/* =========================================================
   ENGINE DO NAVEGADOR
   Mantém o estado da simulação, desenha o mapa no canvas e
   expõe um store (useSyncExternalStore) para a UI em React.
   ========================================================= */
import { CFG, COR_STATUS, NOME_PARQUE, NOME_RIO, PALETA_DIA, PALETA_NOITE, type Palette } from "./config";
import {
  B, COLS, PARK, RIVER_HALF, ROWS, buildRoute, clamp, createWorld, dijkstra, dist, level, riverY,
  stats, stepEV, type Charger, type Connector, type Pt, type Reach, type Route, type World,
} from "./world";
import { clock, fmtDist, fmtMin } from "./format";

export type Mode = "list" | "detail" | "preview" | "nav" | "arrived" | "charging";
export type Filter = "livres" | "rapido" | "ccs2" | "tipo2";
export type TurnIcon = "direita" | "esquerda" | "reto" | "chegada";

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
  zoom: number;
};

export type Insets = { l: number; t: number; r: number; b: number };

const BOLT = typeof Path2D !== "undefined" ? new Path2D("M2.2-6 -3.4 1H0L-1.8 6.4 3.6-.8H0z") : null;
const FONT = '"Hanken Grotesk", system-ui, sans-serif';

export class EVEngine {
  w: World;
  car: Pt & { h: number; batt: number; node: number };
  cam: { x: number; y: number; s: number };
  reach: Reach;
  route: Route | null = null;
  navState: { d: number; seg: number; lastD: number } | null = null;
  P: Palette = PALETA_DIA;
  reduceMotion = false;

  private state: UIState;
  private listeners = new Set<() => void>();
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cw = 0; private ch = 0; private dpr = 1;
  private raf = 0; private last = 0;
  private anim: { from: { x: number; y: number; s: number }; to: { x: number; y: number; s: number }; t0: number; dur: number } | null = null;
  private inertia: { vx: number; vy: number } | null = null;
  private evDrawn: ({ cluster: true; x: number; y: number; r: number; n: number } | { cluster: false; ev: World["evs"][number]; x: number; y: number; r: number })[] = [];
  private bump = new Map<number, number>(); // id -> instante da última mudança (anima o marcador)
  private lastFree = new Map<number, number>();
  private liveTimer: ReturnType<typeof setInterval> | null = null;
  private navEmitT = 0;
  private toastId = 0;
  private flatPaths: { park: Path2D; bldg: Path2D; river: Path2D; minor: Path2D; major: Path2D } | null = null;
  private insetsProvider: () => Insets = () => ({ l: 0, t: 0, r: 0, b: 0 });
  private cleanup: (() => void)[] = [];
  tilted = false;

