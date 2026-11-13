"use client";

import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { useCart } from "./CartProvider";
import { CartLines } from "./CartLines";
import { CartTotals } from "./CartTotals";
import { CouponForm } from "./CouponForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatPrice } from "@/lib/i18n/format";

export function CartPageView({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { count, validated } = useCart();
  const c = dict.cart;
  const blocked = validated?.lines.some((l) => l.status === "out_of_stock" || l.status === "not_found");

  if (count === 0) {
    return <EmptyState title={c.empty} hint={c.emptyHint} href={`/${locale}/shop`} cta={c.continue} />;
  }
  return (
    <div className="grid gap-8 pb-24 lg:grid-cols-[1fr_22rem] lg:pb-0">
      <section aria-label={c.title} className="rounded-card border border-gold/40 bg-surface px-5"><CartLines locale={locale} dict={dict} /></section>
      <aside className="h-fit space-y-4 rounded-card border border-gold/40 bg-surface p-5 lg:sticky lg:top-24">
        <CouponForm dict={dict} />
        <CartTotals locale={locale} dict={dict} />
        {blocked ? (
          <p role="alert" className="text-sm font-medium">{c.outOfStock}</p>
        ) : (
          <Link href={`/${locale}/checkout`} className="flex min-h-12 items-center justify-center rounded-full bg-mauve text-white hover:bg-[#6f4353]">{c.checkout}</Link>
        )}
        <Link href={`/${locale}/shop`} className="block text-center text-sm underline">{c.continue}</Link>
      </aside>
      {validated && !blocked && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-gold/40 bg-canvas/95 p-3 backdrop-blur lg:hidden">
          <div className="shrink-0 leading-tight">
            <p className="text-xs opacity-80">{c.total}</p>
            <p className="font-bold">{formatPrice(validated.subtotal - validated.discount, validated.currency, locale)}</p>
          </div>
          <Link href={`/${locale}/checkout`} className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-mauve text-white hover:bg-[#6f4353]">{c.checkout}</Link>
        </div>
      )}
    </div>
  );
}
