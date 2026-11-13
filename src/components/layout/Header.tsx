import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CartButton } from "@/features/cart/MiniCart";
import { HeartIcon, SearchIcon, UserIcon } from "@/components/ui/Icons";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const items = [
    { href: `/${locale}/shop`, label: dict.nav.shop },
    { href: `/${locale}/prices`, label: dict.nav.prices },
    { href: `/${locale}/color-guide`, label: dict.nav.colorGuide },
    { href: `/${locale}/care`, label: dict.nav.care },
    { href: `/${locale}/about`, label: dict.nav.about },
  ];
  // Phones hide the account/wishlist icons, so they live inside the menu too.
  const extra = [
    { href: `/${locale}/account`, label: dict.actions.account },
    { href: `/${locale}/wishlist`, label: dict.actions.wishlist },
    { href: `/${locale}/track`, label: dict.track.title },
    { href: `/${locale}/contact`, label: dict.nav.contact },
    { href: `/${locale}/complaints`, label: dict.nav.complaints },
  ];
  const iconBtn = "inline-flex size-11 items-center justify-center rounded-full hover:bg-blush/40";

  return (
    <header className="sticky top-0 z-40 border-b border-gold/30 bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:px-6">
        <MobileNav items={items} extra={extra} menuLabel={dict.nav.menu} closeLabel={dict.nav.close} installLabel={dict.install.cta} iosHelp={dict.install.ios} />
        <div className="flex-1 lg:flex-none lg:w-56">
          <div className="flex justify-center lg:justify-start">
            <Logo locale={locale} priority />
          </div>
        </div>
        <NavLinks items={items} label={dict.nav.menu} />
        <div className="flex items-center">
          <Link href={`/${locale}/search`} aria-label={dict.actions.search} className={iconBtn}><SearchIcon /></Link>
          <Suspense fallback={null}>
            <LanguageSwitcher locale={locale} label={dict.actions.language} ariaLabel={dict.actions.languageLabel} />
          </Suspense>
          <Link href={`/${locale}/account`} aria-label={dict.actions.account} className={`${iconBtn} hidden sm:inline-flex`}><UserIcon /></Link>
          <Link href={`/${locale}/wishlist`} aria-label={dict.actions.wishlist} className={`${iconBtn} hidden sm:inline-flex`}><HeartIcon /></Link>
          <CartButton locale={locale} dict={dict} />
        </div>
      </div>
    </header>
  );
}
