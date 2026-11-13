import Link from "next/link";
import { listOrdersAdmin } from "@/lib/db/admin";

const money = (n: number, c: string) => new Intl.NumberFormat("ar-AE", { style: "currency", currency: c }).format(n);
export const statusAr: Record<string, string> = { new: "جديد", processing: "قيد التجهيز", shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغي" };
const payAr: Record<string, string> = { paid: "مدفوع", pending: "بانتظار الدفع", failed: "فشل", refunded: "مسترد" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const rows = listOrdersAdmin(status && statusAr[status] ? status : undefined);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">الطلبات</h1>
      <nav aria-label="تصفية" className="flex flex-wrap gap-2">
        <Link href="/admin/orders" className="inline-flex min-h-11 items-center rounded-full border border-gold/50 bg-surface px-4 text-sm hover:bg-blush/40">الكل</Link>
        {Object.entries(statusAr).map(([k, l]) => <Link key={k} href={`/admin/orders?status=${k}`} className="inline-flex min-h-11 items-center rounded-full border border-gold/50 bg-surface px-4 text-sm hover:bg-blush/40">{l}</Link>)}
      </nav>
      {rows.length === 0 ? <p>لا توجد طلبات.</p> : (
        <div className="overflow-x-auto rounded-card border border-gold/40 bg-surface">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gold/40"><th className="p-3 text-start">الطلب</th><th className="p-3 text-start">التاريخ</th><th className="p-3 text-start">العميل</th><th className="p-3 text-start">الإجمالي</th><th className="p-3 text-start">الدفع</th><th className="p-3 text-start">الحالة</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-gold/20">
                  <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-bold underline" dir="ltr">{o.id}</Link></td>
                  <td className="p-3">{new Date(o.createdAt).toLocaleString("ar-AE")}</td>
                  <td className="p-3" dir="ltr">{o.email}</td>
                  <td className="p-3">{money(o.total, o.currency)}</td>
                  <td className="p-3">{payAr[o.paymentStatus]}</td>
                  <td className="p-3">{statusAr[o.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
