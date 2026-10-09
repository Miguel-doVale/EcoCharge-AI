"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const NODES = [
  { t: "MapLibre / Mapbox", m: "Integrar", d: "Mapa real em tiles vetoriais: estilo dia/noite e câmera 3D." },
  { t: "Camada EV própria", m: "Integrar", d: "Marcadores, clusters e prioridade de desenho sobre o mapa." },
  { t: "OCPI 2.2", m: "Integrar", d: "Protocolo aberto das redes: postos, pontos e status de cada conector." },
  { t: "Telemetria do veículo", m: "Calcular", d: "Bateria, consumo e posição lidos do carro via CAN/API." },
  { t: "Roteamento", m: "Calcular", d: "Rota por tempo com a bateria estimada na chegada." },
  { t: "Modelo de previsão (IA)", m: "Prever", d: "O histórico de status vira previsão de lotação por horário." },
];

const FLOW = ["Mapa", "Veículos próximos", "Carregadores", "Disponibilidade ao vivo", "Seleção do posto", "Conectores livres/ocupados", "Navegação até o carregador"];

export default function Architecture() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    gsap.from(".arch-node", {
      opacity: 0, y: 30, stagger: 0.12, duration: 0.9, ease: "expo.out",
      scrollTrigger: { trigger: ".arch-grid", start: "top 75%" },
    });
    gsap.fromTo(".arch-line", { scaleX: 0 }, {
      scaleX: 1, ease: "none", transformOrigin: "0% 50%",
      scrollTrigger: { trigger: ".arch-grid", start: "top 70%", end: "bottom 40%", scrub: true },
    });
    gsap.to(".arch-pulse", { xPercent: 1000, repeat: -1, duration: 3.2, ease: "power1.inOut" });
  }, { scope: root });

  return (
    <section id="arquitetura" ref={root} className="relative bg-ink px-5 py-24 text-fg sm:px-8 md:py-36">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-16 grid gap-8 md:grid-cols-2 md:items-end">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-volt">Arquitetura</p>
            <h2 className="font-display text-[clamp(2rem,4.4vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.03em]">Pronto para dados reais.</h2>
          </div>
          <p className="max-w-[52ch] text-lg leading-relaxed text-mist">
            Prever, calcular e integrar viram seis peças concretas. A cidade da demo é simulada, mas a lógica já é independente do mapa: plugar dados reais é trocar uma camada, não reescrever o app.
          </p>
        </div>

        <div className="arch-grid relative">
          <div className="absolute left-0 right-0 top-[38px] hidden h-px overflow-hidden bg-fg/10 lg:block">
            <div className="arch-line h-full w-full bg-volt" />
            <div className="arch-pulse absolute -left-[10%] top-[-2px] h-[5px] w-[10%] rounded-full bg-gradient-to-r from-transparent via-fg to-transparent" />
          </div>
          <ol className="grid gap-x-4 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {NODES.map((n, i) => (
              <li key={n.t} className="arch-node relative">
                <span className={`relative z-10 grid h-[76px] w-[76px] place-items-center rounded-full border bg-ink-2 font-display text-lg text-volt ${i === NODES.length - 1 ? "border-volt/60 shadow-[0_0_40px_-8px_var(--color-volt)]" : "border-fg/10"}`}>0{i + 1}</span>
                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-volt">{n.m}</p>
                <h3 className="mt-1 text-lg font-semibold">{n.t}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-mist">{n.d}</p>
              </li>
            ))}
          </ol>
        </div>

        <ol className="mt-20 flex flex-wrap items-center gap-x-2 gap-y-3 rounded-[28px] border border-fg/[.08] bg-ink-2 p-5 sm:p-7" aria-label="Fluxo do navegador">
          {FLOW.map((f, i) => (
            <li key={f} className="flex items-center gap-2">
              <span className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${i === FLOW.length - 1 ? "border-volt/50 bg-volt/10 text-volt" : "border-fg/10 bg-fg/[.04] text-fg/85"}`}>{f}</span>
              {i < FLOW.length - 1 && <span aria-hidden className="text-volt">→</span>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
