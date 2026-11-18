import { describe, it, expect } from "vitest";
import ar from "../src/messages/ar.json";
import en from "../src/messages/en.json";

// The payment gateway's website checklist needs a real business address and a
// payment-confirmation statement on the public policy pages, in both languages.
describe("policy pages content", () => {
  it("shows the business address instead of 'not available'", () => {
    const a = JSON.stringify(ar), e = JSON.stringify(en);
    expect(a).toContain("New Al Falah E1 895, Blue Number 19");
    expect(e).toContain("New Al Falah E1 895, Blue Number 19, Abu Dhabi, United Arab Emirates");
    expect(a).not.toContain("صندوق البريد: غير متوفر");
    expect(e).not.toContain("P.O. Box: not available");
  });
  it("has a payment confirmation section", () => {
    expect(JSON.stringify(ar)).toContain('"تأكيد الدفع"');
    expect(JSON.stringify(en)).toContain('"Payment confirmation"');
  });
});
