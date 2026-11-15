import { listFeedback } from "@/lib/db/extras";
import { setFeedbackStatus } from "../../actions";

const kinds: Record<string, string> = { review: "تقييم", complaint: "شكوى", suggestion: "اقتراح" };
const tagAr: Record<string, string> = { color: "جمال اللون", comfort: "الراحة", look: "الشكل الطبيعي", delivery: "سرعة التوصيل", packaging: "التغليف", service: "خدمة العملاء", price: "السعر" };
const sts: Record<string, string> = { new: "جديد", approved: "منشور", hidden: "مخفي", done: "تم التعامل" };

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ done?: string; id?: string }> }) {
  const { done, id: doneId } = await searchParams;
  const rows = listFeedback();
  const doneMsg: Record<string, string> = { approved: "✅ تم نشر التقييم — صار ظاهرًا الآن في المتجر.", hidden: "✅ تم إخفاؤه من المتجر.", done: "✅ تم تسجيله «تم التعامل».", new: "✅ تمت إعادته إلى الجديد." };
  const btn = "min-h-11 rounded-full border border-mauve px-4 hover:bg-blush/40";
  const act = (id: string, status: string, label: string) => (
    <form action={setFeedbackStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} /><button className={btn}>{label}</button></form>
  );
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">الآراء والشكاوى والاقتراحات</h1>
      {done && doneMsg[done] && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{doneMsg[done]}</p>}
      <p className="text-sm">التقييمات لا تظهر في المتجر إلا بعد ضغط «نشر». الشكاوى والاقتراحات تظهر لك فقط.</p>
      {rows.length === 0 ? <p>لا توجد رسائل بعد.</p> : (
        <ul className="space-y-3">
          {rows.map((f) => (
            <li key={f.id} className={`rounded-card border bg-surface p-4 text-sm ${f.id === doneId ? "border-emerald-500 ring-2 ring-emerald-200" : "border-gold/40"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{kinds[f.kind]}{f.rating ? ` — ${"★".repeat(f.rating)}${"☆".repeat(5 - f.rating)}` : ""}</strong>
                <span className="flex items-center gap-2"><span className="opacity-70" dir="ltr">{f.created_at}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${f.status === "approved" ? "bg-emerald-100 text-emerald-900" : f.status === "new" ? "bg-amber-100 text-amber-900" : "bg-white/80"}`}>{f.status === "approved" ? "✓ منشور في المتجر" : sts[f.status]}</span></span>
              </div>
              <p className="mt-1 opacity-80">{f.name || "بدون اسم"}{f.contact && <> · <span dir="ltr">{f.contact}</span></>}</p>
              {f.tags && <p className="mt-2 flex flex-wrap gap-1">{f.tags.split(",").map((t) => <span key={t} className="rounded-full bg-blush/50 px-3 py-1 text-xs">{tagAr[t] ?? t}</span>)}</p>}
              {f.message && <p className="mt-2 whitespace-pre-wrap leading-7">{f.message}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {f.kind === "review" && f.status !== "approved" && act(f.id, "approved", "نشر")}
                {f.status !== "hidden" && act(f.id, "hidden", f.status === "approved" ? "إخفاء من المتجر" : "إخفاء")}
                {f.status !== "done" && act(f.id, "done", "تم التعامل")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
