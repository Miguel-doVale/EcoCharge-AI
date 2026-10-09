"use client";

import { AnimatePresence, motion, useSpring, useTransform } from "motion/react";
import { useEffect, useState } from "react";
import { COR_STATUS, CFG } from "@/lib/ev/config";
import { fmtDist, fmtKw, fmtMin } from "@/lib/ev/format";
import { level, stats, type Charger, type Connector } from "@/lib/ev/world";
import { useEngine, useUI } from "./engine-context";
import { BoltIcon, CloseIcon, LocateIcon } from "./icons";

const ease = [0.16, 1, 0.3, 1] as const;
const viewAnim = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16 } },
};

export function SheetContent() {
  const mode = useUI((s) => s.mode);
  const selId = useUI((s) => s.selId);
  useUI((s) => s.rev); // re-render quando os dados ao vivo mudam
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={mode + ":" + selId} {...viewAnim}>
        {mode === "list" && <ListView />}
        {mode === "detail" && <DetailView />}
        {mode === "preview" && <PreviewView />}
        {mode === "nav" && <NavView />}
        {mode === "arrived" && <ArrivedView />}
        {mode === "charging" && <ChargingView />}
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------- peças compartilhadas ---------- */
const LV_BG: Record<string, string> = { ok: "bg-ok", warn: "bg-warn", full: "bg-full", off: "bg-off" };

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(value, { stiffness: 180, damping: 22 });
  const txt = useTransform(spring, (v) => String(Math.round(v)));
  useEffect(() => { spring.set(value); }, [value, spring]);
  return <motion.b className={className}>{txt}</motion.b>;
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-[var(--ui-muted)]">
      <i className="live-dot h-2 w-2 rounded-full bg-ok" />Ao vivo
    </span>
  );
}

function CloseBtn() {
  const engine = useEngine();
  return (
    <motion.button whileTap={{ scale: 0.88 }} onClick={() => engine.closeDetail()} aria-label="Fechar"
      className="ml-auto grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--ui-soft)]">
      <CloseIcon />
    </motion.button>
  );
}

