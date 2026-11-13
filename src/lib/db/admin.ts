import { db, fromMinor } from "@/lib/db";
import { mapOrder } from "@/lib/commerce/db-provider";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/commerce/types";

export function dashboardStats() {
  const c = db();
  const one = (sql: string) => (c.prepare(sql).get() as { n: number }).n;
  return {
    products: one("SELECT COUNT(*) n FROM products WHERE status != 'archived'"),
    newOrders: one("SELECT COUNT(*) n FROM orders WHERE status = 'new'"),
    orders: one("SELECT COUNT(*) n FROM orders"),
    customers: one("SELECT COUNT(*) n FROM customers"),
    lowStock: c.prepare(`SELECT COALESCE(NULLIF(p.name_en,''), p.name_ar) name, v.sku, v.stock FROM variants v JOIN products p ON p.id = v.product_id
      WHERE v.stock <= 3 AND p.status != 'archived' ORDER BY v.stock LIMIT 10`).all() as { name: string; sku: string; stock: number }[],
    revenue: fromMinor(one("SELECT COALESCE(SUM(total_minor),0) n FROM orders WHERE payment_status = 'paid' AND status != 'cancelled'")),
  };
}

export type AdminProductRow = {
  id: string; slug: string; name_ar: string; name_en: string; diameter: string | null; status: string; price_minor: number; stock: number; is_sample: number;
};
export function listProductsAdmin(): AdminProductRow[] {
  return db().prepare(`SELECT p.id,p.slug,p.name_ar,p.name_en,p.diameter,p.status,p.price_minor,p.is_sample,
    COALESCE((SELECT SUM(stock) FROM variants WHERE product_id = p.id),0) stock FROM products p ORDER BY p.rowid ASC`).all() as AdminProductRow[];
}

export function getProductAdmin(id: string) {
  const c = db();
  const product = c.prepare("SELECT * FROM products WHERE id = ?").get(id) as Record<string, string | number | null> | undefined;
  if (!product) return null;
  const variants = c.prepare("SELECT * FROM variants WHERE product_id = ? ORDER BY rowid").all(id) as Record<string, string | number | null>[];
  return { product, variants };
}

export type AdminOrderRow = Order & { email: string; phone: string; address: Record<string, string>; couponCode: string | null };

export function listOrdersAdmin(status?: string) {
  const rows = (status
    ? db().prepare("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 200").all(status)
    : db().prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200").all()) as (Parameters<typeof mapOrder>[0] & { email: string })[];
  return rows.map((r) => ({ ...mapOrder(r), email: r.email }));
}

export function getOrderAdmin(id: string): AdminOrderRow | null {
  const row = db().prepare("SELECT * FROM orders WHERE id = ?").get(id) as
    | (Parameters<typeof mapOrder>[0] & { email: string; phone: string; address_json: string; coupon_code: string | null }) | undefined;
  if (!row) return null;
  return { ...mapOrder(row), email: row.email, phone: row.phone, address: JSON.parse(row.address_json), couponCode: row.coupon_code };
}

/** Changes status (and optionally payment status); cancelling returns the stock. A cancelled order cannot be re-opened. */
export function setOrderStatus(id: string, status: OrderStatus, tracking: string | null, payment?: PaymentStatus): "ok" | "locked" | "not_found" {
  const c = db();
  const cur = c.prepare("SELECT status FROM orders WHERE id = ?").get(id) as { status: OrderStatus } | undefined;
  if (!cur) return "not_found";
  if (cur.status === "cancelled" && status !== "cancelled") return "locked";
  c.transaction(() => {
    if (status === "cancelled" && cur.status !== "cancelled") {
      const lines = c.prepare("SELECT variant_id, quantity FROM order_lines WHERE order_id = ?").all(id) as { variant_id: string; quantity: number }[];
      const up = c.prepare("UPDATE variants SET stock = stock + ? WHERE id = ?");
      for (const l of lines) up.run(l.quantity, l.variant_id);
    }
    c.prepare("UPDATE orders SET status = ?, tracking_number = ? WHERE id = ?").run(status, tracking || null, id);
    if (payment) c.prepare("UPDATE orders SET payment_status = ? WHERE id = ?").run(payment, id);
  })();
  return "ok";
}
