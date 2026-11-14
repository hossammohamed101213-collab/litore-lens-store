import { describe, expect, it, beforeAll } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

describe("secrets", () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lt-")), "t.db");
  });
  it("encrypts and decrypts, and never stores plain text", async () => {
    const { encrypt, decrypt } = await import("@/lib/secrets");
    const e = encrypt("my-auth-key");
    expect(e.startsWith("enc:")).toBe(true);
    expect(e).not.toContain("my-auth-key");
    expect(decrypt(e)).toBe("my-auth-key");
    expect(decrypt("enc:garbage")).toBe("");
    expect(decrypt("plain")).toBe("");
  });
});
