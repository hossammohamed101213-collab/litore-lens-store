import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderAdmin } from "@/lib/db/admin";
import { refundOrder, updateOrder } from "../../../actions";
import { uaeDateTime } from "@/lib/time";
import { deleteOrder, duplicateOrder, shipOrder } from "../../../integrations-actions";
import { trackingUrl } from "@/lib/shipping/tracking-url";
import { db, getSetting } from "@/lib/db";
import { reconcileOnlinePayment } from "@/lib/payment/reconcile";

const money = (n: number, c: string) => new Intl.NumberFormat("ar-AE", { style: "currency", currency: c }).format(n);
const statusAr: Record<string, string> = { new: "جديد", processing: "قيد التجهيز", shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغي" };
const payAr: Record<string, string> = { pending: "بانتظار الدفع", paid: "مدفوع", failed: "فشل الدفع", refunded: "مُسترد" };
const countries: Record<string, string> = { AE: "الإمارات", SA: "السعودية", KW: "الكويت", QA: "قطر", BH: "البحرين", OM: "عُمان" };

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  await reconcileOnlinePayment(id).catch(() => "none"); // the owner always sees the real payment state, even if the customer never came back from the payment page
  const o = getOrderAdmin(id);
  if (!o) notFound();
  const a = o.address;
  const card = "rounded-card border border-gold/40 bg-surface p-5";
  return (
    <div className="space-y-6">
      <p><Link href="/admin/orders" className="underline">← كل الطلبات</Link></p>
      <h1 className="font-display text-3xl font-semibold" dir="ltr">{o.id}</h1>
      <p className="flex flex-wrap items-center gap-3" data-order-print>
        <Link href={`/admin/orders/print?id=${o.id}`} className="inline-flex min-h-11 items-center rounded-full bg-mauve px-6 font-bold text-white hover:bg-[#6f4353]">🖨 طباعة ملصق الطلب</Link>
        <Link href={`/admin/orders/${o.id}/invoice`} className="inline-flex min-h-11 items-center rounded-full border border-mauve px-5 text-sm hover:bg-blush/40">الفاتورة العادية (A4)</Link>
      </p>
      {error && <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
      {saved && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تم الحفظ.</p>}
      {o.isMock && <p className="rounded-xl bg-blush/40 p-3 text-sm">طلب مكوّن بالكامل من منتجات تجريبية.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {(() => {
        const car = db().prepare("SELECT carrier, label_url FROM orders WHERE id = ?").get(o.id) as { carrier: string | null; label_url: string | null };
        const names: Record<string, string> = { aramex: "Aramex", quiqup: "Quiqup", emx: "EMX" };
        const on = Object.keys(names).filter((c) => getSetting(`car_${c}_enabled`) === "1");
        const link = o.trackingNumber ? trackingUrl(car.carrier, o.trackingNumber) : "";
        return (
          <section className={card}>
            <h2 className="mb-2 font-bold">الشحن</h2>
            {o.trackingNumber && <p className="mb-3 text-sm">شُحن مع <b>{names[car.carrier ?? ""] ?? "—"}</b> · رقم التتبع <b dir="ltr">{o.trackingNumber}</b>
              {link && <> · <a href={link} target="_blank" rel="noreferrer" className="underline">تتبع</a></>}
              {car.label_url && <> · <a href={car.label_url} target="_blank" rel="noreferrer" className="underline">طباعة الملصق</a></>}</p>}
            {on.length === 0 ? <p className="text-sm">فعّل شركة شحن من صفحة «الشحن» أولًا.</p> : (
              <form action={shipOrder} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <input type="hidden" name="id" value={o.id} />
                <div><label htmlFor="carrier" className="mb-1 block text-sm font-bold">الشركة</label>
                  <select id="carrier" name="carrier" className="min-h-11 w-full rounded-xl border border-gold/50 px-3">{on.map((c) => <option key={c} value={c}>{names[c]}</option>)}</select></div>
                <div><label htmlFor="ship_tracking" className="mb-1 block text-sm font-bold">رقم التتبع (Aramex وQuiqup ينشئانه تلقائيًا)</label>
                  <input id="ship_tracking" name="tracking" dir="ltr" className="min-h-11 w-full rounded-xl border border-gold/50 px-3" /></div>
                <button className="min-h-11 rounded-full bg-mauve px-8 text-white hover:bg-[#6f4353]">اشحن الآن</button>
              </form>
            )}
          </section>
        );
      })()}

      <section className={card}>
          <h2 className="mb-2 font-bold">العميل والتوصيل</h2>
          <p dir="ltr" className="text-start">{o.email} · {o.phone}</p>
          <p className="mt-2">{a.name}</p>
          <p>{a.line1}{a.line2 ? `، ${a.line2}` : ""}</p>
          <p>{a.city}{a.region ? `، ${a.region}` : ""}، {countries[a.country] ?? a.country}</p>
          {a.postalCode && <p dir="ltr" className="text-start">{a.postalCode}</p>}
        </section>
        <form action={updateOrder} className={`${card} space-y-4`}>
          <h2 className="font-bold">حالة الطلب</h2>
          <input type="hidden" name="id" value={o.id} />
          <div>
            <label htmlFor="status" className="mb-1 block text-sm font-bold">الحالة</label>
            <select id="status" name="status" defaultValue={o.status} className="min-h-11 w-full rounded-xl border border-gold/50 px-3">
              {Object.entries(statusAr).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <p className="mt-1 text-xs">الطلب يتحرك للأمام فقط. الإلغاء متاح قبل الشحن فقط ويعيد المنتجات للمخزون، ولا يمكن إعادة فتحه. بعد الشحن استخدمي «المرتجعات».</p>
          </div>
          <div>
            <label htmlFor="payment" className="mb-1 block text-sm font-bold">حالة الدفع</label>
            <select id="payment" name="payment" defaultValue={o.paymentStatus} className="min-h-11 w-full rounded-xl border border-gold/50 px-3">
              {Object.entries(payAr).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <p className="mt-1 text-xs">الدفع أونلاين بتتحدث حالته تلقائيًا بعد نجاح الدفع. «مُسترد» تُضبط من خانة «تسجيل استرداد» بالأسفل.</p>
          </div>
          <div>
            <label htmlFor="tracking" className="mb-1 block text-sm font-bold">رقم التتبع</label>
            <input id="tracking" name="tracking" dir="ltr" defaultValue={o.trackingNumber ?? ""} className="min-h-11 w-full rounded-xl border border-gold/50 px-3" />
          </div>
          <button className="min-h-12 rounded-full bg-mauve px-8 text-white hover:bg-[#6f4353]">حفظ</button>
        </form>
      </div>

      {(() => {
        const m = db().prepare("SELECT total_minor t, refund_minor r, refunded_at at, payment_gateway gw FROM orders WHERE id = ?").get(o.id) as { t: number; r: number; at: string | null; gw: string | null };
        const left = (m.t - m.r) / 100;
        const paidOnce = o.paymentStatus === "paid" || o.paymentStatus === "refunded";
        const gwName = m.gw === "paymennt" ? "Paymennt" : m.gw === "ziina" ? "Ziina" : m.gw === "stripe" ? "Stripe" : "Telr";
        return (
          <section className={`${card} space-y-3`}>
            <h2 className="font-bold">الاسترداد</h2>
            <p className="text-sm">المتجر لا يحوّل أموالًا بنفسه: استردّي المبلغ أولًا من لوحة {gwName}، ثم سجّليه هنا ليبقى السجل والتقارير مضبوطة.</p>
            <p className="text-sm">تاريخ الطلب: <b>{uaeDateTime(o.createdAt)}</b> · المدفوع: <b>{money(m.t / 100, o.currency)}</b> · المسترد حتى الآن: <b>{money(m.r / 100, o.currency)}</b>{m.at ? <> (آخر تسجيل {uaeDateTime(m.at)})</> : null}</p>
            {paidOnce && left > 0 ? (
              <form action={refundOrder} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={o.id} />
                <div><label htmlFor="refund_amount" className="mb-1 block text-sm font-bold">المبلغ المسترد (بحد أقصى {left.toFixed(2)})</label>
                  <input id="refund_amount" name="amount" type="number" inputMode="decimal" min="0.01" max={left.toFixed(2)} step="0.01" required dir="ltr" className="min-h-11 w-40 rounded-xl border border-gold/50 px-3" /></div>
                <button className="min-h-11 rounded-full border border-mauve px-6 hover:bg-blush/40">تسجيل استرداد</button>
              </form>
            ) : <p className="text-sm">{paidOnce ? "تم استرداد كامل المبلغ." : "لا يوجد مبلغ مدفوع لهذا الطلب."}</p>}
          </section>
        );
      })()}

      <section className={`${card} space-y-4`}>
        <h2 className="font-bold">إجراءات أخرى</h2>
        <form action={duplicateOrder} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={o.id} />
          <button className="min-h-11 rounded-full border border-mauve px-6 hover:bg-blush/40">نسخ كطلب جديد</button>
          <span className="text-sm">ينشئ طلبًا جديدًا بنفس العميل والمنتجات، بانتظار الدفع، وبيخصم من المخزون (للعميلة اللي غلطت في طلبها).</span>
        </form>
        <form action={deleteOrder} className="flex flex-wrap items-center gap-3 border-t border-gold/30 pt-4">
          <input type="hidden" name="id" value={o.id} />
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="sure" /> أؤكد حذف الطلب نهائيًا (لا يمكن التراجع)</label>
          <button className="min-h-11 rounded-full bg-red-700 px-6 text-white hover:bg-red-800">حذف الطلب</button>
          <span className="w-full text-sm">الطلب المدفوع لا يُحذف (سجل مالي) — غيّري حالته إلى «ملغي». لو الطلب جديد أو قيد التجهيز، المنتجات بترجع للمخزون. لو مشحون أو مُسلَّم، المخزون ما بيرجعش.</span>
        </form>
      </section>

      <section className={card}>
        <h2 className="mb-3 font-bold">المنتجات</h2>
        <ul className="divide-y divide-gold/30 text-sm">
          {o.lines.map((l) => (
            <li key={l.variantId} className="flex justify-between py-2"><span>{l.name.ar} <span dir="ltr" className="opacity-70">({l.sku})</span> × {l.quantity}</span><span>{money(l.unitPrice * l.quantity, o.currency)}</span></li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-gold/40 pt-3 text-sm">
          <div className="flex justify-between"><dt>المنتجات</dt><dd>{money(o.subtotal, o.currency)}</dd></div>
          {o.discount > 0 && <div className="flex justify-between"><dt>الخصم {o.couponCode && `(${o.couponCode})`}</dt><dd>−{money(o.discount, o.currency)}</dd></div>}
          <div className="flex justify-between"><dt>الشحن ({o.shippingLabel.ar})</dt><dd>{money(o.shipping, o.currency)}</dd></div>
          {o.tax > 0 && <div className="flex justify-between"><dt>الضريبة</dt><dd>{money(o.tax, o.currency)}</dd></div>}
          <div className="flex justify-between text-lg font-bold"><dt>الإجمالي</dt><dd>{money(o.total, o.currency)}</dd></div>
        </dl>
      </section>
    </div>
  );
}
