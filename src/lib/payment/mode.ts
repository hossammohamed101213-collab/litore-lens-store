import { telrConfig } from "./telr";
import { paymenntConfig } from "./paymennt";
import { ziinaConfig } from "./ziina";

/**
 * How checkout takes payment: online only (card / Apple Pay through Paymennt, Ziina or Telr, turned on from the admin
 * integrations pages once keys are saved).
 * "mock" (PAYMENT_MODE=mock, or development without a gateway) is a sample gateway for development/tests; never set on the live server.
 * A live server with no gateway shows "payments closed" so nobody gets a free "paid" order.
 */
export type PaymentOptions = { online: boolean; mock: boolean };

export function paymentOptions(): PaymentOptions {
  const v = process.env.PAYMENT_MODE;
  if (v === "mock") return { online: false, mock: true };
  const online = !!paymenntConfig() || !!ziinaConfig() || !!telrConfig();
  if (!online && process.env.NODE_ENV !== "production") return { online: false, mock: true };
  return { online, mock: false };
}
