"use client";

import { useEffect, useState } from "react";
import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { useRef } from "react";

function Counter({ to, suffix = "", decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const v = useMotionValue(0);
  const txt = useTransform(v, (x) => x.toFixed(decimals).replace(".", ",") + suffix);
  useEffect(() => { if (inView) animate(v, to, { duration: 1.8, ease: [0.16, 1, 0.3, 1] }); }, [inView, to, v]);
  return <motion.span ref={ref}>{txt}</motion.span>;
}

const EVENTS = [
  "Hub Beira-Rio · conector 3 liberado",
  "Posto Central · CCS2 120 kW ocupado",
  "Shopping Rio Claro · 2 vagas abertas",
  "Campus Tecnológico · Tipo 2 liberado",
  "Garagem Sul · fila zerada",
  "Arena Municipal · 180 kW disponível",
  "Praça dos Ipês · conector 1 ocupado",
];

export default function LiveTicker() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((t) => t + 1), 2600); return () => clearInterval(i); }, []);
  return (
    <section className="relative border-y border-white/[.07] bg-ink">
      <div className="mx-auto grid max-w-[1320px] grid-cols-2 gap-px bg-white/[.07] md:grid-cols-4">
        {[
          { n: 15, s: "", l: "carregadores mapeados na cidade-teste" },
          { n: 70, s: "", l: "EVs circulando em tempo real" },
          { n: 2.6, s: " s", d: 1, l: "entre atualizações de status" },
          { n: 180, s: " kW", l: "potência máxima por conector" },
        ].map((x) => (
          <div key={x.l} className="bg-ink px-5 py-9 sm:px-8">
            <div className="font-display text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-tight text-white tabular">
              <Counter to={x.n} suffix={x.s} decimals={x.d} />
            </div>
            <p className="mt-2 text-sm text-mist">{x.l}</p>
          </div>
        ))}
      </div>
      <div className="relative overflow-hidden border-t border-white/[.07] py-4">
        <motion.div
          className="flex w-max gap-10 whitespace-nowrap text-sm text-mist"
          animate={{ x: ["0%", "-50%"] }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        >
          {[...EVENTS, ...EVENTS].map((e, i) => (
            <span key={i} className="flex items-center gap-2.5">
              <i className={`h-1.5 w-1.5 rounded-full ${(i + tick) % 3 === 0 ? "bg-[#ff5a4a]" : "bg-[#3ee08f]"}`} />{e}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
