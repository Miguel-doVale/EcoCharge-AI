/* =========================================================
   ENGINE DO NAVEGADOR
   Mapa real (MapLibre + OpenFreeMap/OpenStreetMap) com uma camada
   própria em canvas por cima: carregadores, EVs, carro e rota.
   Mantém o estado da simulação e expõe um store (useSyncExternalStore)
   para a UI em React.
   ========================================================= */
import * as maplibregl from "maplibre-gl";
import { CFG, COR_STATUS, PALETA_DIA, PALETA_NOITE, type Palette } from "./config";
import { clamp, dist, level, stats, type Charger, type Connector, type Pt } from "./world";
import { buildRoute, createRealWorld, dijkstra, stepEV, type Reach, type RealEV, type RealWorld, type RoadData, type Route } from "./realworld";
import { clock, fmtDist, fmtMin } from "./format";

export type Mode = "list" | "detail" | "preview" | "nav" | "arrived" | "charging";
export type Filter = "livres" | "rapido" | "ccs2" | "tipo2";
export type TurnIcon = "direita" | "esquerda" | "retorno" | "reto" | "chegada";

export type NavInfo = {
  dist: string; instr: string; street: string; icon: TurnIcon;
  eta: string; remaining: string; arrival: string; batt: number; progress: number;
};
export type ChargeInfo = { chargerId: number; con: number; type: string; pct: number; kw: number; toFull: string; addedKWh: number; cost: string };
export type Reservation = { chargerId: number; con: number; until: number };

export type UIState = {
  mode: Mode;
  selId: number | null;
  filters: Filter[];
  query: string;
  showEV: boolean;
  follow: boolean;
  dark: boolean;
  batt: number;
  range: number;
  rev: number; // incrementa quando dados ao vivo mudam
  nav: NavInfo | null;
  charge: ChargeInfo | null;
  reservation: Reservation | null;
  toast: { id: number; msg: string } | null;
};

export type Insets = { l: number; t: number; r: number; b: number };

/* estilos de mapa (OpenFreeMap: tiles vetoriais do OpenStreetMap, sem chave) */
const STYLE_DIA = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_NOITE = "https://tiles.openfreemap.org/styles/dark";
const NAV_PITCH = 55;
// worker servido de public/ (copiado por scripts/copy-maplibre-worker.mjs)
if (typeof window !== "undefined") maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
const EARTH = 40075016.686;

const BOLT = typeof Path2D !== "undefined" ? new Path2D("M2.2-6 -3.4 1H0L-1.8 6.4 3.6-.8H0z") : null;
const FONT = '"Hanken Grotesk", system-ui, sans-serif';

export class EVEngine {
  w: RealWorld;
  car: Pt & { h: number; batt: number; node: number };
  reach: Reach;
  route: Route | null = null;
  navState: { d: number; seg: number; lastD: number } | null = null;
  P: Palette = PALETA_DIA;
  reduceMotion = false;

  private state: UIState;
  private listeners = new Set<() => void>();
  private map: maplibregl.Map | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cw = 0; private ch = 0; private dpr = 1;
  private raf = 0; private last = 0;
  private evDrawn: ({ cluster: true; x: number; y: number; r: number; n: number } | { cluster: false; ev: RealEV; x: number; y: number; r: number })[] = [];
  private bump = new Map<number, number>(); // id -> instante da última mudança (anima o marcador)
  private lastFree = new Map<number, number>();
  private liveTimer: ReturnType<typeof setInterval> | null = null;
  private navEmitT = 0;
  private navCamAt = 0; // até quando a câmera de navegação ainda está animando
  private toastId = 0;
  private insetsProvider: () => Insets = () => ({ l: 0, t: 0, r: 0, b: 0 });
  private lastInsetB = -1;
  private cleanup: (() => void)[] = [];

