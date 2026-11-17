import { telrConfig } from "./telr";
import { paymenntConfig } from "./paymennt";
import { ziinaConfig } from "./ziina";

export type PaymentOptions = { online: boolean; mock: boolean };

export function paymentOptions(): PaymentOptions {
  const v = process.env.PAYMENT_MODE;
  if (v === "mock") return { online: false, mock: true };
  const online = !!paymenntConfig() || !!ziinaConfig() || !!telrConfig();
  if (!online && process.env.NODE_ENV === "production") return { online: false, mock: true };
  return { online, mock: false };
}
