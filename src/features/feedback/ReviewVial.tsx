"use client";

import { useId, useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Review = { id: string; rating: number | null; name: string; message: string };

/** Slim glass vial: the liquid rises and falls with the pointer and the stars follow it. */
export function ReviewVial({ dict, reviews, summary }: { dict: Dictionary; reviews: Review[]; summary: { count: number; avg: number } }) {
  const r = dict.reviews;
  const uid = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const level = hover ?? rating; // 0..5
  const fill = level / 5;
  const fromPointer = (clientY: number) => {
    const b = box.current!.getBoundingClientRect();
    const f = 1 - (clientY - b.top) / b.height;
    return Math.min(5, Math.max(1, Math.ceil(f * 5)));
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setState("sending");
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "review", rating, name, message: comment }) });
      setState(res.ok ? "done" : "error");
    } catch { setState("error"); }
  }

  return (
    <div className="glow-card tone-1 rounded-card border p-5">
      <h2 className="font-display text-2xl font-semibold">{r.title}</h2>
      <p className="mt-1 text-sm opacity-80">{r.hint}</p>
      <div className="mt-4 flex items-stretch justify-center gap-4">
        <div
          ref={box}
          className="relative h-44 w-12 shrink-0 cursor-pointer touch-none select-none"
          onPointerMove={(e) => setHover(fromPointer(e.clientY))}
          onPointerLeave={() => setHover(null)}
          onPointerDown={(e) => setRating(fromPointer(e.clientY))}
          aria-hidden="true"
        >
          <svg viewBox="0 0 48 176" className="absolute inset-0 size-full" preserveAspectRatio="none">
            <defs>
              <clipPath id={`${uid}c`}><rect x="6" y="4" width="36" height="168" rx="18" /></clipPath>
              <linearGradient id={`${uid}l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6a8c2" /><stop offset="1" stopColor="#c46a8d" /></linearGradient>
            </defs>
            <rect x="6" y="4" width="36" height="168" rx="18" fill="#fff" fillOpacity=".55" />
            <g clipPath={`url(#${uid}c)`}>
              <g style={{ transform: `translateY(${(1 - fill) * 168}px)`, transition: "transform .45s cubic-bezier(.3,1.4,.5,1)" }}>
                <rect x="0" y="8" width="48" height="190" fill={`url(#${uid}l)`} />
                <g className="vial-wave"><path d="M0 8c6-5 12-5 18 0s12 5 18 0c6-5 12-5 18 0s12 5 18 0c6-5 12-5 18 0s12 5 18 0c6-5 12-5 18 0s12 5 18 0V30H0Z" fill="#f6a8c2" transform="translate(0 2)" /></g>
              </g>
              <ellipse cx="16" cy="60" rx="3" ry="42" fill="#fff" fillOpacity=".55" />
            </g>
            <rect x="6" y="4" width="36" height="168" rx="18" fill="none" stroke="#c7a16a" strokeWidth="2.2" />
          </svg>
        </div>
        <div role="radiogroup" aria-label={r.title} className="flex flex-col-reverse justify-between py-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={r.stars.replace("{n}", String(n))}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(null)}
              onClick={() => setRating(n)}
              className={`size-8 text-2xl leading-none transition-transform ${n <= level ? "scale-110 text-[#d9a441] drop-shadow" : "text-gold/40"}`}
            >★</button>
          ))}
        </div>
      </div>
      {state === "done" ? (
        <p role="status" className="mt-4 rounded-xl bg-white/70 p-3 text-center text-sm font-medium">{r.thanks}</p>
      ) : (
        rating > 0 && (
          <form onSubmit={send} className="mt-4 space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={r.name} aria-label={r.name} className="min-h-11 w-full rounded-xl border border-gold/50 bg-white/80 px-3 text-sm" />
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1500} rows={3} placeholder={r.comment} aria-label={r.comment} className="w-full rounded-xl border border-gold/50 bg-white/80 px-3 py-2 text-sm" />
            <button disabled={state === "sending"} className="min-h-11 w-full rounded-full bg-mauve px-6 text-white hover:bg-[#6f4353] disabled:opacity-60">{r.send}</button>
            {state === "error" && <p role="alert" className="text-sm font-medium">{r.error}</p>}
          </form>
        )
      )}
      {summary.count > 0 && (
        <div className="mt-5 border-t border-gold/30 pt-4">
          <p className="text-sm font-bold">{r.avg}: <span dir="ltr">{summary.avg.toFixed(1)} ★</span> ({summary.count} {r.count})</p>
          <ul className="mt-3 space-y-3">
            {reviews.map((v) => (
              <li key={v.id} className="rounded-xl bg-white/70 p-3 text-sm">
                <p className="text-[#d9a441]" aria-label={r.stars.replace("{n}", String(v.rating ?? 0))}>{"★".repeat(v.rating ?? 0)}</p>
                <p className="mt-1 leading-7">{v.message}</p>
                {v.name && <p className="mt-1 text-xs opacity-70">— {v.name}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