  constructor(data: RoadData) {
    this.w = createRealWorld(data);
    const start = this.w.nearestNode(this.w.start);
    const n = this.w.nodes[start];
    this.car = { x: n.x, y: n.y, h: -Math.PI / 2, batt: CFG.veiculo.bateriaInicial, node: start };
    this.reach = dijkstra(this.w, start);
    for (const c of this.w.chargers) this.lastFree.set(c.id, stats(c).free);
    this.state = {
      mode: "list", selId: null, filters: [], query: "", showEV: true, follow: true, dark: false,
      batt: this.car.batt, range: this.rangeKm(), rev: 0, nav: null, charge: null, reservation: null, toast: null,
    };
  }

  /* ---------------- store ---------------- */
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getState = () => this.state;
  private set(p: Partial<UIState>) { this.state = { ...this.state, ...p }; this.listeners.forEach((l) => l()); }

  get selected(): Charger | null { return this.state.selId == null ? null : this.w.chargers[this.state.selId]; }
  rangeKm() { return (this.car.batt / 100) * CFG.veiculo.bateriaKWh / CFG.veiculo.consumoKWhKm; }
  batteryAfter(m: number) { return this.car.batt - ((m / 1000) * CFG.veiculo.consumoKWhKm / CFG.veiculo.bateriaKWh) * 100; }
  distTo(c: Charger) { return this.reach.dm[c.node] + dist(this.w.nodes[c.node], c.pos); }
  reachable(c: Charger) { const d = this.distTo(c); return isFinite(d) && this.batteryAfter(d) > 3; }

  matches(c: Charger) {
    const f = this.state.filters, s = stats(c);
    if (f.includes("livres") && !s.free) return false;
    if (f.includes("rapido") && s.max < 100) return false;
    if (f.includes("ccs2") && !c.cons.some((x) => x.type === "CCS2")) return false;
    if (f.includes("tipo2") && !c.cons.some((x) => x.type === "Tipo 2")) return false;
    const q = this.state.query;
    if (q && !(c.name + " " + c.op + " " + c.addr).toLowerCase().includes(q)) return false;
    return true;
  }
  list() {
    return this.w.chargers.filter((c) => this.matches(c))
      .map((c) => { const d = this.distTo(c); return { c, d, t: d / CFG.velocidadeMedia }; })
      .sort((a, b) => a.d - b.d);
  }

