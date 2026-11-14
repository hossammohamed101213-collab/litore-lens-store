import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCommerce } from "@/lib/commerce";
import { ProductGallery } from "@/components/commerce/ProductGallery";
import { Price } from "@/components/commerce/Price";
import { PurchasePanel } from "@/components/commerce/PurchasePanel";
import { WishlistButton } from "@/features/account/AccountViews";
import { ProductGrid } from "@/components/commerce/ProductGrid";

type Params = Promise<{ locale: string; slug: string }>;
export const dynamic = "force-dynamic";


export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = await getCommerce().getProductBySlug(slug);
  if (!product) return {};
  return {
    title: `${product.name[locale]} | Litore`,
    description: product.shortDescription[locale],
    alternates: { languages: { ar: `/ar/shop/${slug}`, en: `/en/shop/${slug}` } },
    // Sample products must never be indexed.
    robots: product.isMock ? { index: false, follow: false } : undefined,
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const commerce = getCommerce();
  const product = await commerce.getProductBySlug(slug);
  if (!product) notFound();

  const p = dict.product;
  const related = (await commerce.listProducts({ colorFamily: undefined })).filter((x) => x.id !== product.id).slice(0, 4);
  const specs: [string, string | number | undefined][] = [
    [p.wearDuration, product.wearDuration],
    [p.diameter, product.diameter],
    [p.baseCurve, product.baseCurve],
    [p.waterContent, product.waterContent],
    [p.lensCount, product.lensCount],
  ];
  const sectionCls = "rounded-card border border-gold/40 bg-surface p-5";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
      <nav aria-label="breadcrumb" className="mb-6 text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          <li><Link href={`/${locale}`} className="hover:text-rose">{p.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={`/${locale}/shop`} className="hover:text-rose">{p.shop}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-bold">{product.name[locale]}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery
          images={product.images.map((im) => im.src).filter((x): x is string => !!x)}
          swatch={product.swatch} label={product.name[locale]} spin={!!product.spin}
          hint={dict.product.spinHint} prev={dict.product.prevPhoto} next={dict.product.nextPhoto}
        />

        <div className="space-y-5">
          {product.isMock && (
            <span className="inline-block rounded-full bg-blush px-3 py-1 text-xs font-medium">{dict.preview.mockBadge}</span>
          )}
          <h1 className="font-display text-4xl font-semibold">{product.name[locale]}</h1>
          {product.nameAlt && <p className="mt-1 text-xl font-medium opacity-75">{product.nameAlt}</p>}
          <p>{product.shortDescription[locale]}</p>
          <Price amount={product.price} compareAt={product.compareAtPrice} currency={product.currency} locale={locale} pendingLabel={p.pricePending} />
          <p className="text-xs opacity-80">{p.sku}: {product.variants[0]?.sku}</p>

          <PurchasePanel
            product={product}
            locale={locale}
            labels={{
              optionName: p.option_color,
              chooseOption: p.chooseOption,
              addToCart: p.addToCart,
              quantity: p.quantity,
              increase: p.increase,
              decrease: p.decrease,
              inStock: p.inStock,
              outOfStock: p.outOfStock,
            }}
          />
          <WishlistButton productId={product.id} dict={dict} />
          <p className="text-sm opacity-80">{p.appearance}</p>

          <div className="space-y-3 pt-2">
            <section className={sectionCls}>
              <h2 className="mb-2 font-bold">{p.description}</h2>
              <p className="text-base font-medium leading-7">{product.description[locale]}</p>
            </section>
            <section className={sectionCls}>
              <h2 className="mb-2 font-bold">{p.specs}</h2>
              <dl className="grid grid-cols-2 gap-y-2 text-[0.95rem]">
                {specs.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="opacity-80">{label}</dt>
                    <dd>{value ?? p.notProvided}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className={sectionCls}>
              <h2 className="mb-2 font-bold">{p.care}</h2>
              <p className="text-base leading-7">{p.careText}</p>
            </section>
            <section className={sectionCls}>
              <h2 className="mb-2 font-bold">{p.shippingTitle}</h2>
              <p className="text-base leading-7">{p.shippingText}</p>
            </section>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-center font-display text-3xl font-semibold">{p.related}</h2>
          <ProductGrid products={related} locale={locale} mockLabel={dict.preview.mockBadge} />
        </section>
      )}
    </div>
  );
}
