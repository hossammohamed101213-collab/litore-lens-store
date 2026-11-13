/** Thin gold divider with a small heart — decorative, low weight. */
export function OrnamentalDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-gold ${className}`} aria-hidden="true">
      <span className="h-px w-16 bg-gold/60" />
      <svg width="18" height="16" viewBox="0 0 24 22" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M12 20S2 14 2 7.5A5 5 0 0 1 12 5a5 5 0 0 1 10 2.5C22 14 12 20 12 20Z" />
      </svg>
      <span className="h-px w-16 bg-gold/60" />
    </div>
  );
}
