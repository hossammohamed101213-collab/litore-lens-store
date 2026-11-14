import { db, fromMinor } from "@/lib/db";
import { saveShipping } from "../../actions";
import { saveCarriers } from "../../integrations-actions";
import { getSetting } from "@/lib/db";
import { hasSecret } from "@/lib/secrets";

type Z = { country: string; label_ar: string; label_en: string; price_minor: number; free_over_minor: number | null; min_days: number | null; max_days: number | null; active: number };
const countries: [string, string][] = [["AE", "الإمارات"], ["SA", "السعودية"], ["KW", "الكويت"], ["QA", "قطر"], ["BH", "البحرين"], ["OM", "عُمان"]];
const input = "min-h-11 w-full rounded-xl border border-gold/50 bg-surface px-3";

export default async function ShippingPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const zones = new Map((db().prepare("SELECT * FROM shipping_zones").all() as Z[]).map((z) => [z.country, z]));
  return (
    <div className="space-y-10">
    <form action={saveShipping} className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">الشحن</h1>
      <p className="text-sm">فعّل الدول التي تشحن لها وحدد السعر. الدولة غير المفعّلة لن يظهر لها شحن عند الدفع.</p>
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
      <button className="min-h-12 rounded-full bg-mauve px-10 text-white hover:bg-[#6f4353]">حفظ أسعار الشحن</button>
    </form>
      <form action={saveCarriers} className="space-y-6">
        <h2 className="font-display text-2xl font-semibold">ربط شركات الشحن</h2>
        <p className="text-sm">فعّل الشركة التي ستشحن بها واكتب بياناتها. في صفحة كل طلب سيظهر زر «اشحن الآن». المفاتيح تُحفظ مشفّرة على السيرفر.</p>
        <fieldset className="space-y-3 rounded-card border border-gold/40 bg-surface p-5">
          <legend className="px-1 font-bold">بيانات المرسل (متجرك)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {([["ship_name", "اسم المتجر"], ["ship_phone", "تليفون الاستلام"], ["ship_email", "إيميل"], ["ship_line1", "عنوان الاستلام"], ["ship_city", "المدينة"]] as const).map(([k, l]) => (
              <div key={k}><label htmlFor={k} className="mb-1 block text-sm font-bold">{l}</label><input id={k} name={k} defaultValue={getSetting(k)} className={input} /></div>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-3 rounded-card border border-gold/40 bg-surface p-5">
          <legend className="px-1 font-bold">Aramex (ربط مباشر)</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" name="car_aramex_enabled" defaultChecked={getSetting("car_aramex_enabled") === "1"} /> مفعّل</label>
          <div className="grid gap-3 sm:grid-cols-3">
            {([["car_aramex_user", "Username (إيميل الحساب)", false], ["car_aramex_pass", "Password", true], ["car_aramex_acct", "Account Number", false], ["car_aramex_pin", "Account PIN", true], ["car_aramex_entity", "Account Entity (مثل DXB)", false], ["car_aramex_country", "رمز الدولة (AE)", false]] as const).map(([k, l, secret]) => (
              <div key={k}><label htmlFor={k} className="mb-1 block text-sm font-bold">{l}{secret && hasSecret(k) && <span className="text-xs font-normal"> (محفوظ)</span>}</label>
                <input id={k} name={k} dir="ltr" type={secret ? "password" : "text"} autoComplete="off" defaultValue={secret ? "" : getSetting(k, k === "car_aramex_country" ? "AE" : "")} className={input} /></div>
            ))}
            <div><label htmlFor="car_aramex_mode" className="mb-1 block text-sm font-bold">الوضع</label>
              <select id="car_aramex_mode" name="car_aramex_mode" defaultValue={getSetting("car_aramex_mode", "test")} className={input}><option value="test">تجربة</option><option value="live">حقيقي</option></select></div>
          </div>
        </fieldset>
        <fieldset className="space-y-3 rounded-card border border-gold/40 bg-surface p-5">
          <legend className="px-1 font-bold">سعر الشحن التلقائي</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" name="car_auto_rates" defaultChecked={getSetting("car_auto_rates") === "1"} /> احسب سعر الشحن تلقائيًا من Aramex لكل عميلة حسب عنوانها</label>
          <p className="text-sm">لما تفعّلها، سعر الشحن عند الدفع يتحسب لوحده من Aramex، ومش محتاج تكتب الأسعار. السعر اللي كتبته فوق لكل دولة يفضل كاحتياطي لو Aramex ما ردّش، فاكتب لكل دولة سعرًا احتياطيًا مرة واحدة (لو سبته صفر هيبقى الشحن مجاني وقت العطل). الدول غير المفعّلة فوق مش بتظهر. «شحن مجاني فوق» لسه بيشتغل.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="car_pack_weight" className="mb-1 block text-sm font-bold">وزن الطرد التقريبي (كجم)</label><input id="car_pack_weight" name="car_pack_weight" type="number" step="0.1" dir="ltr" defaultValue={getSetting("car_pack_weight", "0.3")} className={input} /></div>
            <div><label htmlFor="car_rate_markup" className="mb-1 block text-sm font-bold">إضافة على السعر % (تغطية التغليف، اختياري)</label><input id="car_rate_markup" name="car_rate_markup" type="number" step="1" min="0" dir="ltr" defaultValue={getSetting("car_rate_markup", "0")} className={input} /></div>
          </div>
        </fieldset>
        {([["quiqup", "Quiqup"], ["emx", "EMX / البريد الإماراتي"]] as const).map(([c, n]) => (
          <fieldset key={c} className="space-y-3 rounded-card border border-gold/40 bg-surface p-5">
            <legend className="px-1 font-bold">{n} (برقم التتبع حاليًا)</legend>
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" name={`car_${c}_enabled`} defaultChecked={getSetting(`car_${c}_enabled`) === "1"} /> مفعّل</label>
            <div><label htmlFor={`car_${c}_track`} className="mb-1 block text-sm font-bold">رابط التتبع (اختياري، ضع {"{n}"} مكان رقم الشحنة)</label><input id={`car_${c}_track`} name={`car_${c}_track`} dir="ltr" defaultValue={getSetting(`car_${c}_track`)} className={input} /></div>
          </fieldset>
        ))}
        <button className="min-h-12 rounded-full bg-mauve px-10 text-white hover:bg-[#6f4353]">حفظ ربط الشحن</button>
      </form>
    </div>
  );
}
