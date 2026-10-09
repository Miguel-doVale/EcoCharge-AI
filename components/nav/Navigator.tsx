"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import "maplibre-gl/dist/maplibre-gl.css";
import { EVEngine, type Filter } from "@/lib/ev/engine";
import type { RoadData } from "@/lib/ev/realworld";
import { COR_STATUS } from "@/lib/ev/config";
import { EngineContext, useEngine, useUI } from "./engine-context";
import { BackIcon, CarIcon, LocateIcon, MinusIcon, MoonIcon, PlusIcon, SearchIcon, SunIcon, TurnGlyph } from "./icons";
import { SheetContent } from "./SheetViews";
import { isStandalone, registerSW } from "@/components/pwa/PWAProvider";

gsap.registerPlugin(useGSAP);

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(min-width: 900px)");
    const on = () => setWide(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export default function Navigator() {
  // malha viária real de São Luís (gerada por scripts/build-saoluis-map.mjs)
  const [data, setData] = useState<RoadData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/data/saoluis-roads.json").then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setData).catch(() => setFailed(true));
  }, []);
  if (!data) return (
    <div className="fixed inset-0 grid place-items-center bg-[#EEEEE9] text-[#5F6671]">
      {failed ? "Não foi possível carregar o mapa. Verifique a conexão." : "Carregando mapa de São Luís…"}
    </div>
  );
  return <NavigatorReady data={data} />;
}

function NavigatorReady({ data }: { data: RoadData }) {
  const engine = useMemo(() => new EVEngine(data), [data]);
  return (
    <EngineContext.Provider value={engine}>
      <NavigatorShell />
    </EngineContext.Provider>
  );
}

function NavigatorShell() {
  const engine = useEngine();
  const mode = useUI((s) => s.mode);
  const wide = useWide();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const cv = canvasRef.current!;
    engine.setInsetsProvider(() => {
      const ch = innerHeight;
      const sh = sheetRef.current?.getBoundingClientRect();
      const tb = topRef.current?.getBoundingClientRect();
      if (!sh) return { l: 0, t: 0, r: 0, b: 0 };
      // navegação: o carro fica na parte de baixo da tela, olhando a rua à frente
      if (engine.getState().mode === "nav") {
        const top = tb ? tb.bottom : 0, bottom = matchMedia("(min-width: 900px)").matches ? 0 : ch - sh.top;
        return { l: 0, t: Math.max(top, ch * 0.42), r: 0, b: bottom };
      }
      if (matchMedia("(min-width: 900px)").matches) return { l: sh.right + 12, t: 0, r: 70, b: 0 };
      return { l: 0, t: tb ? tb.bottom : 0, r: 60, b: ch - sh.top };
    });
    engine.attach(mapEl.current!, cv);
    registerSW();
    return () => engine.detach();
  }, [engine]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#EEEEE9] text-[var(--ui-text)] select-none dark:bg-[#161A20]">
      {/* mapa real (MapLibre) + camada própria de carregadores, EVs, carro e rota */}
      {/* o CSS do MapLibre põe position: relative no contêiner; por isso o wrapper absoluto */}
      <div className="absolute inset-0">
        <div ref={mapEl} className="ev-map h-full w-full" aria-label="Mapa de São Luís. Arraste para mover, use a roda do mouse ou pinça para zoom." />
      </div>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 block h-full w-full" aria-hidden />
      {/* sombra de céu quando inclinado */}
      <AnimatePresence>
        {mode === "nav" && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-0 h-[38vh]"
            style={{ background: "linear-gradient(to bottom, var(--ui-bg) 0%, color-mix(in srgb, var(--ui-bg) 60%, transparent) 45%, transparent 100%)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}
          />
        )}
      </AnimatePresence>

      <div ref={topRef} className="pointer-events-none fixed inset-x-0 top-0 z-20 px-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] min-[900px]:right-auto min-[900px]:w-[436px]">
        <AnimatePresence mode="wait" initial={false}>
          {mode === "nav" ? <NavBanner key="nav" /> : <TopBar key="top" />}
        </AnimatePresence>
      </div>

      <Controls />
      <Sheet ref={sheetRef} wide={wide} />
      <Toast />
    </div>
  );
}

/* ---------------- barra superior ---------------- */
const CHIPS: { f: Filter; label: string }[] = [
  { f: "livres", label: "Com vaga agora" },
  { f: "rapido", label: "Rápido 100 kW+" },
  { f: "ccs2", label: "CCS2" },
  { f: "tipo2", label: "Tipo 2" },
];

