import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { waLink } from "@/lib/site";

const ICONS: Record<string, string> = {
  offers: "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 7.5h.01",
  fav: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  prices: "M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.1-4 2.8c0 4 8 2 8 6 0 1.8-1.8 2.9-4 2.9s-4-1.3-4-3",
  color: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.4-2-.7-1.2 0-2.5 1.6-2.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3ZM7.5 11h.01M10 7.5h.01M14.5 7.5h.01",
  care: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  track: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  complaints: "M4 5h16v11H9l-5 4V5Z",
  wa: "M5 20l1.3-4.2A8 8 0 1 1 9 18.7L5 20Z",
};

export function QuickCards({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const q = dict.quick;
  const cards = [
    { k: "offers", href: `/${locale}/offers`, t: dict.nav.offers, h: dict.offers.lead },
    { k: "color", href: `/${locale}/color-guide`, t: q.color, h: q.colorHint },
    { k: "care", href: `/${locale}/care`, t: q.care, h: q.careHint },
    { k: "track", href: `/${locale}/track`, t: q.track, h: q.trackHint },
    { k: "fav", href: `/${locale}/wishlist`, t: dict.account.favorites, h: dict.wishlist.emptyHint },
    { k: "complaints", href: `/${locale}/complaints`, t: q.complaints, h: q.complaintsHint },
    { k: "wa", href: waLink(dict.wa.msg), t: q.wa, h: q.waHint, ext: true },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {cards.map((c, i) => {
        const cls = `glow-card tone-${i % 5} flex h-full min-h-28 flex-col items-center justify-center gap-1 rounded-card border p-3 text-center`;
        const inner = (
          <>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[c.k]} /></svg>
            <span className="font-bold">{c.t}</span>
            <span className="text-xs opacity-75">{c.h}</span>
          </>
        );
        return (
          <li key={c.k}>
            {c.ext ? <a href={c.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a> : <Link href={c.href} className={cls}>{inner}</Link>}
          </li>
        );
      })}
    </ul>
  );
}
