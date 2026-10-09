"use client";

import { useEffect, useState } from "react";
import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { useRef } from "react";

function Counter({ to, prefix = "", suffix = "", decimals = 0 }: { to: number; prefix?: string; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const v = useMotionValue(0);
  const txt = useTransform(v, (x) => prefix + x.toFixed(decimals).replace(".", ",") + suffix);
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

const STATS = [
  { n: 21, p: "", s: " mil", l: "pontos públicos de recarga no Brasil hoje", src: "ABVE" },
  { n: 90, p: "", s: "%", l: "de crescimento anual da frota elétrica", src: "" },
  { n: 300, p: "", s: " mil", l: "carregadores necessários na América Latina", src: "ZapCharge" },
  { n: 30, p: "1:", s: "", l: "um eletroposto para cada 30 veículos", src: "Diário do Estado" },
];

export default function LiveTicker() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((t) => t + 1), 2600); return () => clearInterval(i); }, []);
  return (
    <section className="relative border-y border-fg/[.07] bg-ink">
      <div className="px-5 pt-10 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-volt">Urgência</p>
          <h2 className="mt-3 font-display text-[clamp(1.5rem,2.6vw,2.2rem)] font-semibold tracking-[-0.02em] text-fg">A infraestrutura não acompanha a demanda.</h2>
        </div>
      </div>
      <div className="mx-auto mt-8 grid max-w-[1320px] grid-cols-2 gap-px border-t border-fg/[.07] bg-fg/[.07] md:grid-cols-4">
        {STATS.map((x) => (
          <div key={x.l} className="flex flex-col bg-ink px-5 py-9 sm:px-8">
            <div className="font-display text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-tight text-fg tabular">
              <Counter to={x.n} prefix={x.p} suffix={x.s} />
            </div>
            <p className="mt-2 text-sm text-mist">{x.l}</p>
            {x.src && <p className="mt-auto pt-3 text-[11px] text-mist/60">Fonte: {x.src}</p>}
          </div>
        ))}
      </div>
      <div className="relative overflow-hidden border-t border-fg/[.07] py-4">
        <motion.div
          className="flex w-max gap-10 whitespace-nowrap text-sm text-mist"
          animate={{ x: ["0%", "-50%"] }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        >
          {[...EVENTS, ...EVENTS].map((e, i) => (
            <span key={i} className="flex items-center gap-2.5">
              <i className={`h-1.5 w-1.5 rounded-full ${(i + tick) % 3 === 0 ? "bg-s-full" : "bg-s-ok"}`} />{e}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