  /* ---------------- ciclo de vida ---------------- */
  attach(container: HTMLDivElement, canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dark = matchMedia("(prefers-color-scheme: dark)").matches;
    try { const s = localStorage.getItem("evnav-theme"); if (s) dark = s === "dark"; } catch {}

    const [s, w, n, e] = this.w.bbox, padLat = 0.12, padLon = 0.14;
    const map = new maplibregl.Map({
      container,
      style: dark ? STYLE_NOITE : STYLE_DIA,
      center: this.w.toLngLat(this.car),
      zoom: this.zoomFor(CFG.zoomInicial),
      minZoom: 11, maxZoom: 19, maxPitch: 65,
      // a simulação cobre só a região; o mapa deixa explorar a ilha em volta
      maxBounds: [[w - padLon, s - padLat], [e + padLon, n + padLat]],
      attributionControl: false,
      dragRotate: false, pitchWithRotate: false, touchPitch: false,
      fadeDuration: this.reduceMotion ? 0 : 300,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.touchZoomRotate.disableRotation();
    this.map = map;

    const userMove = (ev: { originalEvent?: unknown }) => { if (ev.originalEvent) this.setFollow(false); };
    map.on("dragstart", userMove); map.on("zoomstart", userMove);
    map.on("click", (ev) => this.tap(ev.point.x, ev.point.y));
    map.on("mousemove", (ev) => { map.getCanvas().style.cursor = this.hit(ev.point.x, ev.point.y) ? "pointer" : ""; });
    map.on("load", () => this.flyTo(this.car, CFG.zoomInicial, 0));

    const ro = new ResizeObserver(() => { this.resize(); map.resize(); });
    ro.observe(container); this.resize();
    const key = (ev: KeyboardEvent) => { if (ev.key === "Escape" && this.state.mode === "detail") this.closeDetail(); };
    addEventListener("keydown", key);
    this.cleanup.push(() => { ro.disconnect(); removeEventListener("keydown", key); });

    this.applyTheme(dark);
    this.liveTimer = setInterval(() => this.tickLive(), CFG.intervaloAoVivo);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }
  detach() {
    cancelAnimationFrame(this.raf);
    if (this.liveTimer) clearInterval(this.liveTimer);
    this.cleanup.forEach((f) => f()); this.cleanup = [];
    this.map?.remove(); this.map = null;
    this.canvas = null; this.ctx = null;
  }
  setInsetsProvider(fn: () => Insets) { this.insetsProvider = fn; }

  private resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.cw = r.width || innerWidth; this.ch = r.height || innerHeight;
    this.canvas.width = this.cw * this.dpr; this.canvas.height = this.ch * this.dpr;
  }

  /* ---------------- câmera ----------------
     A escala "s" (pixels por metro) é a unidade usada no CFG; o MapLibre usa zoom. */
  private cosLat() { return Math.cos((this.w.toLngLat(this.car)[1] * Math.PI) / 180); }
  zoomFor(s: number) { return Math.log2((s * EARTH * this.cosLat()) / 512); }
  get scale() { return this.map ? (512 * 2 ** this.map.getZoom()) / (EARTH * this.cosLat()) : CFG.zoomInicial; }
  toScreen = (p: Pt) => { const q = this.map!.project(this.w.toLngLat(p)); return { x: q.x, y: q.y }; };
  private padding() { const i = this.insetsProvider(); return { left: i.l, top: i.t, right: i.r, bottom: i.b }; }
  private dur(ms: number) { return this.reduceMotion ? 0 : ms; }
  private bearingOf(h: number) { return (h * 180) / Math.PI + 90; }

  flyTo(p: Pt, s = this.scale, dur = 650) {
    this.map?.easeTo({ center: this.w.toLngLat(p), zoom: this.zoomFor(clamp(s, CFG.zoomMin, CFG.zoomMax)), padding: this.padding(), duration: this.dur(dur) });
  }
  fitPoints(pts: Pt[], pad = 60) {
    if (!this.map) return;
    const b = new maplibregl.LngLatBounds();
    for (const p of pts) b.extend(this.w.toLngLat(p));
    const i = this.insetsProvider();
    this.map.fitBounds(b, { padding: { left: i.l + pad, top: i.t + pad, right: i.r + pad, bottom: i.b + pad }, maxZoom: this.zoomFor(1.6), duration: this.dur(700) });
  }
  zoomBy(f: number) { const m = this.map; if (m) m.easeTo({ zoom: m.getZoom() + Math.log2(f), duration: this.dur(320) }); }
  private setFollow(v: boolean) { if (this.state.follow !== v) this.set({ follow: v }); }
  private navCamera(dur: number) {
    this.navCamAt = performance.now() + dur;
    this.map?.easeTo({
      center: this.w.toLngLat(this.car), zoom: this.zoomFor(CFG.zoomNavegacao), pitch: NAV_PITCH,
      bearing: this.bearingOf(this.car.h), padding: this.padding(), duration: this.dur(dur),
    });
  }
  private flatCamera() { this.map?.easeTo({ pitch: 0, bearing: 0, padding: this.padding(), duration: this.dur(900) }); }

  /* ---------------- ações (chamadas pela UI) ---------------- */
  toast(msg: string) { this.set({ toast: { id: ++this.toastId, msg } }); }
  selectCharger(id: number, fly = true) {
    if (this.state.mode === "nav" || this.state.mode === "charging") {
      const c = this.w.chargers[id], s = stats(c);
      this.toast(`${c.name}: ${s.free} de ${s.total} livres`); return;
    }
    this.route = null; this.navState = null;
    this.set({ selId: id, mode: "detail", nav: null });
    const c = this.w.chargers[id];
    if (fly) requestAnimationFrame(() => this.flyTo(c.pos, Math.max(this.scale, 0.95)));
  }
  closeDetail() {
    if (this.state.mode === "charging") return;
    this.route = null; this.navState = null;
    this.set({ selId: null, mode: "list", nav: null });
  }
  planRoute() {
    const c = this.selected; if (!c) return;
    const r = buildRoute(this.w, this.car, c);
    if (!r) { this.toast("Não há rota até esse carregador"); return; }
    this.route = r; this.set({ mode: "preview" });
    requestAnimationFrame(() => this.fitPoints(r.pts));
  }
  routeSummary() {
    const r = this.route; if (!r) return null;
    const sec = r.total / CFG.velocidadeMedia;
    return { eta: fmtMin(sec), dist: fmtDist(r.total), arrival: clock(sec), batt: Math.round(this.batteryAfter(r.total)), first: r.first, steps: r.steps, total: r.total };
  }
  startNav() {
    if (!this.route) return;
    this.navState = { d: 0, seg: 0, lastD: 0 };
    const r = this.route;
    if (r.pts.length > 1) this.car.h = Math.atan2(r.pts[1].y - r.pts[0].y, r.pts[1].x - r.pts[0].x);
    this.set({ mode: "nav", follow: true });
    // a UI troca o painel neste quadro; o recuo (padding) da câmera usa o layout novo
    requestAnimationFrame(() => this.navCamera(1100));
    this.emitNav(true);
  }
  cancelRoute() {
    const wasNav = this.state.mode === "nav";
    this.route = null; this.navState = null;
    const sel = this.selected;
    this.set({ mode: sel ? "detail" : "list", nav: null });
    requestAnimationFrame(() => {
      if (wasNav) this.flatCamera();
      if (sel) this.flyTo(sel.pos, Math.max(this.scale, 0.9));
    });
  }
  reserve(n: number) {
    const c = this.selected; if (!c) return;
    const x = c.cons.find((k) => k.n === n);
    if (!x || x.st !== "livre") { this.toast("Esse conector não está mais livre"); return; }
    this.releaseReservation(false);
    x.st = "reservado";
    this.set({ reservation: { chargerId: c.id, con: n, until: Date.now() + CFG.reservaMin * 60_000 }, rev: this.state.rev + 1 });
    this.toast(`Conector ${n} reservado por ${CFG.reservaMin} min`);
  }
  releaseReservation(notify = true) {
    const r = this.state.reservation; if (!r) return;
    const x = this.w.chargers[r.chargerId].cons.find((k) => k.n === r.con);
    if (x && x.st === "reservado") x.st = "livre";
    this.set({ reservation: null, rev: this.state.rev + 1 });
    if (notify) this.toast("Reserva cancelada");
  }
  startCharge(n: number) {
    const c = this.selected; if (!c) return;
    const x = c.cons.find((k) => k.n === n);
    const res = this.state.reservation;
    const mine = res && res.chargerId === c.id && res.con === n;
    if (!x || (x.st !== "livre" && !(mine && x.st === "reservado"))) { this.toast("Esse conector acabou de ser ocupado"); this.set({ rev: this.state.rev + 1 }); return; }
    x.st = "voce";
    this.chargeStart = { batt: this.car.batt, con: x, price: parseFloat(c.price.replace(",", ".")) };
    this.set({ mode: "charging", reservation: mine ? null : res });
    this.emitCharge();
  }
  private chargeStart: { batt: number; con: Connector; price: number } | null = null;
  stopCharge() {
    const cs = this.chargeStart; if (!cs) return;
    cs.con.st = "livre"; this.chargeStart = null;
    this.set({ mode: "detail", charge: null, rev: this.state.rev + 1 });
    this.toast(`Recarga encerrada em ${Math.round(this.car.batt)}%`);
  }
  toggleFilter(f: Filter) {
    const fs = this.state.filters.includes(f) ? this.state.filters.filter((x) => x !== f) : [...this.state.filters, f];
    this.set({ filters: fs });
  }
  setQuery(q: string) {
    const query = q.trim().toLowerCase();
    if (this.state.mode === "list" || this.state.mode === "detail") this.set({ query, mode: "list", selId: null });
    else this.set({ query });
  }
  searchSubmit() { const r = this.list()[0]; if (r) this.selectCharger(r.c.id); }
  toggleEV() { const v = !this.state.showEV; this.set({ showEV: v }); this.toast(v ? "Carros elétricos visíveis" : "Carros elétricos ocultos"); }
  applyTheme(dark: boolean) {
    this.P = dark ? PALETA_NOITE : PALETA_DIA;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem("evnav-theme", dark ? "dark" : "light"); } catch {}
    if (this.map && this.state.dark !== dark) this.map.setStyle(dark ? STYLE_NOITE : STYLE_DIA, { diff: false });
    this.set({ dark });
  }
  toggleTheme() { this.applyTheme(!this.state.dark); }
  locate() {
    this.setFollow(true);
    if (this.state.mode === "nav") this.navCamera(600);
    else this.flyTo(this.car, Math.max(this.scale, 0.9));
  }

