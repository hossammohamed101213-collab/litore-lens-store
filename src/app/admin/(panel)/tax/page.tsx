import { getSetting } from "@/lib/db";
import { AdminCard, CardGrid, PageTitle } from "../CardGrid";

export default function TaxHub() {
  const rate = Number(getSetting("tax_rate", "0")) || 0;
  return (
    <>
      <PageTitle icon="🧾" title="الضريبة والقانونية" />
      <CardGrid>
        <AdminCard tone={1} href="/admin/tax/rate" icon="💰" title="نسبة الضريبة" sub="النسبة وهل الأسعار شاملة." status={rate ? `${rate}%` : "غير مفعّلة"} on={rate > 0} />
        <AdminCard tone={2} href="/admin/tax/legal" icon="📄" title="الصفحات القانونية" sub="الشروط والخصوصية والإرجاع والشحن والشكاوى." />
      </CardGrid>
    </>
  );
}
