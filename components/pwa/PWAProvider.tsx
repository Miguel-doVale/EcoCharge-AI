"use client";

/* Oferta de instalação do NAVEGADOR (/navegador) como app, usada na landing.
   - Chrome/Edge/Samsung (Android e desktop): guardamos o `beforeinstallprompt` e abrimos o
     instalador nativo quando a pessoa toca em "Baixar app".
   - iPhone/iPad: não existe API de instalação; mostramos o passo a passo (Compartilhar → Tela de Início).
   - Navegadores embutidos (Instagram, Facebook, TikTok...): não instalam; pedimos para abrir no navegador. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import InstallSheet from "./InstallSheet";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export type Platform = "ios" | "android" | "desktop";
export type SheetMode = "promo" | "help";

type Ctx = {
  ready: boolean;
  installed: boolean;
  canPrompt: boolean;
  platform: Platform;
  inApp: boolean;
  mobile: boolean;
  install: () => Promise<void>;
  openSheet: (mode: SheetMode) => void;
};

const PWAContext = createContext<Ctx | null>(null);
export const usePWA = () => {
  const c = useContext(PWAContext);
  if (!c) throw new Error("usePWA fora do <PWAProvider>");
  return c;
};

export function isStandalone() {
  return matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** registra o service worker (só em produção: em dev ele guardaria código antigo) */
export function registerSW() {
  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }
}

function detect() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|musical_ly|Snapchat|LinkedInApp|Twitter/i.test(ua);
  return { platform: (ios ? "ios" : android ? "android" : "desktop") as Platform, inApp, mobile: ios || android };
}

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [env, setEnv] = useState({ platform: "desktop" as Platform, inApp: false, mobile: false });
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [sheet, setSheet] = useState<SheetMode | null>(null);

  useEffect(() => {
    setEnv(detect());
    setInstalled(isStandalone());
    setReady(true);
    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); setSheet(null); };
    addEventListener("beforeinstallprompt", onBIP);
    addEventListener("appinstalled", onInstalled);
    registerSW();
    return () => { removeEventListener("beforeinstallprompt", onBIP); removeEventListener("appinstalled", onInstalled); };
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === "accepted") setSheet(null);
      return;
    }
    setSheet("help"); // iOS, navegador embutido ou sem suporte: instruções
  }, [deferred]);

  const value = useMemo<Ctx>(() => ({ ready, installed, canPrompt: !!deferred, ...env, install, openSheet: setSheet }), [ready, installed, deferred, env, install]);

  return (
    <PWAContext.Provider value={value}>
      {children}
      <InstallSheet mode={sheet} onClose={() => setSheet(null)} />
    </PWAContext.Provider>
  );
}
