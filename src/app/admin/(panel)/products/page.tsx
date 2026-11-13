import Link from "next/link";
import { listProductsAdmin } from "@/lib/db/admin";

const money = (minor: number) => new Intl.NumberFormat("ar-AE", { style: "currency", currency: "AED" }).format(minor / 100);
const statusAr: Record<string, string> = { draft: "مسودة", active: "منشور", archived: "مؤرشف" };

export default function ProductsPage() {
  const rows = listProductsAdmin();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">المنتجات</h1>
        <Link href="/admin/products/new" className="inline-flex min-h-11 items-center rounded-full bg-mauve px-6 text-white hover:bg-[#6f4353]">منتج جديد</Link>
      </div>
      {rows.length === 0 ? <p>لا توجد منتجات بعد. أضف أول منتج.</p> : (
        <div className="overflow-x-auto rounded-card border border-gold/40 bg-surface">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gold/40 text-start"><th className="p-3 text-start">المنتج</th><th className="p-3 text-start">السعر</th><th className="p-3 text-start">المخزون</th><th className="p-3 text-start">الحالة</th><th className="p-3" /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gold/20">
                  <td className="p-3 font-bold">{r.name_ar} {r.is_sample === 1 && <span className="rounded-full bg-blush px-2 py-0.5 text-xs font-normal">تجريبي</span>}</td>
                  <td className="p-3">{money(r.price_minor)}</td>
                  <td className="p-3">{r.stock}</td>
                  <td className="p-3">{statusAr[r.status]}</td>
                  <td className="p-3"><Link href={`/admin/products/${r.id}`} className="underline">تعديل</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
