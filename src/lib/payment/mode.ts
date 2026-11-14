import { telrConfig } from "./telr";

/**
 * How checkout takes payment.
 *  - "mock":   sample gateway for development/tests. Marks orders as paid WITHOUT charging anyone.
 *  - "cod":    cash on delivery. Orders wait as "pending payment"; the owner confirms payment in the admin panel.
 *  - "online": card / Apple Pay / Samsung Pay through Telr (turned on from the admin "الدفع" page once keys are saved).
 * A live server defaults to "cod" so a real customer can never get a free "paid" order.
 * An explicit PAYMENT_MODE=mock|cod env value always wins (tests use "mock").
 */
export type PaymentMode = "mock" | "cod" | "online";

export function paymentMode(): PaymentMode {
  const v = process.env.PAYMENT_MODE;
  if (v === "mock" || v === "cod") return v;
  if (telrConfig()) return "online";
  return process.env.NODE_ENV === "production" ? "cod" : "mock";
}
