import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Product } from "@/lib/commerce/types";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ProductImage } from "./ProductImage";
import { HeartButton } from "@/features/account/HeartButton";
import { formatPrice } from "@/lib/i18n/format";

type Props = { product: Product; locale: Locale; mockLabel: string; tone?: number };

export function ProductCard({ product, locale, mockLabel, tone = 0 }: Props) {
  const dict = getDictionary(locale);
  const name = product.name[locale];
  const h = dict.home;
  const specs: [string, string][] = [];
  if (product.look) specs.push([h.specType, product.look]);
  if (product.diameter) specs.push([h.specSize, product.diameter]);
  if (product.wearDuration) specs.push([h.specWear, product.wearDuration]);
  if (product.lensCount) specs.push([h.specCount, String(product.lensCount)]);
  return (
    <div className="relative">
    <Link
      href={`/${locale}/shop/${product.slug}`}
      className={`glow-card tone-${tone % 5} group block overflow-hidden rounded-card border`}
    >
      <div className="relative aspect-square bg-white/70">
        <ProductImage src={product.images[0]?.src} swatch={product.swatch} label={name} />
        {product.isMock && (
          <span className="absolute start-3 top-3 rounded-full bg-blush px-3 py-1 text-xs font-medium">{mockLabel}</span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold">{name}</h3>
        <p className="mt-1 line-clamp-2 text-sm opacity-80">{product.shortDescription[locale]}</p>
        {specs.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {specs.map(([k, v]) => (
              <li key={k} className="rounded-full bg-white/80 px-2 py-0.5 ring-1 ring-gold/40"><span className="opacity-70">{k}: </span><span className="font-medium">{v}</span></li>
            ))}
          </ul>
        )}
        {product.price > 0 && (
          <p className="mt-2 font-bold">
            {formatPrice(product.price, product.currency, locale)}
            {product.compareAtPrice ? <s className="ms-2 text-sm font-normal opacity-60">{formatPrice(product.compareAtPrice, product.currency, locale)}</s> : null}
          </p>
        )}
      </div>
    </Link>
    <HeartButton productId={product.id} addLabel={dict.wishlist.addShort} removeLabel={dict.wishlist.removeShort} className="absolute end-2 top-2 z-10" />
    </div>
  );
}
