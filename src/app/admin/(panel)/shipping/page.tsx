import { db, fromMinor } from "@/lib/db";
import { saveShipping } from "../../actions";

type Z = { country: string; label_ar: string; label_en: string; price_minor: number; free_over_minor: number | null; min_days: number | null; max_days: number | null; active: number };
const countries: [string, string][] = [["AE", "الإمارات"], ["SA", "السعودية"], ["KW", "الكويت"], ["QA", "قطر"], ["BH", "البحرين"], ["OM", "عُمان"]];
const input = "min-h-11 w-full rounded-xl border border-gold/50 bg-surface px-3";

export default async function ShippingPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const zones = new Map((db().prepare("SELECT * FROM shipping_zones").all() as Z[]).map((z) => [z.country, z]));
  return (
    <form action={saveShipping} className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">الشحن</h1>
      <p className="text-sm">فعّل الدول التي تشحن لها وحدد السعر. الدولة غير المفعّلة لن يظهر لها شحن عند الدفع. (ربط شركات الشحن بالـ API يتم لاحقًا بعد توفر الحسابات.)</p>
      {saved && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تم الحفظ.</p>}
      {countries.map(([code, name]) => {
        const z = zones.get(code);
        return (
          <fieldset key={code} className="space-y-3 rounded-card border border-gold/40 bg-surface p-5">
            <legend className="px-1 font-bold">{name}</legend>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={`active_${code}`} defaultChecked={z?.active === 1} /> الشحن مفعّل</label>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div><label htmlFor={`label_ar_${code}`} className="mb-1 block text-sm font-bold">الاسم (عربي)</label><input id={`label_ar_${code}`} name={`label_ar_${code}`} defaultValue={z?.label_ar ?? "شحن"} className={input} /></div>
              <div><label htmlFor={`label_en_${code}`} className="mb-1 block text-sm font-bold">الاسم (إنجليزي)</label><input id={`label_en_${code}`} name={`label_en_${code}`} dir="ltr" defaultValue={z?.label_en ?? "Shipping"} className={input} /></div>
              <div><label htmlFor={`price_${code}`} className="mb-1 block text-sm font-bold">السعر (درهم)</label><input id={`price_${code}`} name={`price_${code}`} type="number" step="0.01" dir="ltr" defaultValue={z ? fromMinor(z.price_minor) : ""} className={input} /></div>
              <div><label htmlFor={`free_${code}`} className="mb-1 block text-sm font-bold">شحن مجاني فوق</label><input id={`free_${code}`} name={`free_${code}`} type="number" step="0.01" dir="ltr" defaultValue={z?.free_over_minor ? fromMinor(z.free_over_minor) : ""} className={input} /></div>
              <div><label htmlFor={`min_${code}`} className="mb-1 block text-sm font-bold">أقل مدة (أيام)</label><input id={`min_${code}`} name={`min_${code}`} type="number" dir="ltr" defaultValue={z?.min_days ?? ""} className={input} /></div>
              <div><label htmlFor={`max_${code}`} className="mb-1 block text-sm font-bold">أقصى مدة (أيام)</label><input id={`max_${code}`} name={`max_${code}`} type="number" dir="ltr" defaultValue={z?.max_days ?? ""} className={input} /></div>
            </div>
          </fieldset>
        );
      })}
      <button className="min-h-12 rounded-full bg-mauve px-10 text-white hover:bg-[#6f4353]">حفظ</button>
    </form>
  );
}
