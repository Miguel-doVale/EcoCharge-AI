"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// a ordem segue as camadas da animação; cada passo diz a qual movimento do pitch pertence
const STEPS = [
  { k: "Mapa", m: "Integrar", t: "Um mapa de verdade, não um dashboard", d: "Ruas, quarteirões, rio e parques reconhecíveis, com o seu carro no centro e orientado." },
  { k: "Veículos próximos", m: "Integrar", t: "EVs como marcadores discretos", d: "Carros elétricos aparecem como setas pequenas e viram clusters ao afastar o zoom." },
  { k: "Carregadores", m: "Integrar", t: "Todas as redes num mapa só", d: "Postos de redes diferentes na mesma camada, com o número de vagas livres no marcador." },
  { k: "Disponibilidade ao vivo", m: "Prever", t: "Verde, amarelo, vermelho", d: "Com vagas, quase cheio ou lotado, atualizado a cada poucos segundos. O próximo passo é prever a fila antes dela se formar." },
  { k: "Seleção do posto", m: "Prever", t: "Conector por conector", d: "Conectores livres e ocupados, potência máxima e a previsão de quando cada um libera." },
  { k: "Navegação", m: "Calcular", t: "Rota até a tomada", d: "Rota mais eficiente pelas ruas, com tempo, chegada e a bateria estimada ao chegar." },
];

const PINS = [
  { x: 150, y: 110, n: 4, c: "#3ee08f" },
  { x: 470, y: 90, n: 1, c: "#ffc23d" },
  { x: 520, y: 290, n: 0, c: "#ff5a4a" },
  { x: 250, y: 300, n: 6, c: "#3ee08f" },
  { x: 360, y: 190, n: 3, c: "#3ee08f" },
];
const EVS = [[95, 200, 0], [210, 60, 90], [300, 250, 180], [420, 150, 270], [560, 200, 90], [340, 330, 0], [180, 240, 270], [500, 60, 180], [610, 120, 0], [70, 330, 90]];

