import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CartButton } from "@/features/cart/MiniCart";
import { HeartIcon, SearchIcon, UserIcon } from "@/components/ui/Icons";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  // Exact order requested by the owner (same on phone and desktop).
  const items = [
    { href: `/${locale}/offers`, label: dict.nav.offers },
    { href: `/${locale}/color-guide`, label: dict.nav.colorGuide },
    { href: `/${locale}/care`, label: dict.nav.care },
    { href: `/${locale}/about`, label: dict.nav.about },
  ];
  const iconBtn = "inline-flex size-10 items-center justify-center rounded-full hover:bg-blush/40 sm:size-11";

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/55 shadow-[0_8px_30px_-18px_rgba(134,84,102,.35)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Logo sits in the exact middle; the other items are split between the two sides (works in RTL and LTR). */}
        <div className="relative flex min-h-[66px] items-center py-1.5">
          <NavLinks items={items} label={dict.nav.menu} className="hidden xl:order-first xl:flex xl:gap-2 xl:pe-4" />
          <Link href={`/${locale}/search`} aria-label={dict.actions.search} className={`${iconBtn} xl:ms-auto`}><SearchIcon /></Link>
          <Suspense fallback={null}>
            <LanguageSwitcher locale={locale} label={dict.actions.language} ariaLabel={dict.actions.languageLabel} />
          </Suspense>
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
            <div className="pointer-events-auto"><Logo locale={locale} priority /></div>
          </div>
          <div className="ms-auto flex items-center xl:ms-0">
            <CartButton locale={locale} dict={dict} />
            <Link href={`/${locale}/account`} aria-label={dict.actions.account} className={iconBtn}><UserIcon /></Link>
            <Link href={`/${locale}/wishlist`} aria-label={dict.actions.wishlist} className={iconBtn}><HeartIcon /></Link>
          </div>
        </div>
        <NavLinks items={items} label={dict.nav.menu} className="-mx-4 flex justify-between overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:justify-center sm:gap-1 sm:px-6 xl:hidden" />
      </div>
    </header>
  );
}
