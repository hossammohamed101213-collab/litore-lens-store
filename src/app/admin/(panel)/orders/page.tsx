import Link from "next/link";
import { listOrdersAdmin } from "@/lib/db/admin";
import { reconcilePendingPayments } from "@/lib/payment/reconcile";
import { uaeDateTime } from "@/lib/time";
import { orderCounts } from "@/lib/orders/label";
import { SelectAll } from "./SelectAll";
import { trashSelected } from "../../integrations-actions";
import { TRASH_HOURS, trashCount } from "@/lib/orders/trash";

const money = (n: number, c: string) => new Intl.NumberFormat("ar-AE", { style: "currency", currency: c }).format(n);
export const statusAr: Record<string, string> = { new: "جديد", processing: "قيد التجهيز", shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغي" };
const payAr: Record<string, string> = { paid: "مدفوع", pending: "بانتظار الدفع", failed: "فشل", refunded: "مسترد" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; deleted?: string; kept?: string; error?: string; q?: string; view?: string }> }) {
  const { status, deleted, kept, error, q, view } = await searchParams;
  const inTrash = trashCount();
  // Background check of card payments still "waiting" (customer paid but never came back / abandoned payment). Never blocks the page.
  void reconcilePendingPayments().catch(() => {});
  const rows = listOrdersAdmin(status && statusAr[status] ? status : undefined, q, view);
  const c = orderCounts();
  // filter cards: small, one colour per state (soft background, dark text of the same hue), each with its number
  const cards: [string, string, number, string][] = [
    ["/admin/orders?view=toprint", "جاهز للطباعة", c.toprint, "bg-[#ede4ff] text-[#4c2a85] border-[#c4adf3]"],
    ["/admin/orders?view=unpaid", "بانتظار الدفع", c.unpaid, "bg-[#fff0c7] text-[#6f4400] border-[#eecb72]"],
    ["/admin/orders?view=toship", "ينتظر الشحن", c.toship, "bg-[#dff1ff] text-[#0b4a78] border-[#a3d2f3]"],
    ["/admin/orders?status=new", statusAr.new, c.new, "bg-[#ffe3ee] text-[#8a1c4a] border-[#f5aecb]"],
    ["/admin/orders?status=processing", statusAr.processing, c.processing, "bg-[#ffe8d6] text-[#803800] border-[#f3bd92]"],
    ["/admin/orders?status=shipped", statusAr.shipped, c.shipped, "bg-[#d9f5f1] text-[#0b5a50] border-[#98dacf]"],
    ["/admin/orders?status=delivered", statusAr.delivered, c.delivered, "bg-[#def6dd] text-[#1c5e20] border-[#a2dba0]"],
    ["/admin/orders?status=cancelled", statusAr.cancelled, c.cancelled, "bg-[#f1eded] text-[#5c4a4a] border-[#d3c8c8]"],
    ["/admin/orders", "الكل", c.all, "bg-white text-[#5a3342] border-gold/60"],
  ];
  const current = view ? `/admin/orders?view=${view}` : status && statusAr[status] ? `/admin/orders?status=${status}` : "/admin/orders";
  const canPrint = (o: { paymentStatus: string; status: string }) => o.paymentStatus === "paid" && o.status !== "cancelled";
  const printable = rows.filter(canPrint).length;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">الطلبات</h1>
      {error && <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
      {deleted && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">
        {Number(deleted) > 0 ? `تم حذف ${Number(deleted)} طلب. ` : "لم يُحذف أي طلب. "}
        {Number(kept) > 0 && `${Number(kept)} طلب مدفوع لم يُحذف (سجل مالي). `}
        {Number(deleted) > 0 && <>يمكن استرجاعه خلال {TRASH_HOURS} ساعة من <Link href="/admin/orders/trash" className="font-bold underline">المحذوفات</Link>.</>}
      </p>}
      <form action="/admin/orders" role="search" className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1"><label htmlFor="q" className="mb-1 block text-sm font-bold">بحث برقم الطلب أو البريد أو الهاتف أو الاسم أو رقم التتبع</label>
          <input id="q" name="q" defaultValue={q ?? ""} dir="auto" maxLength={80} className="min-h-11 w-full rounded-xl border border-gold/50 px-3" /></div>
        <button className="min-h-11 rounded-full bg-mauve px-6 text-white hover:bg-[#6f4353]">بحث</button>
      </form>
      <nav aria-label="تصفية" className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-9">
        {cards.map(([href, label, n, tone]) => {
          const on = !q && href === current;
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined} data-card={href}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-1.5 py-1 text-center transition hover:brightness-95 ${tone} ${on ? "font-bold shadow-[inset_0_0_0_2px_currentColor]" : ""}`}>
              <span className="text-[15px] font-bold leading-none" dir="ltr">{n}</span>
              <span className="text-[12px] leading-4">{label}</span>
            </Link>
          );
        })}
      </nav>
      {rows.length > 0 && (
        <form id="print-orders" action="/admin/orders/print" method="get" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-gold/40 bg-surface px-4 py-2">
          <SelectAll form="print-orders" />
          {printable > 0 && <button className="min-h-11 rounded-full bg-mauve px-6 font-bold text-white hover:bg-[#6f4353]">🖨 طباعة المحدد</button>}
          <span className="ms-auto flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="sure" className="h-5 w-5" /> أؤكد الحذف</label>
            <button formAction={trashSelected} className="min-h-11 rounded-full bg-red-700 px-6 font-bold text-white hover:bg-red-800">🗑 حذف المحدد</button>
          </span>
          <span className="w-full text-sm">الطباعة للطلبات المدفوعة فقط. الحذف للطلبات غير المدفوعة فقط، والمدفوع لا يُحذف. المحذوف يبقى {TRASH_HOURS} ساعة في المحذوفات ثم يُمسح نهائيًا.</span>
        </form>
      )}
      <p className="text-sm"><Link href="/admin/orders/trash" className="font-bold underline" data-trash-link>🗑 المحذوفات ({inTrash})</Link></p>
      {rows.length === 0 ? <p>لا توجد طلبات.</p> : (
        <div className="overflow-x-auto rounded-card border border-gold/40 bg-surface">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gold/40"><th className="w-9 px-2 py-3 sm:p-3"><span className="sr-only">تحديد</span></th><th className="px-2 py-3 sm:p-3 text-start">الطلب</th><th className="hidden px-2 py-3 sm:table-cell sm:p-3 text-start">التاريخ</th><th className="hidden px-2 py-3 sm:table-cell sm:p-3 text-start">العميل</th><th className="px-2 py-3 sm:p-3 text-start">الإجمالي</th><th className="px-2 py-3 sm:p-3 text-start">الدفع</th><th className="px-2 py-3 sm:p-3 text-start">الحالة</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-gold/20">
                  <td className="px-2 py-3 sm:p-3"><input type="checkbox" name="id" value={o.id} form="print-orders" aria-label={`تحديد ${o.id}`} className="h-5 w-5" /></td>
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
