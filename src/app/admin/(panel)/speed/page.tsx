import { grade, vitalsSummary, type Grade } from "@/lib/ops/vitals";

export const dynamic = "force-dynamic";
const LOOK: Record<Grade, { text: string; cls: string }> = {
  good: { text: "جيد ✓", cls: "border-gold/40 bg-surface" }, mid: { text: "يحتاج تحسين", cls: "border-mauve bg-blush/40" },
  poor: { text: "ضعيف ⚠", cls: "border-mauve bg-blush/70" }, none: { text: "لا توجد بيانات بعد", cls: "border-gold/40 bg-surface" },
};
const sec = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} ث`);

/** Speed as real visitors feel it, from their own phones and computers (last 28 days). */
export default function SpeedPage() {
  const s = vitalsSummary(28);
  const total = s.byDevice.reduce((a, d) => a + d.visits, 0);
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="font-display text-3xl font-semibold">سرعة المتجر عند الزوار</h1>
      <p className="text-sm">الأرقام هنا من أجهزة الزوار أنفسهم في آخر 28 يومًا (من وافقوا على كوكيز الإحصاءات فقط)، وليست تجربة معملية. الرقم المعروض هو ما يراه 3 من كل 4 زوار أو أفضل منه — نفس طريقة جوجل.</p>
      {total < 30 && <p className="rounded-card border border-mauve bg-blush/40 p-4 text-sm" role="status">عدد الزيارات المقيسة حتى الآن <strong>{total}</strong>. الرقم يصبح موثوقًا بعد حوالي 30 زيارة لكل نوع جهاز.</p>}
      {s.byDevice.map((d) => (
        <section key={d.device} className="space-y-2">
          <h2 className="text-lg font-bold">{d.device === "phone" ? "الموبايل" : "الكمبيوتر"} <span className="text-sm font-normal opacity-70">({d.visits} زيارة)</span></h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {([["lcp", "ظهور الصفحة", sec(d.lcp), "المطلوب 2.5 ث أو أقل"], ["inp", "سرعة الاستجابة للمس", d.inp == null ? "—" : `${d.inp} مللي ث`, "المطلوب 200 أو أقل"], ["cls", "ثبات الصفحة", d.cls == null ? "—" : (d.cls / 1000).toFixed(2), "المطلوب 0.10 أو أقل"]] as const).map(([m, title, val, want]) => {
              const g = LOOK[grade(m, m === "lcp" ? d.lcp : m === "inp" ? d.inp : d.cls)];
              return <li key={m} className={`rounded-card border p-3 text-sm ${g.cls}`}><p>{title}</p><p className="text-2xl font-bold" dir="ltr">{val}</p><p className="font-bold">{g.text}</p><p className="text-xs opacity-70">{want}</p></li>;
            })}
          </ul>
        </section>
      ))}
      {s.pages.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">أكثر الصفحات زيارة من الموبايل</h2>
          <ul className="space-y-1 text-sm">
            {s.pages.map((p) => <li key={p.path} className="flex justify-between gap-3 rounded-card border border-gold/40 bg-surface px-3 py-2"><span dir="ltr">{p.path}</span><span>{p.visits} زيارة · ظهور الصفحة <strong dir="ltr">{sec(p.lcp)}</strong></span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