function Btn({ kind, children, ...p }: { kind: "primary" | "go" | "ghost" | "stop" } & React.ComponentProps<typeof motion.button>) {
  const k = { primary: "bg-route text-white", go: "bg-navgreen text-white", ghost: "bg-[var(--ui-soft)]", stop: "bg-full text-white" }[kind];
  return (
    <motion.button whileTap={{ scale: 0.97 }} {...p}
      className={`flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[14px] text-base font-bold disabled:cursor-not-allowed disabled:opacity-45 ${k}`}>
      {children}
    </motion.button>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="sticky bottom-0 mb-1 mt-4 flex gap-2 bg-[var(--ui-bg)] pt-2">{children}</div>;
}

function Stats({ c }: { c: Charger }) {
  const s = stats(c);
  const cell = "px-1.5 py-2.5 text-center";
  return (
    <div className="grid grid-cols-4 divide-x divide-[var(--ui-line)] overflow-hidden rounded-[14px] border border-[var(--ui-line)]">
      <div className={cell}><AnimatedNumber value={s.total} className="tabular block text-[22px] font-extrabold leading-tight" /><span className="text-[12.5px] text-[var(--ui-muted)]">conectores</span></div>
      <div className={cell}><AnimatedNumber value={s.free} className="tabular block text-[22px] font-extrabold leading-tight text-ok" /><span className="text-[12.5px] text-[var(--ui-muted)]">livres</span></div>
      <div className={cell}><AnimatedNumber value={s.busy} className="tabular block text-[22px] font-extrabold leading-tight text-full" /><span className="text-[12.5px] text-[var(--ui-muted)]">ocupados</span></div>
      <div className={cell}><b className="tabular block text-[22px] font-extrabold leading-tight">{s.max}</b><span className="text-[12.5px] text-[var(--ui-muted)]">kW máx.</span></div>
    </div>
  );
}

function conStatus(x: Connector, mineReserved: boolean): [string, string] {
  if (x.st === "livre") return ["Livre", COR_STATUS.ok];
  if (x.st === "ocupado") return [`Libera em ~${Math.max(1, Math.round(x.eta))} min`, COR_STATUS.full];
  if (x.st === "voce") return ["Seu carro", "var(--color-route)"];
  if (x.st === "reservado") return [mineReserved ? "Reservado p/ você" : "Reservado", "var(--color-route)"];
  return ["Fora de serviço", COR_STATUS.off];
}

function Connectors({ c, onReserve }: { c: Charger; onReserve?: (n: number) => void }) {
  const res = useUI((s) => s.reservation);
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
      {c.cons.map((x) => {
        const mine = !!res && res.chargerId === c.id && res.con === x.n;
        const [t, col] = conStatus(x, mine);
        return (
          <motion.div
            key={x.n} layout
            className="relative overflow-hidden rounded-[10px] border border-[var(--ui-line)] py-2.5 pl-4 pr-2.5"
            style={{ background: x.st === "voce" || mine ? "color-mix(in srgb, var(--color-route) 10%, transparent)" : undefined }}
          >
            <motion.span className="absolute inset-y-0 left-0 w-[5px]" animate={{ backgroundColor: col.startsWith("var") ? "#2f6fe4" : col }} transition={{ duration: 0.5 }} />
            <div className="text-[12.5px] font-semibold text-[var(--ui-muted)]">Conector {x.n}</div>
            <div className="my-px text-[15px] font-bold">{x.type}</div>
            <div className="text-sm text-[var(--ui-muted)]">{fmtKw(x.kw)}</div>
            <div className="flex items-center justify-between gap-1">
              <AnimatePresence mode="wait">
                <motion.span key={t} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] font-semibold" style={{ color: col }}>{t}</motion.span>
              </AnimatePresence>
              {onReserve && x.st === "livre" && (
                <button onClick={() => onReserve(x.n)} className="rounded-full bg-[var(--ui-soft)] px-2 py-0.5 text-[12px] font-bold text-route">Reservar</button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** "Horários de pico" no estilo Google Maps */
function BusyChart({ c }: { c: Charger }) {
  const h = new Date().getHours();
  const live = stats(c);
  const liveBusy = live.work ? live.busy / live.work : 1;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[15px] font-bold">Ocupação típica</h3>
        <span className="text-[13px] text-[var(--ui-muted)]">
          Agora: <b className="text-[var(--ui-text)]">{liveBusy > 0.85 ? "lotado" : liveBusy > 0.6 ? "mais cheio que o normal" : liveBusy > 0.3 ? "movimento normal" : "tranquilo"}</b>
        </span>
      </div>
      <div className="flex h-[72px] items-end gap-[3px]" aria-label="Gráfico de ocupação típica por hora">
        {c.busyCurve.map((v, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t-[3px]"
            style={{ background: i === h ? "var(--color-route)" : "color-mix(in srgb, var(--ui-muted) 35%, transparent)" }}
            initial={{ height: 0 }} animate={{ height: `${Math.max(6, (i === h ? Math.max(v, liveBusy) : v) * 100)}%` }}
            transition={{ delay: i * 0.015, duration: 0.5, ease }}
            title={`${i}h`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-[var(--ui-muted)]"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
    </div>
  );
}

/* ---------- lista ---------- */
function ListView() {
  const engine = useEngine();
  useUI((s) => s.filters); useUI((s) => s.query);
  const list = engine.list();
  return (
    <div>
      <div className="mb-2.5 mt-0.5 flex items-center justify-between gap-3">
        <h2 className="text-[19px] font-bold tracking-tight">Carregadores perto de você</h2>
        <LiveBadge />
      </div>
      <div className="mb-1.5 flex flex-wrap gap-3.5 text-[13px] text-[var(--ui-muted)]">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-ok" />Com vagas</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-warn" />Quase cheio</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-full" />Lotado</span>
      </div>
      {list.length ? (
        <motion.ul layout className="divide-y divide-[var(--ui-line)]">
          {list.map(({ c, d, t }) => {
            const s = stats(c), ok = engine.reachable(c);
            return (
              <motion.li key={c.id} layout transition={{ type: "spring", stiffness: 400, damping: 36 }}>
                <button onClick={() => engine.selectCharger(c.id)} className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-[var(--ui-soft)]">
                  <span className={`tabular flex h-10 min-w-12 flex-none items-baseline justify-center rounded-xl pt-[9px] text-lg font-extrabold text-white transition-colors duration-500 ${LV_BG[level(c)]}`}>
                    {s.free}<small className="text-xs font-semibold opacity-85">/{s.total}</small>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <b className="truncate text-base font-semibold">{c.name}</b>
                    <span className="text-sm text-[var(--ui-muted)]">{c.op}, até {fmtKw(s.max)}{!ok && <span className="text-full"> · fora do alcance</span>}</span>
                  </span>
                  <span className="tabular flex flex-none flex-col text-right text-[15px] font-bold">
                    {isFinite(d) ? fmtDist(d) : "–"}
                    <small className="text-[13px] font-medium text-[var(--ui-muted)]">{isFinite(t) ? fmtMin(t) : ""}</small>
                  </span>
                </button>
              </motion.li>
            );
          })}
        </motion.ul>
      ) : (
        <div className="px-1 py-4 text-[15px] text-[var(--ui-muted)]">Nenhum carregador com esses filtros. Remova um filtro para ver mais opções.</div>
      )}
    </div>
  );
}

/* ---------- detalhe ---------- */
function DetailView() {
  const engine = useEngine();
  const c = engine.selected!;
  const res = useUI((s) => s.reservation);
  const d = engine.distTo(c), t = d / CFG.velocidadeMedia, reachable = engine.reachable(c);
  const arrBatt = Math.round(engine.batteryAfter(d));
  const myRes = res && res.chargerId === c.id ? res : null;
  return (
    <div>
      <div className="mt-0.5 flex items-start gap-3">
        <div className="min-w-0">
          <h2 className="mb-0.5 text-[21px] font-bold tracking-tight">{c.name}</h2>
          <div className="text-sm text-[var(--ui-muted)]">{c.op}, {c.addr}</div>
        </div>
        <CloseBtn />
      </div>
      <div className="mb-3.5 mt-2.5 flex flex-wrap gap-1.5">
        {[isFinite(d) ? `${fmtDist(d)} de distância` : "Sem rota disponível", c.open24 ? "Aberto 24h" : "Aberto 6h às 23h", `R$ ${c.price}/kWh`, `★ ${String(c.rating).replace(".", ",")}`].map((tg) => (
          <span key={tg} className="rounded-full bg-[var(--ui-soft)] px-2.5 py-1 text-[13px] font-semibold">{tg}</span>
        ))}
      </div>
      {!reachable && isFinite(d) && (
        <p className="mb-3 rounded-xl bg-[color-mix(in_srgb,var(--color-full)_12%,transparent)] px-3 py-2 text-sm font-semibold text-full">
          Bateria insuficiente: chegaria com {Math.max(0, arrBatt)}%. Escolha um carregador mais próximo.
        </p>
      )}
      {myRes && <ReservationBanner until={myRes.until} con={myRes.con} />}
      <Stats c={c} />
      <h3 className="mb-2 mt-4 text-[15px] font-bold">Conectores</h3>
      <Connectors c={c} onReserve={(n) => engine.reserve(n)} />
      <div className="mt-4"><BusyChart c={c} /></div>
      <h3 className="mb-2 mt-4 text-[15px] font-bold">No local</h3>
      <div className="flex flex-wrap gap-1.5">
        {c.amenities.map((a) => <span key={a} className="rounded-lg border border-[var(--ui-line)] px-2.5 py-1 text-[13px]">{a}</span>)}
      </div>
      <Actions>
        <Btn kind="primary" disabled={!isFinite(d)} onClick={() => engine.planRoute()}>
          <LocateIcon size={18} />Traçar rota{isFinite(t) ? `, ${fmtMin(t)}` : ""}
        </Btn>
      </Actions>
    </div>
  );
}

function ReservationBanner({ until, con }: { until: number; con: number }) {
  const engine = useEngine();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const left = Math.max(0, until - now), m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
      className="mb-3 flex items-center gap-3 rounded-xl bg-[color-mix(in_srgb,var(--color-route)_12%,transparent)] px-3 py-2.5">
      <BoltIcon className="text-route" />
      <div className="flex-1 text-sm"><b>Conector {con} reservado</b><div className="tabular text-[var(--ui-muted)]">expira em {m}:{String(s).padStart(2, "0")}</div></div>
      <button onClick={() => engine.releaseReservation()} className="text-sm font-bold text-route">Cancelar</button>
    </motion.div>
  );
}

/* ---------- prévia da rota ---------- */
function PreviewView() {
  const engine = useEngine();
  const r = engine.routeSummary(), c = engine.selected!;
  if (!r) return null;
  const s = stats(c);
  const battColor = r.batt < 10 ? COR_STATUS.full : r.batt < 25 ? COR_STATUS.warn : COR_STATUS.ok;
  return (
    <div>
      <div className="mt-0.5 flex items-start gap-3">
        <div className="min-w-0">
          <h2 className="mb-0.5 text-[21px] font-bold tracking-tight">Rota até {c.name}</h2>
          <div className="text-sm text-[var(--ui-muted)]">Saindo pela {r.first || "rua atual"}</div>
        </div>
        <CloseBtn />
      </div>
      <div className="tabular mt-1.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <span className="text-[30px] font-extrabold text-ok">{r.eta}</span>
        <span className="text-[15px] text-[var(--ui-muted)]"><b className="text-[var(--ui-text)]">{r.dist}</b></span>
        <span className="text-[15px] text-[var(--ui-muted)]">chegada <b className="text-[var(--ui-text)]">{r.arrival}</b></span>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[13px] text-[var(--ui-muted)]">
          <span>Bateria agora <b className="text-[var(--ui-text)]">{Math.round(engine.car.batt)}%</b></span>
          <span>na chegada <b style={{ color: battColor }}>{r.batt}%</b></span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--ui-soft)]">
          <motion.i className="absolute inset-y-0 left-0 rounded-full opacity-35" style={{ background: battColor }} initial={{ width: 0 }} animate={{ width: `${engine.car.batt}%` }} transition={{ duration: 0.6, ease }} />
          <motion.i className="absolute inset-y-0 left-0 rounded-full" style={{ background: battColor }} initial={{ width: 0 }} animate={{ width: `${Math.max(0, r.batt)}%` }} transition={{ duration: 0.8, delay: 0.15, ease }} />
        </div>
      </div>
      <p className="mt-2 text-[13px] text-[var(--ui-muted)]">{s.free} de {s.total} conectores livres agora. O status é atualizado durante o trajeto.</p>
      <h3 className="mb-1 mt-4 text-[15px] font-bold">Instruções</h3>
      <ol className="text-sm">
        {r.steps.map((st, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
            className="flex items-center gap-3 border-b border-[var(--ui-line)] py-2 last:border-0">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--ui-soft)] text-xs font-bold">
              {st.dir === "direita" ? "↱" : st.dir === "esquerda" ? "↰" : st.dir === "retorno" ? "↶" : "⚑"}
            </span>
            <span className="flex-1">{st.dir === "chegada" ? `Chegada em ${st.street}` : st.dir === "retorno" ? `Faça o retorno${st.street ? ` na ${st.street}` : ""}` : `Vire à ${st.dir}${st.street ? ` na ${st.street}` : ""}`}</span>
            <span className="tabular text-[var(--ui-muted)]">{fmtDist(st.at)}</span>
          </motion.li>
        ))}
      </ol>
      <Actions>
        <Btn kind="go" onClick={() => engine.startNav()}><LocateIcon size={18} />Iniciar</Btn>
        <Btn kind="ghost" onClick={() => engine.cancelRoute()}>Cancelar rota</Btn>
      </Actions>
    </div>
  );
}

/* ---------- navegação ---------- */
function NavView() {
  const engine = useEngine();
  const nav = useUI((s) => s.nav);
  const c = engine.selected;
  if (!nav || !c) return null;
  return (
    <div>
      <div className="tabular mt-1 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <span className="text-[30px] font-extrabold text-ok">{nav.eta}</span>
        <span className="text-[15px] text-[var(--ui-muted)]"><b className="text-[var(--ui-text)]">{nav.remaining}</b></span>
        <span className="text-[15px] text-[var(--ui-muted)]">chegada <b className="text-[var(--ui-text)]">{nav.arrival}</b></span>
        <span className="text-[15px] text-[var(--ui-muted)]">bateria <b className="text-[var(--ui-text)]">{nav.batt}%</b></span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ui-soft)]">
        <motion.i className="block h-full rounded-full bg-route" animate={{ width: `${nav.progress * 100}%` }} transition={{ duration: 0.1 }} />
      </div>
      <p className="mt-2 text-[13px] text-[var(--ui-muted)]">Destino: {c.name} · {stats(c).free} livres agora. Simulação acelerada.</p>
      <Actions><Btn kind="stop" onClick={() => engine.cancelRoute()}>Encerrar navegação</Btn></Actions>
    </div>
  );
}

/* ---------- chegada ---------- */
function ArrivedView() {
  const engine = useEngine();
  const res = useUI((s) => s.reservation);
  const c = engine.selected!;
  const myRes = res && res.chargerId === c.id ? c.cons.find((x) => x.n === res.con && x.st === "reservado") : undefined;
  const free = myRes ?? c.cons.filter((x) => x.st === "livre").sort((a, b) => b.kw - a.kw)[0];
  const next = c.cons.filter((x) => x.st === "ocupado").sort((a, b) => a.eta - b.eta)[0];
  return (
    <div>
      <div className="mt-0.5 flex items-start gap-3">
        <div className="min-w-0">
          <motion.h2 initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="mb-0.5 text-[21px] font-bold tracking-tight">Você chegou</motion.h2>
          <div className="text-sm text-[var(--ui-muted)]">{c.name}, {c.addr}</div>
        </div>
        <CloseBtn />
      </div>
      <div className="mt-3"><Stats c={c} /></div>
      <h3 className="mb-2 mt-4 text-[15px] font-bold">Conectores</h3>
      <Connectors c={c} />
      <Actions>
        {free ? (
          <Btn kind="go" onClick={() => engine.startCharge(free.n)}><BoltIcon />Carregar no conector {free.n}, {fmtKw(free.kw)}</Btn>
        ) : (
          <Btn kind="ghost" disabled>Todos ocupados{next ? `, próximo libera em ~${Math.round(next.eta)} min` : ""}</Btn>
        )}
      </Actions>
    </div>
  );
}

/* ---------- recarga ---------- */
function ChargingView() {
  const engine = useEngine();
  const ch = useUI((s) => s.charge);
  const c = engine.selected!;
  if (!ch) return null;
  const R = 54, C = 2 * Math.PI * R;
  return (
    <div>
      <div className="mt-0.5">
        <h2 className="mb-0.5 text-[21px] font-bold tracking-tight">Carregando</h2>
        <div className="text-sm text-[var(--ui-muted)]">{c.name}, conector {ch.con} ({ch.type})</div>
      </div>
      <div className="mt-3 flex items-center gap-5">
        <div className="relative h-[132px] w-[132px] flex-none">
          <svg viewBox="0 0 132 132" className="-rotate-90">
            <circle cx="66" cy="66" r={R} fill="none" stroke="var(--ui-soft)" strokeWidth="12" />
            <motion.circle cx="66" cy="66" r={R} fill="none" stroke={ch.pct < 80 ? COR_STATUS.ok : COR_STATUS.warn} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - ch.pct / 100) }} transition={{ duration: 0.2 }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="tabular text-[30px] font-extrabold leading-none">{Math.round(ch.pct)}%</div>
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4 }} className="mt-1 flex justify-center text-ok"><BoltIcon /></motion.div>
            </div>
          </div>
        </div>
        <dl className="tabular grid flex-1 grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div><dt className="text-[var(--ui-muted)]">Potência</dt><dd className="text-base font-bold">{fmtKw(ch.kw)}</dd></div>
          <div><dt className="text-[var(--ui-muted)]">Adicionado</dt><dd className="text-base font-bold">{ch.addedKWh.toFixed(1).replace(".", ",")} kWh</dd></div>
          <div><dt className="text-[var(--ui-muted)]">Custo</dt><dd className="text-base font-bold">R$ {ch.cost}</dd></div>
          <div><dt className="text-[var(--ui-muted)]">Autonomia</dt><dd className="text-base font-bold">{Math.round(engine.rangeKm())} km</dd></div>
        </dl>
      </div>
      <p className="mt-3 text-[13px] text-[var(--ui-muted)]">{ch.toFull}. Recarga simulada e acelerada; a potência cai acima de 80%.</p>
      <Actions><Btn kind="stop" onClick={() => engine.stopCharge()}>Encerrar recarga</Btn></Actions>
    </div>
  );
}
