import type { Locale } from "@/lib/i18n/config";
import type { Product } from "@/lib/commerce/types";
import { ProductCard } from "./ProductCard";

type Props = { products: Product[]; locale: Locale; mockLabel: string };

export function ProductGrid({ products, locale, mockLabel }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} locale={locale} mockLabel={mockLabel} tone={i} />
        </li>
      ))}
    </ul>
  );
}
