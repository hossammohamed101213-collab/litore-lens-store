import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/template";
import { getCommerce } from "@/lib/commerce";
import { buildHref, parseQuery, type RawParams } from "@/features/catalog/filters";
import { ProductGrid } from "@/components/commerce/ProductGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrnamentalDivider } from "@/components/ui/Ornament";

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const query = parseQuery(await searchParams);
  const commerce = getCommerce();

  // Only offer filters that have real data behind them.
  const all = await commerce.listProducts();
  const families = [...new Set(all.map((p) => p.colorFamily).filter(Boolean))] as string[];
  const products = await commerce.listProducts(query);

  const base = `/${locale}/shop`;
  const colors = dict.shop.colors as Record<string, string>;
  const chip = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors ${
      active ? "border-mauve bg-mauve text-white" : "border-gold/50 bg-surface hover:bg-blush/40"
    }`;

  const filterPanel = (
    <div className="space-y-4">
      <h2 className="font-bold">{dict.shop.color}</h2>
      <div className="flex flex-wrap gap-2">
        <Link href={buildHref(base, { sort: query.sort })} className={chip(!query.colorFamily)} aria-current={!query.colorFamily}>
          {dict.shop.all}
        </Link>
        {families.map((f) => (
          <Link
            key={f}
            href={buildHref(base, { color: f, sort: query.sort })}
            className={chip(query.colorFamily === f)}
            aria-current={query.colorFamily === f}
          >
            {colors[f] ?? f}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold">{dict.shop.title}</h1>
        <OrnamentalDivider className="mt-3" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside>
          <details className="rounded-card border border-gold/40 bg-surface p-4 lg:hidden">
            <summary className="flex min-h-11 cursor-pointer items-center font-bold">{dict.shop.filters}</summary>
            <div className="mt-3">{filterPanel}</div>
          </details>
          <div className="hidden rounded-card border border-gold/40 bg-surface p-5 lg:block">{filterPanel}</div>
        </aside>

        <section aria-live="polite">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">{fill(dict.shop.count, { n: products.length })}</p>
            <form method="get" className="flex items-center gap-2">
              {query.colorFamily && <input type="hidden" name="color" value={query.colorFamily} />}
              <label htmlFor="sort" className="text-sm">{dict.shop.sort}</label>
              <select
                id="sort"
                name="sort"
                defaultValue={query.sort}
                className="min-h-11 rounded-full border border-gold/50 bg-surface px-3 text-sm"
              >
                {Object.entries(dict.shop.sortOptions).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
              <button className="min-h-11 rounded-full bg-mauve px-4 text-sm text-white">{dict.shop.apply}</button>
            </form>
          </div>

          {products.length ? (
            <ProductGrid products={products} locale={locale} mockLabel={dict.preview.mockBadge} />
          ) : (
            <EmptyState title={dict.shop.empty} hint={dict.shop.emptyHint} href={base} cta={dict.shop.clear} />
          )}
        </section>
      </div>
    </div>
  );
}
