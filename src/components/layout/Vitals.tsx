"use client";
import { useEffect } from "react";

/**
 * Real speed as visitors feel it (Core Web Vitals), measured in their own browser on the first page they open:
 *  LCP = when the biggest thing on the first screen appeared, CLS = how much the page jumped, INP = slowest reaction to a tap/click.
 * Sent once, anonymously, when the visitor leaves the page - and only if they accepted statistics cookies (same rule as page views).
 */
export function Vitals() {
  useEffect(() => {
    let lcp = 0, cls = 0, inp = 0, sent = false;
    const obs: PerformanceObserver[] = [];
    const watch = (type: string, cb: (e: PerformanceEntry) => void, extra: Record<string, unknown> = {}) => {
      try { const o = new PerformanceObserver((l) => l.getEntries().forEach(cb)); o.observe({ type, buffered: true, ...extra } as PerformanceObserverInit); obs.push(o); } catch { /* this browser does not report it */ }
    };
    watch("largest-contentful-paint", (e) => { lcp = e.startTime; });
    watch("layout-shift", (e) => { const s = e as unknown as { value: number; hadRecentInput: boolean }; if (!s.hadRecentInput) cls += s.value; });
    watch("event", (e) => { const ev = e as unknown as { interactionId?: number; duration: number }; if (ev.interactionId && ev.duration > inp) inp = ev.duration; }, { durationThreshold: 40 });
    const path = window.location.pathname;
    const send = () => {
      if (sent || !lcp) return;
      try { if (window.localStorage.getItem("litore.cookies.v1") !== "all") return; } catch { return; }
      sent = true;
      const body = JSON.stringify({ path, lcp: Math.round(lcp), cls: Math.round(cls * 1000), inp: Math.round(inp), w: window.innerWidth });
      try { if (!navigator.sendBeacon?.("/api/vitals", new Blob([body], { type: "application/json" }))) void fetch("/api/vitals", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {}); } catch { /* ignore */ }
    };
    const onHide = () => { if (document.visibilityState === "hidden") send(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", send);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", send); obs.forEach((o) => o.disconnect()); };
  }, []);
  return null;
}
