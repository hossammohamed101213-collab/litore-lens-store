"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/** Shown on every inner admin page: one tap returns to the control center (or one level up). */
export function BackBar() {
  const path = usePathname(); const router = useRouter();
  if (path === "/admin") return null;
  const parent = path.split("/").slice(0, -1).join("/");
  const inner = parent.length > "/admin".length ? parent : "/admin";
  // analytics topics have no index page of their own, so go straight to the hub
  const SECTIONS = ["shipping", "integrations", "tax", "background", "social", "ticker", "account", "backup", "activity", "payments"];
  const top = path.split("/")[2];
  const up = inner.startsWith("/admin/analytics") ? "/admin" : inner === "/admin" && SECTIONS.includes(top) ? "/admin/settings" : inner;
  return (
    <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 pt-4">
      <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push(up))} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-mauve bg-white/80 px-5 text-sm font-bold hover:bg-blush/50">→ رجوع</button>
      <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-mauve px-5 text-sm font-bold text-white hover:bg-[#6f4353]">🏠 مركز التحكم</Link>
    </div>
  );
}
