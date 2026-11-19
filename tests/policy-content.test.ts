import { describe, it, expect } from "vitest";
import ar from "../src/messages/ar.json";
import en from "../src/messages/en.json";

// The payment gateway's website checklist needs a payment-confirmation
// statement on the public policy pages. The owner's street address must never
// be published on the site.
describe("policy pages content", () => {
  it("has a payment confirmation section in both languages", () => {
    expect(JSON.stringify(ar)).toContain('"تأكيد الدفع"');
    expect(JSON.stringify(en)).toContain('"Payment confirmation"');
  });
  it("does not publish the owner's street address", () => {
    for (const s of [JSON.stringify(ar), JSON.stringify(en)]) {
      expect(s).not.toContain("Al Falah");
      expect(s).not.toContain("Blue Number");
    }
  });
  // Paymennt's go-live review: the legal name must appear on every policy page.
  it("names the legal entity on the privacy, terms, returns and shipping pages", () => {
    for (const d of [ar, en]) {
      for (const k of ["privacy", "terms", "returns", "shipping"] as const) {
        expect(JSON.stringify(d.pages[k]).toUpperCase()).toContain("LITORE COSMETICS");
      }
      expect(d.footer.rights.toUpperCase()).toContain("LITORE COSMETICS");
    }
  });
});
