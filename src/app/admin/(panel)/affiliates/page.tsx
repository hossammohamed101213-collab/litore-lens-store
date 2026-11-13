import { db } from "@/lib/db";
import { deleteAffiliate, saveAffiliate } from "../../actions";

export const dynamic = "force-dynamic";
type A = { id: string; name: string; phone: string; email: string; social: string; about: string; status: string; commission_pct: number; code: string | null; notes: string; created_at: string };
const inp = "min-h-11 rounded-xl border border-gold/50 bg-surface px-3";

export default async function AffiliatesPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const rows = db().prepare("SELECT * FROM affiliates ORDER BY (status='pending') DESC, created_at DESC LIMIT 300").all() as A[];
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold">المسوّقون بالعمولة</h1>
      <p className="text-sm">هنا طلبات الانضمام من صفحة «انضمي كمسوّقة». وافقي، حدّدي نسبة العمولة، وأعطيها كودًا خاصًا. تتبّع الطلبات وحساب العمولة تلقائيًا نرتّبه في المرحلة التالية.</p>
      {error && <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
      {saved && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تم الحفظ.</p>}
      {rows.length === 0 ? <p>لا توجد طلبات بعد.</p> : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="space-y-2 rounded-card border border-gold/40 bg-surface p-4 text-sm">
              <p className="font-bold">{a.name} · <a dir="ltr" className="underline" href={`https://wa.me/${a.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">{a.phone}</a>{a.email && <> · <span dir="ltr">{a.email}</span></>}</p>
              {a.social && <p dir="auto">حساباتها: {a.social}</p>}
              {a.about && <p className="whitespace-pre-wrap" dir="auto">{a.about}</p>}
              <p className="text-xs opacity-60" dir="ltr">{a.created_at}</p>
              <form action={saveAffiliate} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={a.id} />
                <label className="text-xs">الحالة<select name="status" defaultValue={a.status} className={`${inp} mt-1 block`}><option value="pending">قيد المراجعة</option><option value="approved">مقبولة</option><option value="rejected">مرفوضة</option></select></label>
                <label className="text-xs">العمولة (%)<input name="commission" type="number" min={0} max={100} step="0.5" defaultValue={a.commission_pct} className={`${inp} mt-1 block w-24`} /></label>
                <label className="text-xs">كودها<input name="code" dir="ltr" defaultValue={a.code ?? ""} className={`${inp} mt-1 block w-36`} /></label>
                <label className="text-xs">ملاحظات<input name="notes" defaultValue={a.notes} className={`${inp} mt-1 block w-48`} /></label>
                <button className="min-h-11 rounded-full border border-mauve px-4 hover:bg-blush/40">حفظ</button>
              </form>
              <form action={deleteAffiliate}><input type="hidden" name="id" value={a.id} /><button className="min-h-11 underline">حذف الطلب</button></form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
