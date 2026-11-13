import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { rateLimited, sameOrigin } from "../src/lib/auth/guards";

describe("passwords", () => {
  it("verifies the right password only and salts each hash", () => {
    const h = hashPassword("correct horse");
    expect(verifyPassword("correct horse", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
    expect(hashPassword("correct horse")).not.toBe(h);
    expect(h).not.toContain("correct horse");
  });
});

describe("guards", () => {
  it("rejects cross-origin posts", () => {
    const mk = (origin: string) => new Request("http://shop.test/api/x", { method: "POST", headers: { origin, host: "shop.test" } });
    expect(sameOrigin(mk("http://shop.test"))).toBe(true);
    expect(sameOrigin(mk("http://evil.test"))).toBe(false);
  });
  it("rate limits", () => {
    for (let i = 0; i < 3; i++) expect(rateLimited("k1", 3)).toBe(false);
    expect(rateLimited("k1", 3)).toBe(true);
  });
});
