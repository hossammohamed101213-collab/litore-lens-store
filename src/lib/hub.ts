import { db, fromMinor, getSetting } from "@/lib/db";
import { daysSince } from "@/lib/backup";

/** Live numbers shown on the admin control-center cards. Everything is read straight from the database. */
export function hubStats() {
  const c = db();
  const n = (sql: string, ...p: unknown[]) => (c.prepare(sql).get(...p) as { n: number }).n ?? 0;
  const last = c.prepare("SELECT action, detail, created_at FROM admin_log ORDER BY id DESC LIMIT 1").get() as { action: string; detail: string; created_at: string } | undefined;
  const admin = c.prepare("SELECT email FROM admins LIMIT 1").get() as { email: string } | undefined;
  return {
    unread: n("SELECT COUNT(*) n FROM notifications WHERE is_read = 0"),
    notifTotal: n("SELECT COUNT(*) n FROM notifications"),
    newOrders: n("SELECT COUNT(*) n FROM orders WHERE status = 'new'"),
    orders: n("SELECT COUNT(*) n FROM orders"),
    revenue: fromMinor(n("SELECT COALESCE(SUM(total_minor),0) n FROM orders WHERE payment_status = 'paid' AND status != 'cancelled'")),
    products: n("SELECT COUNT(*) n FROM products WHERE status != 'archived'"),
    lowStock: n("SELECT COUNT(*) n FROM variants v JOIN products p ON p.id = v.product_id WHERE v.stock <= 3 AND p.status != 'archived'"),
    returnsNew: n("SELECT COUNT(*) n FROM returns WHERE status = 'requested'"),
    returnsAll: n("SELECT COUNT(*) n FROM returns"),
    coupons: n("SELECT COUNT(*) n FROM coupons WHERE active = 1"),
    zones: n("SELECT COUNT(*) n FROM shipping_zones WHERE active = 1"),
    promos: n("SELECT COUNT(*) n FROM promos WHERE active = 1"),
    feedbackNew: n("SELECT COUNT(*) n FROM feedback WHERE status = 'new'"),
    feedbackAll: n("SELECT COUNT(*) n FROM feedback"),
    customers: n("SELECT COUNT(*) n FROM customers"),
    customersWeek: n("SELECT COUNT(*) n FROM customers WHERE created_at >= datetime('now','-7 days')"),
    redeemPending: n("SELECT COUNT(*) n FROM redemptions WHERE status = 'pending'"),
    referrals: n("SELECT COUNT(*) n FROM referrals"),
    affPending: n("SELECT COUNT(*) n FROM affiliates WHERE status = 'pending'"),
    affAll: n("SELECT COUNT(*) n FROM affiliates"),
    resetsPending: n("SELECT COUNT(*) n FROM password_resets WHERE status IN ('pending','sent')"),
    lastAction: last ? { action: last.action, at: last.created_at } : null,
    backupDays: daysSince(getSetting("last_backup_at", "")),
    adminEmail: admin?.email ?? "",
  };
}
export type HubStats = ReturnType<typeof hubStats>;
