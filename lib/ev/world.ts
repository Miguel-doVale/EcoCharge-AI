/* =========================================================
   MUNDO SIMULADO: cidade, malha viária, carregadores, EVs.
   Tudo aqui é substituível por dados reais (MapLibre + OCPI),
   ver GUIA-MANUTENCAO.md.
   ========================================================= */
import {
  CFG, COMODIDADES, MODELOS_EV, NOMES_AV_H, NOMES_AV_V, NOMES_CARREGADORES,
  NOMES_RUAS, OPERADORAS,
} from "./config";

export type Pt = { x: number; y: number };
export type Node = Pt & { i: number; j: number };
export type Edge = {
  a: number; b: number; len: number; major: boolean; name: string;
  dir: "h" | "v"; line: number; idx: number; bridge?: boolean;
};
export type ConnectorType = "CCS2" | "CHAdeMO" | "GB/T" | "Tipo 2";
export type ConnectorStatus = "livre" | "ocupado" | "offline" | "reservado" | "voce";
export type Connector = { n: number; type: ConnectorType; kw: number; st: ConnectorStatus; eta: number; ev?: number /* EV da frota ocupando */ };
export type Charger = {
  id: number; name: string; op: string; addr: string; pos: Pt; node: number;
  cons: Connector[]; price: string; open24: boolean; amenities: string[];
  /** ocupação típica por hora (0..1), estilo "horários de pico" */
  busyCurve: number[]; rating: number;
};
export type EV = { u: number; v: number; e: Edge; t: number; speed: number; model: string; batt: number; x: number; y: number; h: number };
export type Level = "ok" | "warn" | "full" | "off";

