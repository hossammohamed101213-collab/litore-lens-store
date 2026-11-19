import { db, getSetting } from "@/lib/db";
import { notify } from "@/lib/db/notify";
import { telrConfig, checkTelrOrder } from "@/lib/payment/telr";
import { paymenntConfig, checkPaymenntCheckout } from "@/lib/payment/paymennt";
import { ziinaConfig, checkZiinaPayment } from "@/lib/payment/ziina";
import { stripeConfig, checkStripePayment } from "@/lib/payment/stripe";
import { alertOwner, dayKey } from "./alerts";

export type ReconIssue = { order: string; kind: string; detail: string };
export type ReconResult = { day: string; orders: number; paid: number; paidMinor: number; refundedMinor: number; verified: number; unverified: number; issues: ReconIssue[] };

const fin = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
type Row = { id: string; status: string; ps: string; total: number; sub: number; disc: number; ship: number; tax: number; refund: number; ref: string | null; gw: string | null; mock: number; cur: string };

/**
 * Daily reconciliation for one UAE calendar day: orders against payments against refunds.
 * 1. The books inside the store: lines add up to the subtotal, subtotal - discount + shipping + tax = total,
 *    a refund is never larger than what was paid, "refunded" means fully given back, one payment belongs to one order.
 * 2. Every card payment of that day is asked about again at its own gateway: still paid, same amount, same order.
 * A gateway that does not answer is counted as "unverified" (never as an error and never as fine).
 */
export async function reconcileDay(day: string): Promise<ReconResult> {
  // UAE day -> UTC window (UAE is UTC+4 all year)
  const from = new Date(`${day}T00:00:00+04:00`).toISOString().slice(0, 19).replace("T", " ");
  const to = new Date(new Date(`${day}T00:00:00+04:00`).getTime() + 86400_000).toISOString().slice(0, 19).replace("T", " ");
  const rows = db().prepare(`SELECT id, status, payment_status ps, total_minor total, subtotal_minor sub, discount_minor disc, shipping_minor ship, tax_minor tax,
    refund_minor refund, payment_ref ref, payment_gateway gw, is_mock mock, currency cur FROM orders WHERE created_at >= ? AND created_at < ? ORDER BY created_at`).all(from, to) as Row[];
  const issues: ReconIssue[] = [];
  const add = (order: string, kind: string, detail: string) => issues.push({ order, kind, detail });
  const lineSum = db().prepare("SELECT COALESCE(SUM(unit_minor * quantity), 0) s FROM order_lines WHERE order_id = ?");
  const taxInclusive = getSetting("tax_inclusive", "1") !== "0";
  let paidMinor = 0, refundedMinor = 0, paid = 0, verified = 0, unverified = 0;

  for (const o of rows) {
    const lines = (lineSum.get(o.id) as { s: number }).s;
    if (lines !== o.sub) add(o.id, "lines", `مجموع المنتجات ${lines / 100} لا يساوي المسجّل ${o.sub / 100}`);
    const expectA = o.sub - o.disc + o.ship, expectB = expectA + o.tax;
    if (o.total !== expectA && o.total !== expectB) add(o.id, "total", `الإجمالي ${o.total / 100} لا يساوي المنتجات − الخصم + الشحن${taxInclusive ? "" : " + الضريبة"}`);
    if (o.refund < 0 || o.refund > o.total) add(o.id, "refund", `المسترجع ${o.refund / 100} أكبر من الإجمالي ${o.total / 100}`);
    if (o.ps === "refunded" && o.refund !== o.total) add(o.id, "refund", `الطلب «مسترجع» لكن المسجّل ${o.refund / 100} من ${o.total / 100}`);
    if (o.refund > 0 && o.ps !== "paid" && o.ps !== "refunded") add(o.id, "refund", "استرجاع مسجّل على طلب غير مدفوع");
    if (o.ps === "paid" && o.status === "cancelled" && o.refund < o.total) add(o.id, "cancelled_paid", "طلب ملغى ومدفوع ولم يُسجَّل استرجاع كامل");
    if (o.ps === "paid" || o.ps === "refunded") { paid++; paidMinor += o.total; refundedMinor += o.refund; }
    if ((o.ps === "paid" || o.ps === "refunded") && !o.mock && o.total > 0 && !o.ref) add(o.id, "no_payment", "طلب مدفوع بدون رقم عملية من بوابة الدفع");

    // ask the gateway again about every real card payment of the day
    if ((o.ps === "paid" || o.ps === "refunded") && o.ref && !o.mock) {
      try {
        let r: { paid: boolean; amountMinor?: number; currency?: string; owner?: string } | null = null;
        if (o.gw === "paymennt") { const c = paymenntConfig(true); if (c) { const x = await checkPaymenntCheckout(c, o.ref); r = { paid: x.paid, amountMinor: fin(x.amount) ? Math.round(x.amount * 100) : undefined, currency: x.currency, owner: x.orderId }; } }
        else if (o.gw === "ziina") { const c = ziinaConfig(true); if (c) { const x = await checkZiinaPayment(c, o.ref); r = { paid: x.paid, amountMinor: fin(x.amount) ? x.amount : undefined, currency: x.currency }; } }
        else if (o.gw === "stripe") { const c = stripeConfig(true); if (c) { const x = await checkStripePayment(c, o.ref); r = { paid: x.paid, amountMinor: fin(x.amount) ? x.amount : undefined, currency: x.currency, owner: x.orderId }; } }
        else { const c = telrConfig(); if (c) { const x = await checkTelrOrder(c, o.ref); r = { paid: x.paid, amountMinor: fin(x.amount) ? Math.round(x.amount * 100) : undefined, currency: x.currency, owner: x.cartId }; } }
        if (!r) { unverified++; continue; }
        if (!r.paid && o.ps === "paid") add(o.id, "gateway", "المتجر يقول مدفوع والبوابة لا تؤكد الدفع (قد يكون استرجاعًا تم من لوحة البوابة ولم يُسجَّل هنا)");
        else if (r.amountMinor != null && r.amountMinor !== o.total) add(o.id, "gateway", `مبلغ البوابة ${r.amountMinor / 100} يختلف عن إجمالي الطلب ${o.total / 100}`);
        else if (r.currency && r.currency.toUpperCase() !== o.cur.toUpperCase()) add(o.id, "gateway", `عملة البوابة ${r.currency} تختلف عن ${o.cur}`);
        else if (r.owner && r.owner !== o.id) add(o.id, "gateway", `الدفعة مسجّلة عند البوابة لطلب آخر (${r.owner})`);
        else verified++;
      } catch { unverified++; }
    }
  }
  // one gateway payment must never be attached to two orders
  const dup = db().prepare(`SELECT payment_ref ref, COUNT(*) n, MIN(id) id FROM orders WHERE payment_ref IS NOT NULL AND payment_ref != ''
    AND created_at >= ? AND created_at < ? GROUP BY payment_ref, COALESCE(payment_gateway,'') HAVING n > 1`).all(from, to) as { ref: string; n: number; id: string }[];
  for (const d of dup) add(d.id, "duplicate_payment", `نفس رقم عملية الدفع مسجّل على ${d.n} طلبات`);
  return { day, orders: rows.length, paid, paidMinor, refundedMinor, verified, unverified, issues };
}

