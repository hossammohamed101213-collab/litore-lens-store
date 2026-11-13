"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Glossy gold rail on the page edge: its thumb travels up and down with the scroll, plus a back button. */
export function ScrollRail({ backLabel, homeHref }: { backLabel: string; homeHref: string }) {
  const thumb = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
      if (thumb.current) thumb.current.style.setProperty("--p", String(p));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="pointer-events-none fixed end-0.5 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2" aria-hidden={false}>
      <button
        type="button"
        aria-label={backLabel}
        onClick={() => (window.history.length > 1 ? router.back() : router.push(homeHref))}
        className="pointer-events-auto inline-flex size-7 items-center justify-center rounded-full border border-white/70 bg-gradient-to-br from-[#f6e3a8] via-[#d9b36c] to-[#a97b3a] text-[#5a3a14] shadow-[0_4px_10px_-3px_rgba(120,80,20,.6)] hover:brightness-110"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <div className="relative h-[32vh] w-1.5 rounded-full bg-white/55 shadow-inner ring-1 ring-[#d9b36c]/50 backdrop-blur-sm" aria-hidden="true">
        <div
          ref={thumb}
          className="absolute inset-x-0 h-12 rounded-full bg-gradient-to-b from-[#fff2c4] via-[#d9b36c] to-[#9a6d2e] shadow-[0_0_8px_rgba(217,179,108,.9)]"
          style={{ top: "calc(var(--p, 0) * (100% - 3rem))" }}
        />
      </div>
    </div>
  );
}
