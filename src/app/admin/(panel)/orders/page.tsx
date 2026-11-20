import Link from "next/link";
import { listOrdersAdmin } from "@/lib/db/admin";
import { reconcilePendingPayments } from "@/lib/payment/reconcile";
import { uaeDateTime } from "@/lib/time";
import { orderCounts } from "@/lib/orders/label";
import { SelectAll } from "./SelectAll";

const money = (n: number, c: string) => new Intl.NumberFormat("ar-AE", { style: "currency", currency: c }).format(n);
export const statusAr: Record<string, string> = { new: "جديد", processing: "قيد التجهيز", shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغي" };
const payAr: Record<string, string> = { paid: "مدفوع", pending: "بانتظار الدفع", failed: "فشل", refunded: "مسترد" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; deleted?: string; q?: string; view?: string }> }) {
  const { status, deleted, q, view } = await searchParams;
  // Background check of card payments still "waiting" (customer paid but never came back / abandoned payment). Never blocks the page.
  void reconcilePendingPayments().catch(() => {});
  const rows = listOrdersAdmin(status && statusAr[status] ? status : undefined, q, view);
  const c = orderCounts();
  // filter cards: what needs doing first, then every state, each with its number
  const cards: [string, string, number, boolean][] = [
    ["/admin/orders?view=toprint", "جاهز للطباعة", c.toprint, true],
    ["/admin/orders?view=unpaid", "بانتظار الدفع", c.unpaid, true],
    ["/admin/orders?view=toship", "مدفوع وينتظر الشحن", c.toship, true],
    ["/admin/orders?status=new", statusAr.new, c.new, false],
    ["/admin/orders?status=processing", statusAr.processing, c.processing, false],
    ["/admin/orders?status=shipped", statusAr.shipped, c.shipped, false],
    ["/admin/orders?status=delivered", statusAr.delivered, c.delivered, false],
    ["/admin/orders?status=cancelled", statusAr.cancelled, c.cancelled, false],
    ["/admin/orders", "الكل", c.all, false],
  ];
  const current = view ? `/admin/orders?view=${view}` : status && statusAr[status] ? `/admin/orders?status=${status}` : "/admin/orders";
  const canPrint = (o: { paymentStatus: string; status: string }) => o.paymentStatus === "paid" && o.status !== "cancelled";
  const printable = rows.filter(canPrint).length;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">الطلبات</h1>
      {deleted && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تم حذف الطلب.</p>}
      <form action="/admin/orders" role="search" className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1"><label htmlFor="q" className="mb-1 block text-sm font-bold">بحث برقم الطلب أو البريد أو الهاتف أو الاسم أو رقم التتبع</label>
          <input id="q" name="q" defaultValue={q ?? ""} dir="auto" maxLength={80} className="min-h-11 w-full rounded-xl border border-gold/50 px-3" /></div>
        <button className="min-h-11 rounded-full bg-mauve px-6 text-white hover:bg-[#6f4353]">بحث</button>
      </form>
      <nav aria-label="تصفية" className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {cards.map(([href, label, n, key]) => (
          <Link key={href} href={href} aria-current={!q && href === current ? "page" : undefined} data-card={href}
            className={`flex min-h-16 flex-col justify-center rounded-2xl border px-2 py-2 text-center hover:bg-blush/40 ${!q && href === current ? "border-mauve bg-blush/50" : key ? "border-mauve bg-surface" : "border-gold/50 bg-surface"}`}>
            <span className="text-xl font-bold leading-6" dir="ltr">{n}</span>
            <span className={`text-[12px] leading-4 ${key ? "font-bold" : ""}`}>{label}</span>
          </Link>
        ))}
      </nav>
      {printable > 0 && (
        <form id="print-orders" action="/admin/orders/print" method="get" className="flex flex-wrap items-center gap-3 rounded-card border border-gold/40 bg-surface px-4 py-2">
          <SelectAll form="print-orders" />
          <button className="min-h-11 rounded-full bg-mauve px-6 font-bold text-white hover:bg-[#6f4353]">🖨 طباعة المحدد</button>
          <span className="text-sm">كل ملصق في صفحة، من الأقدم للأحدث. للطلبات المدفوعة فقط.</span>
        </form>
      )}
      {rows.length === 0 ? <p>لا توجد طلبات.</p> : (
        <div className="overflow-x-auto rounded-card border border-gold/40 bg-surface">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gold/40"><th className="w-9 px-2 py-3 sm:p-3"><span className="sr-only">تحديد للطباعة</span></th><th className="px-2 py-3 sm:p-3 text-start">الطلب</th><th className="hidden px-2 py-3 sm:table-cell sm:p-3 text-start">التاريخ</th><th className="hidden px-2 py-3 sm:table-cell sm:p-3 text-start">العميل</th><th className="px-2 py-3 sm:p-3 text-start">الإجمالي</th><th className="px-2 py-3 sm:p-3 text-start">الدفع</th><th className="px-2 py-3 sm:p-3 text-start">الحالة</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-gold/20">
                  <td className="px-2 py-3 sm:p-3">{canPrint(o) && <input type="checkbox" name="id" value={o.id} form="print-orders" aria-label={`تحديد ${o.id} للطباعة`} className="h-5 w-5" />}</td>
                  <td className="px-2 py-3 sm:p-3"><Link href={`/admin/orders/${o.id}`} className="font-bold underline" dir="ltr">{o.id}</Link>{o.printed && <span className="ms-1 whitespace-nowrap text-[11px] opacity-70" title="طُبع ملصقه">🖨✓</span>}<span className="mt-0.5 block text-[11px] opacity-70 sm:hidden">{uaeDateTime(o.createdAt)}</span></td>
                  <td className="hidden px-2 py-3 sm:table-cell sm:p-3">{uaeDateTime(o.createdAt)}</td>
                  <td className="hidden px-2 py-3 sm:table-cell sm:p-3" dir="ltr">{o.email}</td>
                  <td className="px-2 py-3 sm:p-3">{money(o.total, o.currency)}</td>
                  <td className="px-2 py-3 sm:p-3">{payAr[o.paymentStatus]}</td>
                  <td className="px-2 py-3 sm:p-3">{statusAr[o.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
