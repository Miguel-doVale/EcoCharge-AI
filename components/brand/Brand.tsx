/* Identidade oficial EcoCharge AI.
   O símbolo (losango + "E" que vira cabo de tomada) é vetorial; o texto "ECOCHARGE AI"
   vem da arte original como máscara (public/brand/*.png), então herda a cor do texto. */

export const BRAND = { sage: "#e2eddf", forest: "#3d5c3f" } as const;

/** Traços do símbolo em viewBox 0 0 100 100 (sem preenchimento, stroke round). */
export const MARK_PATHS = [
  "M44.3 7.8a8 8 0 0 1 11.4 0l36.5 36.5a8 8 0 0 1 0 11.4L55.7 92.2a8 8 0 0 1-11.4 0L7.8 55.7a8 8 0 0 1 0-11.4z",
  "M52.5 25H39.6a4.5 4.5 0 0 0 0 9H53.5M39.6 34a4.8 4.8 0 0 0 0 9.6H64.5a6.6 6.6 0 0 1 0 13.2H62.6",
  "M40 63V52.8a6 6 0 0 1 6-6h8.3a6 6 0 0 1 6 6V63z",
  "M44.6 63v5.2h11.2V63M47.6 68.2v5.6M52.8 68.2v5.6",
  "M60.3 56.8a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0",
];

export function BrandMark({ size = 32, stroke = 3.6, className = "" }: { size?: number; stroke?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className={`flex-none ${className}`}>
      <g fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        {MARK_PATHS.map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  );
}

function Mask({ src, w, h, className = "" }: { src: string; w: number; h: number; className?: string }) {
  const m = `url(${src}) center / contain no-repeat`;
  return <span aria-hidden className={`block flex-none bg-current ${className}`} style={{ width: w, height: h, mask: m, WebkitMask: m }} />;
}

/** Logo horizontal: símbolo + ECOCHARGE + AI (o "AI" em destaque). `h` = altura do texto. */
export function Logo({ h = 15, mark = 34, className = "" }: { h?: number; mark?: number; className?: string }) {
  const eh = h * (92 / 76); // a arte do ECOCHARGE inclui a laçada do "G" abaixo da linha
  return (
    <span className={`flex items-center gap-2.5 text-fg ${className}`}>
      <BrandMark size={mark} className="text-volt" />
      <span className="flex items-start" style={{ gap: h * 0.32, paddingTop: h * 0.22 }}>
        <Mask src="/brand/wordmark-eco.png" w={(eh * 605) / 92} h={eh} />
        <Mask src="/brand/wordmark-ai.png" w={(h * 80 / 76) * (121 / 80)} h={h * (80 / 76)} className="text-volt" />
      </span>
      <span className="sr-only">EcoCharge AI</span>
    </span>
  );
}
