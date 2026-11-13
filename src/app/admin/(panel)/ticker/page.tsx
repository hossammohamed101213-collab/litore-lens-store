import { listPromos } from "@/lib/db/extras";
import { deletePromo, savePromo, togglePromo } from "../../actions";

const input = "min-h-11 w-full rounded-xl border border-gold/50 bg-surface px-3";

export default async function TickerPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const rows = listPromos();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">الشريط المتحرك (الخصومات)</h1>
      <p className="text-sm">كل عدسة تضيفها هنا تظهر فورًا في الشريط أعلى المتجر، يتحرك من اليمين لليسار بدون توقف. لو مفيش عدسات مفعّلة، الشريط يختفي.</p>
      {error && <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
      {saved && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تمت الإضافة.</p>}
      <form action={savePromo} className="grid items-end gap-3 rounded-card border border-gold/40 bg-surface p-5 sm:grid-cols-5">
        <div><label htmlFor="name_ar" className="mb-1 block text-sm font-bold">نوع العدسة (عربي)</label><input id="name_ar" name="name_ar" className={input} /></div>
        <div><label htmlFor="name_en" className="mb-1 block text-sm font-bold">Lens (English)</label><input id="name_en" name="name_en" dir="ltr" className={input} /></div>
        <div><label htmlFor="percent" className="mb-1 block text-sm font-bold">الخصم %</label><input id="percent" name="percent" type="number" step="1" min="1" max="90" dir="ltr" className={input} /></div>
        <div><label htmlFor="price_after" className="mb-1 block text-sm font-bold">السعر بعد الخصم (درهم)</label><input id="price_after" name="price_after" type="number" step="0.01" min="0" dir="ltr" className={input} /></div>
        <button className="min-h-11 rounded-full bg-mauve px-6 text-white hover:bg-[#6f4353]">إضافة للشريط</button>
      </form>
      {rows.length === 0 ? <p>لا توجد عناصر في الشريط.</p> : (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-gold/40 bg-surface p-4 text-sm">
              <span><strong>{p.nameAr}</strong> / <span dir="ltr">{p.nameEn}</span> — خصم {p.percent}% — بعد الخصم {p.priceAfter} درهم {!p.active && <em className="ms-2 opacity-70">(متوقف)</em>}</span>
              <span className="flex gap-2">
                <form action={togglePromo}><input type="hidden" name="id" value={p.id} /><button className="min-h-11 rounded-full border border-mauve px-4 hover:bg-blush/40">{p.active ? "إيقاف" : "تفعيل"}</button></form>
                <form action={deletePromo}><input type="hidden" name="id" value={p.id} /><button className="min-h-11 rounded-full border border-mauve px-4 hover:bg-blush/40">حذف</button></form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
