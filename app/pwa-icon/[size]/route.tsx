import { ImageResponse } from "next/og";

// Ícones PNG do app instalado (gerados no build a partir do mesmo desenho do favicon).
const SIZES = { "192": { px: 192, maskable: false }, "512": { px: 512, maskable: false }, "maskable-512": { px: 512, maskable: true } } as const;
type Key = keyof typeof SIZES;

export function generateStaticParams() {
  return (Object.keys(SIZES) as Key[]).map((size) => ({ size }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const cfg = SIZES[size as Key];
  if (!cfg) return new Response("Not found", { status: 404 });
  // maskable: o sistema recorta em círculo/squircle, então o desenho fica dentro da "zona segura" (≈60%)
  const art = Math.round(cfg.px * (cfg.maskable ? 0.6 : 0.8));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(#161b21, #07090b)",
          borderRadius: cfg.maskable ? 0 : Math.round(cfg.px * 0.22),
        }}
      >
        <svg width={art} height={art} viewBox="0 0 64 64">
          <path d="M32 7c-10.5 0-18.5 8-18.5 18.2C13.5 38.4 32 57 32 57s18.5-18.6 18.5-31.8C50.5 15 42.5 7 32 7z" fill="#b8ff3c" />
          <path d="M35.2 13.5 23.5 29.2h7.6L28.6 40l12-16.3h-7.7z" fill="#07090b" />
        </svg>
      </div>
    ),
    { width: cfg.px, height: cfg.px }
  );
}
