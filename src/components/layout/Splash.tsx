"use client";

import { useEffect, useRef, useState } from "react";

/** First-visit welcome: logo + real progress to 100%, then opens. Shown once per browser session. */
export function Splash({ welcome, sub }: { welcome: string; sub: string }) {
    const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const loaded = useRef(false);
  const bar = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (root.hasAttribute("data-splash-done")) { const z = setTimeout(() => setGone(true), 0); return () => clearTimeout(z); }
    try { sessionStorage.setItem("litore_splash", "1"); } catch { /* private mode: just show again next time */ }
    const onLoad = () => { loaded.current = true; };
    if (document.readyState === "complete") loaded.current = true;
    else window.addEventListener("load", onLoad, { once: true });
    const t0 = performance.now();
    let raf = 0;
    let finishedAt = 0;
    let shown = -1;
    const tick = (now: number) => {
      const el = now - t0;
      let target = Math.min(90, (el / 650) * 90);
      if (loaded.current && el >= 650) {
        if (!finishedAt) finishedAt = now;
        target = Math.min(100, 90 + ((now - finishedAt) / 200) * 10);
      } else if (el > 6000) { loaded.current = true; }
      const p = Math.round(target);
      if (p !== shown) { shown = p; if (bar.current) bar.current.style.width = `${p}%`; if (num.current) num.current.textContent = `${p}%`; } // no React re-render per frame
      if (target >= 100) {
        setLeaving(true);
        setTimeout(() => { setGone(true); root.setAttribute("data-splash-done", ""); }, 380);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("load", onLoad); };
  }, []);

  if (gone) return null;
  return (
    <div id="splash" role="status" aria-live="polite" className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-[#fde4ec] via-[#fff5f6] to-[#efe6fb] px-6 text-center ${leaving ? "is-leaving" : ""}`}>
      {/* the first thing painted on a first visit: a ready-made 384px file, fetched first, never resized on the server */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/litore-logo-md.webp" alt="Litore" width={384} height={328} fetchPriority="high" decoding="sync" className="h-auto w-52 animate-pulse sm:w-64" />
      <div>
        <p className="font-display text-3xl font-semibold sm:text-4xl">{welcome}</p>
        <p className="mt-1 text-sm opacity-80">{sub}</p>
      </div>
      <div className="w-56">
        <div className="h-2 overflow-hidden rounded-full bg-white/80 shadow-inner" aria-hidden="true">
          <div className="h-full rounded-full bg-gradient-to-r from-[#d9b36c] via-[#f3dca0] to-[#c7a16a]" ref={bar} style={{ width: "0%" }} />
        </div>
        <p ref={num} className="mt-2 font-bold tabular-nums" dir="ltr">0%</p>
      </div>
    </div>
  );
}
