"use client";

import { useEffect, useId, useRef } from "react";

/** One eye is drawn in a 60x40 box; the right eye is the mirror image. */
const P0 = [4, 22], P1 = [30, -13], P2 = [56, 22];
const bez = (t: number) => [
  (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
  (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
];
const tan = (t: number) => [
  2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]),
  2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]),
];
/** Long, curled, feminine lashes — longest and most upswept at the outer corner (t near 0). */
const LASHES = Array.from({ length: 9 }, (_, i) => {
  const t = 0.04 + i * 0.105;
  const [x, y] = bez(t);
  const [dx, dy] = tan(t);
  const len = Math.hypot(dx, dy);
  let nx = dy / len, ny = -dx / len; // outward normal
  if (ny > 0) { nx = -nx; ny = -ny; }
  const outer = 1 - t; // 1 at the outer corner
  const L = 7 + outer * 9;
  const sweep = -(3 + outer * 9); // flick toward the outer side
  const ex = x + nx * L + sweep, ey = y + ny * L - outer * 2;
  const cx = x + nx * L * 0.55, cy = y + ny * L * 0.55;
  return `M${x.toFixed(1)} ${y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
});

function Eye({ id, mirror }: { id: string; mirror?: boolean }) {
  return (
    <g transform={mirror ? "translate(124 0) scale(-1 1)" : undefined}>
      <g className="eyes-lid">
        <clipPath id={`${id}-c`}><path d="M4 22Q30-13 56 22Q30 52 4 22Z" /></clipPath>
        <path d="M4 22Q30-13 56 22Q30 52 4 22Z" fill="#fff7f9" />
        <g clipPath={`url(#${id}-c)`}>
          <g className="eyes-iris">
            <circle cx="30" cy="19" r="15" fill={`url(#${id}-i)`} />
            <circle cx="30" cy="19" r="10.5" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="4" strokeDasharray="1 1.6" />
            <circle cx="30" cy="19" r="14.4" fill="none" stroke="#c7a16a" strokeWidth="1.3" />
            <circle cx="30" cy="19" r="6.6" fill="#2b1b22" />
            <circle cx="35" cy="13.5" r="3" fill="#fff" fillOpacity=".95" />
            <circle cx="26" cy="24" r="1.4" fill="#fff" fillOpacity=".7" />
          </g>
          <path d="M4 22Q30-13 56 22Q30 4 4 22Z" fill="#865466" fillOpacity=".16" />
        </g>
        <path d="M4 22Q30-13 56 22" fill="none" stroke="#5e3846" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M6 24Q30 50 54 24" fill="none" stroke="#865466" strokeOpacity=".55" strokeWidth="1.1" strokeLinecap="round" />
        {LASHES.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#3d2430" strokeWidth={1.5 + (i < 3 ? 0.4 : 0)} strokeLinecap="round" />
        ))}
      </g>
    </g>
  );
}

/**
 * Cornea-and-lashes logo mark. mode="loop": looks left and right on its own (splash).
 * mode="follow": pupils follow the mouse on desktop and react to taps on touch screens (cart icon).
 */
export function Eyes({ mode = "loop", className = "", label }: { mode?: "loop" | "follow"; className?: string; label?: string }) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (mode !== "follow") return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 160);
        el.style.setProperty("--ix", `${(dx / d) * 9 * k}px`);
        el.style.setProperty("--iy", `${(dy / d) * 4 * k}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, [mode]);

  const pop = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("eyes-pop");
    void el.getBoundingClientRect();
    el.classList.add("eyes-pop");
  };

  return (
    <svg
      ref={ref}
      viewBox="-16 -32 156 88"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`${mode === "loop" ? "eyes-loop" : ""} ${className}`}
      onPointerDown={mode === "follow" ? pop : undefined}
      onAnimationEnd={(e) => { if (e.animationName === "eyes-wiggle") e.currentTarget.classList.remove("eyes-pop"); }}
    >
      <defs>
        <radialGradient id={`${uid}-i`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#f6c7d6" />
          <stop offset=".55" stopColor="#d68fa5" />
          <stop offset="1" stopColor="#865466" />
        </radialGradient>
      </defs>
      <Eye id={`${uid}a`} />
      <Eye id={`${uid}b`} mirror />
    </svg>
  );
}