/** Runs the reconciliation of one day, stores it, and tells the owner (bell always; e-mail too when something is off). */
export async function runDailyReconciliation(day: string): Promise<ReconResult> {
  const r = await reconcileDay(day);
  db().prepare(`INSERT INTO reconciliations(day, orders, paid, paid_minor, refunded_minor, verified, unverified, issues_json) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(day) DO UPDATE SET ran_at = datetime('now'), orders = excluded.orders, paid = excluded.paid, paid_minor = excluded.paid_minor,
    refunded_minor = excluded.refunded_minor, verified = excluded.verified, unverified = excluded.unverified, issues_json = excluded.issues_json`)
    .run(day, r.orders, r.paid, r.paidMinor, r.refundedMinor, r.verified, r.unverified, JSON.stringify(r.issues.slice(0, 200)));
  const money = (m: number) => (m / 100).toFixed(2);
  const summary = `${r.orders} طلب، ${r.paid} مدفوع بإجمالي ${money(r.paidMinor)}، مسترجع ${money(r.refundedMinor)}. تم التأكد من البوابة: ${r.verified}، لم يتم: ${r.unverified}.`;
  if (r.issues.length) alertOwner("payment", `مطابقة يوم ${day}: ${r.issues.length} اختلاف`, `${summary} أول اختلاف: ${r.issues[0].order} — ${r.issues[0].detail}`, "/admin/reconciliation");
  else if (r.orders > 0) notify("payment", `مطابقة يوم ${day}: سليمة`, summary, "/admin/reconciliation");
  return r;
}

let running = false;
/** Called by the background watch: once a day, after 06:00 UAE time, reconcile yesterday if it was not done yet. */
export async function maybeRunDailyReconciliation(now = new Date()): Promise<ReconResult | null> {
  if (running) return null;
  const uae = new Date(now.getTime() + 4 * 3600_000);
  if (uae.getUTCHours() < 6) return null;
  const yesterday = dayKey(new Date(now.getTime() - 86400_000));
  try {
    if (db().prepare("SELECT 1 FROM reconciliations WHERE day = ?").get(yesterday)) return null;
    running = true;
    return await runDailyReconciliation(yesterday);
  } catch (e) {
    console.log("[daily-reconcile-error]", e instanceof Error ? e.message : String(e));
    return null;
  } finally { running = false; }
}
