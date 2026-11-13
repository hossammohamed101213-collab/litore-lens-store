import Link from "next/link";
import { db } from "@/lib/db";
import { updateReturn } from "../../actions";

export const dynamic = "force-dynamic";
type R = { id: string; order_id: string; reason: string; details: string; status: string; admin_note: string; created_at: string; name: string; phone: string; total_minor: number; currency: string };
const ST: Record<string, string> = { requested: "طلب جديد", approved: "تمت الموافقة", received: "تم استلام المنتج", refunded: "تم الاسترداد", rejected: "مرفوض" };
const WHY: Record<string, string> = { damaged: "المنتج تالف", wrong: "منتج غير المطلوب", color: "اللون غير مناسب", comfort: "غير مريح", other: "سبب آخر" };

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const rows = db().prepare(`SELECT r.*, c.name, o.phone, o.total_minor, o.currency FROM returns r
    JOIN orders o ON o.id = r.order_id LEFT JOIN customers c ON c.id = r.customer_id ORDER BY r.created_at DESC LIMIT 200`).all() as R[];
  const counts = (s: string) => rows.filter((r) => r.status === s).length;
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold">المرتجعات</h1>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Object.entries(ST).map(([k, l]) => <li key={k} className="rounded-card border border-gold/40 bg-surface p-3 text-sm">{l}<p className="text-2xl font-bold">{counts(k)}</p></li>)}
      </ul>
      {error && <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm">⚠ {error}</p>}
      {saved && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تم الحفظ.</p>}
      {rows.length === 0 ? <p>لا توجد طلبات مرتجعات.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-card border border-gold/40 bg-surface p-4 text-sm">
              <p className="font-bold"><Link href={`/admin/orders/${r.order_id}`} className="underline" dir="ltr">{r.order_id}</Link> · {r.name || "—"} · <span dir="ltr">{r.phone}</span></p>
              <p className="mt-1">السبب: <strong>{WHY[r.reason] ?? r.reason}</strong>{r.details ? ` — ${r.details}` : ""}</p>
              <p className="opacity-70">{r.created_at} · الحالة الحالية: {ST[r.status]}</p>
              <form action={updateReturn} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={r.id} />
                <select name="status" defaultValue={r.status} className="min-h-11 rounded-xl border border-gold/50 px-3">{Object.entries(ST).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <input name="note" defaultValue={r.admin_note} placeholder="ملاحظة داخلية" className="min-h-11 min-w-48 flex-1 rounded-xl border border-gold/50 px-3" />
                <button className="min-h-11 rounded-full bg-mauve px-6 text-white hover:bg-[#6f4353]">حفظ</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
