"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { otherLocale, switchLocalePath, type Locale } from "@/lib/i18n/config";

type Props = { locale: Locale; label: string; ariaLabel: string };

/** Keeps the current page and query string when switching language. */
export function LanguageSwitcher({ locale, label, ariaLabel }: Props) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const href = switchLocalePath(pathname, otherLocale(locale)) + (search ? `?${search}` : "");
  return (
    <Link
      href={href}
      hrefLang={otherLocale(locale)}
      lang={otherLocale(locale)}
      aria-label={ariaLabel}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-medium hover:bg-blush/40"
    >
      {label}
    </Link>
  );
}