export function mulberry(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export const B = CFG.quadra, COLS = CFG.colunas, ROWS = CFG.linhas, RIVER = 11;
const BRIDGES = new Set([0, 5, 8, 10, 15, 18, 20, 22, 25]);
export const PARK = { i0: 2, i1: 5, j0: 15, j1: 18 };
const SQUARES = new Set(["9,4", "20,6", "16,18", "12,2"]);
const isMajorCol = (i: number) => i % 5 === 0;
const isMajorRow = (j: number) => j % 4 === 0;
export const riverY = (x: number) => (RIVER + 0.5) * B + 18 * Math.sin(x / 310) + 6 * Math.sin(x / 113 + 1);
export const RIVER_HALF = 30;
export const colName = (i: number) => NOMES_AV_V[i] || NOMES_RUAS[i % NOMES_RUAS.length];
export const rowName = (j: number) => NOMES_AV_H[j] || NOMES_RUAS[(j + 17) % NOMES_RUAS.length];

function bil(q: Pt[], u: number, v: number): Pt {
  return {
    x: (1 - u) * (1 - v) * q[0].x + u * (1 - v) * q[1].x + u * v * q[2].x + (1 - u) * v * q[3].x,
    y: (1 - u) * (1 - v) * q[0].y + u * (1 - v) * q[1].y + u * v * q[2].y + (1 - u) * v * q[3].y,
  };
}

export type Building = { c: Pt[]; h: number };
export type Block = { i: number; j: number; q: Pt[]; type: "urban" | "park" | "orla" };

export function createWorld(seed = CFG.seed) {
  const R = mulberry(seed);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(R() * a.length)];

  const nodes: Node[] = [];
  const nid = (i: number, j: number) => j * (COLS + 1) + i;
  for (let j = 0; j <= ROWS; j++)
    for (let i = 0; i <= COLS; i++) {
      const jx = isMajorCol(i) ? 0 : (R() - 0.5) * 28;
      const jy = isMajorRow(j) ? 0 : j === RIVER ? (R() - 0.5) * 6 : (R() - 0.5) * 28;
      nodes.push({ x: i * B + jx, y: j * B + jy, i, j });
    }

  const edges: Edge[] = [];
  const adj: { to: number; e: Edge }[][] = nodes.map(() => []);
  const edgeByKey = new Map<string, Edge>();
  const addEdge = (a: number, b: number, o: Omit<Edge, "a" | "b" | "len">) => {
    const e: Edge = { a, b, len: dist(nodes[a], nodes[b]), ...o };
    edges.push(e); adj[a].push({ to: b, e }); adj[b].push({ to: a, e });
    edgeByKey.set(a < b ? a + "-" + b : b + "-" + a, e);
  };
  const inParkH = (i: number, j: number) => j > PARK.j0 && j < PARK.j1 && i >= PARK.i0 && i < PARK.i1;
  const inParkV = (i: number, j: number) => i > PARK.i0 && i < PARK.i1 && j >= PARK.j0 && j < PARK.j1;
  for (let j = 0; j <= ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const major = isMajorRow(j);
      if (inParkH(i, j)) continue;
      if (!major && j > 0 && j < ROWS && j !== RIVER && R() < 0.05) continue;
      addEdge(nid(i, j), nid(i + 1, j), { major, name: rowName(j), dir: "h", line: j, idx: i });
    }
  for (let i = 0; i <= COLS; i++)
    for (let j = 0; j < ROWS; j++) {
      const major = isMajorCol(i);
      if (j === RIVER && !BRIDGES.has(i)) continue;
      if (inParkV(i, j)) continue;
      if (!major && i > 0 && i < COLS && j !== RIVER && R() < 0.05) continue;
      addEdge(nid(i, j), nid(i, j + 1), { major, name: colName(i), dir: "v", line: i, idx: j, bridge: j === RIVER });
    }

  const blocks: Block[] = [];
  const buildings: Building[] = [];
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const q = [nodes[nid(i, j)], nodes[nid(i + 1, j)], nodes[nid(i + 1, j + 1)], nodes[nid(i, j + 1)]];
      const park = (i >= PARK.i0 && i < PARK.i1 && j >= PARK.j0 && j < PARK.j1) || SQUARES.has(i + "," + j) || j === RIVER;
      const type: Block["type"] = j === RIVER ? "orla" : park ? "park" : "urban";
      blocks.push({ i, j, q, type });
      if (type !== "urban") continue;
      const nx = 2 + (R() < 0.5 ? 1 : 0), ny = 2 + (R() < 0.4 ? 1 : 0), m = 0.1;
      // prédios mais altos perto do centro
      const centrality = 1 - Math.min(1, Math.hypot(i - 13, j - 8) / 14);
      for (let a = 0; a < nx; a++)
        for (let b = 0; b < ny; b++) {
          if (R() < 0.14) continue;
          const u0 = m + ((1 - 2 * m) * a) / nx, u1 = m + ((1 - 2 * m) * (a + 1)) / nx;
          const v0 = m + ((1 - 2 * m) * b) / ny, v1 = m + ((1 - 2 * m) * (b + 1)) / ny;
          const pu = (0.03 + R() * 0.05) * (u1 - u0) * 3, pv = (0.03 + R() * 0.05) * (v1 - v0) * 3;
          const c = [bil(q, u0 + pu, v0 + pv), bil(q, u1 - pu, v0 + pv), bil(q, u1 - pu, v1 - pv), bil(q, u0 + pu, v1 - pv)];
          buildings.push({ c, h: 8 + R() * 18 + centrality * centrality * 70 * R() });
        }
    }

  const lines: { h: Record<number, Edge[]>; v: Record<number, Edge[]> } = { h: {}, v: {} };
  for (const e of edges) (lines[e.dir][e.line] ||= []).push(e);
  for (const d of ["h", "v"] as const) for (const k in lines[d]) lines[d][k].sort((a, b) => a.idx - b.idx);

  const nearestNode = (p: Pt) => {
    let best = -1, bd = Infinity;
    for (let k = 0; k < nodes.length; k++) {
      if (!adj[k].length) continue;
      const d = dist(nodes[k], p);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  };

  /* ---------- carregadores ---------- */
  const chargers: Charger[] = [];
  let guard = 0;
  while (chargers.length < CFG.qtdCarregadores && guard++ < 2000) {
    const i = 1 + Math.floor(R() * (COLS - 2)), j = 1 + Math.floor(R() * (ROWS - 2));
    const blk = blocks.find((b) => b.i === i && b.j === j);
    if (!blk || blk.type !== "urban") continue;
    const pos = bil(blk.q, 0.2, 0.2);
    if (chargers.some((c) => dist(c.pos, pos) < 520)) continue;
    const idx = chargers.length;
    chargers.push({
      id: idx, name: NOMES_CARREGADORES[idx % NOMES_CARREGADORES.length],
      addr: `${rowName(j)} com ${colName(i)}`, pos, node: nearestNode(pos), ...chargerProfile(R),
    });
  }

  /* ---------- EVs circulando ---------- */
  const evs: EV[] = [];
  for (let k = 0; k < CFG.qtdEVs; k++) {
    const e = pick(edges), fw = R() < 0.5;
    evs.push({ u: fw ? e.a : e.b, v: fw ? e.b : e.a, e, t: R(), speed: 6 + R() * 8, model: pick(MODELOS_EV), batt: 15 + Math.floor(R() * 80), x: 0, y: 0, h: 0 });
  }

  return { R, pick, nodes, nid, edges, adj, edgeByKey, blocks, buildings, lines, nearestNode, chargers, evs };
}
export type World = ReturnType<typeof createWorld>;

