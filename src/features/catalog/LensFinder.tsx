"use client";

import Link from "next/link";
import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** Rule-based colour picker: eye colour x look x occasion -> up to 3 colour families (shop filters). */
const BASE: Record<number, Record<number, string[]>> = {
  0: { 0: ["honey", "hazel"], 1: ["hazel", "gray", "honey"], 2: ["blue", "green", "gray"] },
  1: { 0: ["hazel", "honey"], 1: ["green", "gray", "hazel"], 2: ["blue", "green", "mauve"] },
  2: { 0: ["gray", "hazel"], 1: ["green", "blue", "gray"], 2: ["pink", "mauve", "blue"] },
};
const OCC: Record<number, string | null> = { 0: null, 1: "mauve", 2: "pink" };

export function LensFinder({ dict, locale }: { dict: Dictionary; locale: string }) {
  const f = dict.finder;
  const colors = dict.shop.colors as Record<string, string>;
  const qs = [[f.q1, f.q1a], [f.q2, f.q2a], [f.q3, f.q3a]] as const;
  const [ans, setAns] = useState<number[]>([]);
  const step = ans.length;
  const done = step === 3;
  let picks: string[] = [];
  if (done) {
    picks = [...BASE[ans[0]][ans[1]]];
    const extra = OCC[ans[2]];
    if (extra && !picks.includes(extra)) picks = [picks[0], extra, ...picks.slice(1)];
    picks = picks.slice(0, 3);
  }
  return (
    <div className="glow-card tone-2 rounded-card border p-5">
      <h2 className="font-display text-2xl font-semibold">{f.title}</h2>
      <p className="mt-1 text-sm opacity-80">{f.sub}</p>
      {!done ? (
        <div className="mt-4">
          <p className="mb-3 font-bold">{qs[step][0]}</p>
          <div className="grid gap-2">
            {qs[step][1].map((label, i) => (
              <button key={label} type="button" onClick={() => setAns([...ans, i])} className="min-h-11 rounded-full border border-gold/60 bg-white/80 px-4 text-sm hover:bg-white">{label}</button>
            ))}
          </div>
          <p className="mt-3 text-xs opacity-70" dir="ltr" aria-hidden="true">{step + 1} / 3</p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="mb-3 font-bold">{f.result}</p>
          <div className="flex flex-wrap gap-2">
            {picks.map((c) => (
              <Link key={c} href={`/${locale}/shop?color=${c}`} className="inline-flex min-h-11 items-center rounded-full bg-mauve px-5 text-sm text-white hover:bg-[#6f4353]">{f.show} {colors[c] ?? c}</Link>
            ))}
          </div>
          <p className="mt-3 text-xs opacity-80">{f.tip}</p>
          <button type="button" onClick={() => setAns([])} className="mt-3 text-sm underline">{f.again}</button>
        </div>
      )}
    </div>
  );
}
