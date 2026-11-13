import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
type C = { id: string; name: string; email: string; phone: string; city: string; created_at: string; orders: number; favs: number };

export default function CustomersPage() {
  const rows = db().prepare(`SELECT c.id,c.name,c.email,c.phone,c.city,c.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) orders,
      (SELECT json_array_length(d.wishlist) FROM customer_data d WHERE d.customer_id = c.id) favs
    FROM customers c ORDER BY c.created_at DESC LIMIT 500`).all() as C[];
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold">العميلات ({rows.length})</h1>
      <div className="overflow-x-auto rounded-card border border-gold/40 bg-surface">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gold/40"><th className="p-3 text-start">الاسم</th><th className="p-3 text-start">البريد</th><th className="p-3 text-start">الجوال</th><th className="p-3 text-start">الطلبات</th><th className="p-3 text-start">المفضلة</th><th className="p-3 text-start">تسجيل</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-gold/20">
                <td className="p-3 font-bold">{c.name}</td>
                <td className="p-3" dir="ltr">{c.email}</td>
                <td className="p-3" dir="ltr">{c.phone ? <a className="underline" href={`https://wa.me/${c.phone}`} target="_blank" rel="noopener noreferrer">{c.phone}</a> : "—"}</td>
                <td className="p-3">{c.orders}</td>
                <td className="p-3">{c.favs ?? 0}</td>
                <td className="p-3" dir="ltr">{c.created_at.slice(0, 10)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="p-3" colSpan={6}>لا توجد عميلات بعد.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
