import { CookieSettingsLink } from "./CookieBanner";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { OrnamentalDivider } from "@/components/ui/Ornament";
import { WHATSAPP_DISPLAY, waLink } from "@/lib/site";
import { InstallApp } from "./InstallApp";
import { SocialLinks } from "./SocialLinks";

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const f = dict.footer;
  const col = (title: string, links: [string, string][]) => (
    <div>
      <h2 className="mb-3 text-base font-bold">{title}</h2>
      <ul className="space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={`/${locale}${href}`} className="inline-block min-h-6 hover:text-rose">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer className="mt-16 border-t border-gold/40 bg-blush/30">
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-12 sm:px-6 lg:pb-12">
        <OrnamentalDivider className="mb-10" />
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-3xl">Litore</p>
            <p className="mt-2 text-sm">{f.tagline}</p>
          </div>
          {col(f.shop, [["/shop", dict.nav.shop], ["/offers", dict.nav.offers], ["/color-guide", dict.nav.colorGuide], ["/about", dict.nav.about]])}
          {col(f.help, [["/faq", f.faq], ["/shipping", f.shipping], ["/returns", f.returns], ["/track", dict.track.title], ["/contact", dict.nav.contact], ["/complaints", f.complaints], ["/care", dict.nav.care]])}
          <div className="space-y-3">
            <h2 className="text-base font-bold">{dict.quick.wa}</h2>
            <a href={waLink(dict.wa.msg)} target="_blank" rel="noopener noreferrer" dir="ltr" className="inline-flex min-h-11 items-center rounded-full bg-[#1f9d55] px-6 text-sm font-bold text-white hover:bg-[#188046]">{WHATSAPP_DISPLAY}</a>
            <SocialLinks waText={dict.wa.msg} />
            <InstallApp label={dict.install.cta} iosHelp={dict.install.ios} />
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gold/30 pt-6 text-sm sm:flex-row">
          <p>© {new Date().getFullYear()} Litore. {f.rights}</p>
          <p className="flex flex-wrap justify-center gap-x-4">
            <Link href={`/${locale}/privacy`} className="hover:text-rose">{f.privacy}</Link>
            <Link href={`/${locale}/terms`} className="hover:text-rose">{f.terms}</Link>
            <Link href={`/${locale}/affiliate`} className="hover:text-rose">{f.affiliate}</Link>
            <CookieSettingsLink label={dict.cookies.settings} />
          </p>
        </div>
      </div>
    </footer>
  );
}
