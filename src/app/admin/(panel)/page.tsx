import Link from "next/link";
import { dashboardStats } from "@/lib/db/admin";

const money = (n: number) => new Intl.NumberFormat("ar-AE", { style: "currency", currency: "AED" }).format(n);

export default function Dashboard() {
  const s = dashboardStats();
  const cards: [string, string | number][] = [
    ["طلبات جديدة", s.newOrders], ["إجمالي الطلبات", s.orders], ["المنتجات", s.products],
    ["العملاء", s.customers], ["المبيعات المدفوعة", money(s.revenue)],
  ];
  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold">الرئيسية</h1>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <li key={label} className="rounded-card border border-gold/40 bg-surface p-4">
            <p className="text-sm">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </li>
        ))}
      </ul>
      <section className="rounded-card border border-gold/40 bg-surface p-5">
        <h2 className="mb-3 font-bold">مخزون منخفض (3 أو أقل)</h2>
        {s.lowStock.length === 0 ? <p className="text-sm">لا يوجد.</p> : (
          <ul className="divide-y divide-gold/30 text-sm">
            {s.lowStock.map((r) => (
              <li key={r.sku} className="flex justify-between py-2"><span>{r.name} <span dir="ltr" className="opacity-70">({r.sku})</span></span><strong>{r.stock}</strong></li>
            ))}
          </ul>
        )}
      </section>
      <p><Link href="/admin/products/new" className="inline-flex min-h-12 items-center rounded-full bg-mauve px-8 text-white hover:bg-[#6f4353]">إضافة منتج جديد</Link></p>
    </div>
  );
}
