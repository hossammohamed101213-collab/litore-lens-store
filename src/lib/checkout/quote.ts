import { getCommerce } from "@/lib/commerce";
import type { LineInput, ValidatedLine } from "@/lib/commerce/types";
import { computeTotals, sumLines, type Totals } from "@/lib/commerce/totals";
import { getSetting } from "@/lib/db";
import { getShipping } from "@/lib/providers";
import type { ShippingRate } from "@/lib/shipping/types";

export type Quote = {
  lines: ValidatedLine[];
  rates: ShippingRate[];
  rate: ShippingRate | null;
  couponValid: boolean;
  totals: Totals;
  taxRate: number;
  taxInclusive: boolean;
};

/** Server-side price/stock/shipping/tax math. The checkout page and order creation both use this. */
export async function buildQuote(input: { lines: LineInput[]; country: string; city?: string; couponCode?: string; shippingRateId?: string }): Promise<Quote> {
  const commerce = getCommerce();
  const lines = await commerce.validateLines(input.lines);
  const subtotal = sumLines(lines);
  const coupon = input.couponCode ? await commerce.validateCoupon(input.couponCode, subtotal) : null;
  const discount = coupon?.valid ? coupon.discount : 0;

  const rates = await getShipping().getRates(
    { name: "", phone: "", line1: "", city: input.city ?? "", country: input.country },
    Math.max(0, subtotal - discount),
  );
  const rate = rates.find((r) => r.id === input.shippingRateId) ?? rates[0] ?? null;

  const taxRate = Number(getSetting("tax_rate", "0")) || 0;
  const taxInclusive = getSetting("tax_inclusive", "true") === "true";
  const totals = computeTotals({ subtotal, discount, shipping: rate?.amount ?? 0, taxRate, taxInclusive });
  return { lines, rates, rate, couponValid: !!coupon?.valid, totals, taxRate, taxInclusive };
}
