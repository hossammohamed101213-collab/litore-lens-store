import { getSetting } from "@/lib/db";
import { saveSettings } from "../../actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  return (
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
  );
}