/** conectores, preço, comodidades e curva de ocupação de um posto simulado */
export function chargerProfile(R: () => number) {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(R() * a.length)];
  const hub = R() < 0.6, n = hub ? pick([4, 6, 6, 8, 10]) : pick([2, 2, 3, 4]);
  const cons: Connector[] = [];
  for (let k = 0; k < n; k++) {
    const dc = hub ? k < n - 2 : k === 0 && R() < 0.4;
    const type: ConnectorType = dc ? (R() < 0.72 ? "CCS2" : R() < 0.5 ? "CHAdeMO" : "GB/T") : "Tipo 2";
    const kw = dc ? pick([60, 120, 150, 180]) : pick([7.4, 22]);
    const r = R(), st: ConnectorStatus = r < 0.5 ? "livre" : r < 0.92 ? "ocupado" : "offline";
    cons.push({ n: k + 1, type, kw, st, eta: st === "ocupado" ? 5 + Math.floor(R() * 45) : 0 });
  }
  if (hub) {
    const dcs = cons.filter((c) => c.type !== "Tipo 2");
    if (dcs.length) {
      const top = Math.max(...dcs.map((c) => c.kw));
      cons.forEach((c) => { if (c.type !== "Tipo 2" && R() < 0.5) c.kw = top; });
    }
  }
  const peak = 12 + R() * 7, peak2 = 8 + R() * 2;
  const busyCurve = Array.from({ length: 24 }, (_, h) =>
    clamp(0.08 + 0.75 * Math.exp(-((h - peak) ** 2) / 8) + 0.45 * Math.exp(-((h - peak2) ** 2) / 3) + (R() - 0.5) * 0.08, 0.04, 1));
  const amenities = COMODIDADES.filter(() => R() < 0.45).slice(0, 4);
  return {
    op: pick(OPERADORAS), cons, price: (1.49 + R() * 0.9).toFixed(2).replace(".", ","), open24: R() < 0.7,
    amenities: amenities.length ? amenities : ["Banheiro"], busyCurve, rating: Math.round((3.8 + R() * 1.2) * 10) / 10,
  };
}

