import { db, getSetting } from "@/lib/db";
import { AdminCard, CardGrid, PageTitle } from "../CardGrid";

export default function SettingsHub() {
  const zones = (db().prepare("SELECT COUNT(*) n FROM shipping_zones WHERE active = 1").get() as { n: number }).n;
  const rate = Number(getSetting("tax_rate", "0")) || 0;
  const social = ["whatsapp", "tiktok", "instagram"].filter((k) => getSetting("social_" + k, "")).length;
  const links = ["car_aramex_enabled", "car_quiqup_enabled", "car_emx_enabled", "pay_telr_enabled"].filter((k) => getSetting(k) === "1").length;
  const bg = !!getSetting("hero_bg", "");
  const backup = getSetting("last_backup_at", "");
  return (
    <>
      <PageTitle icon="⚙️" title="الإعدادات" sub="اضغطي على الخدمة اللي تريدين تعدّلينها. كل خدمة لوحدها." />
      <CardGrid>
        <AdminCard tone={0} href="/admin/shipping" icon="🚚" title="الشحن" sub="الدول والأسعار والتفعيل ومدة التوصيل." status={zones ? (zones === 1 ? "دولة واحدة مفعّلة" : zones === 2 ? "دولتان مفعّلتان" : zones <= 10 ? `${zones} دول مفعّلة` : `${zones} دولة مفعّلة`) : "لا دولة مفعّلة"} on={zones > 0} />
        <AdminCard tone={2} href="/admin/integrations" icon="🔗" title="الربط" sub="ربط الدفع الإلكتروني وشركات الشحن." status={links ? `${links} مفعّل` : "لا شيء مفعّل"} on={links > 0} />
        <AdminCard tone={1} href="/admin/tax" icon="🧾" title="الضريبة والقانونية" sub="نسبة الضريبة والصفحات القانونية." status={rate ? `ضريبة ${rate}%` : "بدون ضريبة"} on={rate > 0} />
        <AdminCard tone={3} href="/admin/background" icon="🖼️" title="خلفية الصفحة الرئيسية" sub="صورة شفافة خلف الصفحة الرئيسية." status={bg ? "صورة مرفوعة" : "لا توجد صورة"} on={bg} />
        <AdminCard tone={4} href="/admin/social" icon="📱" title="السوشيال ميديا" sub="أيقونات واتساب وتيك توك وإنستجرام أسفل الموقع." status={`${social} من 3 مضافة`} on={social > 0} />
        <AdminCard tone={0} href="/admin/ticker" icon="✨" title="الشريط المتحرك" sub="الجمل المتحركة أعلى الموقع." />
        <AdminCard tone={2} href="/admin/account" icon="🔑" title="كلمة السر والحساب" sub="تغيير كلمة سر لوحة التحكم." />
        <AdminCard tone={3} href="/admin/backup" icon="💾" title="النسخ الاحتياطي" sub="حمّلي نسخة من بيانات المتجر." status={backup ? "آخر نسخة محفوظة" : "لم تُحمّل نسخة بعد"} on={!!backup} />
        <AdminCard tone={1} href="/admin/activity" icon="📜" title="سجل النشاط" sub="من غيّر ماذا ومتى." />
      </CardGrid>
    </>
  );
}
