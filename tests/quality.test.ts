import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Order rules, refunds, search, owner alerts, two-step codes. Isolated database.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-q-"));
process.env.DATABASE_PATH = path.join(dir, "t.db");

type Db = ReturnType<typeof import("../src/lib/db").db>;
let conn: Db;
let admin: typeof import("../src/lib/db/admin");
let seq = 0;

function makeOrder(o: { ps?: string; status?: string; total?: number; age?: string; email?: string; phone?: string; name?: string; tracking?: string } = {}) {
  const id = `LT-Q${String(++seq).padStart(11, "0")}`;
  conn.prepare(`INSERT INTO orders (id,email,phone,status,payment_status,subtotal_minor,total_minor,currency,shipping_label_ar,shipping_label_en,address_json,idempotency_key,tracking_number,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now', ?))`).run(id, o.email ?? `q${seq}@example.com`, o.phone ?? "+971500000000", o.status ?? "new", o.ps ?? "paid", 10000, o.total ?? 12500, "AED", "x", "x",
    JSON.stringify({ name: o.name ?? "Sara" }), `q-${seq}`, o.tracking ?? null, o.age ?? "-1 minutes");
  return id;
}
const row = (id: string) => conn.prepare("SELECT status, payment_status ps, refund_minor r, delivered_at d FROM orders WHERE id = ?").get(id) as { status: string; ps: string; r: number; d: string | null };

beforeAll(async () => {
  conn = (await import("../src/lib/db")).db();
  admin = await import("../src/lib/db/admin");
});

describe("order status rules", () => {
  it("an order only moves forward, and can be cancelled only before it ships", () => {
    const ok = admin.statusChangeAllowed;
    expect([ok("new", "processing"), ok("new", "shipped"), ok("processing", "delivered"), ok("shipped", "delivered"), ok("shipped", "shipped")]).toEqual([true, true, true, true, true]);
    expect([ok("delivered", "new"), ok("delivered", "shipped"), ok("shipped", "processing"), ok("processing", "new")]).toEqual([false, false, false, false]);
    expect([ok("new", "cancelled"), ok("processing", "cancelled"), ok("shipped", "cancelled"), ok("delivered", "cancelled"), ok("cancelled", "new")]).toEqual([true, true, false, false, false]);
  });

  it("a wrong change is refused and changes nothing; delivery time is recorded once", () => {
    const id = makeOrder();
    expect(admin.setOrderStatus(id, "shipped", "T1")).toBe("ok");
    expect(admin.setOrderStatus(id, "new", "T1")).toBe("invalid");
    expect(admin.setOrderStatus(id, "cancelled", "T1")).toBe("invalid");
    expect(row(id).status).toBe("shipped");
    expect(row(id).d).toBeNull();
    expect(admin.setOrderStatus(id, "delivered", "T1")).toBe("ok");
    const first = row(id).d;
    expect(first).not.toBeNull();
    expect(admin.setOrderStatus(id, "delivered", "T1")).toBe("ok");
    expect(row(id).d).toBe(first);
    const unpaid = makeOrder({ ps: "pending" });
    expect(admin.setOrderStatus(unpaid, "new", null, "refunded")).toBe("invalid"); // nothing was paid, so nothing can be "refunded"
    expect(row(unpaid).ps).toBe("pending");
  });
});

describe("recording refunds", () => {
  it("never more than was paid, never on an unpaid order, never the same entry twice in a row", () => {
    const id = makeOrder({ total: 12500 });
    expect(admin.recordRefund(id, 0)).toBe("amount");
    expect(admin.recordRefund(id, 12501)).toBe("amount");
    expect(admin.recordRefund(id, 2500)).toBe("ok");
    expect(row(id)).toMatchObject({ ps: "paid", r: 2500 });
    expect(admin.recordRefund(id, 2500)).toBe("duplicate"); // double click
    conn.prepare("UPDATE orders SET refunded_at = datetime('now','-5 minutes') WHERE id = ?").run(id);
    expect(admin.recordRefund(id, 10001)).toBe("amount"); // only 100.00 is left
    expect(admin.recordRefund(id, 10000)).toBe("ok");
    expect(row(id)).toMatchObject({ ps: "refunded", r: 12500 });
    conn.prepare("UPDATE orders SET refunded_at = datetime('now','-5 minutes') WHERE id = ?").run(id);
    expect(admin.recordRefund(id, 1)).toBe("amount"); // nothing left
    expect(admin.recordRefund(makeOrder({ ps: "pending" }), 100)).toBe("not_paid");
    expect(admin.recordRefund("LT-NOPE", 100)).toBe("not_found");
  });

  it("the sales figure is what was really kept: paid minus refunded", () => {
    const before = admin.dashboardStats().revenue;
    const id = makeOrder({ total: 20000 });
    expect(admin.dashboardStats().revenue).toBe(before + 200);
    admin.recordRefund(id, 5000);
    expect(admin.dashboardStats().revenue).toBe(before + 150);
    conn.prepare("UPDATE orders SET refunded_at = datetime('now','-5 minutes') WHERE id = ?").run(id);
    admin.recordRefund(id, 15000);
    expect(admin.dashboardStats().revenue).toBe(before);
  });
});

