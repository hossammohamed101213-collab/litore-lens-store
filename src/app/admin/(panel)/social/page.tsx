import { getSetting } from "@/lib/db";
import { AdminCard, CardGrid, PageTitle } from "../CardGrid";

const SOCIAL: [string, string, string][] = [["whatsapp", "💬", "واتساب"], ["tiktok", "🎵", "تيك توك"], ["instagram", "📸", "إنستجرام"]];

export default function SocialHub() {
  return (
    <>
      <PageTitle icon="📱" title="السوشيال ميديا" sub="أيقونات التواصل أسفل الموقع. الأيقونة بدون رابط تظهر عادي ولا تفتح شيئًا." />
      <CardGrid>
        {SOCIAL.map(([k, icon, name], i) => {
          const v = getSetting("social_" + k, "");
          return <AdminCard key={k} tone={i + 2} href={`/admin/social/${k}`} icon={icon} title={name} sub={v ? v.replace(/^https?:\/\//, "").slice(0, 38) : k === "whatsapp" ? "فارغ: يستخدم رقم المتجر" : "لم يُضف رابط"} status={v ? "الرابط مضاف" : "بدون رابط"} on={!!v} />;
        })}
      </CardGrid>
    </>
  );
}
