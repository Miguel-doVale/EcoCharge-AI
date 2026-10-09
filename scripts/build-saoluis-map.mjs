/* =========================================================
   Gera public/data/saoluis-roads.json a partir do OpenStreetMap.
   Malha viária real de São Luís (Ponta d'Areia → Calhau, São Francisco,
   Renascença, Cohafuma), usada pelo navegador para rota, EVs e instruções.

   Uso:  node scripts/build-saoluis-map.mjs
   Dados © OpenStreetMap contributors (ODbL).
   ========================================================= */
import { writeFileSync, mkdirSync } from "node:fs";

// recorte da região (sul, oeste, norte, leste)
export const BBOX = [-2.532, -44.322, -2.476, -44.236];
// origem do sistema local em metros (x = leste, y = sul)
export const REF = { lat: -2.503, lon: -44.279 };

const HIGHWAYS = "motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street";
const QUERY = `[out:json][timeout:180];
way["highway"~"^(${HIGHWAYS})$"]["access"!~"^(private|no)$"]["area"!="yes"](${BBOX.join(",")});
out body; >; out skel qt;`;
const SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

async function fetchOSM() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const url = SERVERS[attempt % SERVERS.length];
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": "EcoCharge-AI-prototype/0.1", "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(QUERY),
      });
      if (r.ok) return await r.json();
      console.warn(`overpass ${r.status} em ${url}, tentando de novo…`);
    } catch (e) { console.warn(`falha em ${url}: ${e.message}`); }
    await new Promise((res) => setTimeout(res, 6000));
  }
  throw new Error("Overpass indisponível");
}

const KX = 111320 * Math.cos((REF.lat * Math.PI) / 180), KY = 110574;
const proj = (lat, lon) => [(lon - REF.lon) * KX, (REF.lat - lat) * KY];

// classe da via: 0 arterial, 1 coletora, 2 local-principal, 3 local
const CLASS = (h) => /^(motorway|trunk|primary)/.test(h) ? 0 : /^secondary/.test(h) ? 1 : /^tertiary/.test(h) ? 2 : 3;

/** Douglas-Peucker em pontos [x,y] */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let best = -1, bd = tol;
    for (let k = a + 1; k < b; k++) {
      const d = Math.abs(dy * (pts[k][0] - ax) - dx * (pts[k][1] - ay)) / L;
      if (d > bd) { bd = d; best = k; }
    }
    if (best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return pts.filter((_, k) => keep[k]);
}

const osm = await fetchOSM();
const coord = new Map(); // id osm -> [x,y]
const ways = [];
for (const el of osm.elements) {
  if (el.type === "node") coord.set(el.id, proj(el.lat, el.lon));
  else if (el.type === "way") ways.push(el);
}

// nós usados por mais de uma via (ou extremidades) viram interseções
const uses = new Map();
for (const w of ways) w.nodes.forEach((id, k) => uses.set(id, (uses.get(id) || 0) + (k === 0 || k === w.nodes.length - 1 ? 2 : 1)));

const nodeIdx = new Map(), nodes = [];
const inter = (id) => { if (!nodeIdx.has(id)) { nodeIdx.set(id, nodes.length); nodes.push(coord.get(id)); } return nodeIdx.get(id); };
const names = [], nameIdx = new Map();
const nameOf = (n) => { if (!n) return -1; if (!nameIdx.has(n)) { nameIdx.set(n, names.length); names.push(n); } return nameIdx.get(n); };

let edges = [];
for (const w of ways) {
  const t = w.tags || {}, cls = CLASS(t.highway);
  let ow = t.oneway === "yes" || t.oneway === "1" || t.junction === "roundabout" || t.junction === "circular" || /^motorway/.test(t.highway) ? 1 : t.oneway === "-1" ? -1 : 0;
  const ids = ow === -1 ? [...w.nodes].reverse() : w.nodes;
  if (ow === -1) ow = 1;
  const nm = nameOf(t.name || t.ref || null);
  let start = 0;
  for (let k = 1; k < ids.length; k++) {
    if (k < ids.length - 1 && (uses.get(ids[k]) || 0) < 2) continue;
    const seg = ids.slice(start, k + 1).map((id) => coord.get(id)).filter(Boolean);
    if (seg.length >= 2) edges.push({ a: inter(ids[start]), b: inter(ids[k]), cls, nm, ow, geom: simplify(seg, 1.5) });
    start = k;
  }
}

// mantém só a maior componente fortemente conexa: toda rota possível respeitando mão única
function largestSCC(n, edges) {
  const out = Array.from({ length: n }, () => []), inn = Array.from({ length: n }, () => []);
  for (const e of edges) {
    out[e.a].push(e.b); inn[e.b].push(e.a);
    if (!e.ow) { out[e.b].push(e.a); inn[e.a].push(e.b); }
  }
  const seen = new Uint8Array(n), order = [];
  for (let s = 0; s < n; s++) {
    if (seen[s]) continue;
    const st = [[s, 0]]; seen[s] = 1;
    while (st.length) {
      const top = st[st.length - 1], u = top[0];
      if (top[1] < out[u].length) { const v = out[u][top[1]++]; if (!seen[v]) { seen[v] = 1; st.push([v, 0]); } }
      else { order.push(u); st.pop(); }
    }
  }
  const comp = new Int32Array(n).fill(-1); let c = 0;
  for (let k = order.length - 1; k >= 0; k--) {
    const s = order[k]; if (comp[s] >= 0) continue;
    const st = [s]; comp[s] = c;
    while (st.length) { const u = st.pop(); for (const v of inn[u]) if (comp[v] < 0) { comp[v] = c; st.push(v); } }
    c++;
  }
  const size = new Map(); for (const x of comp) size.set(x, (size.get(x) || 0) + 1);
  const big = [...size.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return comp.map((x) => x === big);
}
const keep = largestSCC(nodes.length, edges);
edges = edges.filter((e) => keep[e.a] && keep[e.b] && e.a !== e.b);

// reindexa nós usados
const remap = new Map(), outNodes = [];
const ri = (k) => { if (!remap.has(k)) { remap.set(k, outNodes.length / 2); outNodes.push(Math.round(nodes[k][0]), Math.round(nodes[k][1])); } return remap.get(k); };
const outEdges = edges.map((e) => [ri(e.a), ri(e.b), e.cls, e.nm, e.ow, e.geom.slice(1, -1).flat().map(Math.round)]);

const data = { attribution: "© OpenStreetMap contributors (ODbL)", ref: REF, bbox: BBOX, names, nodes: outNodes, edges: outEdges };
mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/saoluis-roads.json", JSON.stringify(data));
console.log(`ok: ${outNodes.length / 2} interseções, ${outEdges.length} trechos, ${names.length} nomes de rua`);
