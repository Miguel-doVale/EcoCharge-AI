"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const NODES = [
  { t: "MapLibre / Mapbox", d: "Tiles vetoriais, estilo dia/noite, câmera 3D." },
  { t: "Camada EV própria", d: "Marcadores, clusters e prioridade de desenho." },
  { t: "OCPI 2.2", d: "Locations, EVSEs e status de cada conector." },
  { t: "Telemetria do veículo", d: "Bateria, consumo e posição via CAN/API." },
  { t: "Roteamento", d: "Rota por tempo com bateria estimada na chegada." },
];

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
    <section id="arquitetura" ref={root} className="relative bg-ink px-5 py-24 text-white sm:px-8 md:py-36">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-16 grid gap-8 md:grid-cols-2 md:items-end">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-volt">Arquitetura</p>
            <h2 className="font-display text-[clamp(2rem,4.4vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.03em]">Pronto para dados reais.</h2>
          </div>
          <p className="max-w-[52ch] text-lg leading-relaxed text-mist">
            Hoje a cidade é simulada no próprio código para a demo funcionar em qualquer lugar. A lógica de carregadores, status, rota e painel já está separada do desenho do mapa, então trocar pelo mapa geográfico real é uma substituição de camada, não uma reescrita.
          </p>
        </div>

        <div className="arch-grid relative">
          <div className="absolute left-0 right-0 top-[38px] hidden h-px overflow-hidden bg-white/10 md:block">
            <div className="arch-line h-full w-full bg-volt" />
            <div className="arch-pulse absolute -left-[10%] top-[-2px] h-[5px] w-[10%] rounded-full bg-gradient-to-r from-transparent via-white to-transparent" />
          </div>
          <ol className="grid gap-4 md:grid-cols-5">
            {NODES.map((n, i) => (
              <li key={n.t} className="arch-node relative">
                <span className="relative z-10 grid h-[76px] w-[76px] place-items-center rounded-full border border-white/10 bg-ink-2 font-display text-lg text-volt">0{i + 1}</span>
                <h3 className="mt-5 text-lg font-semibold">{n.t}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-mist">{n.d}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-20 rounded-[28px] border border-white/[.08] bg-ink-2 p-6 font-mono text-[13px] leading-relaxed text-mist sm:p-8">
          <span className="text-white">Mapa</span> → veículos próximos → <span className="text-white">carregadores</span> → disponibilidade ao vivo → <span className="text-white">seleção do posto</span> → conectores ocupados/livres → <span className="text-volt">navegação até o carregador</span>
        </div>
      </div>
    </section>
  );
}
