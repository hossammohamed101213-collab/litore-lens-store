"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/commerce/types";
import type { Locale } from "@/lib/i18n/config";
import { fill } from "@/lib/i18n/template";
import { formatPrice } from "@/lib/i18n/format";
import { useCart } from "@/features/cart/CartProvider";

type Labels = {
  optionName: string;
  chooseOption: string;
  addToCart: string;
  quantity: string;
  increase: string;
  decrease: string;
  inStock: string;
  outOfStock: string;
};

type Props = { product: Product; locale: Locale; labels: Labels };

/**
 * Variant picker + quantity + add button.
 * The button stays disabled (with a visible reason) until a required option is chosen.
 */
export function PurchasePanel({ product, locale, labels }: Props) {
  const variants = product.variants;
  const [variantId, setVariantId] = useState<string | null>(variants.length === 1 ? variants[0].id : null);
  const [qty, setQty] = useState(1);
  const { add } = useCart();
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);

  // The phone's sticky bar only appears once the main button has scrolled out of view.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const onAdd = () => variant && add(variant.id, qty);

  const variant = variants.find((v) => v.id === variantId) ?? null;
  const soldOut = variant ? variant.inventoryQuantity <= 0 : false;
  const max = variant ? Math.max(1, Math.min(variant.inventoryQuantity, 10)) : 10;
  const reason = !variant ? fill(labels.chooseOption, { option: labels.optionName }) : soldOut ? labels.outOfStock : null;
  const disabled = reason !== null;

  const ctaClasses =
    "min-h-12 w-full rounded-full bg-mauve px-8 text-base font-medium text-white transition-colors hover:bg-[#6f4353] disabled:cursor-not-allowed disabled:bg-mauve/40";

  return (
    <div className="space-y-5">
      {variants.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold">{labels.optionName}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const out = v.inventoryQuantity <= 0;
              return (
                <label
                  key={v.id}
                  className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-mauve ${
                    variantId === v.id ? "border-mauve bg-mauve text-white" : "border-gold/50 bg-surface"
                  } ${out ? "opacity-50" : ""}`}
                >
                  <input
                    type="radio"
                    name="variant"
                    className="sr-only"
                    checked={variantId === v.id}
                    disabled={out}
                    onChange={() => setVariantId(v.id)}
                  />
                  {v.title[locale]}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <p className={`text-sm font-medium ${soldOut ? "" : "text-[#5c6b4f]"}`} aria-live="polite">
        {variant ? (soldOut ? labels.outOfStock : labels.inStock) : " "}
      </p>

      <div className="flex items-center gap-3">
        <span id="qty-label" className="text-sm font-bold">{labels.quantity}</span>
        <div role="group" aria-labelledby="qty-label" className="inline-flex items-center rounded-full border border-gold/50 bg-surface">
          <button type="button" aria-label={labels.decrease} disabled={qty <= 1} onClick={() => setQty((q) => q - 1)} className="size-11 rounded-full text-xl disabled:opacity-40">−</button>
          <output aria-live="polite" className="min-w-8 text-center">{qty}</output>
          <button type="button" aria-label={labels.increase} disabled={qty >= max} onClick={() => setQty((q) => q + 1)} className="size-11 rounded-full text-xl disabled:opacity-40">+</button>
        </div>
      </div>

      <button ref={ctaRef} type="button" onClick={onAdd} disabled={disabled} aria-describedby={disabled ? "cta-reason" : undefined} className={ctaClasses}>
        {labels.addToCart}
      </button>
      {reason && <p id="cta-reason" className="text-sm">{reason}</p>}

      {/* Sticky bar on phones: shown only when the main button is out of view */}
      {!ctaVisible && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-gold/40 bg-canvas/95 p-3 backdrop-blur lg:hidden">
          {product.price > 0 && (
            <span className="shrink-0 text-base font-bold">{formatPrice(variant?.price ?? product.price, product.currency, locale)}</span>
          )}
          <button type="button" onClick={onAdd} disabled={disabled} className={ctaClasses}>{labels.addToCart}</button>
        </div>
      )}
    </div>
  );
}
