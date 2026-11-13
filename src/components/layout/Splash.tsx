"use client";

import { useEffect, useRef, useState } from "react";
import { Eyes } from "@/components/ui/Eyes";

/** First-visit welcome: eyes logo + real progress to 100%, then opens. Shown once per browser session. */
export function Splash({ welcome, sub }: { welcome: string; sub: string }) {
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const loaded = useRef(false);

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
    const tick = (now: number) => {
      const el = now - t0;
      let target = Math.min(90, (el / 650) * 90);
      if (loaded.current && el >= 650) {
        if (!finishedAt) finishedAt = now;
        target = Math.min(100, 90 + ((now - finishedAt) / 200) * 10);
      } else if (el > 6000) { loaded.current = true; }
      setPct(Math.round(target));
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
      <Eyes mode="loop" className="w-52 sm:w-64" />
      <div>
        <p className="font-display text-3xl font-semibold sm:text-4xl">{welcome}</p>
        <p className="mt-1 text-sm opacity-80">{sub}</p>
      </div>
      <div className="w-56">
        <div className="h-2 overflow-hidden rounded-full bg-white/80 shadow-inner" aria-hidden="true">
          <div className="h-full rounded-full bg-gradient-to-r from-[#d9b36c] via-[#f3dca0] to-[#c7a16a]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 font-bold tabular-nums" dir="ltr">{pct}%</p>
      </div>
    </div>
  );
}
