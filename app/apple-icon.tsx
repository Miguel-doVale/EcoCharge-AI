import { ImageResponse } from "next/og";
import { BRAND, MARK_PATHS } from "@/components/brand/Brand";

// Ícone para "Adicionar à tela inicial" (iOS): mesmo desenho do icon.svg, em PNG 180×180.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.forest }}>
        <svg width={150} height={150} viewBox="0 0 100 100">
          <g fill="none" stroke={BRAND.sage} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
            {MARK_PATHS.map((d) => <path key={d} d={d} />)}
          </g>
        </svg>
      </div>
    ),
    size
  );
}
