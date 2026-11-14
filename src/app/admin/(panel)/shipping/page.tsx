import { db, fromMinor, getSetting } from "@/lib/db";
import { AdminCard, CardGrid, PageTitle } from "../CardGrid";

type Z = { country: string; price_minor: number; free_over_minor: number | null; min_days: number | null; max_days: number | null; active: number };
export const dynamic = "force-dynamic";
const countries: [string, string, string][] = [["AE", "🇦🇪", "الإمارات"], ["SA", "🇸🇦", "السعودية"], ["KW", "🇰🇼", "الكويت"], ["QA", "🇶🇦", "قطر"], ["BH", "🇧🇭", "البحرين"], ["OM", "🇴🇲", "عُمان"]];

export default function ShippingHub() {
  const zones = new Map((db().prepare("SELECT * FROM shipping_zones").all() as Z[]).map((z) => [z.country, z]));
  const auto = getSetting("car_auto_rates") === "1";
  return (
    <>
      <PageTitle icon="🚚" title="الشحن" sub="اضغطي على الدولة لتعديل سعرها ومدتها وتفعيلها. الدولة غير المفعّلة لا يظهر لها شحن عند الدفع." />
      <CardGrid>
        {countries.map(([code, flag, name], i) => {
          const z = zones.get(code);
          const on = z?.active === 1;
          const days = z?.min_days != null && z?.max_days != null ? ` · ${z.min_days}-${z.max_days} أيام` : "";
          return <AdminCard key={code} tone={i} href={`/admin/shipping/${code}`} icon={flag} title={name} sub={z ? `${fromMinor(z.price_minor)} د.إ${days}${z.free_over_minor ? ` · مجاني فوق ${fromMinor(z.free_over_minor)}` : ""}` : "لم تُضبط بعد"} status={on ? "مفعّل" : "غير مفعّل"} on={on} />;
        })}
        <AdminCard tone={2} href="/admin/shipping/auto" icon="⚡" title="السعر التلقائي" sub="يحسب سعر الشحن من Aramex لكل عميلة حسب عنوانها." status={auto ? "مفعّل" : "غير مفعّل"} on={auto} />
      </CardGrid>
    </>
  );
}
