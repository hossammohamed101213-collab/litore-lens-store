import { getSetting } from "@/lib/db";
import { hasSecret } from "@/lib/secrets";
import { AdminCard, CardGrid, PageTitle } from "../CardGrid";

export default function IntegrationsHub() {
  const telr = getSetting("pay_telr_enabled") === "1"; const live = getSetting("pay_telr_mode", "test") === "live";
  const st = (c: string) => getSetting(`car_${c}_enabled`) === "1";
  const sender = !!getSetting("ship_line1") && !!getSetting("ship_phone");
  return (
    <>
      <PageTitle icon="🔗" title="الربط" sub="ربط المتجر بالدفع الإلكتروني وشركات الشحن. اضغطي على الخدمة لإدخال بياناتها وتفعيلها." />
      <CardGrid>
        <AdminCard tone={0} href="/admin/integrations/telr" icon="💳" title="الدفع الإلكتروني (Telr)" sub="فيزا · ماستر كارد · Apple Pay · Samsung Pay." status={telr ? (live ? "مفعّل · حقيقي" : "مفعّل · تجربة") : "غير مفعّل"} on={telr} />
        <AdminCard tone={2} href="/admin/integrations/aramex" icon="📦" title="Aramex" sub="إنشاء الشحنة وطباعة الملصق تلقائيًا." status={st("aramex") ? (hasSecret("car_aramex_pass") ? "مفعّل" : "ينقصه كلمة السر") : "غير مفعّل"} on={st("aramex") && hasSecret("car_aramex_pass")} />
        <AdminCard tone={3} href="/admin/integrations/quiqup" icon="🛵" title="Quiqup" sub="تسجيل رقم التتبع يدويًا حاليًا." status={st("quiqup") ? "مفعّل" : "غير مفعّل"} on={st("quiqup")} />
        <AdminCard tone={4} href="/admin/integrations/emx" icon="📮" title="EMX / البريد الإماراتي" sub="تسجيل رقم التتبع يدويًا." status={st("emx") ? "مفعّل" : "غير مفعّل"} on={st("emx")} />
        <AdminCard tone={1} href="/admin/integrations/sender" icon="🏬" title="بيانات المرسل (متجرك)" sub="عنوان وتليفون الاستلام الذي تستخدمه شركات الشحن." status={sender ? "مكتملة" : "ناقصة"} on={sender} />
      </CardGrid>
    </>
  );
}
