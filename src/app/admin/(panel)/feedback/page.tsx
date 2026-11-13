import { listFeedback } from "@/lib/db/extras";
import { setFeedbackStatus } from "../../actions";

const kinds: Record<string, string> = { review: "تقييم", complaint: "شكوى", suggestion: "اقتراح" };
const sts: Record<string, string> = { new: "جديد", approved: "منشور", hidden: "مخفي", done: "تم التعامل" };

export default function FeedbackPage() {
  const rows = listFeedback();
  const btn = "min-h-11 rounded-full border border-mauve px-4 hover:bg-blush/40";
  const act = (id: string, status: string, label: string) => (
    <form action={setFeedbackStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} /><button className={btn}>{label}</button></form>
  );
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">الآراء والشكاوى والاقتراحات</h1>
      <p className="text-sm">التقييمات لا تظهر في المتجر إلا بعد ضغط «نشر». الشكاوى والاقتراحات تظهر لك فقط.</p>
      {rows.length === 0 ? <p>لا توجد رسائل بعد.</p> : (
        <ul className="space-y-3">
          {rows.map((f) => (
            <li key={f.id} className="rounded-card border border-gold/40 bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{kinds[f.kind]}{f.rating ? ` — ${"★".repeat(f.rating)}${"☆".repeat(5 - f.rating)}` : ""}</strong>
                <span className="opacity-70" dir="ltr">{f.created_at} · {sts[f.status]}</span>
              </div>
              <p className="mt-1 opacity-80">{f.name || "بدون اسم"}{f.contact && <> · <span dir="ltr">{f.contact}</span></>}</p>
              {f.message && <p className="mt-2 whitespace-pre-wrap leading-7">{f.message}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {f.kind === "review" && act(f.id, "approved", "نشر")}
                {act(f.id, "hidden", "إخفاء")}
                {act(f.id, "done", "تم التعامل")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
