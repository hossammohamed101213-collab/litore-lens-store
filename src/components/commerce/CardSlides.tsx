"use client";

import { useEffect, useState } from "react";
import { ProductImage } from "./ProductImage";
import { sized } from "@/lib/img";

/** Product-card photos that change by themselves (cross-fade). Each card starts at a different moment so the grid feels alive. */
export function CardSlides({ srcs, swatch, label, seed = 0 }: { srcs: string[]; swatch?: string; label: string; seed?: number }) {
  const list = srcs.slice(0, 6);
  const n = list.length;
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (n < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let t: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => { setReady(true); t = setInterval(() => setI((x) => (x + 1) % n), 4500); }, 600 + (seed % 5) * 900);
    return () => { clearTimeout(start); if (t) clearInterval(t); };
  }, [n, seed]);

  if (n === 0) return <ProductImage swatch={swatch} label={label} />;
  return (
    <>
      <ProductImage src={list[0]} swatch={swatch} label={label} />
      {/* only the photo on screen and the one coming next are fetched, each already resized for a card (never the original) */}
      {ready && list.map((src, k) => (k === 0 || (k !== i && k !== (i + 1) % n) ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={sized(src, 640)} srcSet={`${sized(src, 384)} 384w, ${sized(src, 640)} 640w`} sizes="(min-width:1024px) 25vw, 50vw" alt="" loading="lazy" aria-hidden="true" className={`absolute inset-0 size-full object-cover object-[50%_25%] transition-opacity duration-700 ${i === k ? "opacity-100" : "opacity-0"}`} />
      )))}
    </>
  );
}
