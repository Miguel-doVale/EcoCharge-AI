"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePWA } from "./PWAProvider";

/** "Baixar app" do hero. Some quando o app já está instalado (aberto como app). */
export default function InstallButton({ className = "" }: { className?: string }) {
  const { ready, installed, canPrompt, install, openSheet, mobile } = usePWA();
  return (
    <AnimatePresence>
      {ready && !installed && (
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          onClick={() => (canPrompt ? install() : mobile ? install() : openSheet("help"))}
          className={`group inline-flex h-14 items-center gap-2.5 rounded-full border border-volt/40 bg-volt/10 px-6 text-base font-semibold text-volt backdrop-blur transition-colors hover:border-volt hover:bg-volt/20 ${className}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-transform duration-300 group-hover:translate-y-0.5">
            <path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" />
          </svg>
          Baixar app
          {canPrompt && <span className="rounded-full bg-volt px-2 py-0.5 text-[11px] font-bold text-ink">1 toque</span>}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
