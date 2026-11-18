import { describe, expect, it } from "vitest";
import { secureCookie } from "../src/lib/auth/session";

describe("session cookie is Secure", () => {
  const prod = { NODE_ENV: "production" };
  it("always on the real store, whatever switch is set", () => {
    for (const site of ["https://litore.store", "https://staging.litore.store", "http://litore.store", "http://localhost.evil.com", undefined])
      expect(secureCookie({ ...prod, NEXT_PUBLIC_SITE_URL: site, E2E_PLAIN_HTTP_COOKIE: "1" })).toBe(true);
    expect(secureCookie({ ...prod, NEXT_PUBLIC_SITE_URL: "http://localhost:3100" })).toBe(true);
  });
  it("off only for the automated test build made for http://localhost with the test switch on", () => {
    expect(secureCookie({ ...prod, NEXT_PUBLIC_SITE_URL: "http://localhost:3100", E2E_PLAIN_HTTP_COOKIE: "1" })).toBe(false);
  });
});
