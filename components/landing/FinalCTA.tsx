"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { Logo } from "@/components/brand/Brand";

// slogan da marca, repetido em loop
const PHRASES = Array.from({ length: 4 }, () => "mais do que uma IA");

export default function FinalCTA() {
  // botão magnético. A posição é medida no wrapper parado (não no botão que se move),
  // senão o próprio deslocamento realimenta o cálculo e o botão "foge" do clique.
  const zone = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 200, damping: 18 }), sy = useSpring(my, { stiffness: 200, damping: 18 });
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !zone.current) return;
    const r = zone.current.getBoundingClientRect();
    mx.set((e.clientX - r.left - r.width / 2) * 0.18); my.set((e.clientY - r.top - r.height / 2) * 0.18);
  };
  const reset = () => { mx.set(0); my.set(0); };

  return (
    <section className="relative overflow-hidden bg-ink pt-12 text-fg md:pt-16">
      {/* carrossel de fundo: decorativo, nunca recebe clique nem seleção */}
      <div className="pointer-events-none select-none overflow-hidden" aria-hidden>
        <motion.div
          className="flex w-max whitespace-nowrap font-display text-[clamp(4rem,14vw,13rem)] font-semibold leading-none tracking-[-0.05em] text-fg/[.06]"
          animate={{ x: ["0%", "-50%"] }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        >
          {[0, 1].map((k) => (
            <span key={k} className="flex">
              {PHRASES.map((p, i) => <span key={i} className="pr-[0.6em]">{p} ·</span>)}
            </span>
          ))}
        </motion.div>
      </div>

      <div className="relative z-10 mx-auto -mt-[clamp(3rem,9vw,8rem)] flex max-w-[1384px] flex-col items-center gap-8 px-5 text-center sm:px-8 md:flex-row md:items-end md:justify-between md:text-left">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-volt">A pergunta que fica</p>
          <h2 className="max-w-[20ch] font-display text-[clamp(2rem,4.4vw,3.8rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
            Quando o caos chegar… <span className="text-mist">o que teremos feito para evitá-lo?</span>
          </h2>
        </div>
        {/* área de captura maior que o botão: o ímã começa antes e o clique nunca cai fora */}
        <div ref={zone} onPointerMove={onMove} onPointerLeave={reset} className="-m-6 p-6">
          <motion.div style={{ x: sx, y: sy }}>
            <Link href="/navegador" draggable={false}
              className="grid h-44 w-44 select-none place-items-center rounded-full bg-volt text-center font-display text-lg font-semibold text-ink transition-colors hover:bg-fg md:h-52 md:w-52">
              <span>Abrir<br />navegador →</span>
            </Link>
          </motion.div>
        </div>
      </div>

      <footer className="mx-auto mt-36 flex max-w-[1320px] flex-col gap-6 border-t border-fg/[.08] px-5 py-10 text-sm text-mist sm:px-8 md:mt-52 md:flex-row md:items-center md:justify-between">
        <Logo h={12} mark={28} />
        <p>Protótipo. Cidade, carregadores e EVs são simulados; status inspirado no protocolo OCPI.</p>
        <p>© {new Date().getFullYear()} EcoCharge AI</p>
      </footer>
    </section>
  );
}
