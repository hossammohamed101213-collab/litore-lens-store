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
  const iconBtn = "inline-flex size-11 items-center justify-center rounded-full hover:bg-blush/40";

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/55 shadow-[0_8px_30px_-18px_rgba(134,84,102,.35)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 px-4 py-1.5 sm:px-6 xl:flex-nowrap">
        <div className="flex-1 xl:w-56 xl:flex-none">
          <div className="flex justify-start">
            <Logo locale={locale} priority />
          </div>
        </div>
        <NavLinks items={items} label={dict.nav.menu} />
        <div className="flex items-center xl:order-last">
          <Link href={`/${locale}/search`} aria-label={dict.actions.search} className={iconBtn}><SearchIcon /></Link>
          <Suspense fallback={null}>
            <LanguageSwitcher locale={locale} label={dict.actions.language} ariaLabel={dict.actions.languageLabel} />
          </Suspense>
          <CartButton locale={locale} dict={dict} />
          <Link href={`/${locale}/account`} aria-label={dict.actions.account} className={iconBtn}><UserIcon /></Link>
          <Link href={`/${locale}/wishlist`} aria-label={dict.actions.wishlist} className={iconBtn}><HeartIcon /></Link>
        </div>
      </div>
    </header>
  );
}
