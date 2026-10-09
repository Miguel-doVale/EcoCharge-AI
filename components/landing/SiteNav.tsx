"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { Logo } from "@/components/brand/Brand";
import { ThemeToggle } from "./SiteTheme";

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
        className={`mx-auto flex h-14 max-w-[1320px] items-center justify-between rounded-full pl-4 pr-1.5 transition-colors duration-500 ${solid ? "border border-fg/10 bg-ink/70 backdrop-blur-xl" : "border border-transparent"}`}
      >
        <Link href="/" aria-label="EcoCharge AI, início" className="flex-none"><span className="sm:hidden"><Logo h={11} mark={28} /></span><span className="hidden sm:block"><Logo /></span></Link>
        <div className="hidden items-center gap-7 text-sm font-medium text-mist lg:flex">
          <a href="#como-funciona" className="transition-colors hover:text-fg">Como funciona</a>
          <a href="#painel" className="transition-colors hover:text-fg">Test drive</a>
          <a href="#recursos" className="transition-colors hover:text-fg">Recursos</a>
          <a href="#arquitetura" className="transition-colors hover:text-fg">Arquitetura</a>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <Link href="/navegador" className="inline-flex h-11 items-center whitespace-nowrap rounded-full bg-fg px-4 text-sm sm:px-5 font-bold text-ink transition-colors hover:bg-volt">
          <span className="hidden sm:inline">Abrir navegador</span><span className="sm:hidden">Navegador</span>
        </Link>
        </div>
      </nav>
    </motion.header>
  );
}
