/* =========================================================
   MUNDO REAL: malha viária de São Luís (OpenStreetMap) + carregadores
   simulados em pontos reais da cidade. Os dados vêm de
   public/data/saoluis-roads.json (gerado por scripts/build-saoluis-map.mjs).
   Coordenadas internas em metros: x = leste, y = sul (como a tela).
   ========================================================= */
import { CFG, MODELOS_EV } from "./config";
import { chargerProfile, clamp, dist, mulberry, type Charger, type Pt } from "./world";

export type RoadData = {
  ref: { lat: number; lon: number };
  bbox: [number, number, number, number];
  names: string[];
  nodes: number[]; // x0,y0,x1,y1…
  edges: [number, number, number, number, number, number[]][]; // a, b, classe, nome, mão única, geometria interna
};

export type Road = { a: number; b: number; cls: number; major: boolean; name: string | null; oneway: boolean; pts: Pt[]; cl: number[]; len: number };
export type Link = { to: number; ei: number; fwd: boolean };
export type Leg = { ei: number; fwd: boolean };
/** EV da frota. "livre" circula; "indo" segue a rota da EcoCharge AI até um posto;
    "fila" espera um conector; "carregando" está no posto (some do mapa). */
export type RealEV = {
  id: number; ei: number; fwd: boolean; s: number; prev: number; speed: number; model: string; batt: number; x: number; y: number; h: number;
  mode: "livre" | "indo" | "fila" | "carregando"; target?: number; legs?: Leg[]; leg?: number; arrived?: boolean; since?: number;
};

/** velocidade média por classe de via (m/s): arterial, coletora, local-principal, local */
const SPEED = [15, 12, 10, 7];

/* Carregadores simulados em lugares reais da região (lat, lon, bairro). */
// `street` fixa o endereço quando a rua mais próxima no cálculo não é a de acesso
const PLACES: { name: string; lat: number; lon: number; bairro: string; street?: string }[] = [
  { name: "Estacionamento UNDB", lat: -2.49799, lon: -44.28455, bairro: "Renascença", street: "Rua Júpiter" },
  { name: "Tropical Shopping", lat: -2.50118, lon: -44.2875, bairro: "Renascença" },
  { name: "São Luís Shopping", lat: -2.51103, lon: -44.28531, bairro: "Jaracati" },
  { name: "Jaracati Shopping", lat: -2.50666, lon: -44.284, bairro: "Jaracati" },
  { name: "Lagoa da Jansen", lat: -2.49643, lon: -44.29265, bairro: "Ponta d'Areia" },
  { name: "Praça dos Pescadores", lat: -2.48808, lon: -44.29286, bairro: "Ponta d'Areia" },
  { name: "Ponta d'Areia · Orla", lat: -2.49105, lon: -44.3037, bairro: "Ponta d'Areia" },
  { name: "Hiper Mateus Renascença", lat: -2.50383, lon: -44.28845, bairro: "Renascença" },
  { name: "Mateus Food Service", lat: -2.50887, lon: -44.3007, bairro: "São Francisco" },
  { name: "Castelo Branco", lat: -2.5162, lon: -44.3042, bairro: "São Francisco" },
  { name: "Rangedor Mall", lat: -2.49333, lon: -44.26404, bairro: "Calhau" },
  { name: "Parque do Rangedor", lat: -2.49881, lon: -44.26232, bairro: "Cohafuma" },
  { name: "Mirante da Litorânea", lat: -2.48789, lon: -44.27197, bairro: "Calhau" },
  { name: "Praia do Calhau", lat: -2.48371, lon: -44.25845, bairro: "Calhau" },
  { name: "Pátio Calhau", lat: -2.50326, lon: -44.26214, bairro: "Calhau" },
  { name: "Mateus Calhau", lat: -2.49099, lon: -44.25493, bairro: "Calhau" },
];
/** ponto de partida do carro: UNDB, Renascença */
export const START = { lat: -2.49962, lon: -44.28685 };

