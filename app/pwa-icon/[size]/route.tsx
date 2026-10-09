import { ImageResponse } from "next/og";
import { BRAND, MARK_PATHS } from "@/components/brand/Brand";

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
  const art = Math.round(cfg.px * (cfg.maskable ? 0.66 : 0.86));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: BRAND.forest,
          borderRadius: cfg.maskable ? 0 : Math.round(cfg.px * 0.22),
        }}
      >
        <svg width={art} height={art} viewBox="0 0 100 100">
          <g fill="none" stroke={BRAND.sage} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
            {MARK_PATHS.map((d) => <path key={d} d={d} />)}
          </g>
        </svg>
      </div>
    ),
    { width: cfg.px, height: cfg.px }
  );
}
