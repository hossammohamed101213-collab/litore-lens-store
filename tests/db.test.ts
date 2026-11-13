import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory database with sample data.
process.env.DATABASE_PATH = ":memory:";
process.env.SEED_SAMPLE = "true";

describe("db commerce provider", () => {
  let commerce: import("../src/lib/commerce/types").CommerceProvider;
  let OutOfStockError: typeof import("../src/lib/commerce/db-provider").OutOfStockError;
  beforeAll(async () => {
    const mod = await import("../src/lib/commerce/db-provider");
    OutOfStockError = mod.OutOfStockError;
    commerce = new mod.DbCommerceProvider();
  });

  it("lists active sample products", async () => {
    expect((await commerce.listProducts()).length).toBe(8);
    expect((await commerce.listProducts({ colorFamily: "pink" })).length).toBe(1);
  });

  it("clamps quantity to stock", async () => {
    const [l] = await commerce.validateLines([{ variantId: "mock-1-v1", quantity: 50 }]);
    expect(l.quantity).toBe(10);
    expect(l.status).toBe("limited");
  });

  it("saves an order, decrements stock, and refuses oversell", async () => {
    const [line] = await commerce.validateLines([{ variantId: "mock-2-v1", quantity: 4 }]);
    const order = {
      id: "LT-TEST0001", createdAt: new Date().toISOString(), status: "new" as const, paymentStatus: "paid" as const,
      lines: [line], subtotal: 400, discount: 0, shipping: 0, tax: 0, total: 400, currency: "AED",
      shippingLabel: { ar: "x", en: "x" }, isMock: true,
    };
    const meta = { email: "a@b.com", phone: "+971500000000", address: { name: "A", phone: "1", line1: "x", city: "y", country: "AE" } };
    await commerce.saveOrder(order, "key-00000001", meta);
    const [after] = await commerce.validateLines([{ variantId: "mock-2-v1", quantity: 1 }]);
    expect(after.maxQuantity).toBe(6); // 10 - 4

    // Ask for more than what is left directly at the DB layer: must throw, not go negative.
    const big = { ...order, id: "LT-TEST0002", lines: [{ ...line, quantity: 99 }] };
    await expect(commerce.saveOrder(big, "key-00000002", meta)).rejects.toBeInstanceOf(OutOfStockError);
    expect((await commerce.findOrderByKey("key-00000001"))?.id).toBe("LT-TEST0001");
    expect(await commerce.findOrderByKey("key-00000002")).toBeNull();
  });

  it("validates coupons from the database", async () => {
    expect((await commerce.validateCoupon("sample10", 200)).discount).toBe(20);
    expect((await commerce.validateCoupon("nope", 200)).valid).toBe(false);
  });
});
