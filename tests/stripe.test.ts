import { describe, it, expect } from "vitest";
import { stripeKeyIsTest, stripeKeyLooksValid } from "../src/lib/payment/stripe";

describe("Stripe key checks", () => {
  it("accepts secret and restricted keys only", () => {
    expect(stripeKeyLooksValid("sk_live_51AbCdEfGhIjKlMn")).toBe(true);
    expect(stripeKeyLooksValid("sk_test_51AbCdEfGhIjKlMn")).toBe(true);
    expect(stripeKeyLooksValid("rk_live_51AbCdEfGhIjKlMn")).toBe(true);
    expect(stripeKeyLooksValid("pk_live_51AbCdEfGhIjKlMn")).toBe(false); // publishable key: cannot take payments from the server
    expect(stripeKeyLooksValid("whsec_abcdefghijklmnop")).toBe(false);
    expect(stripeKeyLooksValid("sk_live_short")).toBe(false);
    expect(stripeKeyLooksValid("")).toBe(false);
  });
  it("tells a test key from a live key", () => {
    expect(stripeKeyIsTest("sk_test_51AbCdEfGhIjKlMn")).toBe(true);
    expect(stripeKeyIsTest("rk_test_51AbCdEfGhIjKlMn")).toBe(true);
    expect(stripeKeyIsTest("sk_live_51AbCdEfGhIjKlMn")).toBe(false);
  });
});