export function createRealWorld(data: RoadData, seed = CFG.seed) {
  const R = mulberry(seed);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(R() * a.length)];
  const { ref } = data;
  const KX = 111320 * Math.cos((ref.lat * Math.PI) / 180), KY = 110574;
  const fromLngLat = (lon: number, lat: number): Pt => ({ x: (lon - ref.lon) * KX, y: (ref.lat - lat) * KY });
  const toLngLat = (p: Pt): [number, number] => [ref.lon + p.x / KX, ref.lat - p.y / KY];

  const nodes: Pt[] = [];
  for (let k = 0; k < data.nodes.length; k += 2) nodes.push({ x: data.nodes[k], y: data.nodes[k + 1] });

  const edges: Road[] = data.edges.map(([a, b, cls, nm, ow, g]) => {
    const pts: Pt[] = [nodes[a]];
    for (let k = 0; k < g.length; k += 2) pts.push({ x: g[k], y: g[k + 1] });
    pts.push(nodes[b]);
    const cl = [0];
    for (let k = 1; k < pts.length; k++) cl.push(cl[k - 1] + dist(pts[k - 1], pts[k]));
    return { a, b, cls, major: cls <= 1, name: nm >= 0 ? data.names[nm] : null, oneway: !!ow, pts, cl, len: Math.max(1, cl[cl.length - 1]) };
  });

  // adjacência dirigida (respeita mão única)
  const adj: Link[][] = nodes.map(() => []);
  edges.forEach((e, ei) => {
    adj[e.a].push({ to: e.b, ei, fwd: true });
    if (!e.oneway) adj[e.b].push({ to: e.a, ei, fwd: false });
  });

  const nearestNode = (p: Pt) => {
    let best = 0, bd = Infinity;
    for (let k = 0; k < nodes.length; k++) {
      if (!adj[k].length) continue;
      const d = (nodes[k].x - p.x) ** 2 + (nodes[k].y - p.y) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  };
  /** nome da rua mais próxima de um ponto (para o endereço do posto) */
  const streetNear = (p: Pt) => {
    let best: string | null = null, bd = Infinity;
    for (const e of edges) {
      if (!e.name) continue;
      for (let k = 0; k < e.pts.length - 1; k++) {
        const d = segDist(p, e.pts[k], e.pts[k + 1]);
        if (d < bd) { bd = d; best = e.name; }
      }
    }
    return best;
  };

  /* ---------- carregadores ---------- */
  const chargers: Charger[] = PLACES.map((pl, id) => {
    const pos = fromLngLat(pl.lon, pl.lat);
    const street = pl.street ?? streetNear(pos);
    return { id, name: pl.name, addr: street ? `${street} · ${pl.bairro}` : pl.bairro, pos, node: nearestNode(pos), ...chargerProfile(R) };
  });

  /* ---------- EVs circulando pelas ruas ---------- */
  const evs: RealEV[] = [];
  for (let k = 0; k < CFG.qtdEVsCidade; k++) {
    let ei = Math.floor(R() * edges.length);
    for (let g = 0; g < 20 && edges[ei].cls === 3 && R() < 0.6; g++) ei = Math.floor(R() * edges.length); // mais EVs nas avenidas
    const e = edges[ei], fwd = e.oneway || R() < 0.5;
    evs.push({ id: k, ei, fwd, s: R() * e.len, prev: fwd ? e.a : e.b, speed: 6 + R() * 8, model: pick(MODELOS_EV), batt: 15 + R() * 80, x: 0, y: 0, h: 0, mode: "livre" });
  }

  return { R, pick, nodes, edges, adj, nearestNode, chargers, evs, toLngLat, fromLngLat, start: fromLngLat(START.lon, START.lat), bbox: data.bbox };
}
export type RealWorld = ReturnType<typeof createRealWorld>;

function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / L, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** ponto e direção a uma distância s ao longo de um trecho */
export function along(e: Road, s: number, fwd: boolean) {
  const d = clamp(fwd ? s : e.len - s, 0, e.len);
  let k = 1;
  while (k < e.cl.length - 1 && e.cl[k] < d) k++;
  const a = e.pts[k - 1], b = e.pts[k], seg = Math.max(1e-6, e.cl[k] - e.cl[k - 1]), t = clamp((d - e.cl[k - 1]) / seg, 0, 1);
  const h = fwd ? Math.atan2(b.y - a.y, b.x - a.x) : Math.atan2(a.y - b.y, a.x - b.x);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h };
}

