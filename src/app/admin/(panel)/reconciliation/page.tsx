import Link from "next/link";
import { db } from "@/lib/db";
import { uaeDateTime } from "@/lib/time";
import type { ReconIssue } from "@/lib/ops/daily-reconcile";

export const dynamic = "force-dynamic";
type Row = { day: string; ran_at: string; orders: number; paid: number; paid_minor: number; refunded_minor: number; verified: number; unverified: number; issues_json: string };
const money = (m: number) => (m / 100).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One row per day: what was sold, what was given back, how many payments the gateway confirmed again, and anything that does not add up. */
export default function ReconciliationPage() {
  const rows = db().prepare("SELECT * FROM reconciliations ORDER BY day DESC LIMIT 60").all() as Row[];
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="font-display text-3xl font-semibold">المطابقة اليومية</h1>
      <p className="text-sm">كل يوم بعد 6 صباحًا بتوقيت الإمارات يراجع المتجر طلبات اليوم السابق: مجموع كل طلب، الاسترجاعات، ويسأل بوابة الدفع مرة أخرى عن كل دفعة. أي اختلاف يظهر هنا ويصلك تنبيه.</p>
      {rows.length === 0 && <p className="rounded-card border border-gold/40 bg-surface p-4 text-sm">لم تُنفَّذ أي مطابقة بعد. أول مطابقة تظهر غدًا صباحًا.</p>}
      <ul className="space-y-3">
        {rows.map((r) => {
          const issues = JSON.parse(r.issues_json || "[]") as ReconIssue[];
          return (
            <li key={r.day} className={`rounded-card border p-4 text-sm ${issues.length ? "border-mauve bg-blush/50" : "border-gold/40 bg-surface"}`}>
              <p className="flex flex-wrap items-center justify-between gap-2 font-bold"><span dir="ltr">{r.day}</span><span>{issues.length ? `⚠ ${issues.length} اختلاف` : "✓ سليمة"}</span></p>
              <p className="mt-1">الطلبات: {r.orders} · المدفوع: {r.paid} بإجمالي <span dir="ltr">{money(r.paid_minor)}</span> · المسترجع: <span dir="ltr">{money(r.refunded_minor)}</span></p>
              <p>تأكيد بوابة الدفع: {r.verified} تم{r.unverified ? ` · ${r.unverified} لم يتم (البوابة لم ترد أو لا مفاتيح)` : ""}</p>
              {issues.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 ps-5">
                  {issues.slice(0, 20).map((i, k) => <li key={k}><Link className="font-bold underline" href={`/admin/orders/${i.order}`}>{i.order}</Link> — {i.detail}</li>)}
                </ul>
              )}
              <p className="mt-2 text-xs opacity-70">نُفّذت: {uaeDateTime(r.ran_at)}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
