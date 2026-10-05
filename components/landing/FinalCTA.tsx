"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { Logo } from "./SiteNav";

export default function FinalCTA() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["12%", "-8%"]);

  // botão magnético
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 200, damping: 15 }), sy = useSpring(my, { stiffness: 200, damping: 15 });
  const onMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left - r.width / 2) * 0.25); my.set((e.clientY - r.top - r.height / 2) * 0.25);
  };

  return (
    <section ref={ref} className="relative overflow-hidden bg-ink pt-24 text-white md:pt-36">
      <motion.p style={{ x }} className="whitespace-nowrap font-display text-[clamp(4rem,14vw,13rem)] font-semibold leading-none tracking-[-0.05em] text-white/[.06]" aria-hidden>
        carregue onde tem vaga · carregue onde tem vaga
      </motion.p>
      <div className="mx-auto -mt-[clamp(3rem,9vw,8rem)] flex max-w-[1320px] flex-col items-center gap-8 px-5 text-center sm:px-8 md:flex-row md:items-end md:justify-between md:text-left">
        <h2 className="max-w-[14ch] font-display text-[clamp(2.2rem,5vw,4.4rem)] font-semibold leading-[1] tracking-[-0.035em]">
          Teste o navegador agora.
        </h2>
        <motion.div style={{ x: sx, y: sy }}>
          <Link href="/navegador" onMouseMove={onMove} onMouseLeave={() => { mx.set(0); my.set(0); }}
            className="grid h-44 w-44 place-items-center rounded-full bg-volt text-center font-display text-lg font-semibold text-ink transition-colors hover:bg-white md:h-52 md:w-52">
            Abrir<br />navegador →
          </Link>
        </motion.div>
      </div>

      <footer className="mx-auto mt-24 flex max-w-[1320px] flex-col gap-6 border-t border-white/[.08] px-5 py-10 text-sm text-mist sm:px-8 md:flex-row md:items-center md:justify-between">
        <Logo />
        <p>Protótipo. Cidade, carregadores e EVs são simulados; status inspirado no protocolo OCPI.</p>
        <p>© {new Date().getFullYear()} EcoCharge AI</p>
      </footer>
    </section>
  );
}
