"use client";

import { useSyncExternalStore } from "react";

/* Tema da landing (escuro = padrão; claro = paleta da logo).
   Fica em <html data-site-theme>, aplicado antes da pintura pelo script do layout,
   e não interfere no tema do navegador (que usa data-theme). */
export type SiteTheme = "dark" | "light";
export const SITE_THEME_KEY = "ecocharge-site-theme";
const THEME_COLOR: Record<SiteTheme, string> = { dark: "#07090b", light: "#e2eddf" };

/** Roda no <head> antes do React: evita o "piscar" do tema salvo. */
export const siteThemeScript = `try{var t=localStorage.getItem("${SITE_THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.siteTheme=t}catch(e){}`;

const listeners = new Set<() => void>();
const read = (): SiteTheme => (document.documentElement.dataset.siteTheme === "light" ? "light" : "dark");

export function setSiteTheme(t: SiteTheme) {
  document.documentElement.dataset.siteTheme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[t]);
  try { localStorage.setItem(SITE_THEME_KEY, t); } catch {}
  listeners.forEach((l) => l());
}

export function useSiteTheme(): SiteTheme {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    read,
    () => "dark",
  );
}

export function ThemeToggle() {
  const theme = useSiteTheme();
  const light = theme === "light";
  const label = light ? "Mudar para o tema escuro" : "Mudar para o tema claro";
  const toggle = () => setSiteTheme(light ? "dark" : "light");
  return (
    <>
    {/* celular: botão redondo com o ícone do tema de destino */}
    <button type="button" aria-label={label} onClick={toggle}
      className="grid h-11 w-11 flex-none place-items-center rounded-full border border-fg/15 text-fg transition-colors hover:border-fg/30 sm:hidden">
      {light ? <Moon /> : <Sun />}
    </button>
    <button
      type="button" role="switch" aria-checked={light} aria-label={label} onClick={toggle}
      className="relative hidden h-9 w-[68px] flex-none items-center sm:inline-flex rounded-full border border-fg/15 bg-fg/[.06] p-1 transition-colors hover:border-fg/30"
    >
      <span className={`absolute left-1 top-[3px] h-7 w-7 rounded-full bg-volt shadow transition-transform duration-500 ease-out-expo ${light ? "translate-x-[30px]" : "translate-x-0"}`} />
      {/* lua (escuro) | sol (claro) */}
      <span className={`relative z-10 grid h-7 w-7 place-items-center transition-colors ${light ? "text-mist" : "text-ink"}`}>
        <Moon />
      </span>
      <span className={`relative z-10 ml-[2px] grid h-7 w-7 place-items-center transition-colors ${light ? "text-ink" : "text-mist"}`}>
        <Sun />
      </span>
    </button>
    </>
  );
}

function Moon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>;
}

function Sun() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg>;
}
