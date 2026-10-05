"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

const ease = [0.16, 1, 0.3, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-10%" },
};

function Card({ className = "", delay = 0, children }: { className?: string; delay?: number; children: React.ReactNode }) {
  return (
    <motion.article {...reveal} transition={{ duration: 0.9, delay, ease }}
      className={`group relative overflow-hidden rounded-[28px] border border-white/[.08] bg-ink-2 p-6 sm:p-8 ${className}`}>
      {children}
    </motion.article>
  );
}

/** conectores que mudam de estado sozinhos */
function LiveConnectors() {
  const [st, setSt] = useState(["ok", "ok", "full", "ok", "full", "ok", "off", "ok"]);
  useEffect(() => {
    const i = setInterval(() => setSt((s) => s.map((x) => (x === "off" ? x : Math.random() < 0.18 ? (x === "ok" ? "full" : "ok") : x))), 1600);
    return () => clearInterval(i);
  }, []);
  const free = st.filter((x) => x === "ok").length;
  return (
    <div>
      <div className="mb-4 flex items-baseline gap-2 font-display">
        <motion.span key={free} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-5xl font-semibold text-white">{free}</motion.span>
        <span className="text-mist">de 8 livres agora</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {st.map((s, i) => (
          <motion.div key={i} layout animate={{ backgroundColor: s === "ok" ? "rgba(62,224,143,.9)" : s === "full" ? "rgba(255,90,74,.85)" : "rgba(124,133,144,.5)" }}
            transition={{ duration: 0.5 }} className="flex h-16 flex-col justify-end rounded-xl p-2 text-[11px] font-semibold text-ink">
            <span>#{i + 1}</span><span className="opacity-70">{i < 6 ? "CCS2" : "Tipo 2"}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Clusters() {
  return (
    <svg viewBox="0 0 300 150" className="h-auto w-full" aria-hidden>
      {[...Array(18)].map((_, i) => {
        const x = 30 + ((i * 53) % 240), y = 25 + ((i * 37) % 100);
        return (
          <motion.circle key={i} r="4" fill="#2fc0aa"
            initial={{ cx: x, cy: y }} whileInView={{ cx: i % 2 ? 90 : 210, cy: i % 3 ? 75 : 70 }}
            viewport={{ once: false, margin: "-20%" }} transition={{ duration: 1.2, delay: 0.4 + i * 0.02, ease }} />
        );
      })}
      <motion.g initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: false, margin: "-20%" }} transition={{ delay: 1.3, duration: 0.5 }} style={{ transformOrigin: "150px 75px" }}>
        <circle cx="90" cy="75" r="22" fill="#2fc0aa" stroke="#fff" strokeWidth="2.5" /><text x="90" y="80" textAnchor="middle" fill="#fff" fontWeight="700" fontSize="15">9</text>
        <circle cx="210" cy="72" r="22" fill="#2fc0aa" stroke="#fff" strokeWidth="2.5" /><text x="210" y="77" textAnchor="middle" fill="#fff" fontWeight="700" fontSize="15">9</text>
      </motion.g>
    </svg>
  );
}

function BatteryRoute() {
  return (
    <div className="space-y-3">
      {[["Hub Beira-Rio", 31, "ok"], ["Garagem Sul", 18, "warn"], ["Posto Litorânea", 2, "full"]].map(([n, b, s], i) => (
        <div key={n as string}>
          <div className="mb-1.5 flex justify-between text-sm"><span className="text-white">{n}</span><span className="tabular text-mist">chega com <b className={s === "ok" ? "text-[#3ee08f]" : s === "warn" ? "text-[#ffc23d]" : "text-[#ff5a4a]"}>{b}%</b></span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[.06]">
            <motion.div className={`h-full rounded-full ${s === "ok" ? "bg-[#3ee08f]" : s === "warn" ? "bg-[#ffc23d]" : "bg-[#ff5a4a]"}`}
              initial={{ width: "38%" }} whileInView={{ width: `${b}%` }} viewport={{ once: true }} transition={{ duration: 1.4, delay: 0.3 + i * 0.15, ease }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Features() {
  return (
    <section id="recursos" className="relative bg-ink px-5 py-24 text-white sm:px-8 md:py-36">
      <div className="mx-auto max-w-[1320px]">
        <motion.div {...reveal} transition={{ duration: 0.9, ease }} className="mb-14 max-w-[720px]">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-volt">Recursos</p>
          <h2 className="font-display text-[clamp(2rem,4.4vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
            Informação de recarga onde ela importa: <span className="text-mist">no mapa.</span>
          </h2>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-6">
          <Card className="md:col-span-4">
            <h3 className="text-2xl font-semibold tracking-tight">Status por conector, ao vivo</h3>
            <p className="mb-8 mt-2 max-w-[48ch] text-mist">Cada tomada com tipo, potência e previsão de liberação. O número no marcador muda junto.</p>
            <LiveConnectors />
          </Card>
          <Card className="md:col-span-2" delay={0.08}>
            <h3 className="text-2xl font-semibold tracking-tight">Clusters de EVs</h3>
            <p className="mb-6 mt-2 text-mist">Afastou o zoom, os carros se agrupam. Aproximou, cada um aparece.</p>
            <Clusters />
          </Card>
          <Card className="md:col-span-3" delay={0.04}>
            <h3 className="text-2xl font-semibold tracking-tight">Rota com bateria na chegada</h3>
            <p className="mb-8 mt-2 text-mist">Postos fora do alcance são sinalizados antes de você sair.</p>
            <BatteryRoute />
          </Card>
          <Card className="md:col-span-3" delay={0.12}>
            <h3 className="text-2xl font-semibold tracking-tight">Reserve o conector</h3>
            <p className="mt-2 text-mist">Segure uma tomada livre por 15 minutos enquanto dirige até o posto. Ao chegar, a recarga começa nele.</p>
            <div className="mt-8 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#2f6fe4] font-display text-lg font-semibold">#3</span>
              <div className="flex-1"><div className="font-semibold">Conector 3 reservado</div><div className="text-sm text-mist">CCS2 · 150 kW · expira em 14:32</div></div>
              <motion.span className="h-2.5 w-2.5 rounded-full bg-[#2f6fe4]" animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} />
            </div>
          </Card>
          {[
            ["Ocupação típica por hora", "Gráfico de horários de pico por posto, com o movimento de agora em destaque."],
            ["Modo navegação em perspectiva", "A câmera inclina e segue o carro, com instrução curva a curva."],
            ["Recarga com custo em tempo real", "kWh adicionados, potência efetiva e custo enquanto carrega."],
          ].map(([t, d], i) => (
            <Card key={t} className="md:col-span-2" delay={i * 0.06}>
              <span className="font-display text-sm text-volt">0{i + 1}</span>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">{t}</h3>
              <p className="mt-2 text-mist">{d}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