/* ---------- status dos carregadores ---------- */
export function stats(c: Charger) {
  const free = c.cons.filter((x) => x.st === "livre").length;
  const busy = c.cons.filter((x) => x.st === "ocupado" || x.st === "voce" || x.st === "reservado").length;
  const off = c.cons.filter((x) => x.st === "offline").length;
  return { free, busy, off, total: c.cons.length, work: c.cons.length - off, max: Math.max(...c.cons.map((x) => x.kw)) };
}
export function level(c: Charger): Level {
  const s = stats(c);
  if (!s.work) return "off";
  if (!s.free) return "full";
  if (s.free / s.work <= 0.34) return "warn";
  return "ok";
}

/* ---------- roteamento (Dijkstra por tempo) ---------- */
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
export function dijkstra(w: World, src: number) {
  const n = w.nodes.length;
  const t = new Float64Array(n).fill(Infinity), dm = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  t[src] = 0; dm[src] = 0; const h: HeapItem[] = [[0, src]];
  while (h.length) {
    const [tu, u] = heapPop(h);
    if (tu > t[u]) continue;
    for (const { to, e } of w.adj[u]) {
      const nt = tu + e.len / (e.major ? 15 : 10);
      if (nt < t[to]) { t[to] = nt; dm[to] = dm[u] + e.len; prev[to] = u; heapPush(h, [nt, to]); }
    }
  }
  return { t, dm, prev };
}
export type Reach = ReturnType<typeof dijkstra>;

export type Step = { at: number; dir: "direita" | "esquerda" | "chegada"; street: string | null };
export type Route = { c: Charger; pts: (Pt & { id: number })[]; cum: number[]; total: number; steps: Step[]; first: string | null };

export function buildRoute(w: World, from: Pt, c: Charger): Route | null {
  const src = w.nearestNode(from), r = dijkstra(w, src);
  if (!isFinite(r.t[c.node])) return null;
  const ids: number[] = [];
  for (let k = c.node; k !== -1; k = r.prev[k]) ids.push(k);
  ids.reverse();
  const pts = ids.map((id) => ({ x: w.nodes[id].x, y: w.nodes[id].y, id }));
  if (dist(from, pts[0]) > 0.5) pts.unshift({ x: from.x, y: from.y, id: -1 });
  pts.push({ x: c.pos.x, y: c.pos.y, id: -1 });
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + dist(pts[k], pts[k - 1]));
  const nameAt = (k: number) => {
    const a = pts[k], b = pts[k + 1];
    if (!b || a.id < 0 || b.id < 0) return null;
    const e = w.edgeByKey.get(a.id < b.id ? a.id + "-" + b.id : b.id + "-" + a.id);
    return e ? e.name : null;
  };
  const steps: Step[] = [];
  for (let k = 1; k < pts.length - 1; k++) {
    const a = pts[k - 1], b = pts[k], d = pts[k + 1];
    const v1 = { x: b.x - a.x, y: b.y - a.y }, v2 = { x: d.x - b.x, y: d.y - b.y };
    const ang = Math.atan2(v1.x * v2.y - v1.y * v2.x, v1.x * v2.x + v1.y * v2.y);
    if (Math.abs(ang) > 0.6) steps.push({ at: cum[k], dir: ang > 0 ? "direita" : "esquerda", street: nameAt(k) });
  }
  steps.push({ at: cum[cum.length - 1], dir: "chegada", street: c.name });
  return { c, pts, cum, total: cum[cum.length - 1], steps, first: nameAt(0) || nameAt(1) };
}

export function stepEV(w: World, c: EV, dt: number) {
  c.t += (c.speed * dt) / c.e.len;
  while (c.t >= 1) {
    c.t -= 1;
    const opts = w.adj[c.v].filter((o) => o.to !== c.u);
    const nx = opts.length ? w.pick(opts) : w.adj[c.v][0];
    c.u = c.v; c.v = nx.to; c.e = nx.e;
  }
  const a = w.nodes[c.u], b = w.nodes[c.v];
  c.x = a.x + (b.x - a.x) * c.t; c.y = a.y + (b.y - a.y) * c.t; c.h = Math.atan2(b.y - a.y, b.x - a.x);
}
