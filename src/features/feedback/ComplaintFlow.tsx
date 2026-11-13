"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { WHATSAPP_DISPLAY, waLink } from "@/lib/site";

const CYCLES = 2; // each cycle = 4s inhale + 4s exhale

/** Breathing pause before writing a complaint, then the form. */
export function ComplaintFlow({ dict, locale }: { dict: Dictionary; locale: "ar" | "en" }) {
  const c = dict.complaints;
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [step, setStep] = useState(0); // 0..CYCLES*2
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<"complaint" | "suggestion">("complaint");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => {
      if (step + 1 >= CYCLES * 2) return setReady(true);
      setStep(step + 1);
      setPhase((p) => (p === "in" ? "out" : "in"));
    }, 4000);
    return () => clearTimeout(t);
  }, [step, ready]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, name, contact, message }) });
      setState(res.ok ? "done" : "error");
    } catch { setState("error"); }
  }

  const input = "min-h-11 w-full rounded-xl border border-gold/50 bg-white/80 px-3";
  return (
    <div className="space-y-6">
      <section className="glow-card tone-3 rounded-card border p-6 text-center" aria-live="polite">
        <h2 className="font-display text-2xl font-semibold">{c.calmTitle}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm opacity-80">{c.calmSub}</p>
        <div className="my-6 flex h-40 items-center justify-center">
          <div className="lungs relative flex size-32 items-center justify-center" aria-hidden="true" style={ready ? { animationPlayState: "paused" } : undefined}>
            <span className="absolute inset-0 rounded-full bg-[#8fd3b6]/35" />
            <span className="absolute inset-3 rounded-full bg-[#8fd3b6]/55" />
            <span className="absolute inset-7 rounded-full bg-gradient-to-br from-[#d6f3e6] via-[#8fd3b6] to-[#4a9c80] shadow-[0_0_24px_rgba(74,156,128,.6)]" />
          </div>
        </div>
        <p className="font-bold" role="status">{ready ? "✓" : phase === "in" ? c.inhale : c.exhale}</p>
        <div className="mt-4 flex justify-center gap-3">
          {!ready && <button type="button" onClick={() => setReady(true)} className="min-h-11 rounded-full border border-mauve px-5 text-sm hover:bg-white/60">{c.skip}</button>}
        </div>
      </section>

      {ready && (
        state === "done" ? (
          <p role="status" className="glow-card tone-1 rounded-card border p-6 text-center font-medium">{c.thanks}</p>
        ) : (
          <form onSubmit={send} className="glow-card tone-1 space-y-4 rounded-card border p-5">
            <fieldset className="flex gap-3">
              <legend className="sr-only">{c.kind}</legend>
              {(["complaint", "suggestion"] as const).map((k) => (
                <label key={k} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border px-4 text-sm ${kind === k ? "border-mauve bg-mauve text-white" : "border-gold/50 bg-white/70"}`}>
                  <input type="radio" name="kind" className="sr-only" checked={kind === k} onChange={() => setKind(k)} />{c[k]}
                </label>
              ))}
            </fieldset>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={c.name} aria-label={c.name} className={input} />
            <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} placeholder={c.contact} aria-label={c.contact} dir="ltr" className={input} />
            <textarea required minLength={5} maxLength={1500} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={c.message} aria-label={c.message} className={`${input} py-2`} />
            <button disabled={state === "sending"} className="min-h-12 w-full rounded-full bg-mauve px-8 text-white hover:bg-[#6f4353] disabled:opacity-60">{c.send}</button>
            {state === "error" && <p role="alert" className="text-sm font-medium">{c.error}</p>}
          </form>
        )
      )}
      <p className="text-center text-sm">
        {c.needWa}{" "}
        <a className="font-bold underline" dir="ltr" target="_blank" rel="noopener noreferrer" href={waLink(locale === "ar" ? "مرحبًا Litore" : "Hello Litore")}>{WHATSAPP_DISPLAY}</a>
      </p>
    </div>
  );
}
