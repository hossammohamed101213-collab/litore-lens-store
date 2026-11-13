"use client";

import Image from "next/image";
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
      <Image src="/brand/litore-logo.webp" alt="Litore" width={640} height={546} priority={priority} className="h-12 w-auto sm:h-14" />
    </Link>
  );
}
