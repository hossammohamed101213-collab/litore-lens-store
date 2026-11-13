import { useId } from "react";

/** A glossy rose-gold shopping cart with depth (gradients, highlights, ground shadow) and light motion (see globals.css). */
export function CartIcon3D({ bump = false, className = "" }: { bump?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 56" className={`cart3d ${bump ? "cart3d-bump" : ""} ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6c9d6" /><stop offset=".45" stopColor="#d68fa5" /><stop offset="1" stopColor="#865466" /></linearGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#f3dca0" /><stop offset=".5" stopColor="#c7a16a" /><stop offset="1" stopColor="#8a5a3c" /></linearGradient>
        <radialGradient id={`${id}w`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff" /><stop offset=".35" stopColor="#e9c88a" /><stop offset="1" stopColor="#7a5a34" /></radialGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".75" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      <ellipse className="cart3d-shadow" cx="34" cy="52" rx="20" ry="2.6" fill="#865466" opacity=".22" />
      <g className="cart3d-body">
        {/* handle */}
        <path d="M3 6h8l3.2 5" fill="none" stroke={`url(#${id}h)`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {/* basket: back face for depth, then front face */}
        <path d="M14 13h45l-5.4 21.2a4 4 0 0 1-3.9 3H23.2a4 4 0 0 1-3.9-3z" fill="#865466" opacity=".35" transform="translate(2.2 2)" />
        <path d="M14 13h45l-5.4 21.2a4 4 0 0 1-3.9 3H23.2a4 4 0 0 1-3.9-3z" fill={`url(#${id}b)`} />
        {/* slats */}
        <path d="M25 17.5 27 33M34 17.5V33.5M43 17.5 41.5 33" stroke="#fff" strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" />
        {/* gloss */}
        <path d="M16.5 15.5h38l-1.2 4.6H18.3z" fill={`url(#${id}s)`} />
        <path d="M14 13h45" stroke="#fff3d6" strokeWidth="1.4" strokeLinecap="round" opacity=".9" />
        {/* base bar */}
        <path d="M19 41h31" stroke={`url(#${id}h)`} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M19.8 37.5 19 41" stroke={`url(#${id}h)`} strokeWidth="3" strokeLinecap="round" />
        {/* wheels */}
        <g className="cart3d-wheel"><circle cx="26" cy="47" r="4.6" fill={`url(#${id}w)`} /><path d="M26 43.4v7.2M22.4 47h7.2" stroke="#7a5a34" strokeOpacity=".55" strokeWidth="1" /></g>
        <g className="cart3d-wheel"><circle cx="45" cy="47" r="4.6" fill={`url(#${id}w)`} /><path d="M45 43.4v7.2M41.4 47h7.2" stroke="#7a5a34" strokeOpacity=".55" strokeWidth="1" /></g>
      </g>
    </svg>
  );
}
