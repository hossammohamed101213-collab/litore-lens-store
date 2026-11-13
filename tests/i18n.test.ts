import { describe, expect, it } from "vitest";
import { switchLocalePath, dirOf, isLocale } from "../src/lib/i18n/config";
import { formatPrice } from "../src/lib/i18n/format";

describe("i18n", () => {
  it("keeps the page when switching language", () => {
    expect(switchLocalePath("/ar/shop/sample-rose-quartz", "en")).toBe("/en/shop/sample-rose-quartz");
    expect(switchLocalePath("/en", "ar")).toBe("/ar");
  });
  it("sets direction per locale", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
  });
  it("validates locales", () => {
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
  it("formats currency", () => {
    expect(formatPrice(10, "AED", "en")).toContain("10");
  });
});
