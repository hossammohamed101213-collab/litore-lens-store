import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { code128, code128Svg } from "../src/lib/barcode";

// The encoder was verified by reading its output back with a barcode scanner library (every printable character).
// These tests pin that verified behaviour so it can not drift.
describe("Code 128 barcode", () => {
  it("encodes an order number exactly as the scanner-verified reference", () => {
    expect(code128("LT-540680FC99C1")).toBe("2112141321312133111221322132122212311231222231123112221231221323111313213211223211221313211232211212232331112");
  });
  it("is start B + one symbol per character + checksum + stop, 11 modules per symbol", () => {
    for (const t of ["A", "LT-A1B2C3D4E5F6", " ~!\"#$%&'()*+,-./:;<=>?@[]^_`{|}"]) {
      const w = code128(t); const mods = [...w].reduce((s, d) => s + Number(d), 0);
      expect(w.startsWith("211214")).toBe(true);
      expect(w.endsWith("2331112")).toBe(true);
      expect(mods).toBe((t.length + 2) * 11 + 13);
    }
  });
  it("keeps the standard pattern table untouched", () => {
    const all = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));
    const table = all.map((c) => code128(c).slice(6, 12)).join(" ");
    expect(createHash("sha256").update(table).digest("hex")).toBe(createHash("sha256").update("212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141").digest("hex"));
  });
  it("refuses text a scanner could not read back", () => {
    expect(() => code128("")).toThrow();
    expect(() => code128("طلب")).toThrow();
    expect(() => code128("x".repeat(41))).toThrow();
  });
  it("draws whole-module bars with a quiet zone on both sides", () => {
    const svg = code128Svg("LT-1");
    const xs = [...svg.matchAll(/<rect x="(\d+)" y="0" width="(\d+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const width = Number(svg.match(/viewBox="0 0 (\d+) /)![1]);
    expect(xs[0][0]).toBe(10);
    expect(width - (xs.at(-1)![0] + xs.at(-1)![1])).toBe(10);
    expect(svg).toContain('aria-label="LT-1"');
    expect(code128Svg('a"<b')).toContain("&#34;&#60;");
  });
});
