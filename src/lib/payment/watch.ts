import { sendPendingOrderConfirmations } from "@/lib/order-mail";
import { reconcilePendingPayments } from "./reconcile";

const g = globalThis as unknown as { __litorePayWatch?: ReturnType<typeof setInterval> };

/**
 * Background check of card payments, started once with the server (see src/instrumentation.ts).
 * Every 10 minutes it asks Telr about orders still "waiting for payment", so a paid order is confirmed
 * and an abandoned one is cancelled even when nobody opens the admin panel.
 * PAYMENT_WATCH_MS overrides the interval (tests); 0 switches the watch off.
 */
export function startPaymentWatch(): boolean {
  if (g.__litorePayWatch) return false;
  const raw = process.env.PAYMENT_WATCH_MS;
  const every = raw === undefined || raw === "" ? 10 * 60_000 : Number(raw);
  if (!Number.isFinite(every) || every <= 0) return false;
  const run = () => {
    reconcilePendingPayments({ minIntervalMs: 0, limit: 25 })
      .then((r) => { if (r.paid || r.failed || r.alerts) console.log("[payment-watch]", JSON.stringify(r)); })
      .catch((e) => console.log("[payment-watch-error]", e instanceof Error ? e.message : String(e)))
      .finally(() => sendPendingOrderConfirmations().catch(() => 0)); // retry confirmation e-mails that did not go out
  };
  g.__litorePayWatch = setInterval(run, Math.max(1000, every));
  g.__litorePayWatch.unref?.(); // never keeps the process alive on shutdown
  return true;
}