  constructor() {
    this.w = createWorld();
    const start = this.w.nid(13, 8);
    const n = this.w.nodes[start];
    this.car = { x: n.x, y: n.y, h: -Math.PI / 2, batt: CFG.veiculo.bateriaInicial, node: start };
    this.cam = { x: n.x, y: n.y, s: CFG.zoomInicial };
    this.reach = dijkstra(this.w, start);
    for (const c of this.w.chargers) this.lastFree.set(c.id, stats(c).free);
    this.state = {
      mode: "list", selId: null, filters: [], query: "", showEV: true, follow: true, dark: false,
      batt: this.car.batt, range: this.rangeKm(), rev: 0, nav: null, charge: null, reservation: null,
      toast: null, zoom: this.cam.s,
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
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.buildFlatPaths();
    const onResize = () => this.resize();
    addEventListener("resize", onResize); this.resize();
    this.cleanup.push(() => removeEventListener("resize", onResize));
    this.bindInput(canvas);
    let dark = matchMedia("(prefers-color-scheme: dark)").matches;
    try { const s = localStorage.getItem("evnav-theme"); if (s) dark = s === "dark"; } catch {}
    this.applyTheme(dark);
    this.liveTimer = setInterval(() => this.tickLive(), CFG.intervaloAoVivo);
    requestAnimationFrame(() => {
      Object.assign(this.cam, this.camFor(this.car, CFG.zoomInicial));
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    });
  }
  detach() {
    cancelAnimationFrame(this.raf);
    if (this.liveTimer) clearInterval(this.liveTimer);
    this.cleanup.forEach((f) => f()); this.cleanup = [];
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

  /* ---------------- câmera ---------------- */
  toScreen = (p: Pt) => ({ x: (p.x - this.cam.x) * this.cam.s + this.cw / 2, y: (p.y - this.cam.y) * this.cam.s + this.ch / 2 });
  toWorld = (x: number, y: number) => ({ x: (x - this.cw / 2) / this.cam.s + this.cam.x, y: (y - this.ch / 2) / this.cam.s + this.cam.y });
  viewCenter() { const i = this.insetsProvider(); return { x: (i.l + this.cw - i.r) / 2, y: (i.t + this.ch - i.b) / 2 }; }
  camFor(p: Pt, s: number) { const vc = this.viewCenter(); return { x: p.x - (vc.x - this.cw / 2) / s, y: p.y - (vc.y - this.ch / 2) / s, s }; }
  flyTo(p: Pt, s = this.cam.s, dur = 650) {
    const to = this.camFor(p, clamp(s, CFG.zoomMin, CFG.zoomMax));
    if (this.reduceMotion || !dur) { Object.assign(this.cam, to); return; }
    this.anim = { from: { ...this.cam }, to, t0: performance.now(), dur }; this.inertia = null;
  }
  fitPoints(pts: Pt[], pad = 60) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const i = this.insetsProvider(), w = this.cw - i.l - i.r - pad * 2, h = this.ch - i.t - i.b - pad * 2;
    const s = clamp(Math.min(w / Math.max(x1 - x0, 80), h / Math.max(y1 - y0, 80)), CFG.zoomMin, 1.6);
    this.flyTo({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, s);
  }
  zoomAt(sx: number, sy: number, f: number) {
    const w = this.toWorld(sx, sy);
    this.cam.s = clamp(this.cam.s * f, CFG.zoomMin, CFG.zoomMax);
    this.cam.x = w.x - (sx - this.cw / 2) / this.cam.s; this.cam.y = w.y - (sy - this.ch / 2) / this.cam.s;
    this.anim = null;
  }
  zoomBy(f: number) {
    const vc = this.viewCenter(), w = this.toWorld(vc.x, vc.y);
    this.flyTo(w, this.cam.s * f, 320);
  }
  private clampCam() { this.cam.x = clamp(this.cam.x, -500, COLS * B + 500); this.cam.y = clamp(this.cam.y, -500, ROWS * B + 500); }
  private setFollow(v: boolean) { if (this.state.follow !== v) this.set({ follow: v }); }

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
    if (fly) this.flyTo(c.pos, Math.max(this.cam.s, 0.95));
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
    this.set({ mode: "nav", follow: true });
    this.flyTo(this.car, CFG.zoomNavegacao, 500);
    this.emitNav(true);
  }
  cancelRoute() {
    this.route = null; this.navState = null;
    const sel = this.selected;
    this.set({ mode: sel ? "detail" : "list", nav: null });
    if (sel) this.flyTo(sel.pos, Math.max(this.cam.s, 0.9));
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
    this.set({ dark });
  }
  toggleTheme() { this.applyTheme(!this.state.dark); }
  locate() { this.setFollow(true); this.flyTo(this.car, Math.max(this.cam.s, this.state.mode === "nav" ? CFG.zoomNavegacao : 0.9)); }
  setTilted(v: boolean) { this.tilted = v; }

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
    const target = Math.atan2(b.y - a.y, b.x - a.x);
    let dh = target - car.h;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    car.h += dh * Math.min(1, dt * 8);
    car.batt = Math.max(0, car.batt - ((n.d - n.lastD) / 1000) * CFG.veiculo.consumoKWhKm / CFG.veiculo.bateriaKWh * 100);
    n.lastD = n.d;
    if (this.state.follow) {
      const tc = this.camFor(car, this.cam.s);
      this.cam.x += (tc.x - this.cam.x) * Math.min(1, dt * 5);
      this.cam.y += (tc.y - this.cam.y) * Math.min(1, dt * 5);
    }
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
    else if (toStep > 600) { instr = "Siga em frente"; street = `depois, vire à ${step.dir}`; icon = "reto"; }
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
    const sel = this.selected; if (sel) this.flyTo(sel.pos, 1.5);
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
    const a = this.anim;
    if (a) {
      const k = clamp((now - a.t0) / a.dur, 0, 1), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.cam.s = Math.exp(Math.log(a.from.s) + (Math.log(a.to.s) - Math.log(a.from.s)) * e);
      this.cam.x = a.from.x + (a.to.x - a.from.x) * e; this.cam.y = a.from.y + (a.to.y - a.from.y) * e;
      if (k >= 1) this.anim = null;
    }
    const i = this.inertia;
    if (i) {
      this.cam.x -= (i.vx * 16) / this.cam.s; this.cam.y -= (i.vy * 16) / this.cam.s;
      i.vx *= 0.92; i.vy *= 0.92; this.clampCam();
      if (Math.hypot(i.vx, i.vy) < 0.02) this.inertia = null;
    }
    if (Math.abs(this.state.zoom - this.cam.s) > 0.02) this.set({ zoom: this.cam.s });
    this.draw(now);
    this.raf = requestAnimationFrame(this.frame);
  };

