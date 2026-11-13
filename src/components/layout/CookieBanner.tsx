"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "litore.cookies.v1";
export type CookieChoice = "all" | "essential";

type Labels = { title: string; text: string; accept: string; essential: string; more: string; settings: string };

/** Consent banner: essential cookies always on; optional ones only after "accept all". The choice is remembered and can be reopened. */
export function CookieBanner({ labels, privacyHref }: { labels: Labels; privacyHref: string }) {
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = window.localStorage.getItem(KEY);
        setAsked(!!v);
        setOpen(!v);
      } catch {
        setOpen(true);
        setAsked(false);
      }
    }, 600);
    const reopen = () => setOpen(true);
    window.addEventListener("litore:cookie-settings", reopen);
    return () => { clearTimeout(t); window.removeEventListener("litore:cookie-settings", reopen); };
  }, []);

  function choose(c: CookieChoice) {
    try { window.localStorage.setItem(KEY, c); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent("litore:cookie-choice", { detail: c }));
    setOpen(false);
    setAsked(true);
  }
  if (!open) return asked ? null : null;
  return (
    <div role="dialog" aria-labelledby="ck-t" className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-card border border-gold/60 bg-white p-4 shadow-2xl sm:bottom-5">
      <h2 id="ck-t" className="font-display text-lg font-semibold">{labels.title}</h2>
      <p className="mt-1 text-sm leading-6">{labels.text} <Link href={privacyHref} className="underline">{labels.more}</Link></p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => choose("all")} className="min-h-11 flex-1 rounded-full bg-mauve px-5 text-sm text-white hover:bg-[#6f4353]">{labels.accept}</button>
        <button onClick={() => choose("essential")} className="min-h-11 flex-1 rounded-full border border-mauve px-5 text-sm hover:bg-blush/40">{labels.essential}</button>
      </div>
    </div>
  );
}

export function CookieSettingsLink({ label }: { label: string }) {
  return <button type="button" onClick={() => window.dispatchEvent(new Event("litore:cookie-settings"))} className="min-h-11 underline">{label}</button>;
}
