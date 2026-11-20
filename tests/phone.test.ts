import { describe, expect, it } from "vitest";
import { e164, isUaePhone } from "../src/lib/phone";

describe("UAE phone numbers at checkout", () => {
  it("accepts the ways customers really type a UAE number", () => {
    for (const p of ["0501234567", "050 123 4567", "050-123-4567", "+971501234567", "+971 50 123 4567", "00971501234567", "501234567", "971501234567", "+97126543210"]) expect(isUaePhone(p), p).toBe(true);
    expect(e164("050 123 4567")).toBe("+971501234567");
    expect(e164("00971501234567")).toBe("+971501234567");
  });
  it("refuses numbers the local courier can not call", () => {
    for (const p of ["+447911123456", "+966501234567", "0501234", "12345678", "+9715012345678901", "", "call me"]) expect(isUaePhone(p), p).toBe(false);
  });
});
