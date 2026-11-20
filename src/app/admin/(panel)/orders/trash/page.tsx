import Link from "next/link";
import { listTrash, TRASH_HOURS } from "@/lib/orders/trash";
import { uaeDateTime } from "@/lib/time";
import { restoreDeletedOrder } from "../../../integrations-actions";
import { statusAr } from "../page";

export const dynamic = "force-dynamic";
export const metadata = { title: "المحذوفات" };

const money = (n: number, c: string) => new Intl.NumberFormat("ar-AE", { style: "currency", currency: c }).format(n);
const payAr: Record<string, string> = { paid: "مدفوع", pending: "بانتظار الدفع", failed: "فشل", refunded: "مسترد" };

/** Deleted orders wait here for 48 hours. Each can be put back as it was; after that it is removed for good. */
export default async function OrdersTrash({ searchParams }: { searchParams: Promise<{ restored?: string; error?: string }> }) {
  const { restored, error } = await searchParams;
  const rows = listTrash();
  return (
    <div className="space-y-6">
      <p><Link href="/admin/orders" className="underline">← كل الطلبات</Link></p>
      <h1 className="font-display text-3xl font-semibold">المحذوفات</h1>
      <p className="text-sm">الطلب المحذوف يبقى هنا {TRASH_HOURS} ساعة. اضغطي «استرجاع» ليعود كما كان. بعد {TRASH_HOURS} ساعة يُمسح نهائيًا ولا يمكن استرجاعه.</p>
      {restored && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تم استرجاع الطلب <span dir="ltr">{restored}</span>. <Link href={`/admin/orders/${restored}`} className="font-bold underline">فتح الطلب</Link></p>}
      {error && <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
      {rows.length === 0 ? <p>لا توجد طلبات محذوفة.</p> : (
        <div className="overflow-x-auto rounded-card border border-gold/40 bg-surface">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gold/40"><th className="px-2 py-3 text-start sm:p-3">الطلب</th><th className="hidden px-2 py-3 text-start sm:table-cell sm:p-3">العميل</th><th className="px-2 py-3 text-start sm:p-3">الإجمالي</th><th className="hidden px-2 py-3 text-start sm:table-cell sm:p-3">الحالة</th><th className="px-2 py-3 text-start sm:p-3">يُمسح بعد</th><th className="px-2 py-3 sm:p-3"><span className="sr-only">استرجاع</span></th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-gold/20" data-trashed={o.id}>
                  <td className="px-2 py-3 sm:p-3"><span className="font-bold" dir="ltr">{o.id}</span><span className="block text-[11px] opacity-70">{uaeDateTime(o.createdAt)}</span></td>
                  <td className="hidden px-2 py-3 sm:table-cell sm:p-3" dir="ltr">{o.email}</td>
                  <td className="px-2 py-3 sm:p-3">{money(o.total, o.currency)}</td>
                  <td className="hidden px-2 py-3 sm:table-cell sm:p-3">{statusAr[o.status] ?? o.status} · {payAr[o.paymentStatus] ?? o.paymentStatus}</td>
                  <td className="px-2 py-3 sm:p-3">{o.hoursLeft} ساعة</td>
                  <td className="px-2 py-3 sm:p-3"><form action={restoreDeletedOrder}><input type="hidden" name="id" value={o.id} /><button className="min-h-11 rounded-full border border-mauve px-5 font-bold hover:bg-blush/40" aria-label={`استرجاع ${o.id}`}>استرجاع</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
