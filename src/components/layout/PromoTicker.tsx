import type { Locale } from "@/lib/i18n/config";
import { listPromos } from "@/lib/db/extras";
import { formatPrice } from "@/lib/i18n/format";

/** Discount ticker fed from the admin panel. Hidden when no promo is active. */
export function PromoTicker({ locale }: { locale: Locale }) {
  const promos = listPromos(true);
  if (promos.length === 0) return null;
  const items = promos.map((p) => {
    const name = locale === "ar" ? p.nameAr : p.nameEn;
    const pct = locale === "ar" ? `خصم ${p.percent}%` : `${p.percent}% off`;
    return `${name} · ${pct} · ${formatPrice(p.priceAfter, "AED", locale)}`;
  });
  const reps = Math.max(1, Math.ceil(10 / items.length));
  const group = Array.from({ length: reps }, () => items).flat();
  const chars = group.join("").length;
  const dur = Math.max(18, Math.round(chars * 0.28));
  const render = (key: string, hidden: boolean) => (
    <ul key={key} className="flex shrink-0 items-center" aria-hidden={hidden || undefined} dir={locale === "ar" ? "rtl" : "ltr"}>
      {group.map((t, i) => (
        <li key={i} className="flex shrink-0 items-center whitespace-nowrap px-4 text-sm font-medium">
          {t}<span className="ms-8 text-white/90" aria-hidden="true">✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="ticker bg-gradient-to-r from-[#8a5a3c] via-mauve to-[#8a5a3c] py-2 text-[#fff1cf]" role="region" aria-label={locale === "ar" ? "عروض وخصومات" : "Offers and discounts"} style={{ ["--ticker-dur" as string]: `${dur}s` }}>
      <div className="ticker-track">
        {render("a", false)}
        {render("b", true)}
      </div>
    </div>
  );
}
