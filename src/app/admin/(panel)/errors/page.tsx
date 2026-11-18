import { db } from "@/lib/db";
import { uaeDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";
type Row = { id: number; at: string; source: string; place: string; message: string };

/** The store's own error log: server errors and failed calls to outside services. No customer data is written here. */
export default function ErrorsPage() {
  const rows = db().prepare("SELECT id, at, source, place, message FROM error_log ORDER BY id DESC LIMIT 100").all() as Row[];
  const day = (db().prepare("SELECT COUNT(*) n FROM error_log WHERE at >= datetime('now','-1 day')").get() as { n: number }).n;
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="font-display text-3xl font-semibold">سجل الأخطاء</h1>
      <p className="text-sm">أي خطأ يحدث في المتجر أو مع خدمة خارجية (الدفع، الشحن، البريد) يُسجَّل هنا. لو تكررت الأخطاء يصلك تنبيه على الجرس والبريد.</p>
      <p className={`rounded-card border p-4 text-sm ${day ? "border-mauve bg-blush/50" : "border-gold/40 bg-surface"}`} role="status">آخر 24 ساعة: <strong>{day}</strong> خطأ</p>
      {rows.length === 0 ? <p className="text-sm">لا توجد أخطاء مسجّلة.</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-card border border-gold/40 bg-surface p-3 text-sm">
              <p className="flex flex-wrap justify-between gap-2 text-xs opacity-80"><span>{uaeDateTime(r.at)}</span><span dir="ltr">{r.source}{r.place ? ` · ${r.place}` : ""}</span></p>
              <p className="mt-1 break-words" dir="ltr">{r.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
