"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { motion, useInView } from "motion/react";
import InstallButton from "@/components/pwa/InstallButton";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const scroll = useRef(0);
  const inView = useInView(root, { margin: "100px 0px" });

  useGSAP(() => {
    const split = SplitText.create(".hero-title", { type: "lines,words", mask: "lines" });
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from(split.words, { yPercent: 110, duration: 1.3, stagger: 0.045, delay: 0.2 })
      .from(".hero-fade", { opacity: 0, y: 18, duration: 1, stagger: 0.1 }, "-=0.9")
      .from(".hero-card", { opacity: 0, y: 40, scale: 0.96, duration: 1.2 }, "-=0.9");

    ScrollTrigger.create({
      trigger: root.current, start: "top top", end: "bottom top", scrub: true,
      onUpdate: (s) => { scroll.current = s.progress; },
    });
    gsap.to(".hero-copy", { yPercent: -30, opacity: 0, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "70% top", scrub: true } });
    return () => split.revert();
  }, { scope: root });

  return (
    <section ref={root} className="grain relative h-[100svh] min-h-[640px] overflow-hidden bg-ink">
      <div className="absolute inset-0"><HeroScene scrollRef={scroll} active={inView} /></div>
      {/* vinheta para leitura do texto */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_80%,rgba(7,9,11,.92)_0%,rgba(7,9,11,.55)_45%,transparent_75%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />

      <div className="hero-copy relative z-10 mx-auto flex h-full max-w-[1320px] flex-col justify-end px-5 pb-16 sm:px-8 md:pb-24">
        <p className="hero-fade mb-5 flex items-center gap-2 text-sm font-medium text-mist">
          <span className="live-dot h-2 w-2 rounded-full bg-[#3ee08f]" />
          Disponibilidade de carregadores ao vivo
        </p>
        <h1 className="hero-title max-w-[15ch] font-display text-[clamp(2.6rem,7.2vw,6.4rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-white">
          O mapa que sabe onde tem vaga.
        </h1>
        <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p className="hero-fade max-w-[46ch] text-lg leading-relaxed text-mist">
            Navegação automotiva feita para carros elétricos. Veja cada conector livre ou ocupado, trace a rota pelo caminho real e chegue com bateria para carregar.
          </p>
          <div className="hero-fade pointer-events-auto flex flex-wrap gap-3">
            <Link href="/navegador" className="group inline-flex h-14 items-center gap-3 rounded-full bg-volt pl-6 pr-2 text-base font-bold text-ink transition-colors hover:bg-white">
              Abrir navegador
              <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-volt transition-transform duration-500 ease-out-expo group-hover:translate-x-1 group-hover:-rotate-45">→</span>
            </Link>
            <InstallButton />
            <a href="#como-funciona" className="inline-flex h-14 items-center rounded-full border border-white/15 px-6 text-base font-semibold text-white transition-colors hover:border-white/40">
              Como funciona
            </a>
          </div>
        </div>
      </div>

      {/* card flutuante: exemplo de posto */}
      <motion.div
        className="hero-card pointer-events-none absolute right-6 top-28 z-10 hidden w-[300px] rounded-3xl border border-white/10 bg-ink-2/70 p-5 text-white backdrop-blur-xl lg:block"
        animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center justify-between text-xs text-mist">
          <span>Hub Beira-Rio · Voltra</span><span className="flex items-center gap-1.5"><i className="live-dot h-1.5 w-1.5 rounded-full bg-[#3ee08f]" />ao vivo</span>
        </div>
        <div className="mt-3 font-display text-2xl font-semibold tracking-tight">4 <span className="text-mist">de 6 livres</span></div>
        <div className="mt-4 grid grid-cols-6 gap-1.5">
          {["ok", "ok", "full", "ok", "full", "ok"].map((s, i) => (
            <span key={i} className={`h-10 rounded-lg ${s === "ok" ? "bg-[#3ee08f]/85" : "bg-[#ff5a4a]/80"}`} />
          ))}
        </div>
        <div className="mt-4 flex justify-between text-sm text-mist"><span>até 120 kW</span><span>1,2 km · 4 min</span></div>
      </motion.div>
    </section>
  );
}
