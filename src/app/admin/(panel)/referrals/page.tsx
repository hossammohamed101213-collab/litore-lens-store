import { db } from "@/lib/db";
import { refOwnerPct, refRefereePct } from "@/lib/referrals";
import { createAdminCode, decideRedemption, saveRefSettings, toggleRefCode } from "../../actions";

export const dynamic = "force-dynamic";
const btn = "min-h-11 rounded-full border border-mauve px-4 hover:bg-blush/40";
const inp = "min-h-11 rounded-xl border border-gold/50 bg-surface px-3";
const card = "space-y-3 rounded-card border border-gold/40 bg-surface p-5";

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const c = db();
  const reds = c.prepare(`SELECT r.*, cu.name, cu.email FROM redemptions r JOIN customers cu ON cu.id = r.customer_id ORDER BY (r.status='pending') DESC, r.created_at DESC LIMIT 100`).all() as
    { id: string; name: string; email: string; percent: number; kind: string; status: string; coupon_code: string | null; created_at: string }[];
  const codes = c.prepare(`SELECT rc.code, rc.active, rc.note, cu.name owner, (SELECT COUNT(*) FROM referrals r WHERE r.code = rc.code) uses
    FROM referral_codes rc LEFT JOIN customers cu ON cu.id = rc.owner_id ORDER BY uses DESC, rc.created_at DESC LIMIT 300`).all() as
    { code: string; active: number; note: string; owner: string | null; uses: number }[];
  const log = c.prepare(`SELECT r.code, r.referee_pct, r.owner_pct, r.created_at, cu.name referee, ow.name owner FROM referrals r
    JOIN customers cu ON cu.id = r.referee_id LEFT JOIN customers ow ON ow.id = r.owner_id ORDER BY r.created_at DESC LIMIT 100`).all() as
    { code: string; referee_pct: number; owner_pct: number; created_at: string; referee: string; owner: string | null }[];
  const stat: Record<string, string> = { pending: "بانتظار قرارك", approved: "تمت الموافقة", rejected: "مرفوض" };
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">الإحالات</h1>
      {error && <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
      {saved && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تم الحفظ.</p>}

      <section className={card}>
        <h2 className="font-bold">النسب</h2>
        <form action={saveRefSettings} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">خصم المسجّلة الجديدة (%)<input name="referee" type="number" min={0} max={100} step="0.5" defaultValue={refRefereePct()} className={`${inp} mt-1 block w-32`} /></label>
          <label className="text-sm">رصيد صاحبة الكود لكل إحالة (%)<input name="owner" type="number" min={0} max={100} step="0.5" defaultValue={refOwnerPct()} className={`${inp} mt-1 block w-32`} /></label>
          <button className={btn}>حفظ</button>
        </form>
        <p className="text-xs opacity-80">كود الإدارة يعطي المسجّلة الجديدة الخصم فقط (لا رصيد لأحد). كود العميلة يعطي المسجّلة الخصم، وصاحبة الكود رصيدًا يتراكم حتى 100%.</p>
      </section>

      <section className={card}>
        <h2 className="font-bold">طلبات استلام الرصيد</h2>
        {reds.length === 0 ? <p className="text-sm">لا توجد طلبات.</p> : (
          <ul className="space-y-3">
            {reds.map((r) => (
              <li key={r.id} className="rounded-xl border border-gold/30 p-3 text-sm">
                <p className="font-bold">{r.name} · <span dir="ltr">{r.email}</span></p>
                <p>{r.percent}% — {r.kind === "free_product" ? "منتج مجاني" : "خصم"} — {stat[r.status]}{r.coupon_code ? <> — <strong dir="ltr" className="select-all">{r.coupon_code}</strong></> : null}</p>
                {r.status === "pending" && (
                  <form action={decideRedemption} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <label className="text-xs">نسبة الكوبون (%)<input name="percent" type="number" min={1} max={100} step="0.5" defaultValue={r.percent} className={`${inp} mt-1 block w-28`} /></label>
                    <button name="decision" value="approve" className={btn}>موافقة وإنشاء كود</button>
                    <button name="decision" value="reject" className="min-h-11 rounded-full px-4 underline">رفض (يُعاد الرصيد)</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="font-bold">أكواد الإحالة</h2>
        <form action={createAdminCode} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">كود جديد من الإدارة<input name="code" dir="ltr" required placeholder="LITORE10" className={`${inp} mt-1 block w-44`} /></label>
          <label className="text-sm">ملاحظة (اختياري)<input name="note" className={`${inp} mt-1 block w-56`} /></label>
          <button className={btn}>إضافة</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gold/40"><th className="p-2 text-start">الكود</th><th className="p-2 text-start">النوع</th><th className="p-2 text-start">الاستخدام</th><th className="p-2 text-start">الحالة</th><th /></tr></thead>
            <tbody>
              {codes.map((k) => (
                <tr key={k.code} className="border-b border-gold/20">
                  <td className="p-2 font-bold" dir="ltr">{k.code}</td>
                  <td className="p-2">{k.owner ? `عميلة: ${k.owner}` : `إدارة${k.note ? ` — ${k.note}` : ""}`}</td>
                  <td className="p-2">{k.uses}</td>
                  <td className="p-2">{k.active ? "مفعّل" : "موقوف"}</td>
                  <td className="p-2"><form action={toggleRefCode}><input type="hidden" name="code" value={k.code} /><button className="min-h-11 underline">{k.active ? "إيقاف" : "تفعيل"}</button></form></td>
                </tr>
              ))}
              {codes.length === 0 && <tr><td className="p-2" colSpan={5}>لا توجد أكواد.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-bold">سجل الإحالات</h2>
        {log.length === 0 ? <p className="text-sm">لا توجد إحالات بعد.</p> : (
          <ul className="space-y-1 text-sm">{log.map((l, i) => <li key={i}><strong dir="ltr">{l.code}</strong> — {l.referee} سجّلت (خصم {l.referee_pct}%){l.owner ? ` — رصيد ${l.owner_pct}% لـ ${l.owner}` : " — كود إدارة"} <span dir="ltr" className="opacity-60">{l.created_at}</span></li>)}</ul>
        )}
      </section>
    </div>
  );
}
