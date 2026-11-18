import { db } from "@/lib/db";
import { alertOwner, dayKey, hourKey } from "./alerts";

/**
 * Error tracking kept inside the store (no outside service): every server error is written to the error_log table,
 * and the owner is alerted when errors come in a burst, when payments fail unusually often, or when an outside
 * service (payment gateway, courier, e-mail) keeps failing. Nothing here ever throws.
 */
export function recordError(source: string, message: string, where = ""): void {
  try {
    const clean = String(message).replace(/[\r\n]+/g, " ").replace(/(key|token|secret|authorization|password)\S*\s*[:=]\s*\S+/gi, "$1=…").slice(0, 300);
    db().prepare("INSERT INTO error_log(source, place, message) VALUES (?,?,?)").run(source.slice(0, 40), where.split("?")[0].slice(0, 160), clean);
    db().prepare("DELETE FROM error_log WHERE id <= (SELECT MAX(id) FROM error_log) - 1000").run(); // keep the newest 1000
  } catch { /* the database itself may be the problem */ }
}

/** Five or more server errors within ten minutes = something is broken now. One alert per hour. */
export function raiseErrorAlerts(): number {
  try {
    const n = (db().prepare("SELECT COUNT(*) n FROM error_log WHERE source = 'server' AND at >= datetime('now','-10 minutes')").get() as { n: number }).n;
    if (n < 5) return 0;
    const last = db().prepare("SELECT place, message FROM error_log WHERE source = 'server' ORDER BY id DESC LIMIT 1").get() as { place: string; message: string };
    return alertOwner("system", `أخطاء متكررة في المتجر (${hourKey()})`, `${n} أخطاء خلال 10 دقائق. آخر خطأ في ${last.place || "صفحة غير معروفة"}: ${last.message.slice(0, 160)}`, "/admin/errors") ? 1 : 0;
  } catch { return 0; }
}

/** Card payments failing far more than usual in the last hour (at least 5 attempts, 60% or more failed). One alert per hour. */
export function raisePaymentFailureAlert(): number {
  try {
    const r = db().prepare(`SELECT SUM(payment_status = 'failed') f, SUM(payment_status = 'paid') p FROM orders
      WHERE payment_ref IS NOT NULL AND is_mock = 0 AND created_at >= datetime('now','-60 minutes')`).get() as { f: number | null; p: number | null };
    const failed = r.f ?? 0, total = failed + (r.p ?? 0);
    if (total < 5 || failed / total < 0.6) return 0;
    return alertOwner("payment", `ارتفاع فشل الدفع (${hourKey()})`, `${failed} من ${total} محاولة دفع فشلت خلال آخر ساعة. راجعي لوحة بوابة الدفع وتأكدي أن الحساب يعمل.`, "/admin/orders?view=unpaid") ? 1 : 0;
  } catch { return 0; }
}

const g = globalThis as unknown as { __litoreSvc?: Map<string, number> };
/**
 * Called after every call to an outside service. Three failures in a row = the service is down for us:
 * the owner is told once a day per service. A success resets the count.
 */
export function serviceResult(name: string, ok: boolean, detail = ""): void {
  const m = (g.__litoreSvc ??= new Map());
  if (ok) { m.set(name, 0); return; }
  const n = (m.get(name) ?? 0) + 1;
  m.set(name, n);
  recordError("service:" + name, detail || "no answer");
  if (n === 3) alertOwner("system", `خدمة ${name} لا ترد (${dayKey()})`, `ثلاث محاولات متتالية فشلت مع ${name}. المتجر يعيد المحاولة تلقائيًا، لكن راجعي حساب الخدمة إن استمر التنبيه.`, "/admin/errors");
}