function TopBar() {
  const engine = useEngine();
  const filters = useUI((s) => s.filters);
  return (
    <motion.header
      className="pointer-events-auto flex flex-col gap-2"
      initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-stretch gap-2">
        {/* sem "voltar ao site" dentro da central do carro (iframe) nem no app instalado */}
        {window.self === window.top && !isStandalone() && (
          <Link href="/" aria-label="Voltar ao site" className="ui-card grid h-[50px] w-[50px] flex-none place-items-center rounded-full">
            <BackIcon />
          </Link>
        )}
        <label className="ui-card flex h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-full px-4">
          <SearchIcon className="flex-none text-[var(--ui-muted)]" />
          <input
            type="search" placeholder="Buscar carregador" autoComplete="off" aria-label="Buscar carregador"
            className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-[var(--ui-muted)]"
            onChange={(e) => engine.setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); engine.searchSubmit(); } }}
          />
        </label>
        <Battery />
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtros de carregador">
        {CHIPS.map(({ f, label }) => {
          const on = filters.includes(f);
          return (
            <motion.button
              key={f} whileTap={{ scale: 0.94 }} aria-pressed={on} onClick={() => engine.toggleFilter(f)}
              className={`h-9 flex-none rounded-full px-3.5 text-sm font-semibold shadow-[var(--ui-shadow)] transition-colors ${on ? "bg-[var(--ui-text)] text-[var(--ui-bg)]" : "bg-[var(--ui-bg)]"}`}
            >
              {label}
            </motion.button>
          );
        })}
      </div>
    </motion.header>
  );
}

function Battery() {
  const batt = useUI((s) => s.batt);
  const range = useUI((s) => s.range);
  const b = Math.max(0, Math.min(100, batt));
  const color = b < 20 ? COR_STATUS.full : b < 35 ? COR_STATUS.warn : COR_STATUS.ok;
  return (
    <div className="ui-card tabular flex h-[50px] flex-none items-center gap-2 rounded-full pl-3 pr-3.5" aria-label={`Bateria ${Math.round(b)}%, autonomia ${Math.round(range)} km`}>
      <div className="relative h-[13px] w-[26px] rounded-[4px] border-2 border-current after:absolute after:-right-[5px] after:top-[2.5px] after:h-1 after:w-[3px] after:rounded-r-sm after:bg-current">
        <motion.i className="absolute bottom-px left-px top-px rounded-[1.5px]" animate={{ width: `calc(${b}% - 2px)`, backgroundColor: color }} transition={{ duration: 0.4 }} />
      </div>
      <b className="text-[15px] font-bold">{Math.round(b)}%</b>
      <span className="hidden text-[13px] text-[var(--ui-muted)] min-[380px]:inline">{Math.round(range)} km</span>
    </div>
  );
}

