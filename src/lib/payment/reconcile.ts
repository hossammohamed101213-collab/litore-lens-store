import { db, getSetting } from "@/lib/db";
import { sendOrderConfirmation } from "@/lib/order-mail";
import { setOrderStatus } from "@/lib/db/admin";
import { notify } from "@/lib/db/notify";
import { checkTelrOrder, telrConfig } from "./telr";

/** Adds a payment alert to the admin notification centre once (the same alert is never repeated for the same order). */
function alertOnce(title: string, body: string, orderId: string) {
  try {
    if (db().prepare("SELECT 1 FROM notifications WHERE kind = 'payment' AND title = ?").get(title)) return;
  } catch {
    /* fall through to notify (which never throws) */
  }
  notify("payment", title, body, `/admin/orders/${orderId}`);
}

/** Minutes an online order may wait for its payment before it is cancelled and its stock freed (admin setting, default 60; 0 = never). */
export function pendingTimeoutMinutes(): number {
  const n = Number(getSetting("pay_pending_timeout_min", "60"));
  if (!Number.isFinite(n) || n <= 0) return n === 0 ? 0 : 60;
  return Math.max(15, Math.min(7 * 24 * 60, Math.round(n)));
}

/**
 * Confirms an online (Telr) payment on the SERVER. Paid -> marks the order paid.
 * Declined/cancelled -> cancels the order and returns the stock. Still waiting -> leaves it alone,
 * until the waiting time is over (60 minutes by default): then the order is cancelled and its stock is free again.
 * An order is only ever cancelled after Telr itself answered "not paid" — never when Telr could not be reached.
 */
export async function reconcileOnlinePayment(orderId: string): Promise<"paid" | "failed" | "pending" | "none"> {
  const row = db().prepare(`SELECT status, payment_status, payment_ref, total_minor, currency,
      CAST(strftime('%s','now') AS INTEGER) - CAST(strftime('%s', created_at) AS INTEGER) AS age_s FROM orders WHERE id = ?`).get(orderId) as
    | { status: string; payment_status: string; payment_ref: string | null; total_minor: number; currency: string; age_s: number } | undefined;
  if (!row?.payment_ref) return "none";
  if (row.payment_status === "paid") return "paid";
  if (row.payment_status !== "pending") return "failed";
  const cfg = telrConfig();
  if (!cfg) return "pending";
  try {
    const r = await checkTelrOrder(cfg, row.payment_ref);
    // Diagnostics only (no secrets): what Telr answered for this order.
    console.log("[telr-check]", JSON.stringify({ order: orderId, code: r.code, tx: r.tx, cart: r.cartId, amount: r.amount, cur: r.currency, expect: row.total_minor / 100 }));
    if (r.paid) {
      const same = r.cartId === orderId && Math.round((r.amount ?? 0) * 100) === row.total_minor && (!r.currency || r.currency === row.currency);
      if (!same) {
        // never mark paid if the amount or order doesn't match — but tell the owner, money may have moved
        alertOnce(`دفعة لا تطابق الطلب ${orderId}`, `Telr: ${r.amount ?? "?"} ${r.currency ?? ""} — المتوقع: ${row.total_minor / 100} ${row.currency}. راجعي لوحة Telr قبل الشحن.`, orderId);
        return "pending";
      }
      db().prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ? AND payment_status = 'pending'").run(orderId);
      if (row.status !== "cancelled") void sendOrderConfirmation(orderId);
      if (row.status === "cancelled") {
        alertOnce(`دفعة وصلت لطلب ملغي ${orderId}`, "العميلة دفعت بعد إلغاء الطلب. أعيدي المبلغ من لوحة Telr أو انسخي الطلب كطلب جديد.", orderId);
      }
      return "paid";
    }
    if (r.declined) {
      setOrderStatus(orderId, "cancelled", null, "failed");
      return "failed";
    }
    const limit = pendingTimeoutMinutes();
    if (limit > 0 && row.age_s > limit * 60) {
      if (r.code !== 1) {
        // Only Telr's plain "pending, nothing paid" answer (code 1) may expire an order. Anything else we do not
        // fully understand (an unexpected code, an empty or changed answer) is never treated as "unpaid".
        if (r.code !== 2 && r.tx !== "H") {
          alertOnce(`رد غير مفهوم من Telr للطلب ${orderId}`, `الطلب ينتظر الدفع منذ أكثر من ${limit} دقيقة وTelr ردّ بحالة غير متوقعة (${Number.isFinite(r.code) ? r.code : "بدون رمز"}). لم يُلغَ الطلب تلقائيًا — راجعي لوحة Telr.`, orderId);
          return "pending";
        }
        // the bank holds the money (authorised, not captured): a person must decide, never cancel this automatically
        alertOnce(`دفعة معلّقة عند البنك للطلب ${orderId}`, "Telr يُظهر الدفعة «مفوَّضة» وليست «مدفوعة». راجعي لوحة Telr: اقبضي المبلغ أو ألغي التفويض.", orderId);
        return "pending";
      }
      if (r.cartId && r.cartId !== orderId) {
        alertOnce(`رد غير مفهوم من Telr للطلب ${orderId}`, "Telr ردّ ببيانات طلب آخر. لم يُلغَ الطلب تلقائيًا — راجعي لوحة Telr.", orderId);
        return "pending";
      }
      setOrderStatus(orderId, "cancelled", null, "failed");
      console.log("[telr-timeout]", JSON.stringify({ order: orderId, minutes: Math.round(row.age_s / 60), limit }));
      return "failed";
    }
  } catch (e) {
    console.log("[telr-check-error]", orderId, e instanceof Error ? e.message : String(e));
  }
  return "pending";
}

