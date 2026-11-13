import { useId } from "react";

/** A translucent glass-like coloured lens, drawn in SVG (no images, very light). */
export function GlassLens({ color, accent = "#c7a16a", size = 160, className = "", style }: { color: string; accent?: string; size?: number; className?: string; style?: React.CSSProperties }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" className={className} style={style}>
      <defs>
        <radialGradient id={`${id}b`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor={color} stopOpacity=".05" />
          <stop offset=".62" stopColor={color} stopOpacity=".22" />
          <stop offset="1" stopColor={color} stopOpacity=".5" />
        </radialGradient>
        <radialGradient id={`${id}i`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" stopOpacity=".1" />
          <stop offset=".5" stopColor={color} stopOpacity=".55" />
          <stop offset="1" stopColor={color} stopOpacity=".85" />
        </radialGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".1" />
          <stop offset="1" stopColor="#fff" stopOpacity=".8" />
        </linearGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill={`url(#${id}b)`} />
      {/* iris body + fibres */}
      <circle cx="100" cy="100" r="62" fill={`url(#${id}i)`} />
      <circle cx="100" cy="100" r="44" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="34" strokeDasharray="1.2 3.4" />
      <circle cx="100" cy="100" r="52" fill="none" stroke={accent} strokeOpacity=".55" strokeWidth="14" strokeDasharray="0.8 5" />
      <circle cx="100" cy="100" r="62" fill="none" stroke={accent} strokeOpacity=".9" strokeWidth="2.4" />
      <circle cx="100" cy="100" r="25" fill="#1d1218" fillOpacity=".78" />
      {/* glass rim and reflections */}
      <circle cx="100" cy="100" r="95" fill="none" stroke={`url(#${id}r)`} strokeWidth="3" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1" />
      <path d="M38 70A70 70 0 0 1 98 30" fill="none" stroke={`url(#${id}h)`} strokeWidth="9" strokeLinecap="round" />
      <ellipse cx="128" cy="62" rx="14" ry="7" transform="rotate(-35 128 62)" fill="#fff" fillOpacity=".7" />
      <circle cx="146" cy="150" r="4" fill="#fff" fillOpacity=".55" />
    </svg>
  );
}
