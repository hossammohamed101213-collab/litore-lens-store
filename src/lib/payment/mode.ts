import { getSetting } from "@/lib/db";
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
export type PaymentOptions = { online: boolean; cod: boolean; mock: boolean };

/**
 * Which payment methods a customer can pick right now. On a live server the owner controls this from the admin panel:
 * online = Telr saved + enabled; cod = the "cash on delivery" switch (on by default). Both can be on together.
 * PAYMENT_MODE=mock|cod (env) still forces a single method (tests). Development without a gateway uses the sample gateway.
 */
export function paymentOptions(): PaymentOptions {
  const v = process.env.PAYMENT_MODE;
  if (v === "mock") return { online: false, cod: false, mock: true };
  if (v === "cod") return { online: false, cod: true, mock: false };
  const online = !!telrConfig();
  if (!online && process.env.NODE_ENV !== "production") return { online: false, cod: false, mock: true };
  return { online, cod: getSetting("pay_cod_enabled", "1") !== "0", mock: false };
}
