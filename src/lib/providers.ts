import { MockShippingProvider } from "@/lib/shipping/mock-provider";
import { DbShippingProvider } from "@/lib/shipping/db-provider";
import { MockPaymentProvider } from "@/lib/payment/mock-provider";
import { CodPaymentProvider } from "@/lib/payment/cod-provider";
import { paymentMode } from "@/lib/payment/mode";
import type { PaymentProvider } from "@/lib/payment/types";
import type { ShippingProvider } from "@/lib/shipping/types";

const g = globalThis as unknown as { __litorePay?: PaymentProvider };

export function getShipping(): ShippingProvider {
  return process.env.SHIPPING_PROVIDER === "mock" ? new MockShippingProvider() : new DbShippingProvider();
}

/**
 * No online gateway yet (needs a licensed merchant account + API keys).
 * Live = cash on delivery; development/tests = sample gateway. See lib/payment/mode.ts.
 */
export function getPayment(): PaymentProvider {
  const mode = paymentMode();
  if (!g.__litorePay || g.__litorePay.name !== mode) {
    g.__litorePay = mode === "cod" ? new CodPaymentProvider() : new MockPaymentProvider();
  }
  return g.__litorePay;
}