  /* ---------------- simulação ---------------- */
  private tickLive() {
    const { w } = this;
    for (const c of w.chargers) for (const x of c.cons) if (x.st === "ocupado") { x.eta -= 0.6; if (x.eta <= 0) { x.st = "livre"; x.eta = 0; } }
    for (let k = 0; k < 3; k++) {
      const c = w.pick(w.chargers), x = w.pick(c.cons);
      if (x.st === "voce" || x.st === "reservado") continue;
      const r = w.R();
      if (x.st === "livre" && r < 0.8) { x.st = "ocupado"; x.eta = 8 + Math.floor(w.R() * 40); }
      else if (x.st === "offline" && r < 0.3) x.st = "livre";
      else if (x.st === "livre" && r > 0.97) x.st = "offline";
    }
    const now = performance.now();
    for (const c of w.chargers) {
      const f = stats(c).free;
      if (f !== this.lastFree.get(c.id)) { this.bump.set(c.id, now); this.lastFree.set(c.id, f); }
    }
    const res = this.state.reservation;
    if (res && Date.now() > res.until) { this.releaseReservation(false); this.toast("Sua reserva expirou"); }
    this.set({ rev: this.state.rev + 1 });
  }

  private stepNav(dt: number) {
    const n = this.navState!, r = this.route!, car = this.car;
    n.d = Math.min(r.total, n.d + dt * CFG.velocidadeSimulacao);
    while (n.seg < r.pts.length - 2 && r.cum[n.seg + 1] <= n.d) n.seg++;
    const a = r.pts[n.seg], b = r.pts[n.seg + 1] || a, segLen = Math.max(1e-6, dist(a, b));
    const t = clamp((n.d - r.cum[n.seg]) / segLen, 0, 1);
    car.x = a.x + (b.x - a.x) * t; car.y = a.y + (b.y - a.y) * t;
    if (segLen > 0.5) {
      const target = Math.atan2(b.y - a.y, b.x - a.x);
      let dh = target - car.h;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      car.h += dh * Math.min(1, dt * 4);
    }
    car.batt = Math.max(0, car.batt - ((n.d - n.lastD) / 1000) * CFG.veiculo.consumoKWhKm / CFG.veiculo.bateriaKWh * 100);
    n.lastD = n.d;
    // câmera de navegação: segue e gira com o carro
    if (this.state.follow && this.map && performance.now() > this.navCamAt)
      this.map.jumpTo({ center: this.w.toLngLat(car), bearing: this.bearingOf(car.h), padding: this.padding() });
    if (n.d >= r.total) this.arrive(); else this.emitNav();
  }
  private emitNav(force = false) {
    const now = performance.now();
    if (!force && now - this.navEmitT < 100) return;
    this.navEmitT = now;
    const r = this.route, n = this.navState; if (!r || !n) return;
    const step = r.steps.find((s) => s.at > n.d + 1) || r.steps[r.steps.length - 1];
    const toStep = step.at - n.d, rem = r.total - n.d;
    let instr: string, street: string, icon: TurnIcon;
    if (step.dir === "chegada") { instr = "Destino à frente"; street = step.street || ""; icon = "chegada"; }
    else if (toStep > 600) { instr = "Siga em frente"; street = step.dir === "retorno" ? "depois, faça o retorno" : `depois, vire à ${step.dir}`; icon = "reto"; }
    else if (step.dir === "retorno") { instr = "Faça o retorno"; street = step.street ? `na ${step.street}` : ""; icon = "retorno"; }
    else { instr = `Vire à ${step.dir}`; street = step.street ? `na ${step.street}` : ""; icon = step.dir; }
    this.set({
      nav: {
        dist: fmtDist(toStep), instr, street, icon, eta: fmtMin(rem / CFG.velocidadeMedia), remaining: fmtDist(rem),
        arrival: clock(rem / CFG.velocidadeMedia), batt: Math.round(this.batteryAfter(rem)), progress: n.d / r.total,
      },
      batt: this.car.batt, range: this.rangeKm(),
    });
  }
  private arrive() {
    this.car.node = this.w.nearestNode(this.car);
    this.reach = dijkstra(this.w, this.car.node);
    this.route = null; this.navState = null;
    this.set({ mode: "arrived", nav: null });
    const sel = this.selected;
    requestAnimationFrame(() => {
      this.flatCamera();
      if (sel) this.flyTo(sel.pos, 1.5, 900);
    });
  }
  private stepCharge(dt: number) {
    const cs = this.chargeStart; if (!cs || this.car.batt >= 100) return;
    const eff = this.car.batt < 80 ? cs.con.kw : cs.con.kw * 0.35;
    this.car.batt = Math.min(100, this.car.batt + (eff * dt / 3600 / CFG.veiculo.bateriaKWh) * 100 * CFG.aceleracaoRecarga);
    this.emitCharge();
  }
  private emitCharge() {
    const cs = this.chargeStart; if (!cs) return;
    const b = this.car.batt, kw = cs.con.kw, cap = CFG.veiculo.bateriaKWh;
    const eff = b < 80 ? kw : kw * 0.35;
    const toFull = b >= 100 ? 0 : (((80 - Math.min(b, 80)) / 100) * cap / kw + ((100 - Math.max(b, 80)) / 100) * cap / (kw * 0.35)) * 3600;
    const added = ((b - cs.batt) / 100) * cap;
    this.set({
      charge: {
        chargerId: this.state.selId!, con: cs.con.n, type: cs.con.type, pct: b, kw: Math.round(eff * 10) / 10,
        toFull: b >= 100 ? "bateria cheia" : `cheia em ${fmtMin(toFull)}`, addedKWh: added,
        cost: (added * cs.price).toFixed(2).replace(".", ","),
      },
      batt: b, range: this.rangeKm(),
    });
  }

