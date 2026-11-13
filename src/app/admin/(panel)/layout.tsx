import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/session";
import { unreadCount } from "@/lib/db/notify";
import { adminLogout } from "../actions";

export const dynamic = "force-dynamic";

const nav = [
  ["/admin", "الرئيسية"],
  ["/admin/notifications", "الإشعارات"],
  ["/admin/analytics", "الزيارات والتحليل"],
  ["/admin/returns", "المرتجعات"],
  ["/admin/products", "المنتجات"],
  ["/admin/orders", "الطلبات"],
  ["/admin/coupons", "الكوبونات"],
  ["/admin/shipping", "الشحن"],
  ["/admin/ticker", "الشريط المتحرك"],
  ["/admin/feedback", "الآراء والشكاوى"],
  ["/admin/customers", "العميلات"],
  ["/admin/referrals", "الإحالات"],
  ["/admin/affiliates", "المسوّقون"],
  ["/admin/resets", "استرجاع كلمة السر"],
  ["/admin/activity", "سجل النشاط"],
  ["/admin/settings", "الضريبة والتواصل"],
  ["/admin/account", "حسابي"],
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  const unread = unreadCount();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-gold/40 bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav aria-label="لوحة التحكم" className="flex flex-wrap gap-1">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm hover:bg-blush/40">{label}
                {href === "/admin/notifications" && unread > 0 && <span className="ms-2 rounded-full bg-mauve px-2 text-xs text-white" aria-label={`${unread} غير مقروء`}>{unread}</span>}
              </Link>
            ))}
          </nav>
          <form action={adminLogout} className="flex items-center gap-3 text-sm">
            <span dir="ltr">{admin.email}</span>
            <button className="min-h-11 rounded-full border border-mauve px-4 hover:bg-blush/40">خروج</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