export default function HowItWorks() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: root.current, start: "top top", end: "+=" + STEPS.length * 85 + "%", pin: ".hiw-pin", scrub: 0.8,
          onUpdate: (s) => setActive(Math.min(STEPS.length - 1, Math.floor(s.progress * STEPS.length * 0.999))),
        },
      });
      buildTimeline(tl);
    });
    mm.add("(max-width: 899px)", () => {
      const tl = gsap.timeline({ defaults: { ease: "power2.inOut" }, scrollTrigger: { trigger: ".hiw-screen", start: "top 70%", end: "+=900", scrub: 0.8 } });
      buildTimeline(tl);
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <section id="como-funciona" ref={root} className="relative bg-ink text-fg">
      <div className="hiw-pin mx-auto grid min-h-[100svh] max-w-[1384px] items-center gap-12 px-5 py-24 sm:px-8 min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[900px]:py-0">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-volt">Como funciona</p>
          <h2 className="font-display text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
            Prever. Calcular. Integrar.
          </h2>
          <p className="mt-4 text-lg text-mist">Três movimentos. Uma rede só.</p>
          <ol className="mt-8 space-y-1">
            {STEPS.map((s, i) => {
              const on = i === active, done = i < active;
              return (
                <li key={s.k} className={`relative overflow-hidden rounded-2xl border py-3 pl-5 pr-4 transition-all duration-500 ${on ? "border-volt/25 bg-volt/[.06]" : "border-transparent min-[900px]:opacity-50"}`}>
                  {/* barra de progresso da etapa */}
                  <span className={`absolute inset-y-3 left-0 w-[3px] rounded-full transition-colors duration-500 ${on ? "bg-volt" : done ? "bg-volt/40" : "bg-fg/10"}`} />
                  <div className="flex items-center gap-3.5">
                    <span className={`grid h-7 w-7 flex-none place-items-center rounded-full font-display text-[11px] font-semibold tabular transition-colors duration-500 ${on ? "bg-volt text-ink" : done ? "bg-volt/15 text-volt" : "bg-fg/[.06] text-mist"}`}>0{i + 1}</span>
                    <span className="min-w-0">
                      <span className={`block text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors duration-500 ${on ? "text-volt" : "text-mist"}`}>{s.m}</span>
                      <span className="block text-lg font-semibold leading-snug">{s.t}</span>
                    </span>
                  </div>
                  <p className={`grid transition-all duration-500 ${on ? "mt-2 grid-rows-[1fr]" : "mt-2 grid-rows-[1fr] min-[900px]:mt-0 min-[900px]:grid-rows-[0fr]"}`}>
                    <span className="overflow-hidden pl-[42px] text-[15px] leading-relaxed text-volt">{s.d}</span>
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        {/* "tela" da central multimídia */}
        <div className="hiw-screen site-dark relative">
          <div className="pointer-events-none absolute -inset-3 rounded-[48px] sm:-inset-10 bg-[radial-gradient(closest-side,rgba(184,255,60,.12),transparent)]" />
          <div className="relative rounded-[28px] border border-fg/10 bg-gradient-to-b from-[#1a1f26] to-[#0c0f13] p-3 shadow-[0_40px_120px_-30px_rgba(0,0,0,.9)]">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[20px] bg-[#161a20]">
              <svg viewBox="0 0 640 400" className="absolute inset-0 h-full w-full" aria-label="Ilustração do navegador montando camadas">
                {/* camada 1: mapa */}
                <g className="l-map">
                  <rect width="640" height="400" fill="#161a20" />
                  <path d="M0 236 C 120 226, 220 250, 330 238 S 540 226, 640 240 L640 270 C 540 256, 430 270, 330 266 S 120 256, 0 266Z" fill="#0d2740" />
                  <rect x="40" y="300" width="110" height="80" rx="4" fill="#1b2e22" />
                  {[60, 140, 220, 300, 380, 460, 540, 620].map((x) => <line key={"v" + x} x1={x} y1="0" x2={x} y2="400" stroke={x % 160 === 140 ? "#6b5b36" : "#2c333d"} strokeWidth={x % 160 === 140 ? 9 : 5} />)}
                  {[40, 120, 200, 290, 360].map((y) => <line key={"h" + y} x1="0" y1={y} x2="640" y2={y} stroke={y === 120 ? "#6b5b36" : "#2c333d"} strokeWidth={y === 120 ? 9 : 5} />)}
                  <text x="470" y="256" fill="#7fa9d4" fontSize="11" fontStyle="italic" fontWeight="600">Rio Claro</text>
                </g>
                {/* camada 2: EVs */}
                <g className="l-evs" opacity="0">
                  {EVS.map(([x, y, r], i) => (
                    <path key={i} d="M9 0 -6 -5.5 -3.5 0 -6 5.5Z" transform={`translate(${x} ${y}) rotate(${r})`} fill="#2fc0aa" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
                  ))}
                  <g transform="translate(560 340)"><circle r="17" fill="#2fc0aa" opacity=".85" stroke="#fff" strokeWidth="2" /><text textAnchor="middle" dy="4" fill="#fff" fontSize="12" fontWeight="700">12</text></g>
                </g>
                {/* camada 3: carregadores */}
                <g className="l-pins" opacity="0">
                  {PINS.map((p, i) => (
                    <g key={i} transform={`translate(${p.x} ${p.y})`} className="l-pin">
                      <path d="M-7 -34 h14 a12 12 0 0 1 0 24 h-1 l-6 7 -6 -7 h-1 a12 12 0 0 1 0 -24z" transform="scale(1.35 1)" fill="#fff" />
                      <path d="M-7 -32 h14 a10 10 0 0 1 0 20 h-2 l-5 6 -5 -6 h-2 a10 10 0 0 1 0 -20z" transform="scale(1.35 1)" className="l-pinfill" fill={p.c} />
                      <text x="4" y="-17" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800">{p.n}</text>
                      <path d="M-11 -27 l-4 6 h3 l-1 5 4 -6 h-3z" fill="#fff" />
                    </g>
                  ))}
                </g>
                {/* camada 4: ao vivo (anéis) */}
                <g className="l-live" opacity="0">
                  {PINS.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="16" fill="none" stroke={p.c} strokeWidth="2" className="l-ring" />)}
                </g>
                {/* camada 6: rota */}
                <path className="l-route" d="M300 120 L300 200 L360 200 L360 190" fill="none" stroke="#5b92ff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="200" strokeDashoffset="200" />
                {/* carro */}
                <g transform="translate(300 120)">
                  <circle r="16" fill="rgba(200,16,46,.2)" />
                  <path d="M0 -12 9 10 0 5 -9 10Z" fill="#c8102e" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" transform="rotate(180)" />
                </g>
              </svg>

              {/* camada 5: card do posto */}
              <div className="l-card absolute bottom-3 left-3 w-[58%] max-w-[300px] rounded-2xl bg-[#1e232b] p-3.5 text-[#eef0f3] opacity-0 shadow-2xl sm:bottom-4 sm:left-4">
                <div className="text-[13px] font-bold sm:text-[15px]">Posto Central</div>
                <div className="text-[10px] text-[#9ea6b1] sm:text-xs">Recarga Já · Av. Brasil</div>
                <div className="mt-2 grid grid-cols-4 divide-x divide-[#2e3540] rounded-lg border border-[#2e3540] text-center">
                  {[["6", "conect."], ["4", "livres"], ["2", "ocup."], ["120", "kW"]].map(([n, l], i) => (
                    <div key={l} className="py-1"><b className={`block text-sm sm:text-lg ${i === 1 ? "text-s-ok" : i === 2 ? "text-s-full" : ""}`}>{n}</b><span className="text-[9px] text-[#9ea6b1] sm:text-[10px]">{l}</span></div>
                  ))}
                </div>
                <div className="mt-2 rounded-lg bg-[#2f6fe4] py-1.5 text-center text-[11px] font-bold sm:text-sm">Traçar rota · 3 min</div>
              </div>
              {/* camada 6: faixa de instrução */}
              <div className="l-banner absolute left-3 right-3 top-3 flex items-center gap-3 rounded-2xl bg-[#0b6e4f] px-3.5 py-2.5 text-fg opacity-0 sm:right-auto sm:w-[60%]">
                <svg width="30" height="30" viewBox="0 0 48 48" aria-hidden><path d="M14 40V24a6 6 0 0 1 6-6h16" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" /><path d="M30 10l9 8-9 8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <div><div className="text-lg font-extrabold leading-none">120 m</div><div className="text-xs font-semibold opacity-90 sm:text-sm">Vire à direita na Av. Brasil</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildTimeline(tl: gsap.core.Timeline) {
  tl.from(".l-map", { opacity: 0.25, scale: 1.08, transformOrigin: "50% 50%", duration: 1 })
    .to(".l-evs", { opacity: 1, duration: 1 })
    .to(".l-pins", { opacity: 1, duration: 0.4 })
    .from(".l-pin", { y: -24, opacity: 0, stagger: 0.12, duration: 0.6, ease: "back.out(2)" }, "<")
    .to(".l-evs", { opacity: 0.45, duration: 0.5 })
    .to(".l-live", { opacity: 1, duration: 0.4 })
    .fromTo(".l-ring", { attr: { r: 10 }, opacity: 1 }, { attr: { r: 34 }, opacity: 0, stagger: 0.1, duration: 0.8 }, "<")
    .fromTo(".l-card", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8 })
    .to(".l-card", { opacity: 0, y: 20, duration: 0.5 }, "+=0.4")
    .to(".l-route", { strokeDashoffset: 0, duration: 1 })
    .to(".l-banner", { opacity: 1, duration: 0.5 }, "<0.3")
    .to({}, { duration: 0.4 });
}
