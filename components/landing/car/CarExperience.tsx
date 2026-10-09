"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useScroll, useTransform } from "motion/react";
import type { Cmd, Phase } from "./CarScene";

const CarScene = dynamic(() => import("./CarScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center">
      <div className="h-14 w-14 animate-spin rounded-full border-2 border-fg/10 border-t-volt" />
    </div>
  ),
});

const ease = [0.16, 1, 0.3, 1] as const;

export default function CarExperience() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "200px 0px" });
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("outside");
  const [cmd, setCmd] = useState<Cmd>(null);
  const [touch, setTouch] = useState(false);
  const screenEl = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 0.4], [0.9, 1]);
  const radius = useTransform(scrollYProgress, [0, 0.4], [56, 28]);

  useEffect(() => { if (inView) setMounted(true); }, [inView]);
  useEffect(() => { setTouch(matchMedia("(pointer: coarse), (max-width: 767px)").matches); }, []);
  // Esc sai do carro
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && phase === "inside") setCmd({ t: "leave", id: Date.now() }); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [phase]);

  const enter = () => setCmd({ t: "enter", id: Date.now() });
  const leave = () => setCmd({ t: "leave", id: Date.now() });

  return (
    <section id="painel" className="relative bg-ink px-3 py-24 text-fg sm:px-5 md:py-36">
      <div className="mx-auto mb-12 max-w-[1320px] px-2 sm:px-3 md:mb-16 md:flex md:items-end md:justify-between md:gap-10">
        <h2 className="max-w-[16ch] font-display text-[clamp(2rem,4.4vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-volt">
          Faça um test drive.
        </h2>
        <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-mist md:mt-0">
          Toque na porta do motorista, sente no banco e use o navegador de verdade, direto na central de 12,8 polegadas.
        </p>
      </div>

      <motion.div
        ref={ref}
        style={{ scale, borderRadius: radius }}
        className="site-dark relative mx-auto h-[min(80vh,780px)] min-h-[520px] max-w-[1400px] overflow-hidden border border-fg/10 bg-ink text-fg"
      >
        {mounted && <CarScene phase={phase} setPhase={setPhase} active={inView} touch={touch} cmd={cmd} screenEl={screenEl} onReady={onReady} />}

        {/* vinheta de cabine */}
        <AnimatePresence>
          {phase === "inside" && (
            <motion.div key="vig" className="pointer-events-none absolute inset-0 bg-[radial-gradient(75%_70%_at_50%_45%,transparent_55%,rgba(5,7,9,.85)_100%)]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} />
          )}
        </AnimatePresence>
        {/* navegador real na central: posicionado a cada quadro sobre a tela 3D (ScreenTracker) */}
        <div
          ref={screenEl}
          className="absolute left-0 top-0 origin-top-left overflow-hidden rounded-[18px] bg-[#0b1016]"
          style={{ width: 1280, height: 800, visibility: "hidden", pointerEvents: touch ? "none" : "auto" }}
        >
          {phase === "inside" && (
            <motion.iframe
              src="/navegador?embed=1" title="Navegador EcoCharge na central do carro"
              className="block h-full w-full border-0"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
            />
          )}
        </div>

        {/* rótulo do lado de fora */}
        <AnimatePresence>
          {phase === "outside" && ready && (
            <motion.div
              key="out" className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-4 sm:bottom-8"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease } }} exit={{ opacity: 0, y: 10 }}
            >
              <span className="flex items-center gap-2 text-sm text-mist">
                <i className="live-dot h-2 w-2 rounded-full bg-volt" />
                {touch ? "Toque em entrar" : "Clique na porta do motorista ou arraste para girar"}
              </span>
              <button onClick={enter} className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-volt px-6 font-bold text-ink transition-colors hover:bg-fg">
                Entrar no carro →
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* controles de dentro */}
        <AnimatePresence>
          {phase === "inside" && (
            <motion.div
              key="in" className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3 sm:p-5"
              initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease } }} exit={{ opacity: 0 }}
            >
              <button onClick={leave} className="inline-flex h-11 items-center gap-2 rounded-full border border-fg/15 bg-ink/70 px-4 text-sm font-semibold backdrop-blur-xl transition-colors hover:border-fg/40">
                ← Sair do carro
              </button>
              <Link href="/navegador" className="inline-flex h-11 items-center gap-2 rounded-full bg-fg px-4 text-sm font-bold text-ink transition-colors hover:bg-volt">
                Tela cheia ↗
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
        {phase === "inside" && touch && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-x-0 bottom-5 flex justify-center px-4">
            <Link href="/navegador" className="inline-flex h-12 items-center rounded-full bg-volt px-6 font-bold text-ink">Usar a central em tela cheia</Link>
          </motion.div>
        )}
        {(phase === "entering" || phase === "leaving") && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm text-mist">
            {phase === "entering" ? "Abrindo a porta…" : "Saindo do carro…"}
          </div>
        )}
      </motion.div>
      <p className="mx-auto mt-4 max-w-[1400px] px-2 text-xs text-mist/70 sm:px-3">Modelo 3D ilustrativo de um hatch elétrico compacto, sem relação com marcas.</p>
    </section>
  );
}
