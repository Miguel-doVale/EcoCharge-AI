import type { TurnIcon } from "@/lib/ev/engine";

type P = { size?: number; className?: string };

export const SearchIcon = ({ size = 20, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={className} aria-hidden>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
export const PlusIcon = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
);
export const MinusIcon = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>
);
export const LocateIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M21 3 3 10.5l7.2 2.3L12.5 20z" /></svg>
);
export const CarIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
    <path d="M5 16V11l2-5h10l2 5v5z" /><circle cx="8" cy="16" r="1.6" fill="currentColor" /><circle cx="16" cy="16" r="1.6" fill="currentColor" /><path d="M5 11h14" />
  </svg>
);
export const MoonIcon = ({ size = 21 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
);
export const SunIcon = ({ size = 21 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
  </svg>
);
export const CloseIcon = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const BoltIcon = ({ size = 16, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden><path d="M13.5 2 4.5 13.5H11L9.5 22l10-12.5H13z" /></svg>
);
export const BackIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
);

export function TurnGlyph({ icon, size = 48 }: { icon: TurnIcon; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {icon === "direita" && (
        <>
          <path d="M14 40V24a6 6 0 0 1 6-6h16" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          <path d="M30 10l9 8-9 8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {icon === "esquerda" && (
        <>
          <path d="M34 40V24a6 6 0 0 0-6-6H12" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          <path d="M18 10l-9 8 9 8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {icon === "retorno" && (
        <>
          <path d="M32 40V18a8 8 0 0 0-16 0v12" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          <path d="M9 24l7 8 7-8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {icon === "reto" && (
        <>
          <path d="M24 42V8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          <path d="M15 17l9-9 9 9" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {icon === "chegada" && (
        <>
          <path d="M24 44s-13-12-13-22a13 13 0 0 1 26 0c0 10-13 22-13 22z" fill="#fff" />
          <path d="M26 13l-6 10h5l-2 8 6-10h-5z" fill="#0B6E4F" />
        </>
      )}
    </svg>
  );
}
