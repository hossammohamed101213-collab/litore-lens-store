"use client";
import { useEffect } from "react";

/**
 * Every admin form: the moment a button is pressed it shows a small spinner and cannot be pressed twice,
 * so a slow phone connection never looks like "nothing happened". It un-freezes as soon as the page updates
 * (or after 10 s at the latest).
 */
export function FormPending() {
  useEffect(() => {
    let current: { btn: HTMLButtonElement; timer: number; obs: MutationObserver } | null = null;
    const release = () => {
      if (!current) return;
      const { btn, timer, obs } = current; current = null;
      window.clearTimeout(timer); obs.disconnect();
      if (btn.isConnected) { btn.disabled = false; btn.removeAttribute("aria-busy"); }
    };
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement;
      const sub = (e as SubmitEvent).submitter as HTMLButtonElement | null;
      if (!sub || sub.tagName !== "BUTTON" || e.defaultPrevented) return;
      if (current) release();
      // wait one tick so the browser still sends this button's own value, then lock it
      window.setTimeout(() => {
        if (!form.isConnected) return;
        sub.disabled = true; sub.setAttribute("aria-busy", "true");
        let armed = false;
        const obs = new MutationObserver(() => { if (armed) window.setTimeout(release, 150); });
        window.setTimeout(() => { armed = true; }, 400);
        obs.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true, characterData: true });
        current = { btn: sub, timer: window.setTimeout(release, 10000), obs };
      }, 0);
    };
    document.addEventListener("submit", onSubmit, true);
    return () => { document.removeEventListener("submit", onSubmit, true); release(); };
  }, []);
  return null;
}
