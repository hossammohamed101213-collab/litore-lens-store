import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/session";
import { adminLogout } from "../actions";

export const dynamic = "force-dynamic";

const nav = [
  ["/admin", "الرئيسية"],
  ["/admin/products", "المنتجات"],
  ["/admin/orders", "الطلبات"],
  ["/admin/coupons", "الكوبونات"],
  ["/admin/shipping", "الشحن"],
  ["/admin/ticker", "الشريط المتحرك"],
  ["/admin/feedback", "الآراء والشكاوى"],
  ["/admin/settings", "الضريبة"],
  ["/admin/account", "حسابي"],
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <div className="min-h-dvh">
      <header className="border-b border-gold/40 bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav aria-label="لوحة التحكم" className="flex flex-wrap gap-1">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm hover:bg-blush/40">{label}</Link>
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
