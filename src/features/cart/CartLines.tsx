"use client";

import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/i18n/format";
import { ProductImage } from "@/components/commerce/ProductImage";
import { useCart } from "./CartProvider";

type Props = { locale: Locale; dict: Dictionary; onNavigate?: () => void };

export function CartLines({ locale, dict, onNavigate }: Props) {
  const { validated, lines, loading, error, setQuantity, remove } = useCart();
  const c = dict.cart;

  if (!validated) {
    return <p role="status" className="py-6 text-sm">{error ? c.error : loading ? c.loading : ""}</p>;
  }

  return (
    <ul className="divide-y divide-gold/30" aria-busy={loading}>
      {validated.lines.map((line) => {
        const inCart = lines.find((l) => l.variantId === line.variantId);
        const name = line.name[locale];
        const unavailable = line.status === "out_of_stock" || line.status === "not_found";
        return (
          <li key={line.variantId} className="flex gap-3 py-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-gold/30 bg-white">
              <ProductImage src={line.image} swatch={line.swatch} label={name} sizes="80px" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  {line.slug ? (
                    <Link href={`/${locale}/shop/${line.slug}`} onClick={onNavigate} className="font-bold hover:text-rose">{name}</Link>
                  ) : (
                    <span className="font-bold">{line.sku}</span>
                  )}
                  <p className="text-xs opacity-80">
                    {c.unit}: {formatPrice(line.unitPrice, line.currency, locale)}
                    {line.isMock && ` · ${c.sample}`}
                  </p>
                </div>
                <button type="button" onClick={() => remove(line.variantId)} className="min-h-11 shrink-0 px-2 text-sm underline hover:text-rose">
                  {c.remove}
                </button>
              </div>
              {unavailable ? (
                <p role="alert" className="mt-1 text-sm font-medium">{line.status === "not_found" ? c.notFound : c.outOfStock}</p>
              ) : (
                <>
                  {line.status === "limited" && <p role="status" className="mt-1 text-sm">{c.limited}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <div role="group" aria-label={c.qty} className="inline-flex items-center rounded-full border border-gold/50 bg-surface">
                      <button type="button" aria-label={dict.product.decrease} disabled={(inCart?.quantity ?? 1) <= 1} onClick={() => setQuantity(line.variantId, (inCart?.quantity ?? 1) - 1)} className="size-11 rounded-full text-xl disabled:opacity-40">−</button>
                      <output className="min-w-8 text-center">{line.quantity}</output>
                      <button type="button" aria-label={dict.product.increase} disabled={line.quantity >= line.maxQuantity} onClick={() => setQuantity(line.variantId, line.quantity + 1)} className="size-11 rounded-full text-xl disabled:opacity-40">+</button>
                    </div>
                    <span className="font-bold">{formatPrice(line.unitPrice * line.quantity, line.currency, locale)}</span>
                  </div>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
