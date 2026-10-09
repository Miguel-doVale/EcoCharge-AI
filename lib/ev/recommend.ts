/* =========================================================
   ECOCHARGE AI: previsão de vaga e recomendação de posto
   ---------------------------------------------------------
   Para cada posto, a IA prevê o estado no HORÁRIO DA CHEGADA do carro:
   1. conectores compatíveis com o carro e quando cada um libera;
   2. carros da rede EcoCharge que já estão indo para lá (chegadas previstas),
      ocupando conectores na ordem em que chegam;
   3. carros de fora da rede, pela ocupação típica daquele horário
      (chegadas aleatórias, modelo de Poisson).
   A recomendação escolhe o posto com o menor tempo até sair carregado:
   deslocamento + espera prevista + recarga até a meta.
   Todo tempo aqui é em minutos do relógio da simulação.
   ========================================================= */
import { CFG } from "./config";
import { stats, type Charger, type Connector } from "./world";

/** carro da rede indo para um posto: a vaga dele já conta para os próximos */
export type Intent = { who: number | "me"; chargerId: number; arrive: number; dur: number };

export type Forecast = {
  compat: number; // conectores compatíveis funcionando
  freeAtArrival: number; // livres na chegada, já descontando os carros da rede que chegam antes
  incoming: number; // carros da rede chegando antes de você
  chance: number; // probabilidade de achar vaga ao chegar (0..1)
  wait: number; // espera prevista (min)
};

export type Rec = {
  c: Charger;
  dist: number; // m
  drive: number; // min até o posto
  arriveBatt: number; // % ao chegar
  fc: Forecast;
  kw: number; // potência efetiva esperada (limitada pelo carro)
  charge: number; // min para carregar até a meta
  total: number; // min até sair carregado
  cost: number; // R$ estimado da recarga
  ok: boolean;
  why: string; // motivo da exclusão ou destaque principal
  lowReserve?: boolean; // só falhou na reserva de segurança
};

export type Car = { batt: number; types: readonly string[]; dc: number; ac: number; capKWh: number };
/** minutos até a reserva de um conector acabar; -1 = reservado para este próprio carro */
export type ForecastOpts = { hour: number; reservedUntil?: (x: Connector) => number | null };

const isDC = (x: Connector) => x.type !== "Tipo 2";
const usable = (x: Connector, car: Car) => car.types.includes(x.type) && x.st !== "offline";
export const powerOn = (x: Connector, car: Car) => Math.min(x.kw, isDC(x) ? car.dc : car.ac);

/** chegadas de carros de fora da rede por minuto, pela curva de ocupação típica */
export function backgroundRate(c: Charger, hour: number) {
  return c.cons.length * 0.012 * (0.25 + c.busyCurve[hour % 24]);
}

/** P(N < k) para N ~ Poisson(mu) */
function poissonBelow(k: number, mu: number) {
  if (k <= 0) return 0;
  let term = Math.exp(-mu), sum = term;
  for (let i = 1; i < k; i++) { term *= mu / i; sum += term; }
  return Math.min(1, sum);
}

/** minutos para carregar de `from`% até `to`% numa potência */
export function chargeMinutes(from: number, to: number, kw: number, capKWh: number) {
  if (to <= from || kw <= 0) return 0;
  return ((to - from) / 100) * capKWh / kw * 60;
}

export function forecast(
  c: Charger, car: Car, now: number, arrive: number, intents: Intent[], who: number | "me",
  opts: ForecastOpts = { hour: new Date().getHours() },
): Forecast {
  const comp = c.cons.filter((x) => usable(x, car));
  if (!comp.length) return { compat: 0, freeAtArrival: 0, incoming: 0, chance: 0, wait: Infinity };
  // quando cada conector compatível fica livre
  const freeAt = comp.map((x) => {
    if (x.st === "livre") return now;
    if (x.st === "ocupado") return now + Math.max(0, x.eta);
    if (x.st === "reservado") { const u = opts.reservedUntil?.(x); return u === -1 ? now : now + (u ?? 15); }
    return Infinity; // "voce": o próprio carro está carregando
  });
  // carros da rede que chegam antes ocupam os conectores na ordem de chegada
  const before = intents.filter((i) => i.chargerId === c.id && i.who !== who && i.arrive <= arrive).sort((a, b) => a.arrive - b.arrive);
  for (const it of before) {
    let k = 0;
    for (let j = 1; j < freeAt.length; j++) if (freeAt[j] < freeAt[k]) k = j;
    freeAt[k] = Math.max(it.arrive, freeAt[k]) + it.dur;
  }
  const free = freeAt.filter((t) => t <= arrive).length;
  // carros de fora da rede chegando até lá (só os que usam conector compatível)
  const mu = backgroundRate(c, opts.hour) * (comp.length / c.cons.length) * Math.max(0, arrive - now);
  const chance = poissonBelow(free, mu);
  // se não houver vaga: espera até o próximo conector liberar
  const later = freeAt.filter((t) => t > arrive && isFinite(t)).sort((a, b) => a - b);
  const avgDur = 25;
  const waitIfFull = later.length ? later[0] - arrive : avgDur / comp.length;
  return { compat: comp.length, freeAtArrival: free, incoming: before.length, chance, wait: (1 - chance) * waitIfFull };
}

