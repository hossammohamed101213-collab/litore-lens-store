import { db, fromMinor } from "@/lib/db";
import { deleteCoupon, saveCoupon, toggleCoupon } from "../../actions";

type C = { code: string; kind: "percent" | "fixed"; value: number; min_subtotal_minor: number; active: number };
const input = "min-h-11 w-full rounded-xl border border-gold/50 bg-surface px-3";

export default async function CouponsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const rows = db().prepare("SELECT * FROM coupons ORDER BY code").all() as C[];
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">الكوبونات</h1>
      {error && <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
      {saved && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تم الحفظ.</p>}
      <form action={saveCoupon} className="grid items-end gap-3 rounded-card border border-gold/40 bg-surface p-5 sm:grid-cols-5">
        <div><label htmlFor="code" className="mb-1 block text-sm font-bold">الكود</label><input id="code" name="code" dir="ltr" className={input} /></div>
        <div><label htmlFor="kind" className="mb-1 block text-sm font-bold">النوع</label><select id="kind" name="kind" className={input}><option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت</option></select></div>
        <div><label htmlFor="value" className="mb-1 block text-sm font-bold">القيمة</label><input id="value" name="value" type="number" step="0.01" dir="ltr" className={input} /></div>
        <div><label htmlFor="min" className="mb-1 block text-sm font-bold">حد أدنى للطلب</label><input id="min" name="min" type="number" step="0.01" dir="ltr" className={input} /></div>
        <button className="min-h-11 rounded-full bg-mauve px-6 text-white hover:bg-[#6f4353]">حفظ الكوبون</button>
      </form>
      {rows.length === 0 ? <p>لا توجد كوبونات.</p> : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.code} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-gold/40 bg-surface p-4 text-sm">
              <span><strong dir="ltr">{c.code}</strong> — {c.kind === "percent" ? `${c.value}%` : `${c.value} درهم`}{c.min_subtotal_minor > 0 && ` (حد أدنى ${fromMinor(c.min_subtotal_minor)})`}</span>
              <span className="flex gap-2">
                <form action={toggleCoupon}><input type="hidden" name="code" value={c.code} /><button className="min-h-11 rounded-full border border-mauve px-4 hover:bg-blush/40">{c.active ? "إيقاف" : "تفعيل"}</button></form>
                <form action={deleteCoupon}><input type="hidden" name="code" value={c.code} /><button className="min-h-11 rounded-full border border-mauve px-4 hover:bg-blush/40">حذف</button></form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
