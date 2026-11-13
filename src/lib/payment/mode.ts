/**
 * How checkout takes payment.
 *  - "mock": sample gateway for development/tests. Marks orders as paid WITHOUT charging anyone.
 *  - "cod":  cash on delivery. Orders are created as "pending payment"; the owner confirms payment in the admin panel.
 * A live server defaults to "cod" so a real customer can never get a free "paid" order.
 * Set PAYMENT_MODE explicitly to override (tests use "mock").
 */
export type PaymentMode = "mock" | "cod";

export function paymentMode(): PaymentMode {
  const v = process.env.PAYMENT_MODE;
  if (v === "mock" || v === "cod") return v;
  return process.env.NODE_ENV === "production" ? "cod" : "mock";
}
