import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCommerce } from "@/lib/commerce";
import { formatPrice } from "@/lib/i18n/format";
import { listPromos } from "@/lib/db/extras";
import { OrnamentalDivider } from "@/components/ui/Ornament";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const d = getDictionary(locale).prices;
  return { title: `${d.title} | Litore`, description: d.intro, alternates: { languages: { ar: "/ar/prices", en: "/en/prices" } } };
}

export default async function PricesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.prices;
  const products = (await getCommerce().listProducts()).filter((p) => p.price > 0);
  const promos = listPromos(true);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-center font-display text-4xl font-semibold">{t.title}</h1>
      <OrnamentalDivider className="my-4" />
      <p className="text-center">{t.intro}</p>

      {promos.length > 0 && (
        <section className="mt-8" aria-labelledby="offers">
          <h2 id="offers" className="mb-3 text-xl font-bold">{t.offers}</h2>
          <ul className="space-y-3">
            {promos.map((p, i) => (
              <li key={p.id} className={`glow-card tone-${i % 5} flex items-center justify-between gap-3 rounded-card border p-4`}>
                <span className="font-bold">{locale === "ar" ? p.nameAr : p.nameEn}</span>
                <span className="text-end text-sm"><span className="rounded-full bg-mauve px-2 py-0.5 text-white">{p.percent}% {t.off}</span><br /><strong className="text-base">{formatPrice(p.priceAfter, "AED", locale)}</strong> <span className="opacity-70">{t.after}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8" aria-labelledby="all">
        <h2 id="all" className="mb-3 text-xl font-bold">{t.all}</h2>
        {products.length === 0 ? <p>{t.none}</p> : (
          <ul className="space-y-3">
            {products.map((p, i) => (
              <li key={p.id}>
                <Link href={`/${locale}/shop/${p.slug}`} className={`glow-card tone-${(i + 2) % 5} flex items-center justify-between gap-3 rounded-card border p-4`}>
                  <span className="font-bold">{p.name[locale]}</span>
                  <span className="text-end">
                    <strong>{formatPrice(p.price, p.currency, locale)}</strong>
                    {p.compareAtPrice ? <span className="block text-xs opacity-60">{t.wasPrice} <s>{formatPrice(p.compareAtPrice, p.currency, locale)}</s></span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
