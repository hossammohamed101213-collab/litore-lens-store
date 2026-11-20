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
    // money really kept: paid orders minus what was given back (a fully refunded order counts as 0)
    revenue: fromMinor(one("SELECT COALESCE(SUM(total_minor - refund_minor),0) n FROM orders WHERE payment_status IN ('paid','refunded') AND status != 'cancelled'")),
    toShip: one("SELECT COUNT(*) n FROM orders WHERE payment_status = 'paid' AND status IN ('new','processing')"),
    awaitingPayment: one("SELECT COUNT(*) n FROM orders WHERE payment_status = 'pending' AND status != 'cancelled'"),
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

/** `view` narrows to what needs attention: "toship" = paid and not shipped yet, "unpaid" = waiting for payment. `q` searches order number, e-mail, phone and name. */
export function listOrdersAdmin(status?: string, q?: string, view?: string) {
  const where: string[] = []; const args: string[] = [];
  if (status) { where.push("status = ?"); args.push(status); }
  if (view === "toship") where.push("payment_status = 'paid' AND status IN ('new','processing')");
  if (view === "unpaid") where.push("payment_status = 'pending' AND status != 'cancelled'");
  if (view === "toprint") where.push("payment_status = 'paid' AND status != 'cancelled' AND printed_at IS NULL");
  const term = (q ?? "").trim().slice(0, 80);
  if (term) {
    const like = `%${term.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
    where.push("(id LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR address_json LIKE ? ESCAPE '\\' OR tracking_number LIKE ? ESCAPE '\\')");
    args.push(like, like, like, like, like);
  }
  const rows = db().prepare(`SELECT * FROM orders ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 200`).all(...args) as (Parameters<typeof mapOrder>[0] & { email: string; printed_at?: string | null })[];
  return rows.map((r) => ({ ...mapOrder(r), email: r.email, printed: !!r.printed_at }));
}

export function getOrderAdmin(id: string): AdminOrderRow | null {
  const row = db().prepare("SELECT * FROM orders WHERE id = ?").get(id) as
    | (Parameters<typeof mapOrder>[0] & { email: string; phone: string; address_json: string; coupon_code: string | null }) | undefined;
  if (!row) return null;
  return { ...mapOrder(row), email: row.email, phone: row.phone, address: JSON.parse(row.address_json), couponCode: row.coupon_code };
}

/**
 * A real order that took money (paid or refunded) is part of the financial records and is never deleted:
 * it is cancelled instead. Orders made only of sample products (demo / preview data) can still be removed.
 */
export function orderDeletable(o: { payment_status: string; is_mock: number }): boolean {
  return o.is_mock === 1 || (o.payment_status !== "paid" && o.payment_status !== "refunded");
}

const RANK: Record<string, number> = { new: 0, processing: 1, shipped: 2, delivered: 3 };

/**
 * Which status changes make sense. An order only moves forward (new -> processing -> shipped -> delivered);
 * it can be cancelled only while the goods are still with us (new / processing) — after that the way back is a
 * return, so stock and money are never touched by a wrong click. A cancelled order stays cancelled.
 */
export function statusChangeAllowed(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  if (from === "cancelled") return false;
  if (to === "cancelled") return from === "new" || from === "processing";
  return RANK[to] > RANK[from];
}

/** Changes status (and optionally payment status); cancelling returns the stock (and the coupon use of an unpaid order). A cancelled order cannot be re-opened. */
export function setOrderStatus(id: string, status: OrderStatus, tracking: string | null, payment?: PaymentStatus): "ok" | "locked" | "invalid" | "not_found" {
  const c = db();
  const cur = c.prepare("SELECT status, payment_status, coupon_code FROM orders WHERE id = ?").get(id) as
    | { status: OrderStatus; payment_status: PaymentStatus; coupon_code: string | null } | undefined;
  if (!cur) return "not_found";
  if (cur.status === "cancelled" && status !== "cancelled") return "locked";
  if (!statusChangeAllowed(cur.status, status)) return "invalid";
  // "refunded" is only for money that was really taken; refunds are recorded with recordRefund()
  if (payment === "refunded" && cur.payment_status !== "paid" && cur.payment_status !== "refunded") return "invalid";
  c.transaction(() => {
    if (status === "cancelled" && cur.status !== "cancelled") {
      const lines = c.prepare("SELECT variant_id, quantity FROM order_lines WHERE order_id = ?").all(id) as { variant_id: string; quantity: number }[];
      const up = c.prepare("UPDATE variants SET stock = stock + ? WHERE id = ?");
      for (const l of lines) up.run(l.quantity, l.variant_id);
      // An order that was never paid (declined / abandoned payment) gives its coupon use back,
      // so a one-time coupon is not lost on a failed payment. Paid orders keep the use.
      if (cur.coupon_code && cur.payment_status !== "paid" && cur.payment_status !== "refunded" && payment !== "paid" && payment !== "refunded") {
        c.prepare("UPDATE coupons SET used_count = MAX(0, used_count - 1) WHERE code = ?").run(cur.coupon_code);
      }
    }
    c.prepare("UPDATE orders SET status = ?, tracking_number = ? WHERE id = ?").run(status, tracking || null, id);
    if (status === "delivered" && cur.status !== "delivered") c.prepare("UPDATE orders SET delivered_at = COALESCE(delivered_at, datetime('now')) WHERE id = ?").run(id);
    if (payment) c.prepare("UPDATE orders SET payment_status = ? WHERE id = ?").run(payment, id);
  })();
  return "ok";
}

/**
 * Records money the owner gave back from the payment gateway's own dashboard (the store never moves money itself).
 * Never more than what was paid, never on an unpaid order, and the same amount can not be entered twice within a minute.
 */
export function recordRefund(id: string, amountMinor: number): "ok" | "not_found" | "not_paid" | "amount" | "duplicate" {
  const c = db();
  return c.transaction(() => {
    const o = c.prepare(`SELECT total_minor, refund_minor, payment_status,
        CAST(strftime('%s','now') AS INTEGER) - CAST(strftime('%s', COALESCE(refunded_at, '2000-01-01')) AS INTEGER) AS since FROM orders WHERE id = ?`).get(id) as
      | { total_minor: number; refund_minor: number; payment_status: string; since: number } | undefined;
    if (!o) return "not_found" as const;
    if (o.payment_status !== "paid" && o.payment_status !== "refunded") return "not_paid" as const;
    if (!Number.isInteger(amountMinor) || amountMinor <= 0 || o.refund_minor + amountMinor > o.total_minor) return "amount" as const;
    if (o.since < 60) return "duplicate" as const;
    const total = o.refund_minor + amountMinor;
    c.prepare("UPDATE orders SET refund_minor = ?, refunded_at = datetime('now'), payment_status = ? WHERE id = ?").run(total, total === o.total_minor ? "refunded" : "paid", id);
    return "ok" as const;
  })();
}
