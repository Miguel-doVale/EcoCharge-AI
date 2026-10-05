"use client";

import dynamic from "next/dynamic";

// O navegador depende de canvas/window: carregado só no cliente.
const Navigator = dynamic(() => import("./Navigator"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-[#EEEEE9] text-[#5F6671]">Carregando mapa…</div>
  ),
});

export default function NavigatorClient() {
  return <Navigator />;
}
