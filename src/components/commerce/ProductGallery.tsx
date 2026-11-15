"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { LensPlaceholder } from "./LensPlaceholder";

type Props = { images: string[]; swatch?: string; label: string; hint?: string; prev: string; next: string };

/** Product photos: change slowly by themselves (every 4.5 s, soft cross-fade); pause while touched/hovered or after a manual choice. Arrows, swipe and thumbnails too. */
export function ProductGallery({ images, swatch, label, prev, next }: Props) {
  const [i, setI] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const n = images.length;
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (n < 2 || paused || reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 4500);
    return () => clearInterval(t);
  }, [n, paused, reduce, i]);

  useEffect(() => {
    if (!paused) return;
    const t = setTimeout(() => setPaused(false), 9000);
    return () => clearTimeout(t);
  }, [paused]);

  if (n === 0) {
    return <div className="relative mx-auto aspect-[5/4] max-h-[46svh] w-full max-w-xl sm:aspect-square sm:max-h-none overflow-hidden rounded-card border border-gold/40 bg-white"><LensPlaceholder color={swatch ?? "#D68FA5"} label={label} /></div>;
  }

  const go = (d: number) => { setPaused(true); setI((x) => (x + d + n) % n); };

  return (
    <div className="mx-auto w-full min-w-0 max-w-xl space-y-3">
      <div
        className="relative aspect-[5/4] max-h-[46svh] w-full select-none overflow-hidden sm:aspect-square sm:max-h-none rounded-card border border-gold/40 bg-white"
        style={{ touchAction: "pan-y" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => { setPaused(true); touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const t = touch.current; touch.current = null;
          if (!t || n < 2) return;
          const dx = e.changedTouches[0].clientX - t.x;
          const dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        }}
      >
        {images.map((src, k) => (
          <Image key={src} src={src} alt={k === i ? label : ""} fill unoptimized priority={k === 0} sizes="(min-width:1024px) 50vw, 100vw"
            className={`object-cover object-[50%_25%] transition-opacity duration-700 ${k === i ? "opacity-100" : "opacity-0"}`} />
        ))}
        {n > 1 && (
          <>
            <button type="button" aria-label={prev} onClick={() => go(-1)} className="absolute start-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow">‹</button>
            <button type="button" aria-label={next} onClick={() => go(1)} className="absolute end-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow">›</button>
          </>
        )}
      </div>
      {n > 1 && (
        <ul className="flex max-w-full justify-start gap-2 overflow-x-auto pb-1 sm:justify-center">
          {images.map((src, k) => (
            <li key={src} className="shrink-0">
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