/* ---------------- faixa de instrução (GSAP no ícone) ---------------- */
function NavBanner() {
  const nav = useUI((s) => s.nav);
  const iconRef = useRef<HTMLDivElement>(null);
  const icon = nav?.icon;
  useGSAP(() => {
    if (!iconRef.current) return;
    gsap.fromTo(iconRef.current, { scale: 0.4, rotate: -25, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.55, ease: "back.out(2.2)" });
  }, { dependencies: [icon] });
  if (!nav) return null;
  return (
    <motion.div
      className="pointer-events-auto flex items-center gap-3.5 rounded-[20px] bg-[var(--color-navgreen)] px-4 py-3.5 text-white shadow-[var(--ui-shadow)]"
      initial={{ opacity: 0, y: -24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -24 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      role="status" aria-live="polite"
    >
      <div ref={iconRef} className="flex-none"><TurnGlyph icon={nav.icon} /></div>
      <div className="min-w-0">
        <div className="tabular text-[28px] font-extrabold leading-none">{nav.dist}</div>
        <div className="mt-1 text-[17px] font-semibold leading-tight">{nav.instr}</div>
        <div className="truncate text-[15px] opacity-85">{nav.street}</div>
      </div>
    </motion.div>
  );
}

/* ---------------- controles ---------------- */
function Controls() {
  const engine = useEngine();
  const follow = useUI((s) => s.follow);
  const showEV = useUI((s) => s.showEV);
  const dark = useUI((s) => s.dark);
  const btn = "grid h-[46px] w-[46px] place-items-center bg-[var(--ui-bg)] text-[var(--ui-text)]";
  return (
    <nav aria-label="Controles do mapa" className="fixed right-3 top-[calc(env(safe-area-inset-top,0px)+124px)] z-10 flex flex-col gap-2.5 min-[900px]:right-4 min-[900px]:top-1/2 min-[900px]:-translate-y-1/2">
      <div className="flex flex-col overflow-hidden rounded-[14px] shadow-[var(--ui-shadow)]">
        <motion.button whileTap={{ scale: 0.9 }} className={btn} onClick={() => engine.zoomBy(1.6)} aria-label="Aproximar"><PlusIcon /></motion.button>
        <motion.button whileTap={{ scale: 0.9 }} className={`${btn} border-t border-[var(--ui-line)]`} onClick={() => engine.zoomBy(1 / 1.6)} aria-label="Afastar"><MinusIcon /></motion.button>
      </div>
      <motion.button whileTap={{ scale: 0.9 }} className={`${btn} rounded-[14px] shadow-[var(--ui-shadow)] ${follow ? "" : "text-[var(--ui-muted)]"}`} onClick={() => engine.locate()} aria-label="Centralizar no meu carro">
        <LocateIcon />
      </motion.button>
      <motion.button whileTap={{ scale: 0.9 }} className={`${btn} rounded-[14px] shadow-[var(--ui-shadow)] ${showEV ? "text-[var(--color-route)]" : ""}`} aria-pressed={showEV} onClick={() => engine.toggleEV()} aria-label="Mostrar carros elétricos">
        <CarIcon />
      </motion.button>
      <motion.button whileTap={{ scale: 0.9, rotate: 30 }} className={`${btn} rounded-[14px] shadow-[var(--ui-shadow)]`} onClick={() => engine.toggleTheme()} aria-label="Alternar modo dia e noite">
        {dark ? <SunIcon /> : <MoonIcon />}
      </motion.button>
    </nav>
  );
}

/* ---------------- painel inferior / lateral (Motion) ---------------- */
function Sheet({ ref, wide }: { ref: React.Ref<HTMLElement>; wide: boolean }) {
  const mode = useUI((s) => s.mode);
  const [expanded, setExpanded] = useState(false);
  const onPanEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y < -30 || info.velocity.y < -300) setExpanded(true);
    else if (info.offset.y > 30 || info.velocity.y > 300) setExpanded(false);
  };
  useEffect(() => { if (mode === "nav") setExpanded(false); }, [mode]);

  const navLike = mode === "nav";
  return (
    <motion.section
      ref={ref}
      aria-live="polite"
      className={
        wide
          ? `fixed left-3 z-20 flex w-[436px] flex-col rounded-[20px] bg-[var(--ui-bg)] shadow-[var(--ui-shadow)] ${navLike ? "bottom-3" : "top-[calc(env(safe-area-inset-top,0px)+118px)]"}`
          : "fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[20px] bg-[var(--ui-bg)] pb-[calc(env(safe-area-inset-bottom,0px)+8px)] shadow-[0_-6px_28px_rgba(20,24,30,.18)]"
      }
      style={wide ? { maxHeight: navLike ? "40vh" : "calc(100% - 130px)" } : undefined}
      initial={false}
      animate={wide ? undefined : { maxHeight: expanded ? "76vh" : "42vh" }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      {!wide && (
        <motion.button
          onPanEnd={onPanEnd}
          onClick={() => setExpanded((v) => !v)}
          aria-label="Expandir ou recolher painel"
          className="grid h-6 w-full flex-none touch-none place-items-center"
        >
          <span className="h-[5px] w-10 rounded-full bg-[var(--ui-line)]" />
        </motion.button>
      )}
      <div className={`overflow-y-auto overscroll-contain px-4 pb-2 ${wide ? "pt-3.5" : ""}`}>
        <SheetContent />
      </div>
    </motion.section>
  );
}

/* ---------------- toast ---------------- */
function Toast() {
  const toast = useUI((s) => s.toast);
  const [visible, setVisible] = useState<typeof toast>(null);
  useEffect(() => {
    if (!toast) return;
    setVisible(toast);
    const t = setTimeout(() => setVisible(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+118px)] z-30 flex justify-center px-4" role="status">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={visible.id}
            initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}
            className="max-w-full rounded-xl bg-[var(--ui-text)] px-4 py-2.5 text-[14.5px] font-semibold text-[var(--ui-bg)] shadow-[var(--ui-shadow)]"
          >
            {visible.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
