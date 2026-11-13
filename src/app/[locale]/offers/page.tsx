import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCommerce } from "@/lib/commerce";
import { formatPrice } from "@/lib/i18n/format";
import { listPromos } from "@/lib/db/extras";
import { ProductCard } from "@/components/commerce/ProductCard";
import { OrnamentalDivider } from "@/components/ui/Ornament";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const d = getDictionary(locale).offers;
  return { title: `${d.title} | Litore`, description: d.lead, alternates: { languages: { ar: "/ar/offers", en: "/en/offers" } } };
}

export default async function OffersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.offers;
  const promos = listPromos(true);
  const discounted = (await getCommerce().listProducts()).filter((p) => p.compareAtPrice && p.compareAtPrice > p.price && p.price > 0);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-center font-display text-4xl font-semibold">{t.title}</h1>
      <OrnamentalDivider className="my-4" />
      <p className="text-center">{t.lead}</p>

      {promos.length === 0 && discounted.length === 0 && (
        <div className="mt-10 text-center">
          <p>{t.empty}</p>
          <Link href={`/${locale}/shop`} className="mt-4 inline-flex min-h-12 items-center rounded-full bg-mauve px-8 text-white">{dict.cart.continue}</Link>
        </div>
      )}

      {promos.length > 0 && (
        <ul className="mx-auto mt-8 max-w-3xl space-y-3">
          {promos.map((p, i) => (
            <li key={p.id} className={`glow-card tone-${i % 5} flex items-center justify-between gap-3 rounded-card border p-4`}>
              <span className="font-bold">{locale === "ar" ? p.nameAr : p.nameEn}</span>
              <span className="text-end text-sm">
                <span className="rounded-full bg-mauve px-2 py-0.5 text-white">{p.percent}% {t.off}</span><br />
                <strong className="text-base">{formatPrice(p.priceAfter, "AED", locale)}</strong> <span className="opacity-70">{t.after}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {discounted.length > 0 && (
        <section className="mt-10" aria-labelledby="disc">
          <h2 id="disc" className="mb-4 text-xl font-bold">{t.discounted}</h2>
          <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {discounted.map((p, i) => <li key={p.id}><ProductCard product={p} locale={locale} mockLabel={dict.preview.mockBadge} tone={i} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
