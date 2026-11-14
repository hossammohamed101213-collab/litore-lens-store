import { getSetting } from "@/lib/db";
import { saveSettings } from "../../../actions";
import { Flash, PageTitle, inputCls, panelCls, saveCls } from "../../CardGrid";

export default async function TaxRate({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  return (
    <>
      <PageTitle icon="💰" title="نسبة الضريبة" sub="اتركيها 0 إذا لم تُفعّلي الضريبة بعد. اعتمدي النسبة وطريقة الاحتساب من مستشارك المحاسبي أو الضريبي." />
      <Flash saved={saved} error={error} />
      <form action={saveSettings} className={panelCls}>
        <div>
          <label htmlFor="tax_rate" className="mb-1 block text-sm font-bold">نسبة الضريبة %</label>
          <input id="tax_rate" name="tax_rate" type="number" step="0.01" dir="ltr" defaultValue={getSetting("tax_rate", "0")} className={inputCls} />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="tax_inclusive" defaultChecked={getSetting("tax_inclusive", "true") === "true"} /> الأسعار المعروضة شاملة الضريبة</label>
        <button className={saveCls}>حفظ</button>
      </form>
    </>
  );
}
