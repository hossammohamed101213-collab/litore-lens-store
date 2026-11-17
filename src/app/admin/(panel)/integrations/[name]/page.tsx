import { notFound } from "next/navigation";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { getSetting } from "@/lib/db";
import { hasSecret } from "@/lib/secrets";
import { saveAramex, saveManualCarrier, saveQuiqup, saveSender, savePayments, testTelr, savePaymennt, testPaymennt, saveZiina, testZiina } from "../../../integrations-actions";
import { Flash, PageTitle, inputCls, panelCls, saveCls } from "../../CardGrid";

export default async function IntegrationPage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ saved?: string; msg?: string; error?: string }> }) {
  const { name } = await params; const { saved, msg, error } = await searchParams;
  const flash = <Flash saved={saved} msg={msg} error={error} />;
  const lab = (id: string, text: string, el: React.ReactNode) => <div><label htmlFor={id} className="mb-1 block text-sm font-bold">{text}</label>{el}</div>;

  if (name === "telr") {
    const enabled = getSetting("pay_telr_enabled") === "1"; const live = getSetting("pay_telr_mode", "test") === "live";
    return (
      <>
        <PageTitle icon="💳" title="الدفع الإلكتروني (Telr)" sub="بعد فتح حساب Telr بالرخصة التجارية ستجدين Store ID وAuth Key في لوحة Telr. اكتبيهما هنا فقط (لا ترسليهما في أي شات). تُحفظ مشفّرة على السيرفر. Apple Pay وSamsung Pay تُفعَّلان من حساب Telr نفسه." />
        {flash}
        <p className="mb-4 max-w-xl rounded-xl bg-blush/30 p-4 text-sm">الدفع الإلكتروني الآن: <b>{enabled ? (live ? "مفعّل — دفع حقيقي" : "مفعّل — وضع تجربة (لا يخصم فلوس)") : "غير مفعّل"}</b>. لو الدفع الإلكتروني مقفول المتجر لا يقبل طلبات.</p>
        <form action={savePayments} className={panelCls}>
          <div className="grid gap-3 sm:grid-cols-2">
            {lab("store", "Store ID", <input id="store" name="store" dir="ltr" defaultValue={getSetting("pay_telr_store")} className={inputCls} autoComplete="off" />)}
            {lab("key", `Auth Key${hasSecret("pay_telr_key") ? " (محفوظ — اتركيه فارغًا للإبقاء عليه)" : ""}`, <PasswordInput id="key" name="key" autoComplete="new-password" className={inputCls} />)}
            {lab("mode", "الوضع", <select id="mode" name="mode" defaultValue={live ? "live" : "test"} className={inputCls}><option value="test">تجربة (بدون خصم فلوس)</option><option value="live">حقيقي (يخصم من العميلة)</option></select>)}
          </div>
          <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" name="enabled" defaultChecked={enabled} /> فعّلي الدفع الإلكتروني في المتجر</label>
          <button className={saveCls}>حفظ</button>
        </form>
        <form action={testTelr} className="mt-4"><button className="min-h-11 rounded-full border border-mauve px-6 hover:bg-blush/40">اختبار الاتصال (لا يخصم فلوس)</button></form>
        <p className="mt-3 max-w-xl text-sm leading-6">قبل التشغيل الحقيقي: اعملي طلب تجربة بوضع «تجربة» وتأكدي أنه يظهر «مدفوع»، ثم حوّلي الوضع إلى «حقيقي».</p>
      </>
    );
  }
  if (name === "paymennt") {
    const enabled = getSetting("pay_paymennt_enabled") === "1";
    const live = getSetting("pay_paymennt_mode", "test") === "live";
    return (
      <>
        <PageTitle icon="\uD83D\uDCB3" title="Paymennt" sub="\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0628\u0648\u0627\u0628\u0629 Paymennt (PointCheckout)" />
        {flash}
        <form action={savePaymennt} className={panelCls}>
          <div className="grid gap-3 sm:grid-cols-2">
            {lab("key", "API Key", <PasswordInput id="key" name="key" autoComplete="off" className={inputCls} />)}
            {lab("secret", "API Secret", <PasswordInput id="secret" name="secret" autoComplete="off" className={inputCls} />)}
            {lab("whsec", "Webhook Secret", <PasswordInput id="whsec" name="whsec" autoComplete="off" className={inputCls} />)}
            {lab("mode", "\u0627\u0644\u0648\u0636\u0639", <select id="mode" name="mode" defaultValue={live ? "live" : "test"} className={inputCls}><option value="test">\u062A\u062C\u0631\u064A\u0628\u064A</option><option value="live">\u062D\u064A (Live)</option></select>)}
          </div>
          <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" name="enabled" defaultChecked={enabled} value="1" /> \u062A\u0641\u0639\u064A\u0644</label>
          <button className={saveCls}>\u062D\u0641\u0638</button>
        </form>
        <form action={testPaymennt} className="mt-4"><button className="min-h-11 rounded-full border border-mauve px-6 hover:bg-blush/40">\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644</button></form>
      </>
    );
  }
  if (name === "ziina") {
    const enabled = getSetting("pay_ziina_enabled") === "1";
    const live = getSetting("pay_ziina_mode", "test") === "live";
    return (
      <>
        <PageTitle icon="\uD83D\uDCB3" title="Ziina" sub="\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0628\u0648\u0627\u0628\u0629 Ziina" />
        {flash}
        <form action={saveZiina} className={panelCls}>
          <div className="grid gap-3 sm:grid-cols-2">
            {lab("key", "API Key", <PasswordInput id="key" name="key" autoComplete="off" className={inputCls} />)}
            {lab("whsec", "Webhook Secret", <PasswordInput id="whsec" name="whsec" autoComplete="off" className={inputCls} />)}
            {lab("mode", "\u0627\u0644\u0648\u0636\u0639", <select id="mode" name="mode" defaultValue={live ? "live" : "test"} className={inputCls}><option value="test">\u062A\u062C\u0631\u064A\u0628\u064A</option><option value="live">\u062D\u064A (Live)</option></select>)}
          </div>
          <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" name="enabled" defaultChecked={enabled} value="1" /> \u062A\u0641\u0639\u064A\u0644</label>
          <button className={saveCls}>\u062D\u0641\u0638</button>
        </form>
        <form action={testZiina} className="mt-4"><button className="min-h-11 rounded-full border border-mauve px-6 hover:bg-blush/40">\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644</button></form>
      </>
    );
  }
  if (name === "aramex") {
    const f: [string, string, boolean][] = [["car_aramex_user", "Username (إيميل الحساب)", false], ["car_aramex_pass", "Password", true], ["car_aramex_acct", "Account Number", false], ["car_aramex_pin", "Account PIN", true], ["car_aramex_entity", "Account Entity (مثل DXB)", false], ["car_aramex_country", "رمز الدولة (AE)", false]];
    return (
      <>
        <PageTitle icon="📦" title="Aramex" sub="فعّلي Aramex واكتبي بيانات حسابك. في صفحة كل طلب سيظهر زر «اشحن الآن». المفاتيح تُحفظ مشفّرة على السيرفر." />
        {flash}
        <form action={saveAramex} className={panelCls}>
          <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" name="car_aramex_enabled" defaultChecked={getSetting("car_aramex_enabled") === "1"} /> مفعّل</label>
          <div className="grid gap-3 sm:grid-cols-2">
            {f.map(([k, l, secret]) => lab(k, `${l}${secret && hasSecret(k) ? " (محفوظ)" : ""}`, secret
              ? <PasswordInput id={k} name={k} autoComplete="new-password" className={inputCls} />
              : <input id={k} name={k} dir="ltr" autoComplete="off" defaultValue={getSetting(k, k === "car_aramex_country" ? "AE" : "")} className={inputCls} />))}
            {lab("car_aramex_mode", "الوضع", <select id="car_aramex_mode" name="car_aramex_mode" defaultValue={getSetting("car_aramex_mode", "test")} className={inputCls}><option value="test">تجربة</option><option value="live">حقيقي</option></select>)}
          </div>
          <button className={saveCls}>حفظ</button>
        </form>
      </>
    );
  }
  if (name === "quiqup") {
    const live = getSetting("car_quiqup_mode", "test") === "live";
    return (
      <>
        <PageTitle icon="🛵" title="Quiqup" sub="الربط تلقائي: في صفحة الطلب تضغطين «اشحن الآن» فتُنشأ الشحنة عند Quiqup ويصلك الملصق ورقم التتبع. المفتاح تعملينه بنفسك من لوحة Quiqup، ويُحفظ هنا مشفّرًا." />
        {flash}
        <p className="mb-4 max-w-xl rounded-xl bg-blush/30 p-4 text-sm">الحالة الآن: <b>{getSetting("car_quiqup_enabled") === "1" ? (live ? "مفعّل — شحن حقيقي" : "مفعّل — وضع تجربة (لا يُرسل مندوب)") : "غير مفعّل — تسجيل رقم التتبع يدويًا"}</b></p>
        <form action={saveQuiqup} className={panelCls}>
          <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" name="enabled" defaultChecked={getSetting("car_quiqup_enabled") === "1"} /> مفعّل</label>
          <div className="grid gap-3 sm:grid-cols-2">
            {lab("key", `API Key${hasSecret("car_quiqup_key") ? " (محفوظ — اتركيه فارغًا للإبقاء عليه)" : ""}`, <PasswordInput id="key" name="key" autoComplete="new-password" className={inputCls} />)}
            {lab("mode", "الوضع", <select id="mode" name="mode" defaultValue={live ? "live" : "test"} className={inputCls}><option value="test">تجربة (لا يُرسل مندوب)</option><option value="live">حقيقي (يُرسل مندوب)</option></select>)}
            {lab("kind", "نوع التوصيل", <select id="kind" name="kind" defaultValue={getSetting("car_quiqup_kind", "partner_next_day")} className={inputCls}><option value="partner_next_day">اليوم التالي (Next Day)</option><option value="partner_same_day">نفس اليوم (Same Day)</option></select>)}
            {lab("whsec", `Webhook secret (اختياري)${hasSecret("car_quiqup_whsec") ? " (محفوظ)" : ""}`, <PasswordInput id="whsec" name="whsec" autoComplete="new-password" className={inputCls} />)}
          </div>
          <button className={saveCls}>حفظ</button>
        </form>
        <div className="mt-4 max-w-xl space-y-1 text-sm leading-7">
          <p><b>للتحديث التلقائي لحالة التسليم:</b> في لوحة Quiqup افتحي Integrations ← Webhooks ← New subscription، واكتبي الرابط:</p>
          <p dir="ltr" className="rounded-xl bg-blush/30 p-3 text-start font-mono text-xs">https://litore.store/api/webhooks/quiqup</p>
          <p>ثم انسخي الـ secret الذي تعرضه Quiqup وضعيه في خانة Webhook secret أعلاه.</p>
          <p>وضع «تجربة» يعمل على موقع Quiqup التجريبي بمفتاح تجريبي. وضع «حقيقي» يحتاج مفتاحًا من لوحة Quiqup الحقيقية.</p>
        </div>
      </>
    );
  }
  if (name === "emx") {
    const n = "EMX / البريد الإماراتي";
    return (
      <>
        <PageTitle icon="📮" title={n} sub="تسجيل رقم التتبع يدويًا حاليًا: عند «اشحن الآن» في صفحة الطلب تكتبين رقم الشحنة ويصل للعميلة." />
        {flash}
        <form action={saveManualCarrier} className={panelCls}>
          <input type="hidden" name="carrier" value={name} />
          <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" name="enabled" defaultChecked={getSetting(`car_${name}_enabled`) === "1"} /> مفعّل</label>
          {lab("track", "رابط التتبع (اختياري)", <input id="track" name="track" dir="ltr" placeholder="https://.../track?n={n}" defaultValue={getSetting(`car_${name}_track`)} className={inputCls} />)}
          <p className="text-sm leading-6">ضعي {"{n}"} مكان رقم الشحنة في الرابط، ويظهر للعميلة زر تتبع مباشر.</p>
          <button className={saveCls}>حفظ</button>
        </form>
      </>
    );
  }
  if (name === "sender") {
    const f: [string, string][] = [["ship_name", "اسم المتجر"], ["ship_phone", "تليفون الاستلام"], ["ship_email", "إيميل"], ["ship_line1", "عنوان الاستلام"], ["ship_city", "المدينة"]];
    return (
      <>
        <PageTitle icon="🏬" title="بيانات المرسل (متجرك)" sub="هذا عنوان الاستلام الذي تستخدمه شركات الشحن عند إنشاء الشحنة." />
        {flash}
        <form action={saveSender} className={panelCls}>
          <div className="grid gap-3 sm:grid-cols-2">{f.map(([k, l]) => lab(k, l, <input key={k} id={k} name={k} defaultValue={getSetting(k)} className={inputCls} />))}</div>
          <button className={saveCls}>حفظ</button>
        </form>
      </>
    );
  }
  notFound();
}
