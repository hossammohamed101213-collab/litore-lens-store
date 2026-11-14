import { PasswordInput } from "@/components/ui/PasswordInput";
import { getSetting } from "@/lib/db";
import { hasSecret } from "@/lib/secrets";
import { savePayments, testTelr } from "../../integrations-actions";

const input = "min-h-11 w-full rounded-xl border border-gold/50 bg-surface px-3";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ saved?: string; msg?: string }> }) {
  const { saved, msg } = await searchParams;
  const enabled = getSetting("pay_telr_enabled") === "1";
  const live = getSetting("pay_telr_mode", "test") === "live";
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">الدفع الإلكتروني</h1>
      {saved && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تم الحفظ.</p>}
      {msg && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">{msg}</p>}
      <p className="rounded-xl bg-blush/30 p-4 text-sm">
        الحالة الآن: <b>{enabled ? (live ? "مفعّل — دفع حقيقي" : "مفعّل — وضع تجربة (لا يخصم فلوس)") : "غير مفعّل — الدفع عند الاستلام"}</b>
      </p>
      <form action={savePayments} className="space-y-4 rounded-card border border-gold/40 bg-surface p-5">
        <h2 className="font-bold">Telr (فيزا · ماستر كارد · Apple Pay · Samsung Pay)</h2>
        <p className="text-sm">بعد فتح حساب Telr بالرخصة التجارية ستجد الرقمين من لوحة Telr: <b>Store ID</b> و <b>Auth Key</b>. اكتبهما هنا (لا ترسلهما في أي شات). تُحفظ المفاتيح مشفّرة على السيرفر. طرق الدفع (Apple Pay وSamsung Pay) تُفعّلها من حساب Telr نفسه.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="store" className="mb-1 block text-sm font-bold">Store ID</label><input id="store" name="store" dir="ltr" defaultValue={getSetting("pay_telr_store")} className={input} autoComplete="off" /></div>
          <div><label htmlFor="key" className="mb-1 block text-sm font-bold">Auth Key {hasSecret("pay_telr_key") && <span className="text-xs font-normal">(محفوظ — اتركه فارغًا للإبقاء عليه)</span>}</label><PasswordInput id="key" name="key" autoComplete="new-password" className={input} /></div>
          <div>
            <label htmlFor="mode" className="mb-1 block text-sm font-bold">الوضع</label>
            <select id="mode" name="mode" defaultValue={live ? "live" : "test"} className={input}>
              <option value="test">تجربة (بدون خصم فلوس)</option>
              <option value="live">حقيقي (يخصم من العميلة)</option>
            </select>
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" name="enabled" defaultChecked={enabled} /> فعّل الدفع الإلكتروني في المتجر</label>
        <button className="min-h-12 rounded-full bg-mauve px-10 text-white hover:bg-[#6f4353]">حفظ</button>
      </form>
      <form action={testTelr}>
        <button className="min-h-11 rounded-full border border-mauve px-6">اختبار الاتصال (لا يخصم فلوس)</button>
      </form>
      <p className="text-sm">قبل التشغيل الحقيقي: اعمل طلب تجربة بوضع «تجربة» وتأكد أنه يظهر «مدفوع»، ثم حوّل الوضع إلى «حقيقي».</p>
    </div>
  );
}
