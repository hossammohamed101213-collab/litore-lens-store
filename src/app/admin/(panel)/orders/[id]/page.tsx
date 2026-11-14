import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderAdmin } from "@/lib/db/admin";
import { updateOrder } from "../../../actions";
import { shipOrder } from "../../../integrations-actions";
import { trackingUrl } from "@/lib/shipping/tracking-url";
import { db, getSetting } from "@/lib/db";

const money = (n: number, c: string) => new Intl.NumberFormat("ar-AE", { style: "currency", currency: c }).format(n);
const statusAr: Record<string, string> = { new: "جديد", processing: "قيد التجهيز", shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغي" };
const payAr: Record<string, string> = { pending: "بانتظار الدفع / عند الاستلام", paid: "مدفوع", failed: "فشل الدفع", refunded: "مُسترد" };
const countries: Record<string, string> = { AE: "الإمارات", SA: "السعودية", KW: "الكويت", QA: "قطر", BH: "البحرين", OM: "عُمان" };

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const o = getOrderAdmin(id);
  if (!o) notFound();
  const a = o.address;
  const card = "rounded-card border border-gold/40 bg-surface p-5";
  return (
    <div className="space-y-6">
      <p><Link href="/admin/orders" className="underline">← كل الطلبات</Link></p>
      <h1 className="font-display text-3xl font-semibold" dir="ltr">{o.id}</h1>
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
                <div><label htmlFor="ship_tracking" className="mb-1 block text-sm font-bold">رقم التتبع (Aramex ينشئه تلقائيًا)</label>
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
            <p className="mt-1 text-xs">إلغاء الطلب يعيد المنتجات للمخزون، ولا يمكن إعادة فتحه.</p>
          </div>
          <div>
            <label htmlFor="payment" className="mb-1 block text-sm font-bold">حالة الدفع</label>
            <select id="payment" name="payment" defaultValue={o.paymentStatus} className="min-h-11 w-full rounded-xl border border-gold/50 px-3">
              {Object.entries(payAr).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <p className="mt-1 text-xs">في الدفع عند الاستلام: غيّرها إلى «مدفوع» بعد استلام المبلغ.</p>
          </div>
          <div>
            <label htmlFor="tracking" className="mb-1 block text-sm font-bold">رقم التتبع</label>
            <input id="tracking" name="tracking" dir="ltr" defaultValue={o.trackingNumber ?? ""} className="min-h-11 w-full rounded-xl border border-gold/50 px-3" />
          </div>
          <button className="min-h-12 rounded-full bg-mauve px-8 text-white hover:bg-[#6f4353]">حفظ</button>
        </form>
      </div>

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
