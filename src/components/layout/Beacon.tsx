"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Sends one anonymous page-view per navigation, only if the visitor accepted statistics cookies.
export function Beacon() {
  const path = usePathname();
  useEffect(() => {
    try {
      if (window.localStorage.getItem("litore.cookies.v1") !== "all") return;
      let v = window.sessionStorage.getItem("litore.visit");
      if (!v) { v = Math.random().toString(36).slice(2, 12); window.sessionStorage.setItem("litore.visit", v); }
      const body = JSON.stringify({ path, ref: document.referrer, visit: v, screen: `${window.screen.width}x${window.screen.height}` });
      fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch { /* ignore */ }
  }, [path]);
  return null;
}
