"use client";

import { useEffect, useState } from "react";
import { ProductImage } from "./ProductImage";

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
    const start = setTimeout(() => { setReady(true); t = setInterval(() => setI((x) => (x + 1) % n), 2400); }, 600 + (seed % 5) * 450);
    return () => { clearTimeout(start); if (t) clearInterval(t); };
  }, [n, seed]);

  if (n === 0) return <ProductImage swatch={swatch} label={label} />;
  return (
    <>
      <ProductImage src={list[0]} swatch={swatch} label={label} />
      {ready && list.slice(1).map((src, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" loading="lazy" aria-hidden="true" className={`absolute inset-0 size-full object-cover object-[50%_25%] transition-opacity duration-700 ${i === k + 1 ? "opacity-100" : "opacity-0"}`} />
      ))}
    </>
  );
}
