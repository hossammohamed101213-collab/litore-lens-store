export const round2 = (n: number) => Math.round(n * 100) / 100;

export function sumLines(lines: { unitPrice: number; quantity: number }[]): number {
  return round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
}

export type Totals = { subtotal: number; discount: number; shipping: number; tax: number; total: number };

/**
 * Single source of truth for order math (used by the checkout quote AND order creation,
 * so what the customer sees always equals what is charged).
 * taxRate is a percentage (e.g. 5). 0 = tax disabled.
 */
export function computeTotals(input: {
  subtotal: number; discount: number; shipping: number; taxRate: number; taxInclusive: boolean;
}): Totals {
  const { subtotal, discount, shipping, taxRate, taxInclusive } = input;
  const base = round2(Math.max(0, subtotal - discount) + shipping);
  if (taxRate <= 0) return { subtotal, discount, shipping, tax: 0, total: base };
  const r = taxRate / 100;
  if (taxInclusive) return { subtotal, discount, shipping, tax: round2(base - base / (1 + r)), total: base };
  const tax = round2(base * r);
  return { subtotal, discount, shipping, tax, total: round2(base + tax) };
}
