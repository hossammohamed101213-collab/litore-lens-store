import { telrConfig } from "./telr";

/**
 * How checkout takes payment: online only (card / Apple Pay / Samsung Pay through Telr, turned on from the admin "الدفع" page once keys are saved).
 * "mock" (PAYMENT_MODE=mock, or development without a gateway) is a sample gateway for development/tests; never set on the live server.
 * A live server with no gateway shows "payments closed" so nobody gets a free "paid" order.
 */
export type PaymentOptions = { online: boolean; mock: boolean };

export function paymentOptions(): PaymentOptions {
  const v = process.env.PAYMENT_MODE;
  if (v === "mock") return { online: false, mock: true };
  const online = !!telrConfig();
  if (!online && process.env.NODE_ENV !== "production") return { online: false, mock: true };
  return { online, mock: false };
}
