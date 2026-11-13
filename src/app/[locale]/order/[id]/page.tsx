import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/i18n/format";
import { getCommerce } from "@/lib/commerce";
import { OrnamentalDivider } from "@/components/ui/Ornament";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const o = dict.order;
  const order = await getCommerce().getOrder(id);

  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-bold">{o.notFound}</p>
        <Link href={`/${locale}/shop`} className="mt-6 inline-block underline">{dict.cart.continue}</Link>
      </div>
    );
  }
  const money = (n: number) => formatPrice(n, order.currency, locale);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold">{o.title}</h1>
        <OrnamentalDivider className="my-4" />
        <p>{o.thanks} <strong dir="ltr">{order.id}</strong></p>
      </div>
      <div className="mt-8 space-y-4 rounded-card border border-gold/40 bg-surface p-6">
        <p><span className="font-bold">{o.status}:</span> {(o.statuses as Record<string, string>)[order.status]}</p>
        <p><span className="font-bold">{o.payment}:</span> {(o.payments as Record<string, string>)[order.paymentStatus]}</p>
        {order.trackingNumber && <p><span className="font-bold">{o.tracking}:</span> <span dir="ltr">{order.trackingNumber}</span></p>}
        <h2 className="pt-2 font-bold">{o.items}</h2>
        <ul className="divide-y divide-gold/30">
          {order.lines.map((l) => (
            <li key={l.variantId} className="flex justify-between py-2 text-sm">
              <span>{l.name[locale]} × {l.quantity}</span>
              <span>{money(l.unitPrice * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-gold/40 pt-3 text-sm">
          <div className="flex justify-between"><dt>{dict.cart.subtotal}</dt><dd>{money(order.subtotal)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between"><dt>{dict.cart.discount}</dt><dd>−{money(order.discount)}</dd></div>}
          <div className="flex justify-between"><dt>{dict.cart.shipping} ({order.shippingLabel[locale]})</dt><dd>{money(order.shipping)}</dd></div>
          {order.tax > 0 && <div className="flex justify-between"><dt>{dict.cart.tax}</dt><dd>{money(order.tax)}</dd></div>}
          <div className="flex justify-between text-lg font-bold"><dt>{dict.cart.total}</dt><dd>{money(order.total)}</dd></div>
        </dl>
        {order.isMock && <p className="rounded-xl bg-blush/60 p-3 text-sm">{o.mockNote}</p>}
      </div>
      <p className="mt-8 text-center"><Link href={`/${locale}/shop`} className="underline">{dict.cart.continue}</Link></p>
    </div>
  );
}