  /* ---------------- desenho ---------------- */
  private buildFlatPaths() {
    const { w } = this;
    const park = new Path2D(), bldg = new Path2D(), river = new Path2D(), minor = new Path2D(), major = new Path2D();
    for (const b of w.blocks) {
      if (b.type === "urban") continue;
      park.moveTo(b.q[0].x, b.q[0].y); for (let k = 1; k < 4; k++) park.lineTo(b.q[k].x, b.q[k].y); park.closePath();
    }
    for (const b of w.buildings) { bldg.moveTo(b.c[0].x, b.c[0].y); for (let k = 1; k < 4; k++) bldg.lineTo(b.c[k].x, b.c[k].y); bldg.closePath(); }
    const x0 = -600, x1 = COLS * B + 600;
    river.moveTo(x0, riverY(x0) - RIVER_HALF);
    for (let x = x0; x <= x1; x += 20) river.lineTo(x, riverY(x) - RIVER_HALF);
    for (let x = x1; x >= x0; x -= 20) river.lineTo(x, riverY(x) + RIVER_HALF);
    river.closePath();
    for (const e of w.edges) { const p = e.major ? major : minor, a = w.nodes[e.a], b = w.nodes[e.b]; p.moveTo(a.x, a.y); p.lineTo(b.x, b.y); }
    this.flatPaths = { park, bldg, river, minor, major };
  }
  private setWorld() { const { ctx, cam, dpr, cw, ch } = this; const s = cam.s * dpr; ctx!.setTransform(s, 0, 0, s, dpr * (cw / 2 - cam.x * cam.s), dpr * (ch / 2 - cam.y * cam.s)); }
  private setScreen() { this.ctx!.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
  private strokeRoads(path: Path2D, px: number, color: string) { const c = this.ctx!; c.lineWidth = px / this.cam.s; c.strokeStyle = color; c.stroke(path); }

  private draw(now: number) {
    if (!this.ctx || !this.flatPaths) return;
    this.drawMap();
    this.setScreen();
    this.drawEVs();
    this.drawChargers(now);
    this.drawCar(now);
  }

  private drawMap() {
    const ctx = this.ctx!, P = this.P, s = this.cam.s, fp = this.flatPaths!;
    this.setScreen(); ctx.fillStyle = P.land; ctx.fillRect(0, 0, this.cw, this.ch);
    this.setWorld();
    ctx.fillStyle = P.park; ctx.fill(fp.park);
    ctx.fillStyle = P.water; ctx.fill(fp.river);
    const flatBldg = s > 0.34 && s < 1.05;
    if (flatBldg) {
      ctx.globalAlpha = clamp((s - 0.34) / 0.3, 0, 1);
      ctx.fillStyle = P.bldg; ctx.fill(fp.bldg); ctx.lineWidth = 1 / s; ctx.strokeStyle = P.bldgEdge; ctx.stroke(fp.bldg);
      ctx.globalAlpha = 1;
    }
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const minorPx = Math.max(1.2, 10 * s), majorPx = Math.max(2.6, 17 * s);
    const mAlpha = clamp((s - 0.16) / 0.18, 0, 1);
    if (mAlpha > 0) { ctx.globalAlpha = mAlpha; this.strokeRoads(fp.minor, minorPx + 2, P.minorCase); ctx.globalAlpha = 1; }
    this.strokeRoads(fp.major, majorPx + 2.4, P.majorCase);
    if (mAlpha > 0) { ctx.globalAlpha = mAlpha; this.strokeRoads(fp.minor, minorPx, P.minor); ctx.globalAlpha = 1; }
    this.strokeRoads(fp.major, majorPx, P.major);
    if (this.route) {
      const r = this.route, n = this.navState;
      const rp = new Path2D();
      if (n) { rp.moveTo(this.car.x, this.car.y); for (let k = n.seg + 1; k < r.pts.length; k++) rp.lineTo(r.pts[k].x, r.pts[k].y); }
      else { rp.moveTo(r.pts[0].x, r.pts[0].y); for (let k = 1; k < r.pts.length; k++) rp.lineTo(r.pts[k].x, r.pts[k].y); }
      const rpx = Math.max(6, 12 * s);
      this.strokeRoads(rp, rpx + 3, P.routeCase); this.strokeRoads(rp, rpx, P.route);
      // setas de direção sobre a rota
      if (s > 0.5) {
        ctx.setLineDash([2 / s, 34 / s]); ctx.lineDashOffset = -(performance.now() / 30) / s;
        this.strokeRoads(rp, Math.max(2.5, 4 * s), "rgba(255,255,255,.85)");
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
      }
    }
    this.setScreen();
    if (s >= 1.05) this.drawBuildings3D();
    this.drawLabels();
  }

  /** prédios 2.5D (extrusão oblíqua) quando o zoom está próximo */
  private drawBuildings3D() {
    const ctx = this.ctx!, P = this.P, s = this.cam.s;
    const alpha = clamp((s - 1.05) / 0.25, 0, 1);
    const k = 0.55 * s; // px de altura por metro
    const vis: { pts: Pt[]; h: number; y: number }[] = [];
    for (const b of this.w.buildings) {
      const c0 = this.toScreen(b.c[0]);
      if (c0.x < -120 || c0.x > this.cw + 120 || c0.y < -200 || c0.y > this.ch + 120) continue;
      vis.push({ pts: b.c.map(this.toScreen), h: b.h * k * 0.6, y: c0.y });
    }
    vis.sort((a, b) => a.y - b.y);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    for (const v of vis) {
      const top = v.pts.map((p) => ({ x: p.x, y: p.y - v.h }));
      // paredes visíveis: as que apontam para baixo na tela
      for (let i = 0; i < 4; i++) {
        const a = v.pts[i], b = v.pts[(i + 1) % 4];
        // normal externa (polígono horário em tela, y para baixo) = (dy, -dx);
        // a extrusão é para cima, então só as faces voltadas para baixo aparecem
        if (-(b.x - a.x) <= 0) continue;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(top[(i + 1) % 4].x, top[(i + 1) % 4].y); ctx.lineTo(top[i].x, top[i].y); ctx.closePath();
        ctx.fillStyle = P.bldgWall; ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(top[0].x, top[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(top[i].x, top[i].y); ctx.closePath();
      ctx.fillStyle = P.bldgTop; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = P.bldgEdge; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private labelText(text: string, x: number, y: number, ang: number, size: number, color: string, weight = 500, italic = false) {
    const ctx = this.ctx!;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${FONT}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 3.5; ctx.strokeStyle = this.P.halo; ctx.lineJoin = "round"; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color; ctx.fillText(text, 0, 0); ctx.restore();
  }
  private drawLabels() {
    const ctx = this.ctx!, s = this.cam.s, P = this.P, { cw, ch, cam, w } = this;
    if (s > 0.28) {
      const step = Math.max(900, 520 / s);
      for (let x = Math.floor((cam.x - cw / s) / step) * step; x < cam.x + cw / s; x += step) {
        const p = this.toScreen({ x: x + step / 2, y: riverY(x + step / 2) });
        if (p.x < -60 || p.x > cw + 60 || p.y < -20 || p.y > ch + 20) continue;
        const d = riverY(x + step / 2 + 10) - riverY(x + step / 2 - 10);
        this.labelText(NOME_RIO, p.x, p.y, Math.atan2(d, 20), 13, P.waterLabel, 600, true);
      }
      const pc = this.toScreen({ x: ((PARK.i0 + PARK.i1) / 2) * B, y: ((PARK.j0 + PARK.j1) / 2) * B });
      if (pc.x > -80 && pc.x < cw + 80) this.labelText(NOME_PARQUE, pc.x, pc.y, 0, 13, P.parkLabel, 600);
    }
    ctx.font = `500 12px ${FONT}`;
    for (const d of ["h", "v"] as const)
      for (const key in w.lines[d]) {
        const arr = w.lines[d][key]; if (!arr.length) continue;
        const major = arr[0].major;
        if (major && s < 0.3) continue;
        if (!major && s < 0.8) continue;
        const k = Math.max(1, Math.ceil((major ? 380 : 300) / (B * s)));
        for (const e of arr) {
          if ((e.idx + +key * 2) % k !== 0) continue;
          const a = this.toScreen(w.nodes[e.a]), b = this.toScreen(w.nodes[e.b]);
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          if (mx < -80 || mx > cw + 80 || my < -30 || my > ch + 30) continue;
          const len = Math.hypot(b.x - a.x, b.y - a.y), tw = ctx.measureText(e.name).width;
          if (len < tw + 16) continue;
          let ang = Math.atan2(b.y - a.y, b.x - a.x);
          if (ang > Math.PI / 2) ang -= Math.PI;
          if (ang < -Math.PI / 2) ang += Math.PI;
          this.labelText(e.name, mx, my, ang, major ? 12.5 : 11.5, P.label, major ? 650 : 500);
        }
      }
  }

  private pinPath(w: number, h: number, top: number) {
    const x0 = -w / 2, x1 = w / 2, y0 = top, y1 = top + h, r = h / 2, p = new Path2D();
    p.moveTo(x0 + r, y0); p.lineTo(x1 - r, y0); p.arc(x1 - r, y0 + r, r, -Math.PI / 2, Math.PI / 2);
    p.lineTo(6, y1); p.lineTo(0, y1 + 7); p.lineTo(-6, y1); p.lineTo(x0 + r, y1);
    p.arc(x0 + r, y0 + r, r, Math.PI / 2, Math.PI * 1.5); p.closePath(); return p;
  }
  private drawChargers(now: number) {
    const ctx = this.ctx!, sel = this.selected, res = this.state.reservation;
    const order = [...this.w.chargers].sort((a, b) => Number(a === sel) - Number(b === sel) || a.pos.y - b.pos.y);
    for (const c of order) {
      const p = this.toScreen(c.pos);
      if (p.x < -40 || p.x > this.cw + 40 || p.y < -50 || p.y > this.ch + 20) continue;
      const lv = level(c), col = COR_STATUS[lv], isSel = c === sel, dim = !this.matches(c) && !isSel;
      ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = dim ? 0.32 : 1;
      if (this.cam.s < 0.26 && !isSel) {
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
    const vis: { c: World["evs"][number]; p: Pt }[] = [];
    for (const c of this.w.evs) { const p = this.toScreen(c); if (p.x < -20 || p.x > this.cw + 20 || p.y < -20 || p.y > this.ch + 20) continue; vis.push({ c, p }); }
    if (this.cam.s < CFG.zoomAgruparEVs) {
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
  private drawEV({ c, p }: { c: World["evs"][number]; p: Pt }) {
    const ctx = this.ctx!;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(c.h);
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -5.5); ctx.lineTo(-3.5, 0); ctx.lineTo(-6, 5.5); ctx.closePath();
    ctx.fillStyle = this.P.ev; ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.lineJoin = "round"; ctx.stroke(); ctx.fill(); ctx.restore();
    this.evDrawn.push({ cluster: false, ev: c, x: p.x, y: p.y, r: 13 });
  }
  private drawCar(now: number) {
    const ctx = this.ctx!, p = this.toScreen(this.car);
    ctx.save(); ctx.translate(p.x, p.y);
    const pu = this.reduceMotion ? 0.5 : (Math.sin(now / 600) + 1) / 2;
    ctx.beginPath(); ctx.arc(0, 0, 20 + pu * 5, 0, 7); ctx.fillStyle = "rgba(200,16,46,.15)"; ctx.fill();
    // cone de direção
    ctx.save(); ctx.rotate(this.car.h);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 60);
    g.addColorStop(0, "rgba(200,16,46,.28)"); g.addColorStop(1, "rgba(200,16,46,0)");
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 60, -0.45, 0.45); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.rotate(this.car.h + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 11); ctx.lineTo(0, 5.5); ctx.lineTo(-10, 11); ctx.closePath();
    ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 6; ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.lineJoin = "round"; ctx.stroke(); ctx.shadowColor = "transparent";
    ctx.fillStyle = "#C8102E"; ctx.fill(); ctx.restore();
  }

  /* ---------------- entrada (arrastar, pinça, roda, toque) ---------------- */
  private bindInput(cv: HTMLCanvasElement) {
    const ptrs = new Map<number, Pt>();
    let drag: { x: number; y: number; sx: number; sy: number; moved: boolean; vx: number; vy: number; t: number } | null = null;
    let pinch: { d0: number; s0: number; w: Pt } | null = null;
    let lastTap = 0;
    const local = (e: PointerEvent | WheelEvent) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, local(e)); this.anim = null; this.inertia = null;
      if (ptrs.size === 1) { const p = local(e); drag = { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, vx: 0, vy: 0, t: performance.now() }; }
      else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), s0: this.cam.s, w: this.toWorld(mid.x, mid.y) }; drag = null;
      }
    };
    const move = (e: PointerEvent) => {
      const p = local(e);
      if (!ptrs.has(e.pointerId)) { if (e.pointerType === "mouse") cv.style.cursor = this.hit(p.x, p.y) ? "pointer" : "grab"; return; }
      ptrs.set(e.pointerId, p);
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.cam.s = clamp((pinch.s0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d0, CFG.zoomMin, CFG.zoomMax);
        this.cam.x = pinch.w.x - (mid.x - this.cw / 2) / this.cam.s; this.cam.y = pinch.w.y - (mid.y - this.ch / 2) / this.cam.s;
        this.setFollow(false); return;
      }
      if (!drag) return;
      const dx = p.x - drag.x, dy = p.y - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t);
      if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) { drag.moved = true; cv.style.cursor = "grabbing"; this.setFollow(false); }
      if (drag.moved) { this.cam.x -= dx / this.cam.s; this.cam.y -= dy / this.cam.s; drag.vx = dx / dt; drag.vy = dy / dt; }
      drag.x = p.x; drag.y = p.y; drag.t = now; this.clampCam();
    };
    const up = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId); cv.style.cursor = "grab";
      if (pinch) { if (ptrs.size < 2) pinch = null; drag = null; return; }
      if (drag) {
        const p = local(e);
        if (!drag.moved && e.type === "pointerup") {
          const now = performance.now();
          if (now - lastTap < 300) { this.zoomAt(p.x, p.y, 2); lastTap = 0; } else { lastTap = now; this.tap(p.x, p.y); }
        } else if (drag.moved && performance.now() - drag.t < 80 && !this.reduceMotion) this.inertia = { vx: drag.vx, vy: drag.vy };
      }
      drag = null;
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); const p = local(e); this.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0016)); this.setFollow(false); };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "+" || e.key === "=") this.zoomBy(1.4);
      if (e.key === "-") this.zoomBy(1 / 1.4);
      if (e.key === "Escape" && this.state.mode === "detail") this.closeDetail();
    };
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", wheel, { passive: false }); addEventListener("keydown", key);
    this.cleanup.push(() => {
      cv.removeEventListener("pointerdown", down); cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up); cv.removeEventListener("pointercancel", up);
      cv.removeEventListener("wheel", wheel); removeEventListener("keydown", key);
    });
  }
  private hitCharger(x: number, y: number) {
    const sel = this.selected;
    for (const c of [...this.w.chargers].reverse()) {
      const p = this.toScreen(c.pos), sc = c === sel ? 1.22 : 1;
      if (Math.hypot(x - p.x, y - (p.y - 22 * sc)) < 24 * sc || Math.hypot(x - p.x, y - p.y) < 12) return c;
    }
    return null;
  }
  private hit(x: number, y: number) {
    if (this.tilted) return false;
    return !!this.hitCharger(x, y) || this.evDrawn.some((d) => Math.hypot(x - d.x, y - d.y) < d.r);
  }
  private tap(x: number, y: number) {
    if (this.tilted) return; // perspectiva 3D ativa: coordenadas de toque não batem com o mapa plano
    const c = this.hitCharger(x, y);
    if (c) { this.selectCharger(c.id); return; }
    let best: (typeof this.evDrawn)[number] | null = null, bd = Infinity;
    for (const d of this.evDrawn) { const dd = Math.hypot(x - d.x, y - d.y); if (dd < d.r && dd < bd) { bd = dd; best = d; } }
    if (best) {
      if (best.cluster) { this.zoomAt(best.x, best.y, 2.2); this.toast(`${best.n} carros elétricos nesta área`); }
      else this.toast(`${best.ev.model}, bateria ${best.ev.batt}%`);
      return;
    }
    if (this.state.mode === "detail") this.closeDetail();
  }
}
