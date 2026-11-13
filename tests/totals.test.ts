import { describe, expect, it } from "vitest";
import { round2, sumLines } from "../src/lib/commerce/totals";
import { MockCommerceProvider } from "../src/lib/commerce/mock-provider";

describe("totals", () => {
  it("sums lines without float drift", () => {
    expect(sumLines([{ unitPrice: 0.1, quantity: 3 }])).toBe(0.3);
    expect(round2(1.005 * 100) / 100).toBeCloseTo(1, 1);
  });
});

describe("mock commerce", () => {
  const c = new MockCommerceProvider();
  it("clamps quantity to stock and flags it", async () => {
    const [l] = await c.validateLines([{ variantId: "mock-1-v1", quantity: 50 }]);
    expect(l.quantity).toBe(10);
    expect(l.status).toBe("limited");
  });
  it("reports unknown variants", async () => {
    const [l] = await c.validateLines([{ variantId: "nope", quantity: 1 }]);
    expect(l.status).toBe("not_found");
  });
  it("validates the mock coupon", async () => {
    expect((await c.validateCoupon("sample10", 200)).discount).toBe(20);
    expect((await c.validateCoupon("bad", 200)).valid).toBe(false);
  });
});

import { computeTotals } from "../src/lib/commerce/totals";
describe("computeTotals", () => {
  it("no tax", () => {
    expect(computeTotals({ subtotal: 100, discount: 10, shipping: 15, taxRate: 0, taxInclusive: true }).total).toBe(105);
  });
  it("exclusive tax is added", () => {
    const t = computeTotals({ subtotal: 299, discount: 0, shipping: 15, taxRate: 5, taxInclusive: false });
    expect(t.tax).toBe(15.7);
    expect(t.total).toBe(329.7);
  });
  it("inclusive tax is extracted, total unchanged", () => {
    const t = computeTotals({ subtotal: 105, discount: 0, shipping: 0, taxRate: 5, taxInclusive: true });
    expect(t.total).toBe(105);
    expect(t.tax).toBe(5);
  });
});
