import { db } from "@/lib/db";
import { mapOrder } from "@/lib/commerce/db-provider";
import { uaeDateTime } from "@/lib/time";
import { WHATSAPP_DISPLAY } from "@/lib/site";
import { PrintButton } from "./PrintButton";

type Row = Parameters<typeof mapOrder>[0] & { email: string; phone: string; address_json: string; coupon_code: string | null; refund_minor: number; customer_id: string | null };

/** The order as stored, for an invoice. `customerId` limits it to that customer's own orders. */
export function invoiceOrder(id: string, customerId?: string) {
  const row = (customerId
    ? db().prepare("SELECT * FROM orders WHERE id = ? AND customer_id = ?").get(id, customerId)
    : db().prepare("SELECT * FROM orders WHERE id = ?").get(id)) as Row | undefined;
  if (!row) return null;
  let address: Record<string, string> = {};
  try { address = JSON.parse(row.address_json); } catch { /* keep empty */ }
  return { order: mapOrder(row), email: row.email, phone: row.phone, address, coupon: row.coupon_code, refunded: row.refund_minor / 100 };
}

const T = {
  ar: { title: "فاتورة", order: "رقم الطلب", date: "التاريخ", to: "العميل", item: "المنتج", qty: "الكمية", price: "السعر", sum: "الإجمالي", subtotal: "المجموع", discount: "الخصم", shipping: "الشحن", tax: "الضريبة", total: "الإجمالي المدفوع", refunded: "المسترد", pay: "حالة الدفع", print: "طباعة / حفظ PDF", paid: "مدفوع", pending: "بانتظار الدفع", failed: "فشل الدفع", refundedS: "مسترد", wa: "واتساب", unpaid: "هذه ليست فاتورة ضريبية نهائية: الطلب غير مدفوع." },
  en: { title: "Invoice", order: "Order", date: "Date", to: "Customer", item: "Item", qty: "Qty", price: "Price", sum: "Total", subtotal: "Subtotal", discount: "Discount", shipping: "Shipping", tax: "Tax", total: "Total paid", refunded: "Refunded", pay: "Payment", print: "Print / save as PDF", paid: "Paid", pending: "Awaiting payment", failed: "Payment failed", refundedS: "Refunded", wa: "WhatsApp", unpaid: "This is not a final invoice: the order is not paid." },
};

/** Printable invoice built only from what was saved with the order (prices at the time of purchase). */
export function Invoice({ data, locale }: { data: NonNullable<ReturnType<typeof invoiceOrder>>; locale: "ar" | "en" }) {
  const t = T[locale]; const { order: o, address: a } = data;
  const money = (n: number) => new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", { style: "currency", currency: o.currency }).format(n);
  const pay = { paid: t.paid, pending: t.pending, failed: t.failed, refunded: t.refundedS }[o.paymentStatus];
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://litore.store").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <article dir={locale === "ar" ? "rtl" : "ltr"} lang={locale} className="invoice mx-auto max-w-3xl rounded-card border border-gold/40 bg-white p-6 text-[#2b1a21] sm:p-10">
      <style>{`@media print { body * { visibility: hidden !important; } .invoice, .invoice * { visibility: visible !important; } .invoice { position: absolute; inset: 0; border: 0 !important; padding: 0 !important; max-width: none !important; } .no-print { display: none !important; } }`}</style>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gold/40 pb-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/litore-logo-email.png" width={96} height={82} alt="Litore" />
          <p className="mt-2 text-sm" dir="ltr">{site}</p>
          <p className="text-sm">{t.wa}: <span dir="ltr">{WHATSAPP_DISPLAY}</span></p>
        </div>
        <div className="text-end">
          <h1 className="font-display text-3xl font-semibold">{t.title}</h1>
          <p className="mt-2 text-sm">{t.order}: <b dir="ltr">{o.id}</b></p>
          <p className="text-sm">{t.date}: <b>{uaeDateTime(o.createdAt, locale === "ar" ? "ar-AE" : "en-AE")}</b></p>
          <p className="text-sm">{t.pay}: <b>{pay}</b></p>
        </div>
      </header>
      {o.paymentStatus !== "paid" && o.paymentStatus !== "refunded" && <p role="note" className="mt-4 rounded-xl bg-blush/50 p-3 text-sm font-medium">{t.unpaid}</p>}
      <section className="mt-4 text-sm">
        <h2 className="font-bold">{t.to}</h2>
        <p>{a.name}</p>
        <p>{[a.line1, a.line2, a.city, a.region, a.country].filter(Boolean).join(locale === "ar" ? "، " : ", ")}</p>
        <p dir="ltr" className="text-start">{data.email} · {data.phone}</p>
      </section>
      <table className="mt-6 w-full text-sm">
        <thead><tr className="border-b border-gold/40"><th scope="col" className="p-2 text-start">{t.item}</th><th scope="col" className="p-2 text-start">{t.qty}</th><th scope="col" className="p-2 text-start">{t.price}</th><th scope="col" className="p-2 text-end">{t.sum}</th></tr></thead>
        <tbody>
          {o.lines.map((l) => (
            <tr key={l.variantId} className="border-b border-gold/20"><td className="p-2">{l.name[locale]} <span dir="ltr" className="opacity-70">({l.sku})</span></td><td className="p-2">{l.quantity}</td><td className="p-2">{money(l.unitPrice)}</td><td className="p-2 text-end">{money(l.unitPrice * l.quantity)}</td></tr>
          ))}
        </tbody>
      </table>
      <dl className="ms-auto mt-4 grid max-w-xs grid-cols-2 gap-y-1 text-sm">
        <dt>{t.subtotal}</dt><dd className="text-end">{money(o.subtotal)}</dd>
        {o.discount > 0 && <><dt>{t.discount}{data.coupon ? <> (<span dir="ltr">{data.coupon}</span>)</> : null}</dt><dd className="text-end">−{money(o.discount)}</dd></>}
        <dt>{t.shipping} — {o.shippingLabel[locale]}</dt><dd className="text-end">{money(o.shipping)}</dd>
        {o.tax > 0 && <><dt>{t.tax}</dt><dd className="text-end">{money(o.tax)}</dd></>}
        <dt className="border-t border-gold/40 pt-1 font-bold">{t.total}</dt><dd className="border-t border-gold/40 pt-1 text-end font-bold">{money(o.total)}</dd>
        {data.refunded > 0 && <><dt>{t.refunded}</dt><dd className="text-end">−{money(data.refunded)}</dd></>}
      </dl>
      <p className="no-print mt-6"><PrintButton label={t.print} /></p>
    </article>
  );
}
