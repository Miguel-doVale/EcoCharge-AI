"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useInView, useScroll, useTransform } from "motion/react";

const Spline = dynamic(() => import("@splinetool/react-spline"), { ssr: false });

// Troque pela URL da sua cena publicada no Spline (Export → Code → React).
const SCENE = process.env.NEXT_PUBLIC_SPLINE_SCENE || "https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode";

const CALLOUTS = [
  { t: "Painel lateral em telas largas", d: "Lista e card à esquerda, mapa livre à direita, como na central multimídia.", pos: "left-4 top-6 sm:left-8 sm:top-10" },
  { t: "Alvos grandes para toque", d: "Botões de 46–50 px e texto legível com o carro em movimento.", pos: "right-4 top-1/3 sm:right-8" },
  { t: "Dia e noite", d: "Paletas de mapa separadas, trocadas com um toque.", pos: "bottom-6 left-4 sm:bottom-10 sm:left-1/4" },
];

export default function SplineStage() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "200px 0px" });
  const [state, setState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 0.45], [0.88, 1]);
  const radius = useTransform(scrollYProgress, [0, 0.45], [56, 28]);

  useEffect(() => {
    if (!inView || state !== "idle") return;
    setState("loading");
  }, [inView, state]);
  useEffect(() => {
    if (state !== "loading") return;
    const t = setTimeout(() => setState((s) => (s === "loading" ? "failed" : s)), 15000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <section id="painel" className="relative bg-ink px-3 py-24 text-white sm:px-5 md:py-36">
      <div className="mx-auto mb-12 max-w-[1320px] px-2 sm:px-3 md:mb-16 md:flex md:items-end md:justify-between md:gap-10">
        <h2 className="max-w-[16ch] font-display text-[clamp(2rem,4.4vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
          Feito para a central do carro.
        </h2>
        <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-mist md:mt-0">
          Arraste o objeto 3D. A mesma interface roda no celular, no tablet e no painel de 12,8 polegadas.
        </p>
      </div>

      <motion.div
        ref={ref}
        style={{ scale, borderRadius: radius }}
        className="relative mx-auto h-[min(78vh,760px)] max-w-[1400px] overflow-hidden border border-white/10 bg-[radial-gradient(80%_70%_at_50%_40%,#1b232c_0%,#0b0e12_70%)]"
      >
        {(state === "loading" || state === "ready") && (
          <Spline scene={SCENE} onLoad={() => setState("ready")} className="absolute inset-0" />
        )}
        {state !== "ready" && (
          <div className="absolute inset-0 grid place-items-center">
            {state === "failed" ? (
              <p className="max-w-[36ch] text-center text-mist">Não foi possível carregar a cena 3D. Confira a URL em <code className="text-white">NEXT_PUBLIC_SPLINE_SCENE</code>.</p>
            ) : (
              <motion.div className="h-14 w-14 rounded-full border-2 border-white/10 border-t-volt" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
            )}
          </div>
        )}
        {CALLOUTS.map((c, i) => (
          <motion.div
            key={c.t}
            className={`pointer-events-none absolute hidden max-w-[260px] rounded-2xl border border-white/10 bg-ink/60 p-4 backdrop-blur-xl md:block ${c.pos}`}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-15%" }}
            transition={{ delay: 0.2 + i * 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-2 text-[15px] font-semibold"><i className="h-1.5 w-1.5 rounded-full bg-volt" />{c.t}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-mist">{c.d}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
