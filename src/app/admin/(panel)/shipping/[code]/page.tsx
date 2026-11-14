import { notFound } from "next/navigation";
import { db, fromMinor } from "@/lib/db";
import { saveShipping } from "../../../actions";
import { Flash, PageTitle, inputCls, panelCls, saveCls } from "../../CardGrid";

type Z = { country: string; label_ar: string; label_en: string; price_minor: number; free_over_minor: number | null; min_days: number | null; max_days: number | null; active: number };
const NAMES: Record<string, string> = { AE: "الإمارات", SA: "السعودية", KW: "الكويت", QA: "قطر", BH: "البحرين", OM: "عُمان" };

export default async function ZonePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { code } = await params; const { saved, error } = await searchParams;
  if (!NAMES[code]) notFound();
  const z = db().prepare("SELECT * FROM shipping_zones WHERE country = ?").get(code) as Z | undefined;
  const f = (id: string, label: string, el: React.ReactNode) => <div><label htmlFor={id} className="mb-1 block text-sm font-bold">{label}</label>{el}</div>;
  return (
    <>
      <PageTitle icon="🚚" title={`الشحن إلى ${NAMES[code]}`} />
      <Flash saved={saved} error={error} />
      <form action={saveShipping} className={panelCls}>
        <input type="hidden" name="country" value={code} />
        <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked={z?.active === 1} /> الشحن مفعّل لهذه الدولة</label>
        <div className="grid gap-3 sm:grid-cols-2">
          {f("price", "السعر (درهم)", <input id="price" name="price" type="number" step="0.01" min="0" dir="ltr" defaultValue={z ? fromMinor(z.price_minor) : ""} className={inputCls} />)}
          {f("free", "شحن مجاني فوق (درهم)", <input id="free" name="free" type="number" step="0.01" min="0" dir="ltr" defaultValue={z?.free_over_minor ? fromMinor(z.free_over_minor) : ""} className={inputCls} />)}
          {f("min", "أقل مدة (أيام)", <input id="min" name="min" type="number" min="0" dir="ltr" defaultValue={z?.min_days ?? ""} className={inputCls} />)}
          {f("max", "أقصى مدة (أيام)", <input id="max" name="max" type="number" min="0" dir="ltr" defaultValue={z?.max_days ?? ""} className={inputCls} />)}
          {f("label_ar", "الاسم الظاهر (عربي)", <input id="label_ar" name="label_ar" defaultValue={z?.label_ar ?? "شحن"} className={inputCls} />)}
          {f("label_en", "الاسم الظاهر (إنجليزي)", <input id="label_en" name="label_en" dir="ltr" defaultValue={z?.label_en ?? "Shipping"} className={inputCls} />)}
        </div>
        <button className={saveCls}>حفظ</button>
      </form>
    </>
  );
}
