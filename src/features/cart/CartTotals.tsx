"use client";

import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/i18n/format";
import { useCart } from "./CartProvider";

type Props = { locale: Locale; dict: Dictionary; shipping?: number; shippingLabel?: string };

export function CartTotals({ locale, dict, shipping, shippingLabel }: Props) {
  const { validated } = useCart();
  if (!validated) return null;
  const c = dict.cart;
  const money = (n: number) => formatPrice(n, validated.currency, locale);
  const total = validated.subtotal - validated.discount + (shipping ?? 0);
  const row = "flex justify-between py-1 text-sm";

  return (
    <dl>
      <div className={row}><dt>{c.subtotal}</dt><dd>{money(validated.subtotal)}</dd></div>
      {validated.discount > 0 && <div className={row}><dt>{c.discount}</dt><dd>−{money(validated.discount)}</dd></div>}
      <div className={row}>
        <dt>{c.shipping}{shippingLabel ? ` (${shippingLabel})` : ""}</dt>
        <dd>{shipping === undefined ? c.shippingLater : money(shipping)}</dd>
      </div>
      <div className="mt-2 flex justify-between border-t border-gold/40 pt-3 text-lg font-bold"><dt>{c.total}</dt><dd>{money(total)}</dd></div>
    </dl>
  );
}