  /* ---------------- loop ---------------- */
  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    for (const c of this.w.evs) stepEV(this.w, c, dt);
    if (this.state.mode === "nav" && this.navState) this.stepNav(dt);
    if (this.state.mode === "charging") this.stepCharge(dt);
    // a atribuição do mapa sobe junto com o painel inferior (celular)
    const ib = Math.round(this.insetsProvider().b);
    if (ib !== this.lastInsetB && this.map) { this.lastInsetB = ib; this.map.getContainer().style.setProperty("--map-inset-b", ib + "px"); }
    this.draw(now);
    this.raf = requestAnimationFrame(this.frame);
  };

  /* ---------------- desenho (camada própria sobre o mapa) ---------------- */
  private draw(now: number) {
    const ctx = this.ctx; if (!ctx || !this.map) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cw, this.ch);
    this.drawRoute(now);
    this.drawEVs();
    this.drawChargers(now);
    this.drawCar(now);
  }
  private onScreen(p: Pt, m = 40) { return p.x > -m && p.x < this.cw + m && p.y > -m && p.y < this.ch + m; }
  /** direção na tela de um rumo h no mapa (considera giro e inclinação) */
  private screenAngle(p: Pt, h: number, sp: Pt) {
    const q = this.toScreen({ x: p.x + Math.cos(h) * 8, y: p.y + Math.sin(h) * 8 });
    return Math.atan2(q.y - sp.y, q.x - sp.x);
  }

  private drawRoute(now: number) {
    const r = this.route; if (!r) return;
    const ctx = this.ctx!, P = this.P, n = this.navState;
    const path = new Path2D();
    const start = n ? n.seg + 1 : 1, p0 = this.toScreen(n ? this.car : r.pts[0]);
    path.moveTo(p0.x, p0.y);
    for (let k = start; k < r.pts.length; k++) { const p = this.toScreen(r.pts[k]); path.lineTo(p.x, p.y); }
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const wpx = n ? 11 : 8;
    ctx.lineWidth = wpx + 4; ctx.strokeStyle = P.routeCase; ctx.stroke(path);
    ctx.lineWidth = wpx; ctx.strokeStyle = P.route; ctx.stroke(path);
    // setas de direção sobre a rota
    ctx.setLineDash([2, 30]); ctx.lineDashOffset = this.reduceMotion ? 0 : -now / 30;
    ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.stroke(path);
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }

  private pinPath(w: number, h: number, top: number) {
    const x0 = -w / 2, x1 = w / 2, y0 = top, y1 = top + h, r = h / 2, p = new Path2D();
    p.moveTo(x0 + r, y0); p.lineTo(x1 - r, y0); p.arc(x1 - r, y0 + r, r, -Math.PI / 2, Math.PI / 2);
    p.lineTo(6, y1); p.lineTo(0, y1 + 7); p.lineTo(-6, y1); p.lineTo(x0 + r, y1);
    p.arc(x0 + r, y0 + r, r, Math.PI / 2, Math.PI * 1.5); p.closePath(); return p;
  }
  private drawChargers(now: number) {
    const ctx = this.ctx!, sel = this.selected, res = this.state.reservation, s = this.scale;
    const pts = this.w.chargers.map((c) => ({ c, p: this.toScreen(c.pos) }));
    pts.sort((a, b) => Number(a.c === sel) - Number(b.c === sel) || a.p.y - b.p.y);
    for (const { c, p } of pts) {
      if (!this.onScreen(p, 50)) continue;
      const lv = level(c), col = COR_STATUS[lv], isSel = c === sel, dim = !this.matches(c) && !isSel;
      ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = dim ? 0.32 : 1;
      if (s < 0.26 && !isSel) {
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke(); ctx.restore(); continue;
      }
      const bt = this.bump.get(c.id);
      if (bt && !this.reduceMotion) {
        const k = (now - bt) / 500;
        if (k < 1) { const sc = 1 + 0.28 * Math.sin(k * Math.PI) * (1 - k); ctx.scale(sc, sc); }
      }
      if (isSel) {
        const pu = this.reduceMotion ? 0 : (now / 900) % 1;
        ctx.beginPath(); ctx.arc(0, 0, 8 + pu * 16, 0, 7); ctx.fillStyle = col; ctx.globalAlpha = 0.3 * (1 - pu); ctx.fill(); ctx.globalAlpha = 1; ctx.scale(1.22, 1.22);
      }
      const n = stats(c).free, w = n > 9 ? 44 : 38, path = this.pinPath(w, 24, -34);
      ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.stroke(path);
      ctx.shadowColor = "transparent"; ctx.fillStyle = col; ctx.fill(path);
      ctx.save(); ctx.translate(-w / 2 + 12, -22); ctx.fillStyle = "#fff"; if (BOLT) ctx.fill(BOLT); ctx.restore();
      ctx.fillStyle = "#fff"; ctx.font = `800 14px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(n), 5, -21.5);
      if (res && res.chargerId === c.id) {
        ctx.beginPath(); ctx.arc(w / 2 - 2, -34, 6, 0, 7); ctx.fillStyle = this.P.route; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
      }
      ctx.restore();
    }
  }
  private drawEVs() {
    this.evDrawn = [];
    if (!this.state.showEV) return;
    const ctx = this.ctx!, P = this.P;
    const vis: { c: RealEV; p: Pt }[] = [];
    for (const c of this.w.evs) { const p = this.toScreen(c); if (this.onScreen(p, 20)) vis.push({ c, p }); }
    if (this.scale < CFG.zoomAgruparEVs) {
      const cell = 64, g = new Map<string, typeof vis>();
      for (const v of vis) { const k = Math.floor(v.p.x / cell) + "," + Math.floor(v.p.y / cell); let arr = g.get(k); if (!arr) g.set(k, (arr = [])); arr.push(v); }
      for (const arr of g.values()) {
        if (arr.length === 1) { this.drawEV(arr[0]); continue; }
        const x = arr.reduce((a, v) => a + v.p.x, 0) / arr.length, y = arr.reduce((a, v) => a + v.p.y, 0) / arr.length, r = 11 + Math.sqrt(arr.length) * 2.2;
        ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 7); ctx.fillStyle = P.ev; ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1;
        ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = P.ev; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = `700 12px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(arr.length), x, y + 0.5);
        this.evDrawn.push({ cluster: true, x, y, r: r + 4, n: arr.length });
      }
    } else vis.forEach((v) => this.drawEV(v));
  }
  private drawEV({ c, p }: { c: RealEV; p: Pt }) {
    const ctx = this.ctx!;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(this.screenAngle(c, c.h, p));
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -5.5); ctx.lineTo(-3.5, 0); ctx.lineTo(-6, 5.5); ctx.closePath();
    ctx.fillStyle = this.P.ev; ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.lineJoin = "round"; ctx.stroke(); ctx.fill(); ctx.restore();
    this.evDrawn.push({ cluster: false, ev: c, x: p.x, y: p.y, r: 13 });
  }
  private drawCar(now: number) {
    const ctx = this.ctx!, p = this.toScreen(this.car), ang = this.screenAngle(this.car, this.car.h, p);
    ctx.save(); ctx.translate(p.x, p.y);
    const pu = this.reduceMotion ? 0.5 : (Math.sin(now / 600) + 1) / 2;
    ctx.beginPath(); ctx.arc(0, 0, 20 + pu * 5, 0, 7); ctx.fillStyle = "rgba(200,16,46,.15)"; ctx.fill();
    // cone de direção
    ctx.save(); ctx.rotate(ang);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 60);
    g.addColorStop(0, "rgba(200,16,46,.28)"); g.addColorStop(1, "rgba(200,16,46,0)");
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 60, -0.45, 0.45); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.rotate(ang + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 11); ctx.lineTo(0, 5.5); ctx.lineTo(-10, 11); ctx.closePath();
    ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 6; ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.lineJoin = "round"; ctx.stroke(); ctx.shadowColor = "transparent";
    ctx.fillStyle = "#C8102E"; ctx.fill(); ctx.restore();
  }

  /* ---------------- toque ---------------- */
  private hitCharger(x: number, y: number) {
    const sel = this.selected;
    for (const c of [...this.w.chargers].reverse()) {
      const p = this.toScreen(c.pos), sc = c === sel ? 1.22 : 1;
      if (Math.hypot(x - p.x, y - (p.y - 22 * sc)) < 24 * sc || Math.hypot(x - p.x, y - p.y) < 12) return c;
    }
    return null;
  }
  private hit(x: number, y: number) {
    return !!this.hitCharger(x, y) || this.evDrawn.some((d) => Math.hypot(x - d.x, y - d.y) < d.r);
  }
  private tap(x: number, y: number) {
    const c = this.hitCharger(x, y);
    if (c) { this.selectCharger(c.id); return; }
    let best: (typeof this.evDrawn)[number] | null = null, bd = Infinity;
    for (const d of this.evDrawn) { const dd = Math.hypot(x - d.x, y - d.y); if (dd < d.r && dd < bd) { bd = dd; best = d; } }
    if (best) {
      if (best.cluster) {
        const m = this.map!; m.easeTo({ center: m.unproject([best.x, best.y]), zoom: m.getZoom() + 1.2, duration: this.dur(450) });
        this.toast(`${best.n} carros elétricos nesta área`);
      } else this.toast(`${best.ev.model}, bateria ${best.ev.batt}%`);
      return;
    }
    if (this.state.mode === "detail") this.closeDetail();
  }
}
