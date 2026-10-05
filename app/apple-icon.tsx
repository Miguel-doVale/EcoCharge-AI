import { ImageResponse } from "next/og";

// Ícone para "Adicionar à tela inicial" (iOS): mesmo desenho do icon.svg, em PNG 180×180.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(#161b21, #07090b)" }}>
        <svg width="150" height="150" viewBox="0 0 64 64">
          <path d="M32 7c-10.5 0-18.5 8-18.5 18.2C13.5 38.4 32 57 32 57s18.5-18.6 18.5-31.8C50.5 15 42.5 7 32 7z" fill="#b8ff3c" />
          <path d="M35.2 13.5 23.5 29.2h7.6L28.6 40l12-16.3h-7.7z" fill="#07090b" />
        </svg>
      </div>
    ),
    size
  );
}
