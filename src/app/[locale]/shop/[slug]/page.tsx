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
import { db, getSetting } from "@/lib/db";
import { formatPrice } from "@/lib/i18n/format";

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
    alternates: { canonical: `/${locale}/shop/${slug}`, languages: { ar: `/ar/shop/${slug}`, en: `/en/shop/${slug}` } },
    openGraph: { type: "website", title: `${product.name[locale]} | Litore`, description: product.shortDescription[locale], url: `/${locale}/shop/${slug}`,
      images: product.images.map((im) => im.src).filter((x): x is string => !!x).slice(0, 1) },
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
  ];
  const sectionCls = "rounded-card border border-gold/40 bg-surface p-4 sm:p-5";

  // Delivery inside the UAE (the home zone) as the owner set it, shown before the customer decides.
  const zone = db().prepare("SELECT price_minor p, free_over_minor f, min_days a, max_days b FROM shipping_zones WHERE country = 'AE' AND active = 1").get() as
    | { p: number; f: number | null; a: number | null; b: number | null } | undefined;
  // with automatic (Aramex) pricing the real price depends on the address, so no fixed amount is promised here
  const autoRate = getSetting("car_auto_rates") === "1";
  const returnDays = Math.max(0, Number(getSetting("returns_window_days", "14")) || 0);
  const ar = locale === "ar";
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://litore.store").replace(/\/$/, "");
  const inStock = product.variants.some((v) => v.inventoryQuantity > 0);
  const photos = product.images.map((im) => im.src).filter((x): x is string => !!x).map((u) => (u.startsWith("http") ? u : site + u));
  // Product structured data for search engines: exactly the price and availability shown on the page. Not for sample or unpriced products.
  const jsonLd = !product.isMock && product.price > 0 ? {
    "@context": "https://schema.org", "@type": "Product", name: product.name[locale], description: product.shortDescription[locale] || product.description[locale],
    sku: product.variants[0]?.sku, brand: { "@type": "Brand", name: "Litore" }, ...(photos.length ? { image: photos } : {}),
    offers: {
      "@type": "Offer", url: `${site}/${locale}/shop/${slug}`, priceCurrency: product.currency, price: product.price.toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition",
      ...(zone ? { shippingDetails: {
        "@type": "OfferShippingDetails", shippingDestination: { "@type": "DefinedRegion", addressCountry: "AE" },
        ...(autoRate ? {} : { shippingRate: { "@type": "MonetaryAmount", value: (zone.p / 100).toFixed(2), currency: product.currency } }),
        ...(zone.a != null && zone.b != null ? { deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" }, transitTime: { "@type": "QuantitativeValue", minValue: zone.a, maxValue: zone.b, unitCode: "DAY" } } } : {}),
      } } : {}),
      ...(returnDays > 0 ? { hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "AE", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: returnDays, returnMethod: "https://schema.org/ReturnByMail", returnFees: "https://schema.org/ReturnFeesCustomerResponsibility" } } : {}),
    },
  } : null;

  return (
    <div className="mx-auto max-w-7xl px-3 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-12">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <nav aria-label="breadcrumb" className="mb-3 text-xs sm:mb-6 sm:text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          <li><Link href={`/${locale}`} className="hover:text-rose">{p.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={`/${locale}/shop`} className="hover:text-rose">{p.shop}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-bold">{product.name[locale]}</li>
        </ol>
      </nav>

      <div className="grid min-w-0 grid-cols-1 gap-5 sm:gap-10 lg:grid-cols-2">
        <ProductGallery
          images={product.images.map((im) => im.src).filter((x): x is string => !!x)}
          swatch={product.swatch} label={product.name[locale]}
          hint={dict.product.spinHint} prev={dict.product.prevPhoto} next={dict.product.nextPhoto}
        />

        <div className="min-w-0 space-y-3 sm:space-y-5">
          {product.isMock && (
            <span className="inline-block rounded-full bg-blush px-3 py-1 text-xs font-medium">{dict.preview.mockBadge}</span>
          )}
          <h1 className="font-display text-2xl font-semibold sm:text-4xl">{product.name[locale]}</h1>
          {product.nameAlt && <p className="mt-1 text-base font-medium sm:text-xl opacity-75">{product.nameAlt}</p>}
          <p>{product.shortDescription[locale]}</p>
          {product.colorTip?.[locale] && (
            <aside data-color-tip className="rounded-card border border-gold/50 bg-blush/25 p-3 text-[0.95rem] font-medium leading-7 sm:p-4">
              <span className="font-bold">✨ {ar ? "يناسب من؟" : "Who it suits"}: </span>{product.colorTip[locale]}
            </aside>
          )}
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
          <section aria-label={ar ? "التوصيل والإرجاع والدفع" : "Delivery, returns and payment"} className="rounded-card border border-gold/40 bg-surface p-4 text-sm leading-7">
            <ul className="space-y-1">
              {zone && <li>🚚 {ar ? "التوصيل داخل الإمارات" : "Delivery in the UAE"}: <b>{autoRate ? (ar ? "تُحسب حسب العنوان عند إتمام الطلب" : "calculated from your address at checkout") : zone.p === 0 ? (ar ? "مجاني" : "free") : formatPrice(zone.p / 100, product.currency, locale)}</b>
                {zone.a != null && zone.b != null ? (ar ? ` · خلال ${zone.a}–${zone.b} أيام عمل` : ` · ${zone.a}–${zone.b} working days`) : ""}
                {zone.f ? (ar ? ` · مجاني للطلبات فوق ${formatPrice(zone.f / 100, product.currency, locale)}` : ` · free over ${formatPrice(zone.f / 100, product.currency, locale)}`) : ""}
                {" "}<Link href={`/${locale}/shipping`} className="underline">{ar ? "سياسة الشحن" : "Shipping policy"}</Link></li>}
              <li>↩️ {returnDays > 0 ? (ar ? `الإرجاع خلال ${returnDays} يومًا للعبوات غير المفتوحة.` : `Returns within ${returnDays} days for sealed packs.`) : ""} <Link href={`/${locale}/returns`} className="underline">{ar ? "سياسة الاستبدال والاسترجاع" : "Returns policy"}</Link></li>
              <li>💳 {ar ? "دفع آمن بالبطاقة عبر بوابة دفع مرخّصة؛ لا نحفظ بيانات بطاقتك." : "Secure card payment through a licensed gateway; we never store your card details."}</li>
            </ul>
          </section>
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
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-10 sm:mt-16">
          <h2 className="mb-4 text-center font-display text-2xl sm:mb-6 sm:text-3xl font-semibold">{p.related}</h2>
          <ProductGrid products={related} locale={locale} mockLabel={dict.preview.mockBadge} />
        </section>
      )}
    </div>
  );
}
