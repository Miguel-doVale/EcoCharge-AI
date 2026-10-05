"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 font-display text-[15px] font-semibold tracking-tight text-white">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-volt text-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M13.5 2 4.5 13.5H11L9.5 22l10-12.5H13z" /></svg>
      </span>
      EcoCharge<span className="text-volt">AI</span>
    </span>
  );
}

export default function SiteNav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [hidden, setHidden] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setSolid(y > 40);
    setHidden(y > 600 && y > prev);
  });
  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3"
      animate={{ y: hidden ? -90 : 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <nav
        className={`mx-auto flex h-14 max-w-[1320px] items-center justify-between rounded-full pl-4 pr-1.5 transition-colors duration-500 ${solid ? "border border-white/10 bg-ink/70 backdrop-blur-xl" : "border border-transparent"}`}
      >
        <Link href="/" aria-label="EcoCharge AI, início"><Logo /></Link>
        <div className="hidden items-center gap-7 text-sm font-medium text-mist md:flex">
          <a href="#como-funciona" className="transition-colors hover:text-white">Como funciona</a>
          <a href="#painel" className="transition-colors hover:text-white">No painel</a>
          <a href="#recursos" className="transition-colors hover:text-white">Recursos</a>
          <a href="#arquitetura" className="transition-colors hover:text-white">Arquitetura</a>
        </div>
        <Link href="/navegador" className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-ink transition-colors hover:bg-volt">
          Abrir navegador
        </Link>
      </nav>
    </motion.header>
  );
}
