"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const SETTINGS_TABS: [string, string, string][] = [
  ["/admin/settings", "⚙️", "عام (الضريبة والتواصل والخلفية)"],
  ["/admin/payments", "💳", "الدفع"],
  ["/admin/shipping", "🚚", "الشحن"],
  ["/admin/ticker", "✨", "الشريط المتحرك"],
  ["/admin/account", "🔑", "كلمة السر والحساب"],
  ["/admin/backup", "💾", "النسخ الاحتياطي"],
  ["/admin/activity", "📜", "سجل النشاط"],
];

/** One "الإعدادات" section: every store-editing page shows these tabs on top. */
export function SettingsNav() {
  const path = usePathname();
  if (!SETTINGS_TABS.some(([href]) => path === href || path.startsWith(href + "/"))) return null;
  return (
    <nav aria-label="الإعدادات" className="mx-auto max-w-6xl px-4 pt-4">
      <p className="mb-2 font-display text-2xl font-semibold">⚙️ الإعدادات</p>
      <ul className="flex flex-wrap gap-2">
        {SETTINGS_TABS.map(([href, icon, label]) => {
          const on = path === href || path.startsWith(href + "/");
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold ${on ? "border-mauve bg-mauve text-white" : "border-gold/60 bg-white/80 hover:bg-blush/50"}`}>
                <span aria-hidden="true">{icon}</span>{label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
