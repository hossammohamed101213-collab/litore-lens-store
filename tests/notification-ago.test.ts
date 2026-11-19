import { describe, it, expect } from "vitest";
import { ago } from "../src/app/admin/(panel)/NotificationBell";

describe("notification time label", () => {
  const now = Date.parse("2026-11-19T10:00:00Z");
  it("reads the stored UTC time and shortens it", () => {
    expect(ago("2026-11-19 09:59:40", now)).toBe("الآن");
    expect(ago("2026-11-19 09:45:00", now)).toBe("15 د");
    expect(ago("2026-11-19 07:00:00", now)).toBe("3 س");
    expect(ago("2026-11-16 10:00:00", now)).toBe("3 ي");
  });
  it("never breaks on a bad or future value", () => {
    expect(ago("nonsense", now)).toBe("");
    expect(ago("2026-11-19 10:05:00", now)).toBe("الآن");
  });
});
