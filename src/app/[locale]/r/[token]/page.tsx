import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/i18n/format";
import { receiptByToken } from "@/lib/orders/label";
import { reconcileOnlinePayment } from "@/lib/payment/reconcile";
import { trackingUrl } from "@/lib/shipping/tracking-url";
import { uaeDateTime } from "@/lib/time";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const T = {
  ar: { title: "إيصال الطلب", order: "رقم الطلب", date: "تاريخ الطلب", for: "العميل", phone: "هاتف ينتهي بـ", city: "المدينة", payment: "حالة الدفع", shipping: "حالة الطلب", paidOn: "تاريخ الدفع", item: "المنتج", size: "المقاس", qty: "الكمية", sum: "السعر",
    subtotal: "المجموع", discount: "الخصم", ship: "الشحن", tax: "الضريبة (مشمولة)", total: "الإجمالي", paid: "المدفوع", refunded: "المسترد", track: "تتبع الشحنة", carrier: "شركة الشحن",
    note: "هذه الصفحة تؤكد الطلب وحالة الدفع فقط. لحماية خصوصيتك لا تعرض الاسم الكامل ولا رقم الهاتف ولا العنوان.",
    pay: { paid: "مدفوع", pending: "بانتظار الدفع", failed: "لم يتم الدفع", refunded: "مُسترد" }, st: { new: "جديد", processing: "قيد التجهيز", shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغي" } },
  en: { title: "Order receipt", order: "Order no.", date: "Order date", for: "Customer", phone: "Phone ending", city: "City", payment: "Payment", shipping: "Order status", paidOn: "Paid on", item: "Item", size: "Size", qty: "Qty", sum: "Price",
    subtotal: "Subtotal", discount: "Discount", ship: "Shipping", tax: "VAT (included)", total: "Total", paid: "Paid", refunded: "Refunded", track: "Track shipment", carrier: "Carrier",
    note: "This page only confirms the order and its payment. To protect your privacy it never shows the full name, phone number or address.",
    pay: { paid: "Paid", pending: "Awaiting payment", failed: "Not paid", refunded: "Refunded" }, st: { new: "New", processing: "Being prepared", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" } },
} as const;
const CARRIERS: Record<string, string> = { quiqup: "Quiqup", aramex: "Aramex", emx: "EMX" };

/** Opened by scanning the QR code on the store label. The link carries a secret per-order code; a wrong one is a plain 404. */
export default async function Receipt({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  const first = receiptByToken(token);
  if (!first) notFound();
  await reconcileOnlinePayment(first.id).catch(() => "none"); // show the real payment state, as the order page does
  const r = receiptByToken(token)!;
  const t = T[locale]; const money = (n: number) => formatPrice(n, r.currency, locale);
  const dl = locale === "ar" ? "ar-AE" : "en-AE";
  const paidNow = r.paymentStatus === "paid" || r.paymentStatus === "refunded" ? r.total : 0;
  const link = r.tracking ? trackingUrl(r.carrier || null, r.tracking) : "";
  const row = "flex justify-between gap-4 border-b border-gold/25 py-2";
  return (
    <div className="mx-auto max-w-xl px-4 py-10" data-receipt>
      <h1 className="text-center font-display text-3xl font-semibold text-mauve">{t.title}</h1>
      <p className={`mx-auto mt-4 w-fit rounded-full px-6 py-2 text-lg font-bold ${r.paymentStatus === "paid" ? "bg-mauve text-white" : "border border-mauve"}`} data-pay={r.paymentStatus}>{t.pay[r.paymentStatus]}</p>
      <dl className="mt-6 rounded-card border border-gold/40 bg-surface p-5 text-[0.95rem]">
        <div className={row}><dt>{t.order}</dt><dd className="font-bold" dir="ltr">{r.id}</dd></div>
        <div className={row}><dt>{t.date}</dt><dd>{uaeDateTime(r.createdAt, dl)}</dd></div>
        {r.paidAt && r.paymentStatus !== "pending" && <div className={row}><dt>{t.paidOn}</dt><dd>{uaeDateTime(r.paidAt, dl)}</dd></div>}
        <div className={row}><dt>{t.shipping}</dt><dd className="font-bold">{t.st[r.status as keyof typeof t.st] ?? r.status}</dd></div>
        {r.firstName && <div className={row}><dt>{t.for}</dt><dd>{r.firstName}</dd></div>}
        {r.phoneEnd && <div className={row}><dt>{t.phone}</dt><dd dir="ltr">•••• {r.phoneEnd}</dd></div>}
        {r.city && <div className={row}><dt>{t.city}</dt><dd>{r.city}</dd></div>}
        {r.carrier && CARRIERS[r.carrier] && <div className={row}><dt>{t.carrier}</dt><dd>{CARRIERS[r.carrier]}{link ? <> · <a href={link} target="_blank" rel="noreferrer" className="underline">{t.track}</a></> : null}</dd></div>}
      </dl>
      <div className="mt-4 overflow-x-auto rounded-card border border-gold/40 bg-surface p-5">
        <table className="w-full text-[0.95rem]">
          <thead><tr className="border-b border-gold/40"><th scope="col" className="py-2 text-start">{t.item}</th><th scope="col" className="py-2 text-start">{t.size}</th><th scope="col" className="py-2 text-start">{t.qty}</th><th scope="col" className="py-2 text-end">{t.sum}</th></tr></thead>
          <tbody>{r.lines.map((l, i) => <tr key={i} className="border-b border-gold/20"><td className="py-2">{locale === "ar" && l.nameAr ? l.nameAr : l.nameEn}</td><td className="py-2" dir="ltr">{l.size}</td><td className="py-2">{l.quantity}</td><td className="py-2 text-end">{money(l.total)}</td></tr>)}</tbody>
        </table>
        <dl className="mt-3 text-[0.95rem]">
          <div className="flex justify-between py-1"><dt>{t.subtotal}</dt><dd>{money(r.subtotal)}</dd></div>
          {r.discount > 0 && <div className="flex justify-between py-1"><dt>{t.discount}</dt><dd>−{money(r.discount)}</dd></div>}
          <div className="flex justify-between py-1"><dt>{t.ship}</dt><dd>{money(r.shipping)}</dd></div>
          {r.tax > 0 && <div className="flex justify-between py-1"><dt>{t.tax}</dt><dd>{money(r.tax)}</dd></div>}
          <div className="flex justify-between border-t border-gold/40 py-2 text-lg font-bold"><dt>{t.total}</dt><dd>{money(r.total)}</dd></div>
          <div className="flex justify-between py-1 font-bold" data-paid-amount><dt>{t.paid}</dt><dd>{money(paidNow)}</dd></div>
          {r.refunded > 0 && <div className="flex justify-between py-1"><dt>{t.refunded}</dt><dd>−{money(r.refunded)}</dd></div>}
        </dl>
      </div>
      <p className="mt-4 text-sm opacity-80">{t.note}</p>
    </div>
  );
}
