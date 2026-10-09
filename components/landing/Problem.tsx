"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { motion } from "motion/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const ease = [0.16, 1, 0.3, 1] as const;
const STORY = "Você saiu de casa com 30% de bateria. O carregador mais próximo fica a 8 quilômetros. Você chega lá… e tem fila. O próximo está fora de operação. E o seguinte fica do outro lado da cidade.";
const QUOTES = [
  "A infraestrutura é precária.",
  "Preciso planejar a rota inteira em função dos carregadores.",
  "Perco 40 minutos esperando numa fila de shopping.",
];
const BEATS = ["Sem dados.", "Sem previsão.", "Sem inteligência."];

/* Parte 1 do pitch, em dois blocos (a faixa de urgência fica entre eles):
   "story" = Imagine… · "voice" = voz do usuário + diagnóstico. */
export default function Problem({ part }: { part: "story" | "voice" }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (part !== "story") return;
    // a história "acende" palavra por palavra enquanto se lê
    gsap.fromTo(".story-w", { opacity: 0.16 }, {
      opacity: 1, stagger: 0.05, ease: "none",
      scrollTrigger: { trigger: ".story", start: "top 80%", end: "bottom 45%", scrub: true },
    });
  }, { scope: root });

  return (
    <section id={part === "story" ? "problema" : "voz-do-usuario"} ref={root} className="relative bg-ink px-5 py-24 text-fg sm:px-8 md:py-36">
      <div className="mx-auto max-w-[1320px]">
        {part === "story" && <>
        {/* Imagine… */}
        <p className="mb-6 text-sm font-semibold uppercase tracking-[0.18em] text-volt">Imagine…</p>
        <p className="story max-w-[24ch] font-display text-[clamp(1.7rem,3.6vw,3.2rem)] font-semibold leading-[1.12] tracking-[-0.025em]">
          {STORY.split(" ").map((w, i) => <span key={i} className="story-w">{w} </span>)}
        </p>
        <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-mist">
          Isso não é ficção. <span className="text-fg">É o dia a dia de milhões de motoristas elétricos no Brasil.</span>
        </p>

        </>}

        {part === "voice" && <>
        {/* voz do usuário */}
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-volt">Voz do usuário</p>
          <h2 className="font-display text-[clamp(2rem,4.4vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
            Nós fomos a campo. <span className="text-mist">Ouvimos isso:</span>
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {QUOTES.map((q, i) => (
              <motion.figure key={q}
                initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.9, delay: i * 0.1, ease }}
                className="flex flex-col justify-between gap-10 rounded-[28px] border border-fg/[.08] bg-ink-2 p-6 sm:p-8">
                <span className="font-display text-5xl leading-none text-volt" aria-hidden>“</span>
                <blockquote className="text-2xl font-semibold leading-snug tracking-tight">{q}</blockquote>
                <figcaption className="text-sm text-mist">Motorista de carro elétrico</figcaption>
              </motion.figure>
            ))}
          </div>
          <p className="mt-10 max-w-[60ch] text-lg leading-relaxed text-mist">
            Famílias repensando viagens. Entregadores perdendo produtividade e renda. E o mais cruel: <span className="text-fg">o carregador ultrarrápido existe, mas só nos bairros nobres.</span>
          </p>
          <p className="mt-4 text-[11px] text-mist/60">Fonte: entrevistas de campo da equipe EcoCharge AI com motoristas de veículos elétricos.</p>
        </div>

        {/* diagnóstico */}
        <div className="mt-28 grid gap-10 md:mt-40 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-volt">Diagnóstico</p>
            <h2 className="font-display text-[clamp(2.2rem,5.2vw,4.6rem)] font-semibold leading-[1] tracking-[-0.035em]">
              O problema não é quantidade. <span className="text-volt">É inteligência.</span>
            </h2>
            <p className="mt-8 max-w-[48ch] text-lg leading-relaxed text-mist">
              Redes que não conversam entre si. Filas que poderiam ser evitadas. Um ecossistema inteiro operando no escuro.
            </p>
          </div>
          <ul className="space-y-2">
            {BEATS.map((b, i) => (
              <motion.li key={b}
                initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.25, ease }}
                className="border-b border-fg/[.08] pb-3 font-display text-[clamp(1.6rem,3vw,2.6rem)] font-semibold tracking-[-0.02em] last:border-0">
                {b}
              </motion.li>
            ))}
          </ul>
        </div>
        </>}
      </div>
    </section>
  );
}
