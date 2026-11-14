import Link from "next/link";
import { getSetting } from "@/lib/db";
import { saveAutoRates } from "../../../integrations-actions";
import { Flash, PageTitle, inputCls, panelCls, saveCls } from "../../CardGrid";

export default async function AutoRates({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const aramex = getSetting("car_aramex_enabled") === "1";
  return (
    <>
      <PageTitle icon="⚡" title="سعر الشحن التلقائي" sub="لما تفعّلينه، سعر الشحن عند الدفع يتحسب لوحده من Aramex، ومش محتاجة تكتبي الأسعار." />
      <Flash saved={saved} error={error} />
      {!aramex && <p className="mb-4 max-w-xl rounded-xl bg-blush/50 p-3 text-sm font-medium">⚠ يحتاج ربط Aramex أولًا. <Link href="/admin/integrations/aramex" className="font-bold underline">افتحي ربط Aramex</Link></p>}
      <form action={saveAutoRates} className={panelCls}>
        <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" name="car_auto_rates" defaultChecked={getSetting("car_auto_rates") === "1"} /> احسبي سعر الشحن تلقائيًا من Aramex</label>
        <p className="text-sm leading-6">السعر المكتوب لكل دولة في بطاقتها يفضل كاحتياطي لو Aramex ما ردّت. لو تركتِه صفرًا يبقى الشحن مجانيًا وقت العطل. «شحن مجاني فوق» يشتغل كالمعتاد.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="car_pack_weight" className="mb-1 block text-sm font-bold">وزن الطرد التقريبي (كجم)</label><input id="car_pack_weight" name="car_pack_weight" type="number" step="0.1" min="0.1" dir="ltr" defaultValue={getSetting("car_pack_weight", "0.3")} className={inputCls} /></div>
          <div><label htmlFor="car_rate_markup" className="mb-1 block text-sm font-bold">إضافة على السعر % (للتغليف، اختياري)</label><input id="car_rate_markup" name="car_rate_markup" type="number" step="1" min="0" dir="ltr" defaultValue={getSetting("car_rate_markup", "0")} className={inputCls} /></div>
        </div>
        <button className={saveCls}>حفظ</button>
      </form>
    </>
  );
}
