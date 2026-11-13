"use client";

import { useState } from "react";

type L = Record<string, string>;
const cls = "min-h-11 w-full rounded-xl border border-gold/50 bg-surface px-4";

export function AffiliateForm({ t }: { t: L }) {
  const [v, setV] = useState({ name: "", phone: "", email: "", social: "", about: "" });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error" | "many">("idle");
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (v.name.trim().length < 2) next.name = t.required;
    if (!/^[+\d][\d\s-]{6,17}$/.test(v.phone.trim())) next.phone = t.phoneBad;
    setErr(next);
    if (Object.keys(next).length) return;
    setState("sending");
    const res = await fetch("/api/affiliate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    setState(res?.ok ? "done" : res?.status === 429 ? "many" : "error");
  }
  if (state === "done") return <p role="status" className="rounded-card border border-gold/40 bg-surface p-6 text-center font-medium">{t.thanks}</p>;
  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-card border border-gold/40 bg-surface p-6">
      <div><label htmlFor="a-name" className="mb-1 block text-sm font-bold">{t.name}</label><input id="a-name" className={cls} value={v.name} onChange={set("name")} autoComplete="name" aria-invalid={!!err.name} />{err.name && <p className="mt-1 text-sm">⚠ {err.name}</p>}</div>
      <div><label htmlFor="a-phone" className="mb-1 block text-sm font-bold">{t.phone}</label><input id="a-phone" type="tel" dir="ltr" inputMode="tel" className={cls} value={v.phone} onChange={set("phone")} autoComplete="tel" aria-invalid={!!err.phone} />{err.phone && <p className="mt-1 text-sm">⚠ {err.phone}</p>}</div>
      <div><label htmlFor="a-email" className="mb-1 block text-sm font-bold">{t.email}</label><input id="a-email" type="email" dir="ltr" className={cls} value={v.email} onChange={set("email")} autoComplete="email" /></div>
      <div><label htmlFor="a-social" className="mb-1 block text-sm font-bold">{t.social}</label><input id="a-social" dir="ltr" className={cls} value={v.social} onChange={set("social")} placeholder="instagram.com/..., tiktok.com/@..." /></div>
      <div><label htmlFor="a-about" className="mb-1 block text-sm font-bold">{t.about}</label><textarea id="a-about" rows={4} className="w-full rounded-xl border border-gold/50 bg-surface px-4 py-2" value={v.about} onChange={set("about")} maxLength={1000} /></div>
      <button disabled={state === "sending"} className="min-h-12 w-full rounded-full bg-mauve px-8 text-white hover:bg-[#6f4353] disabled:opacity-60">{t.send}</button>
      {state === "error" && <p role="alert" className="text-sm font-medium">⚠ {t.error}</p>}
      {state === "many" && <p role="alert" className="text-sm font-medium">⚠ {t.many}</p>}
    </form>
  );
}
