import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/template";
import { getCommerce } from "@/lib/commerce";
import { parseQuery, type RawParams } from "@/features/catalog/filters";
import { ProductGrid } from "@/components/commerce/ProductGrid";
import { logSearch } from "@/lib/analytics";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { search } = parseQuery(await searchParams);
  const products = search ? await getCommerce().listProducts({ search }) : [];
  if (search) logSearch(search, products.length);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-center font-display text-4xl font-semibold">{dict.search.title}</h1>
      <form role="search" method="get" className="mx-auto mt-6 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">{dict.search.placeholder}</label>
        <input
          id="q"
          name="q"
          defaultValue={search}
          placeholder={dict.search.placeholder}
          className="min-h-11 flex-1 rounded-full border border-gold/50 bg-surface px-5"
        />
        <button className="min-h-11 rounded-full bg-mauve px-6 text-white hover:bg-[#6f4353]">{dict.search.button}</button>
      </form>

      <div className="mt-10" aria-live="polite">
        {!search ? (
          <p className="text-center text-sm opacity-80">{dict.search.prompt}</p>
        ) : products.length ? (
          <>
            <p className="mb-5 text-sm">{fill(dict.search.results, { q: search })}</p>
            <ProductGrid products={products} locale={locale} mockLabel={dict.preview.mockBadge} />
          </>
        ) : (
          <EmptyState title={dict.shop.empty} hint={dict.shop.emptyHint} href={`/${locale}/shop`} cta={dict.shop.title} />
        )}
      </div>
    </div>
  );
}