/* ---------- roteamento (Dijkstra por tempo, respeitando mão única) ---------- */
type HeapItem = [number, number];
function heapPush(h: HeapItem[], x: HeapItem) {
  h.push(x); let i = h.length - 1;
  while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; }
}
function heapPop(h: HeapItem[]) {
  const top = h[0], last = h.pop()!;
  if (h.length) {
    h[0] = last; let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < h.length && h[l][0] < h[m][0]) m = l;
      if (r < h.length && h[r][0] < h[m][0]) m = r;
      if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m;
    }
  }
  return top;
}
export function dijkstra(w: RealWorld, src: number) {
  const n = w.nodes.length;
  const t = new Float64Array(n).fill(Infinity), dm = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1), via = new Int32Array(n).fill(-1), viaFwd = new Uint8Array(n);
  t[src] = 0; dm[src] = 0; const h: HeapItem[] = [[0, src]];
  while (h.length) {
    const [tu, u] = heapPop(h);
    if (tu > t[u]) continue;
    for (const { to, ei, fwd } of w.adj[u]) {
      const e = w.edges[ei], nt = tu + e.len / SPEED[e.cls];
      if (nt < t[to]) { t[to] = nt; dm[to] = dm[u] + e.len; prev[to] = u; via[to] = ei; viaFwd[to] = fwd ? 1 : 0; heapPush(h, [nt, to]); }
    }
  }
  return { t, dm, prev, via, viaFwd };
}
export type Reach = ReturnType<typeof dijkstra>;

export type Step = { at: number; dir: "direita" | "esquerda" | "retorno" | "chegada"; street: string | null };
export type Route = { c: Charger; pts: Pt[]; cum: number[]; total: number; steps: Step[]; first: string | null };