let lastSweep = 0;
let sweeping = false;

/**
 * Safety net for the admin panel: asks Telr about online orders that are still "waiting for payment".
 * Without it, a customer who paid but never came back to the store (closed the browser, lost signal)
 * stays "unpaid" forever, and an abandoned payment keeps its stock reserved forever.
 * Also raises an alert when Telr shows a payment for an order we cancelled after a declined attempt.
 * Throttled (once a minute, a few orders per run) so it can be called from page loads.
 */
export async function reconcilePendingPayments(opts: { limit?: number; minIntervalMs?: number } = {}): Promise<{ checked: number; paid: number; failed: number; alerts: number }> {
  const out = { checked: 0, paid: 0, failed: 0, alerts: 0 };
  const now = Date.now();
  if (sweeping || now - lastSweep < (opts.minIntervalMs ?? 60_000)) return out;
  const cfg = telrConfig();
  if (!cfg) return out;
  sweeping = true;
  lastSweep = now;
  try {
    const limit = Math.max(1, Math.min(50, opts.limit ?? 15));
    const pending = db().prepare(`SELECT id FROM orders WHERE payment_ref IS NOT NULL AND payment_status = 'pending'
      AND created_at >= datetime('now','-30 days') ORDER BY created_at ASC LIMIT ?`).all(limit) as { id: string }[];
    for (const o of pending) {
      const r = await reconcileOnlinePayment(o.id);
      out.checked++;
      if (r === "paid") out.paid++;
      if (r === "failed") out.failed++;
    }
    // Orders we cancelled after a declined/expired attempt: if Telr later shows them paid, the customer was charged for nothing.
    const failed = db().prepare(`SELECT id, payment_ref, total_minor FROM orders WHERE payment_ref IS NOT NULL AND payment_status = 'failed'
      AND created_at >= datetime('now','-3 days') ORDER BY created_at DESC LIMIT ?`).all(limit) as { id: string; payment_ref: string; total_minor: number }[];
    for (const o of failed) {
      const title = `دفعة مؤكدة على طلب فشل دفعه ${o.id}`;
      if (db().prepare("SELECT 1 FROM notifications WHERE kind = 'payment' AND title = ?").get(title)) continue;
      try {
        const r = await checkTelrOrder(cfg, o.payment_ref);
        out.checked++;
        if (r.paid && r.cartId === o.id) {
          alertOnce(title, `Telr يُظهر دفعة ${r.amount ?? "?"} ${r.currency ?? ""} لطلب مُلغى. أعيدي المبلغ من لوحة Telr أو انسخي الطلب كطلب جديد.`, o.id);
          out.alerts++;
        }
      } catch (e) {
        console.log("[telr-check-error]", o.id, e instanceof Error ? e.message : String(e));
      }
    }
  } finally {
    sweeping = false;
  }
  return out;
}
