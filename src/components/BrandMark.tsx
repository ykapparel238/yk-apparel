type BrandMarkProps = {
  className?: string;
  compact?: boolean;
};

export function BrandMark({ className = "h-9 w-9", compact = false }: BrandMarkProps) {
  return (
    <div
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#064e3b,#0f766e_48%,#f59e0b)] text-primary-foreground shadow-sm ${className}`}
      aria-label="YK Apparels"
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" role="img" aria-hidden="true">
        <path d="M32 8 13 18v9h6v21h26V27h6v-9L32 8Z" fill="rgba(255,255,255,.94)" />
        <path d="M25 15c1.7 3.4 4 5.1 7 5.1s5.3-1.7 7-5.1" fill="none" stroke="#0f766e" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M20 28h24M20 36h24M20 44h24" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" opacity=".9" />
        <path d="M11 18 22 8l5 7-8 7-8-4ZM53 18 42 8l-5 7 8 7 8-4Z" fill="#d1fae5" />
        <path d="M44 17.5 51 20v7h-6" fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 17.5 13 20v7h6" fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact ? (
        <span className="absolute bottom-1 right-1 rounded bg-amber-400 px-1 text-[9px] font-black leading-3 text-emerald-950">
          YK
        </span>
      ) : null}
    </div>
  );
}
