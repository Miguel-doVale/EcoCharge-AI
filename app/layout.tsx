import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Unbounded } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", weight: ["400", "500", "600", "700", "800"] });
const unbounded = Unbounded({ subsets: ["latin"], variable: "--font-unbounded", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "EcoCharge AI — navegação para carros elétricos",
  description:
    "Navegador automotivo especializado em EVs: carregadores com disponibilidade ao vivo, conectores livres e ocupados, rota até o posto e recarga.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${hanken.variable} ${unbounded.variable}`} suppressHydrationWarning>
      <body className="font-sans">{children}</body>
    </html>
  );
}
