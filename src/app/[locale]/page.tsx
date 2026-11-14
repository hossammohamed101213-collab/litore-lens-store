import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCommerce } from "@/lib/commerce";
import { Hero, HomeBackdrop } from "@/components/sections/Hero";
import { QuickCards } from "@/components/sections/QuickCards";
import { OrnamentalDivider } from "@/components/ui/Ornament";
import { ProductGrid } from "@/components/commerce/ProductGrid";
import { LensFinder } from "@/features/catalog/LensFinder";
import { ReviewVial } from "@/features/feedback/ReviewVial";
import { approvedReviews, ratingSummary } from "@/lib/db/extras";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const products = await getCommerce().listProducts({ limit: 8 });
  const sample = products.some((p) => p.isMock);
  const reviews = approvedReviews(5).map((r) => ({ id: r.id, rating: r.rating, name: r.name, message: r.message, tags: r.tags ? r.tags.split(",") : [] }));

  return (
    <>
      <HomeBackdrop locale={locale} />
      <Hero locale={locale} dict={dict} />
      <section aria-labelledby="lenses" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h2 id="lenses" className="font-display text-3xl font-semibold sm:text-4xl">{sample ? dict.preview.title : dict.home.lensesTitle}</h2>
          <OrnamentalDivider className="my-4" />
          <p className="mx-auto max-w-xl text-sm opacity-80">{sample ? dict.preview.subtitle : dict.home.lensesSub}</p>
        </div>
        {products.length === 0 ? (
          <p className="glow-card tone-1 mx-auto mt-8 max-w-md rounded-card border p-6 text-center">{dict.home.noProducts}</p>
        ) : (
          <div className="mt-8"><ProductGrid products={products} locale={locale} mockLabel={dict.preview.mockBadge} /></div>
        )}
      </section>
      <section aria-label={dict.home.quick} className="mx-auto max-w-5xl px-4 pb-10 sm:px-6"><QuickCards locale={locale} dict={dict} /></section>
      <section className="mx-auto grid max-w-5xl gap-5 px-4 pb-6 sm:px-6 md:grid-cols-2">
        <LensFinder dict={dict} locale={locale} />
        <ReviewVial dict={dict} reviews={reviews} summary={ratingSummary()} />
      </section>
    </>
  );
}
