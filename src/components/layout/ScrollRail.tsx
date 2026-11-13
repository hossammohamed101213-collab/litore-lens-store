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
    <div className="pointer-events-none fixed end-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2" aria-hidden={false}>
      <button
        type="button"
        aria-label={backLabel}
        onClick={() => (window.history.length > 1 ? router.back() : router.push(homeHref))}
        className="pointer-events-auto inline-flex size-7 items-center justify-center rounded-full border border-white/70 bg-gradient-to-br from-[#f6e3a8] via-[#d9b36c] to-[#a97b3a] text-[#5a3a14] shadow-[0_4px_10px_-3px_rgba(120,80,20,.6)] hover:brightness-110"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <div className="relative h-[32vh] w-1 rounded-full bg-gradient-to-b from-white/70 via-[#e9cf94]/60 to-white/70 shadow-inner ring-1 ring-[#d9b36c]/50 backdrop-blur-sm" aria-hidden="true">
        <div
          ref={thumb}
          className="absolute start-1/2 h-14 w-7 -translate-x-1/2 rtl:translate-x-1/2"
          style={{ top: "calc(var(--p, 0) * (100% - 3.5rem))" }}
        >
          {/* glossy golden spear in the shape of a sparkling star: sharp points top and bottom, short side points */}
          <svg viewBox="0 0 28 56" className="litore-star size-full drop-shadow-[0_0_6px_rgba(240,200,110,.95)]" aria-hidden="true">
            <defs>
              <linearGradient id="rail-gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff7d6" />
                <stop offset=".45" stopColor="#e3bb6a" />
                <stop offset="1" stopColor="#9a6d2e" />
              </linearGradient>
              <linearGradient id="rail-shine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity=".95" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M14 0 L17.2 21 L28 28 L17.2 35 L14 56 L10.8 35 L0 28 L10.8 21 Z" fill="url(#rail-gold)" stroke="#fff3c4" strokeWidth=".8" strokeLinejoin="round" />
            <path d="M14 3 L16 21.5 L14 28 L12 21.5 Z" fill="url(#rail-shine)" />
            <circle className="litore-glint" cx="14" cy="28" r="2.2" fill="#fff" />
          </svg>
        </div>
      </div>
    </div>
  );
}
