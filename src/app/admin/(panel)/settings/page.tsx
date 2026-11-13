import { getSetting } from "@/lib/db";
import { removeHeroBg, saveHeroBg, saveSettings, saveSocial } from "../../actions";
import { HeroBgForm } from "./HeroBgForm";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  return (
    <div className="space-y-8">
    <form action={saveSettings} className="max-w-lg space-y-5">
      <h1 className="font-display text-3xl font-semibold">الضريبة</h1>
      <p className="text-sm">اتركها 0 إذا لم تُفعّل الضريبة بعد. اعتمد النسبة وطريقة الاحتساب من مستشارك المحاسبي/الضريبي.</p>
      {error && <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
      {saved && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تم الحفظ.</p>}
      <div>
        <label htmlFor="tax_rate" className="mb-1 block text-sm font-bold">نسبة الضريبة %</label>
        <input id="tax_rate" name="tax_rate" type="number" step="0.01" dir="ltr" defaultValue={getSetting("tax_rate", "0")} className="min-h-11 w-full rounded-xl border border-gold/50 px-3" />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="tax_inclusive" defaultChecked={getSetting("tax_inclusive", "true") === "true"} /> الأسعار المعروضة شاملة الضريبة</label>
      <button className="min-h-12 rounded-full bg-mauve px-10 text-white hover:bg-[#6f4353]">حفظ</button>
    </form>
      <section className="max-w-lg space-y-3 border-t border-gold/40 pt-6">
        <h2 className="font-display text-2xl font-semibold">خلفية الصفحة الرئيسية</h2>
        <p className="text-sm">ارفعي صورتك لتظهر شفافة وفخمة خلف جملة الترحيب في أول الصفحة. حرّكي القوة والمكان وشوفي المعاينة قبل الحفظ.</p>
        <HeroBgForm current={getSetting("hero_bg", "")} opacity={Number(getSetting("hero_bg_opacity", "40")) || 40} side={getSetting("hero_bg_side", "center")} pos={Number(getSetting("hero_bg_pos", "20")) || 20} save={saveHeroBg} remove={removeHeroBg} />
      </section>
      <form action={saveSocial} className="max-w-lg space-y-4 border-t border-gold/40 pt-6">
        <h2 className="font-display text-2xl font-semibold">أيقونات التواصل (أسفل الموقع)</h2>
        <p className="text-sm">الصقي رابط كل حساب. الأيقونة بدون رابط تظهر عادي ولا تفتح شيئًا. واتساب لو تركتيه فاضي يستخدم رقم المتجر.</p>
        {[["whatsapp", "واتساب"], ["tiktok", "تيك توك"], ["instagram", "إنستجرام"]].map(([k, l]) => (
          <div key={k}>
            <label htmlFor={"s_" + k} className="mb-1 block text-sm font-bold">{l}</label>
            <input id={"s_" + k} name={k} dir="ltr" placeholder="https://" defaultValue={getSetting("social_" + k, "")} className="min-h-11 w-full rounded-xl border border-gold/50 px-3" />
          </div>
        ))}
        <button className="min-h-12 rounded-full bg-mauve px-10 text-white hover:bg-[#6f4353]">حفظ الروابط</button>
      </form>
    </div>
  );
}
