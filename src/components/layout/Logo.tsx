"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";

export function Logo({ locale, priority = false }: { locale: Locale; priority?: boolean }) {
  const pathname = usePathname();
  const home = `/${locale}`;
  return (
    <Link
      href={home}
      aria-label="Litore"
      onClick={() => { if (pathname === home) window.scrollTo({ top: 0, behavior: "smooth" }); }}
      className="inline-flex shrink-0 items-center"
    >
      {/* a ready-made small file: the header logo is ~60px wide, so nothing is resized on the server and phones download 12KB */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/litore-logo-sm.webp" alt="Litore" width={160} height={136} decoding="async" fetchPriority={priority ? "high" : "auto"} className="h-12 w-auto sm:h-[52px]" />
    </Link>
  );
}
