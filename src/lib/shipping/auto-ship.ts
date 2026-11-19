import { db, getSetting } from "@/lib/db";
import { notify } from "@/lib/db/notify";
import { getOrderAdmin } from "@/lib/db/admin";
import { sendShippedEmail } from "@/lib/order-mail";
import { createQuiqupOrder, quiqupConfig } from "./quiqup";
import type { Address } from "./types";

/** The owner switches this on from the Quiqup page: a paid order is sent to Quiqup without pressing "اشحن الآن". */
export const autoShipOn = () => getSetting("car_quiqup_auto") === "1";

function alertOnce(orderId: string, reason: string) {
  const title = `لم يُشحن تلقائيًا: ${orderId}`;
  try {
    if (db().prepare("SELECT 1 FROM notifications WHERE kind = 'shipping' AND title = ?").get(title)) return;
  } catch {
    /* fall through */
  }
  notify("shipping", title, `${reason} افتحي الطلب واضغطي «اشحن الآن» بعد حل السبب.`, `/admin/orders/${orderId}`);
}

/**
 * Sends a PAID order to Quiqup by itself, right after the payment is confirmed.
 * It never ships an unpaid, cancelled or already shipped order, and never creates two shipments for one order
 * (Quiqup gets the same uuid for the same order, and the order row is only updated while it is still unshipped).
 * Any problem leaves the order as it is and tells the owner once, so she can ship it by hand.
 */
export async function autoShipPaidOrder(orderId: string): Promise<"shipped" | "skipped" | "failed"> {
  try {
    if (!autoShipOn() || !quiqupConfig()) return "skipped";
    const o = getOrderAdmin(orderId);
    if (!o || o.paymentStatus !== "paid" || (o.status !== "new" && o.status !== "processing")) return "skipped";
    const prev = db().prepare("SELECT carrier_ref, tracking_number FROM orders WHERE id = ?").get(orderId) as { carrier_ref: string | null; tracking_number: string | null } | undefined;
    if (prev?.carrier_ref || prev?.tracking_number) return "skipped";
    const address = o.address as unknown as Address;
    if (address.country !== "AE") {
      alertOnce(orderId, "Quiqup يوصّل داخل الإمارات فقط وهذا الطلب لدولة أخرى.");
      return "skipped";
    }
    const r = await createQuiqupOrder({ orderId: o.id, address, email: o.email, phone: o.phone });
    const done = db().prepare(`UPDATE orders SET status = 'shipped', tracking_number = ?, carrier = 'quiqup', label_url = ?, carrier_ref = ?
      WHERE id = ? AND payment_status = 'paid' AND status IN ('new','processing') AND tracking_number IS NULL`)
      .run(r.uuid, `/api/admin/orders/${encodeURIComponent(o.id)}/label`, r.orderId, orderId);
    if (done.changes !== 1) return "skipped";
    notify("shipping", `شُحن تلقائيًا: ${orderId}`, "أُرسل الطلب إلى Quiqup بعد تأكيد الدفع. اطبعي الملصق من صفحة الطلب.", `/admin/orders/${orderId}`);
    void sendShippedEmail(orderId);
    return "shipped";
  } catch (e) {
    const m = String(e instanceof Error ? e.message : e);
    const reason =
      m === "shipper_missing" ? "بيانات المرسل ناقصة."
      : m === "bad_phone" ? "رقم تليفون العميلة غير صالح لـ Quiqup (لازم رقم إماراتي)."
      : m.startsWith("quiqup:") ? `Quiqup رفض الطلب: ${m.slice(7, 160)}.`
      : "تعذر الاتصال بـ Quiqup.";
    console.log("[auto-ship-failed]", orderId, m.slice(0, 200));
    alertOnce(orderId, reason);
    return "failed";
  }
}
