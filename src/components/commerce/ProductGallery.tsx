"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { LensPlaceholder } from "./LensPlaceholder";

type Props = { images: string[]; swatch?: string; label: string; spin: boolean; hint: string; prev: string; next: string };

/**
 * Product photos. In "spin" mode the photos are a turntable: they turn by themselves, stop while the pointer rests on
 * the picture (or a finger touches it), and can be dragged/hovered sideways to turn by hand.
 */
export function ProductGallery({ images, swatch, label, spin, hint, prev, next }: Props) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const n = images.length;
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!spin || n < 3 || paused || reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 260);
    return () => clearInterval(t);
  }, [spin, n, paused, reduce]);

  if (n === 0) {
    return <div className="relative mx-auto aspect-square max-w-xl overflow-hidden rounded-card border border-gold/40 bg-white"><LensPlaceholder color={swatch ?? "#D68FA5"} label={label} /></div>;
  }

  const go = (d: number) => setI((x) => (x + d + n) % n);
  const scrub = (clientX: number) => {
    if (!box.current || n < 2) return;
    const r = box.current.getBoundingClientRect();
    const f = Math.min(0.999, Math.max(0, (clientX - r.left) / r.width));
    setI(Math.floor(f * n));
  };

  return (
    <div className="space-y-3">
      <div
        ref={box}
        className={`relative mx-auto aspect-square max-w-xl select-none overflow-hidden rounded-card border border-gold/40 bg-white ${spin && n > 2 ? "cursor-ew-resize" : ""}`}
        style={{ touchAction: spin ? "pan-y" : undefined }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => { setPaused(false); drag.current = null; }}
        onMouseMove={(e) => { if (spin && n > 2) scrub(e.clientX); }}
        onTouchStart={(e) => { setPaused(true); drag.current = { x: e.touches[0].clientX, start: i }; }}
        onTouchMove={(e) => {
          if (!drag.current || n < 2) return;
          const dx = e.touches[0].clientX - drag.current.x;
          const step = Math.round(dx / 24);
          setI(((drag.current.start - step) % n + n) % n);
        }}
        onTouchEnd={() => { drag.current = null; setTimeout(() => setPaused(false), 2500); }}
      >
        {images.map((src, k) => (
          <Image key={src} src={src} alt={k === i ? label : ""} fill unoptimized priority={k === 0} sizes="(min-width:1024px) 50vw, 100vw"
            className={`object-cover object-[50%_25%] transition-opacity duration-150 ${k === i ? "opacity-100" : "opacity-0"}`} />
        ))}
        {spin && n > 2 && <span className="pointer-events-none absolute bottom-2 start-2 rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-mauve shadow">360°</span>}
        {!spin && n > 1 && (
          <>
            <button type="button" aria-label={prev} onClick={() => go(-1)} className="absolute start-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow">‹</button>
            <button type="button" aria-label={next} onClick={() => go(1)} className="absolute end-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow">›</button>
          </>
        )}
      </div>
      {spin && n > 2 && <p className="text-center text-xs opacity-75">{hint}</p>}
      {n > 1 && (
        <ul className="flex justify-center gap-2 overflow-x-auto pb-1">
          {images.map((src, k) => (
            <li key={src}>
              <button type="button" aria-label={`${label} ${k + 1}`} aria-current={k === i} onClick={() => { setPaused(true); setI(k); }}
                className={`relative block size-14 overflow-hidden rounded-xl border-2 ${k === i ? "border-mauve" : "border-gold/40"}`}>
                <Image src={src} alt="" fill unoptimized sizes="56px" className="object-cover object-[50%_25%]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
