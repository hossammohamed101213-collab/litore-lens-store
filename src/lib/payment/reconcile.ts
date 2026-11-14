import { db } from "@/lib/db";
import { setOrderStatus } from "@/lib/db/admin";
import { checkTelrOrder, telrConfig } from "./telr";

/**
 * Confirms an online (Telr) payment on the SERVER. Paid -> marks the order paid.
 * Declined/cancelled -> cancels the order and returns the stock. Still waiting -> leaves it alone.
 */
export async function reconcileOnlinePayment(orderId: string): Promise<"paid" | "failed" | "pending" | "none"> {
  const row = db().prepare("SELECT payment_status, payment_ref, total_minor, currency FROM orders WHERE id = ?").get(orderId) as
    | { payment_status: string; payment_ref: string | null; total_minor: number; currency: string } | undefined;
  if (!row?.payment_ref) return "none";
  if (row.payment_status === "paid") return "paid";
  if (row.payment_status !== "pending") return "failed";
  const cfg = telrConfig();
  if (!cfg) return "pending";
  try {
    const r = await checkTelrOrder(cfg, row.payment_ref);
    if (r.paid) {
      const same = r.cartId === orderId && Math.round((r.amount ?? 0) * 100) === row.total_minor && (!r.currency || r.currency === row.currency);
      if (!same) return "pending"; // never mark paid if the amount or order doesn't match
      db().prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ? AND payment_status = 'pending'").run(orderId);
      return "paid";
    }
    if (r.declined) {
      setOrderStatus(orderId, "cancelled", null, "failed");
      return "failed";
    }
  } catch {
    /* network problem: try again later */
  }
  return "pending";
}
