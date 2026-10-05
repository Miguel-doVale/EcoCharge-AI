import type { Metadata } from "next";
import NavigatorClient from "@/components/nav/NavigatorClient";

export const metadata: Metadata = {
  title: "Navegador EV — EcoCharge AI",
  description: "Mapa interativo com carregadores, disponibilidade ao vivo e rota até o posto.",
};

export default function NavegadorPage() {
  return <NavigatorClient />;
}
