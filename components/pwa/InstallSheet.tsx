"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePWA, type SheetMode } from "./PWAProvider";
import { BRAND, BrandMark } from "@/components/brand/Brand";

const DISMISS_KEY = "ecocharge-install-dismissed";
const DISMISS_DAYS = 7;
const ease = [0.16, 1, 0.3, 1] as const;

export function AppIcon({ size = 56 }: { size?: number }) {
  return (
    <span className="grid flex-none place-items-center rounded-[26%] shadow-[0_8px_24px_rgba(61,92,63,.35)]" style={{ width: size, height: size, background: BRAND.forest, color: BRAND.sage }}>
      <BrandMark size={size * 0.86} stroke={4.2} />
    </span>
  );
}

const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="inline -mt-1">
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);
const PlusSquare = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="inline -mt-1">
    <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
);

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-5 space-y-3">
      {items.map((it, i) => (
        <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex items-start gap-3 text-[15px] leading-snug text-fg/90">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-volt font-display text-xs font-semibold text-ink">{i + 1}</span>
          <span className="pt-0.5">{it}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function HelpContent() {
  const { platform, inApp } = usePWA();
  const [copied, setCopied] = useState(false);
  if (inApp) {
    const url = typeof location !== "undefined" ? location.origin + "/navegador" : "/navegador";
    return (
      <>
        <h2 className="pr-8 text-xl font-semibold">Abra no navegador para instalar</h2>
        <p className="mt-2 text-[15px] text-mist">Este app (Instagram, Facebook…) abriu o site num navegador embutido, que não permite instalar.</p>
        <Steps items={[<>Toque no menu <b>⋯</b> no canto da tela</>, <>Escolha <b>Abrir no navegador</b> (Chrome ou Safari)</>, <>Toque em <b>Baixar app</b> de novo</>]} />
        <button
          onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch {} }}
          className="mt-6 h-12 w-full rounded-2xl border border-fg/15 font-semibold"
        >
          {copied ? "Link copiado ✓" : "Copiar link do app"}
        </button>
      </>
    );
  }
  if (platform === "ios") {
    return (
      <>
        <h2 className="pr-8 text-xl font-semibold">Instalar no iPhone ou iPad</h2>
        <p className="mt-2 text-[15px] text-mist">No iOS a instalação é pelo menu de compartilhar. Leva 10 segundos.</p>
        <Steps items={[
          <>Toque em <b>Compartilhar</b> <ShareIcon /> na barra do Safari</>,
          <>Role e escolha <b>Adicionar à Tela de Início</b> <PlusSquare /></>,
          <>Toque em <b>Adicionar</b>. O ícone do EcoCharge aparece junto dos seus apps</>,
        ]} />
      </>
    );
  }
  if (platform === "android") {
    return (
      <>
        <h2 className="pr-8 text-xl font-semibold">Instalar no Android</h2>
        <p className="mt-2 text-[15px] text-mist">Seu navegador não abriu o instalador automático, mas dá para instalar pelo menu.</p>
        <Steps items={[<>Toque no menu <b>⋮</b> do Chrome</>, <>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b></>, <>Confirme em <b>Instalar</b></>]} />
      </>
    );
  }
  return (
    <>
      <h2 className="pr-8 text-xl font-semibold">Instalar no computador</h2>
      <p className="mt-2 text-[15px] text-mist">Funciona no Chrome e no Edge. No Safari (Mac), use Arquivo → Adicionar ao Dock.</p>
      <Steps items={[<>Abra o <b>navegador</b> deste site</>, <>Clique no ícone de <b>instalar</b> no fim da barra de endereço</>, <>Confirme em <b>Instalar</b></>]} />
    </>
  );
}

function PromoContent({ onLater }: { onLater: () => void }) {
  const { install, platform } = usePWA();
  return (
    <>
      <div className="flex items-center gap-4 pr-8">
        <AppIcon />
        <div>
          <h2 className="text-xl font-semibold leading-tight">Leve o navegador no bolso</h2>
          <p className="mt-0.5 text-sm text-mist">EcoCharge · grátis · sem loja de apps</p>
        </div>
      </div>
      <ul className="mt-5 space-y-2.5 text-[15px] text-fg/90">
        {["Abre direto no mapa, em tela cheia", "Carregadores e conectores livres ao vivo", "Ícone na tela inicial, como um app nativo"].map((t) => (
          <li key={t} className="flex items-center gap-2.5"><i className="h-1.5 w-1.5 flex-none rounded-full bg-volt" />{t}</li>
        ))}
      </ul>
      <div className="mt-6 flex gap-2">
        <button onClick={install} className="h-12 flex-1 rounded-2xl bg-volt font-bold text-ink transition-colors hover:bg-fg">
          {platform === "ios" ? "Ver como instalar" : "Instalar app"}
        </button>
        <button onClick={onLater} className="h-12 rounded-2xl px-5 font-semibold text-mist transition-colors hover:text-fg">Agora não</button>
      </div>
    </>
  );
}

/** Folha de instalação (pop-up). Também dispara sozinha uma vez no celular. */
export default function InstallSheet({ mode, onClose }: { mode: SheetMode | null; onClose: () => void }) {
  const { ready, installed, mobile, openSheet } = usePWA();

  // pop-up automático: só no celular, se não estiver instalado e não foi dispensado nos últimos 7 dias
  useEffect(() => {
    if (!ready || installed || !mobile) return;
    try {
      const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - t < DISMISS_DAYS * 864e5) return;
    } catch {}
    const id = setTimeout(() => openSheet("promo"), 4500);
    return () => clearTimeout(id);
  }, [ready, installed, mobile, openSheet]);

  const dismiss = () => {
    if (mode === "promo") { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {} }
    onClose();
  };
  useEffect(() => {
    if (!mode) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });

  return (
    <AnimatePresence>
      {mode && (
        <motion.div key="install" className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" data-lenis-prevent
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Instalar o app EcoCharge"
            className="relative w-full max-w-[440px] rounded-t-[28px] border border-fg/10 bg-ink-2 p-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] text-fg shadow-2xl sm:rounded-[28px] sm:pb-6"
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: { duration: 0.45, ease } }} exit={{ y: 40, opacity: 0, transition: { duration: 0.2 } }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => { if (i.offset.y > 90 || i.velocity.y > 500) dismiss(); }}
          >
            <span className="mx-auto mb-5 block h-1.5 w-10 rounded-full bg-fg/15 sm:hidden" />
            <button onClick={dismiss} aria-label="Fechar" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-fg/5 text-mist hover:text-fg">✕</button>
            {mode === "promo" ? <PromoContent onLater={dismiss} /> : <HelpContent />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