/**
 * Ranqueia os postos para um carro. `distTo` dá a distância em metros pelas ruas;
 * `driveMin` converte distância em minutos (no relógio da simulação).
 */
export function recommend(
  chargers: Charger[], car: Car, now: number, intents: Intent[], who: number | "me",
  distTo: (c: Charger) => number, driveMin: (m: number) => number,
  opts: ForecastOpts = { hour: new Date().getHours() },
): Rec[] {
  const R = CFG.ia;
  const recs = chargers.map((c): Rec => {
    const dist = distTo(c), drive = driveMin(dist);
    const arriveBatt = car.batt - ((dist / 1000) * CFG.veiculo.consumoKWhKm / car.capKWh) * 100;
    const fc = forecast(c, car, now, now + drive, intents, who, opts);
    const comp = c.cons.filter((x) => usable(x, car));
    const kw = comp.length ? Math.max(...comp.map((x) => powerOn(x, car))) : 0;
    const charge = chargeMinutes(Math.max(0, arriveBatt), R.metaRecarga, kw, car.capKWh);
    const total = drive + fc.wait + charge;
    const cost = ((R.metaRecarga - Math.max(0, arriveBatt)) / 100) * car.capKWh * parseFloat(c.price.replace(",", "."));
    let ok = true, why = "", lowReserve = false;
    if (!isFinite(dist)) { ok = false; why = "Sem rota até o posto"; }
    else if (!comp.length) { ok = false; why = stats(c).work ? "Nenhum conector compatível com seu carro" : "Posto fora de serviço"; }
    else if (arriveBatt < R.bateriaCritica) { ok = false; why = `Chegaria com ${Math.max(0, Math.round(arriveBatt))}%: risco de ficar sem bateria`; }
    else if (fc.chance < R.chanceMinima && fc.wait > R.esperaMaxima) { ok = false; why = fc.incoming ? `Deve lotar antes de você chegar (${fc.incoming} ${fc.incoming > 1 ? "carros da rede" : "carro da rede"} a caminho)` : "Deve lotar antes de você chegar"; }
    else if (fc.wait > R.esperaMaxima) { ok = false; why = `Espera prevista de ${Math.round(fc.wait)} min`; }
    else if (arriveBatt < R.reservaSeguranca) { ok = false; lowReserve = true; why = `Chegaria com ${Math.round(arriveBatt)}%, abaixo da reserva de ${R.reservaSeguranca}%`; }
    else if (kw <= car.ac) why = "Só recarga lenta (AC)";
    return { c, dist, drive, arriveBatt, fc, kw, charge, total, cost, ok, why, lowReserve };
  });
  // bateria crítica: se nenhum posto respeita a reserva, aceita os alcançáveis com
  // margem mínima e prioriza o caminho mais curto (menos risco), não o tempo total
  if (!recs.some((r) => r.ok) && recs.some((r) => r.lowReserve)) {
    for (const r of recs) if (r.lowReserve) { r.ok = true; r.why = "Bateria crítica: posto mais seguro ao alcance"; }
    return recs.sort((a, b) => Number(b.ok) - Number(a.ok) || a.drive + a.fc.wait - (b.drive + b.fc.wait));
  }
  // menor tempo até sair carregado; desempate pelo custo
  return recs.sort((a, b) => Number(b.ok) - Number(a.ok) || a.total - b.total || a.cost - b.cost);
}
