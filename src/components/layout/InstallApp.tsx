"use client";

import { useEffect, useState } from "react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Offers "install as app": native prompt on Android/desktop, instructions on iPhone. Registers the tiny service worker. */
export function InstallApp({ label, iosHelp, className = "" }: { label: string; iosHelp: string; className?: string }) {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});
    const t = setTimeout(() => {
      setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    }, 0);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIP); };
    const onInstalled = () => { setStandalone(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (standalone || (!evt && !ios)) return null;
  return (
    <div className={className}>
      <button
        type="button"
        onClick={async () => { if (evt) { await evt.prompt(); setEvt(null); } else setHelp((v) => !v); }}
        className="glow-card tone-0 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" /></svg>
        {label}
      </button>
      {help && <p role="status" className="mt-2 rounded-xl bg-blush/50 p-3 text-center text-xs">{iosHelp}</p>}
    </div>
  );
}