describe("finding orders", () => {
  it("search by order number, e-mail, phone, name or tracking number; odd characters match nothing extra", () => {
    const a = makeOrder({ email: "noura.find@example.com", phone: "+971551234567", name: "نورة الكتبي", tracking: "TRK-90210" });
    const ids = (q: string) => admin.listOrdersAdmin(undefined, q).map((o) => o.id);
    for (const q of [a, a.slice(-6), "noura.find", "551234567", "نورة", "TRK-90210"]) expect(ids(q)).toEqual([a]);
    expect(ids("%")).toEqual([]);
    expect(ids("_")).toEqual([]);
    expect(ids("' OR 1=1 --")).toEqual([]);
    expect(admin.listOrdersAdmin(undefined, "").length).toBeGreaterThan(1);
  });

  it("the two work lists: paid and waiting to ship, and waiting for payment", () => {
    const toShip = makeOrder(); const shipped = makeOrder({ status: "shipped" }); const unpaid = makeOrder({ ps: "pending" });
    const a = admin.listOrdersAdmin(undefined, undefined, "toship").map((o) => o.id);
    const b = admin.listOrdersAdmin(undefined, undefined, "unpaid").map((o) => o.id);
    expect(a).toContain(toShip); expect(a).not.toContain(shipped); expect(a).not.toContain(unpaid);
    expect(b).toContain(unpaid); expect(b).not.toContain(toShip);
    const s = admin.dashboardStats();
    expect(s.toShip).toBe(a.length); expect(s.awaitingPayment).toBe(b.length);
  });
});

describe("owner alerts", () => {
  it("a paid order nobody shipped for two days raises one alert, once", async () => {
    const { raiseOpsAlerts } = await import("../src/lib/ops-alerts");
    conn.prepare("DELETE FROM notifications").run();
    const late = makeOrder({ age: "-49 hours" }); makeOrder({ age: "-47 hours" }); makeOrder({ age: "-72 hours", status: "shipped" }); makeOrder({ age: "-72 hours", ps: "pending" });
    const n = () => (conn.prepare("SELECT COUNT(*) n FROM notifications WHERE kind = 'order' AND title LIKE '%لم يُشحن%'").get() as { n: number }).n;
    raiseOpsAlerts();
    expect(n()).toBe(1);
    expect((conn.prepare("SELECT link FROM notifications WHERE kind = 'order'").get() as { link: string }).link).toBe(`/admin/orders/${late}`);
    raiseOpsAlerts();
    expect(n()).toBe(1);
  });
});

describe("two-step sign-in codes", () => {
  it("match the published standard and are accepted once, within one step of clock drift", async () => {
    const t = await import("../src/lib/auth/totp");
    const secret = t.base32(Buffer.from("12345678901234567890")); // RFC 6238 test key
    expect(t.fromBase32(secret).toString()).toBe("12345678901234567890");
    expect(t.totpCode(secret, Math.floor(59 / 30))).toBe("287082");
    expect(t.totpCode(secret, Math.floor(1111111109 / 30))).toBe("081804");
    expect(t.totpCode(secret, Math.floor(2000000000 / 30))).toBe("279037");
    const now = 1_700_000_000_000; const c = t.totpCounter(now);
    expect(t.verifyTotp(secret, t.totpCode(secret, c), -1, now)).toBe(c);
    expect(t.verifyTotp(secret, t.totpCode(secret, c - 1), -1, now)).toBe(c - 1);
    expect(t.verifyTotp(secret, t.totpCode(secret, c + 1), -1, now)).toBe(c + 1);
    expect(t.verifyTotp(secret, t.totpCode(secret, c - 2), -1, now)).toBeNull();
    expect(t.verifyTotp(secret, t.totpCode(secret, c), c, now)).toBeNull(); // the same code a second time
    for (const bad of ["", "12345", "abcdef", "1234567", "000000 1"]) expect(t.verifyTotp(secret, bad, -1, now)).toBeNull();
    expect(t.verifyTotp("", "123456", -1, now)).toBeNull();
    const codes = t.backupCodesFor(secret);
    expect(new Set(codes).size).toBe(8);
    expect(t.backupCodesFor(secret)).toEqual(codes); // the same key always has the same backup codes
    expect(t.backupCodesFor(t.newTotpSecret())).not.toEqual(codes);
    for (const c of codes) expect(c).toMatch(/^[A-Z2-7]{10}$/);
    expect(t.hashBackup(codes[0].toLowerCase() + " ")).toBe(t.hashBackup(codes[0]));
    expect(t.newTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });
});

describe("dates", () => {
  it("are shown in UAE time whatever the server clock is", async () => {
    const { uaeDateTime, uaeDate } = await import("../src/lib/time");
    expect(uaeDateTime("2026-11-17 20:30:00", "en-AE")).toMatch(/18 Nov 2026.*12:30/);
    expect(uaeDateTime("2026-11-17T20:30:00Z", "en-AE")).toMatch(/18 Nov 2026/);
    expect(uaeDate("2026-11-17 19:59:59", "en-AE")).toMatch(/17 Nov 2026/);
  });
});
