import type { MetadataRoute } from "next";

/* O app instalável é o NAVEGADOR (/navegador). A landing só oferece a instalação.
   O escopo fica em "/" para que o instalador também funcione a partir da landing;
   dentro do app instalado não há links de volta para o site. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/navegador",
    name: "EcoCharge — navegador para carros elétricos",
    short_name: "EcoCharge",
    description: "Carregadores com disponibilidade ao vivo, conector por conector, e rota até o posto.",
    lang: "pt-BR",
    start_url: "/navegador?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#07090b",
    theme_color: "#07090b",
    categories: ["navigation", "travel", "utilities"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
