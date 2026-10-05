"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { EVEngine, UIState } from "@/lib/ev/engine";

export const EngineContext = createContext<EVEngine | null>(null);

export function useEngine() {
  const e = useContext(EngineContext);
  if (!e) throw new Error("useEngine fora do <EngineContext>");
  return e;
}

/** Lê o estado da UI do engine (re-renderiza quando muda). */
export function useUI<T = UIState>(sel?: (s: UIState) => T): T {
  const e = useEngine();
  const s = useSyncExternalStore(e.subscribe, e.getState, e.getState);
  return sel ? sel(s) : (s as unknown as T);
}