export function buildRoute(w: RealWorld, from: Pt, c: Charger): Route | null {
  const src = w.nearestNode(from), r = dijkstra(w, src);
  if (!isFinite(r.t[c.node])) return null;
  const legs: { ei: number; fwd: boolean }[] = [];
  for (let k = c.node; k !== src; k = r.prev[k]) legs.push({ ei: r.via[k], fwd: !!r.viaFwd[k] });
  legs.reverse();

  const pts: Pt[] = [];
  const push = (p: Pt) => { const l = pts[pts.length - 1]; if (!l || dist(l, p) > 0.5) pts.push({ x: p.x, y: p.y }); };
  push(from);
  const legEnd: { idx: number; name: string | null }[] = []; // último ponto de cada trecho (para saber o nome da rua)
  legs.forEach((lg) => {
    const e = w.edges[lg.ei], seq = lg.fwd ? e.pts : [...e.pts].reverse();
    seq.forEach(push);
    legEnd.push({ idx: pts.length - 1, name: e.name });
  });
  push(c.pos);
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + dist(pts[k], pts[k - 1]));
  const total = cum[cum.length - 1];

  // ponto da rota a uma distância d (para medir o ângulo de cada cruzamento)
  const at = (d: number) => {
    d = clamp(d, 0, total);
    let k = 1; while (k < cum.length - 1 && cum[k] < d) k++;
    const a = pts[k - 1], b = pts[k], t = (d - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  // fim de cada trecho em metros → nome da rua em qualquer ponto da rota
  const nameAt = (d: number) => { let k = 0; while (k < legEnd.length - 1 && cum[legEnd[k].idx] < d) k++; return legEnd[k]?.name ?? null; };

  // manobras pela mudança de direção ao longo da rota (pega curvas nos cruzamentos
  // e também retornos e alças que fazem a volta dentro de um mesmo trecho)
  const W = 20, STEP = 4;
  const angle = (v1: Pt, v2: Pt) => Math.atan2(v1.x * v2.y - v1.y * v2.x, v1.x * v2.x + v1.y * v2.y);
  const turnAt = (d: number) => {
    const a = at(d - W), p = at(d), b = at(d + W);
    return angle({ x: p.x - a.x, y: p.y - a.y }, { x: b.x - p.x, y: b.y - p.y });
  };
  /** direção da rua bem antes × bem depois da manobra: ~180° = retorno */
  const reversal = (d: number) => {
    const a0 = at(d - 60), a1 = at(d - 35), b0 = at(d + 35), b1 = at(d + 60);
    return Math.abs(angle({ x: a1.x - a0.x, y: a1.y - a0.y }, { x: b1.x - b0.x, y: b1.y - b0.y }));
  };
  const steps: Step[] = [];
  let best: { d: number; ang: number } | null = null;
  const flush = () => {
    if (!best) return;
    const { d, ang } = best; best = null;
    const before = nameAt(d - W - 5), after = nameAt(d + W + 5);
    const uturn = Math.abs(ang) > 2.3 || (Math.abs(ang) > 1 && reversal(d) > 2.6);
    // curvas suaves da mesma avenida não viram instrução
    if (!uturn && before && before === after && Math.abs(ang) < 1.2) return;
    // alça de retorno costuma não ter nome: usa a avenida de onde se vem
    let dir: Step["dir"] = uturn ? "retorno" : ang > 0 ? "direita" : "esquerda", street = uturn ? before ?? nameAt(d - 80) : after;
    const last = steps[steps.length - 1];
    if (last && last.dir !== "chegada" && d - last.at < 45) {
      if (last.dir === "retorno") return; // a saída do retorno não é outra manobra
      // duas viradas coladas para o mesmo lado = atravessar o canteiro (retorno)
      if (last.dir === dir || dir === "retorno") { steps.pop(); dir = "retorno"; street = nameAt(last.at - W - 5) ?? nameAt(last.at - 80); }
      else if (d - last.at < 30) steps.pop(); // viradas coladas = uma manobra só
    }
    steps.push({ at: d, dir, street });
  };
  for (let d = W; d < total - 15; d += STEP) {
    const a = turnAt(d);
    if (Math.abs(a) > 0.65) { if (!best || Math.abs(a) > Math.abs(best.ang)) best = { d, ang: a }; }
    else flush();
  }
  flush();
  steps.push({ at: total, dir: "chegada", street: c.name });
  const first = legs.map((l) => w.edges[l.ei].name).find(Boolean) ?? null;
  return { c, pts, cum, total, steps, first };
}

/** trechos do caminho mais rápido de `src` até `dst` (resultado de dijkstra a partir de src) */
export function legsTo(r: Reach, src: number, dst: number): Leg[] | null {
  if (!isFinite(r.t[dst])) return null;
  const legs: Leg[] = [];
  for (let k = dst; k !== src; k = r.prev[k]) legs.push({ ei: r.via[k], fwd: !!r.viaFwd[k] });
  return legs.reverse();
}

export function stepEV(w: RealWorld, c: RealEV, dt: number) {
  if (c.mode === "fila" || c.mode === "carregando") return;
  c.s += c.speed * dt;
  let e = w.edges[c.ei];
  while (c.s >= e.len) {
    // seguindo a rota da EcoCharge AI até o posto
    if (c.legs) {
      if (c.leg! + 1 >= c.legs.length) { c.s = e.len; c.arrived = true; break; }
      c.s -= e.len; c.leg!++;
      const lg = c.legs[c.leg!]; c.ei = lg.ei; c.fwd = lg.fwd; e = w.edges[c.ei];
      continue;
    }
    c.s -= e.len;
    const end = c.fwd ? e.b : e.a;
    const opts = w.adj[end].filter((o) => o.ei !== c.ei);
    const nx = opts.length ? w.pick(opts) : w.adj[end][0];
    c.prev = end; c.ei = nx.ei; c.fwd = nx.fwd; e = w.edges[c.ei];
  }
  const p = along(e, c.s, c.fwd);
  c.x = p.x; c.y = p.y; c.h = p.h;
}
