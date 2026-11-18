import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

// Daily reconciliation, error tracking and outage alerts. Isolated database; the "gateway" is a local stand-in.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-ops-"));
process.env.DATABASE_PATH = path.join(dir, "t.db");
process.env.TELR_ENDPOINT = "http://127.0.0.1:4391/order.json";

type Db = ReturnType<typeof import("../src/lib/db").db>;
let conn: Db;
let recon: typeof import("../src/lib/ops/daily-reconcile");
let errors: typeof import("../src/lib/ops/errors");
let server: http.Server;
let gatewayUp = true;
const answers = new Map<string, unknown>(); // payment ref -> what the gateway says
let seq = 0;
const DAY = "2026-11-10"; // a UAE day; 10:00 UTC falls inside it

function order(o: { ps?: string; status?: string; sub?: number; disc?: number; ship?: number; total?: number; refund?: number; ref?: string | null; lines?: number; at?: string; mock?: number } = {}) {
  const id = `LT-O${String(++seq).padStart(11, "0")}`;
  const sub = o.sub ?? 10000, disc = o.disc ?? 0, ship = o.ship ?? 2500;
  const total = o.total ?? sub - disc + ship;
  conn.prepare(`INSERT INTO orders (id,email,phone,status,payment_status,subtotal_minor,discount_minor,shipping_minor,total_minor,currency,shipping_label_ar,shipping_label_en,address_json,idempotency_key,payment_ref,refund_minor,is_mock,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, `o${seq}@example.com`, "+971500000000", o.status ?? "new", o.ps ?? "paid", sub, disc, ship, total, "AED", "x", "x", "{}", `ops-${seq}`,
    o.ref === undefined ? `REF${seq}` : o.ref, o.refund ?? 0, o.mock ?? 0, o.at ?? `${DAY} 10:00:00`);
  conn.prepare("INSERT INTO order_lines (order_id,variant_id,product_id,slug,name_ar,name_en,sku,unit_minor,quantity) VALUES (?,?,?,?,?,?,?,?,?)").run(id, "v", "p", "s", "a", "e", "sku", o.lines ?? sub, 1);
  if (o.ref !== null) answers.set(o.ref ?? `REF${seq}`, { order: { status: { code: 3 }, transaction: { status: "A" }, cartid: id, amount: (total / 100).toFixed(2), currency: "AED" } });
  return id;
}
const kinds = (r: { issues: { order: string; kind: string }[] }, id: string) => r.issues.filter((i) => i.order === id).map((i) => i.kind);

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      if (!gatewayUp) { req.socket.destroy(); return; }
      const ref = JSON.parse(body || "{}").order?.ref; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(answers.get(ref) ?? { order: { status: { code: 1 } } }));
    });
  });
  await new Promise<void>((ok) => server.listen(4391, "127.0.0.1", ok));
  const dbm = await import("../src/lib/db"); conn = dbm.db();
  dbm.setSetting("pay_telr_store", "12345"); dbm.setSetting("pay_telr_enabled", "1");
  (await import("../src/lib/secrets")).setSecret("pay_telr_key", "TEST-KEY");
  recon = await import("../src/lib/ops/daily-reconcile");
  errors = await import("../src/lib/ops/errors");
});
afterAll(() => { server.close(); });

describe("daily reconciliation: orders against payments against refunds", () => {
  it("a clean day has no differences and every card payment is confirmed again at the gateway", async () => {
    order(); order({ disc: 1000 }); order({ ps: "pending", ref: null }); order({ ps: "refunded", refund: 12500 });
    const r = await recon.reconcileDay(DAY);
    expect(r.issues).toEqual([]);
    expect(r).toMatchObject({ orders: 4, paid: 3, paidMinor: 12500 + 11500 + 12500, refundedMinor: 12500, verified: 3, unverified: 0 });
  });
  it("orders of another UAE day are not counted (20:30 UTC is already the next day in the UAE)", async () => {
    order({ at: `${DAY} 20:30:00` });
    expect((await recon.reconcileDay(DAY)).orders).toBe(4);
    expect((await recon.reconcileDay("2026-11-11")).orders).toBe(1);
  });
  it("finds every kind of difference inside the store's own books", async () => {
    const lines = order({ lines: 9000 });
    const total = order({ total: 99999 });
    const partial = order({ ps: "refunded", refund: 500 });
    const noRef = order({ ref: null });
    const cancelled = order({ status: "cancelled" });
    const r = await recon.reconcileDay(DAY);
    expect(kinds(r, lines)).toContain("lines");
    expect(kinds(r, total)).toContain("total");
    expect(kinds(r, partial)).toContain("refund");
    expect(kinds(r, noRef)).toContain("no_payment");
    expect(kinds(r, cancelled)).toContain("cancelled_paid");
  });
  it("finds a payment the gateway does not confirm, a different amount, and a payment that belongs to another order", async () => {
    const gone = order(); answers.set(`REF${seq}`, { order: { status: { code: -2 }, transaction: { status: "D" } } });
    const amount = order(); answers.set(`REF${seq}`, { order: { status: { code: 3 }, transaction: { status: "A" }, cartid: amount, amount: "1.00", currency: "AED" } });
    const other = order(); answers.set(`REF${seq}`, { order: { status: { code: 3 }, transaction: { status: "A" }, cartid: "LT-SOMEONE-ELSE", amount: "125.00", currency: "AED" } });
    const r = await recon.reconcileDay(DAY);
    for (const id of [gone, amount, other]) expect(kinds(r, id)).toEqual(["gateway"]);
  });
  it("one gateway payment attached to two orders is reported", async () => {
    const a = order({ ref: "SAME" }); order({ ref: "SAME" });
    expect(kinds(await recon.reconcileDay(DAY), a)).toContain("duplicate_payment");
  });
  it("a gateway that does not answer counts as unverified, never as fine and never as a difference", async () => {
    gatewayUp = false;
    const r = await recon.reconcileDay("2026-11-11");
    gatewayUp = true;
    expect(r).toMatchObject({ orders: 1, verified: 0, unverified: 1 });
    expect(r.issues).toEqual([]);
  });
  it("the result is stored once per day and the owner is alerted once when something is off", async () => {
    await recon.runDailyReconciliation(DAY); await recon.runDailyReconciliation(DAY);
    const row = conn.prepare("SELECT orders, issues_json FROM reconciliations WHERE day = ?").get(DAY) as { orders: number; issues_json: string };
    expect(JSON.parse(row.issues_json).length).toBeGreaterThan(5);
    expect((conn.prepare("SELECT COUNT(*) n FROM reconciliations").get() as { n: number }).n).toBe(1);
    expect((conn.prepare("SELECT COUNT(*) n FROM notifications WHERE title LIKE ?").get(`مطابقة يوم ${DAY}%`) as { n: number }).n).toBe(1);
  });
  it("runs by itself once a day: only after 06:00 UAE time, only for yesterday, never twice", async () => {
    expect(await recon.maybeRunDailyReconciliation(new Date("2026-11-12T01:00:00Z"))).toBeNull(); // 05:00 in the UAE
    const r = await recon.maybeRunDailyReconciliation(new Date("2026-11-12T03:00:00Z")); // 07:00 in the UAE
    expect(r?.day).toBe("2026-11-11");
    expect(await recon.maybeRunDailyReconciliation(new Date("2026-11-12T09:00:00Z"))).toBeNull();
  });
});

describe("error tracking and outage alerts", () => {
  const alerts = (like: string) => (conn.prepare("SELECT COUNT(*) n FROM notifications WHERE title LIKE ?").get(like) as { n: number }).n;
  it("errors are stored without secrets, and the log keeps only the newest 1000", () => {
    errors.recordError("server", "boom token=abc123 password: hunter2", "GET /ar/shop?x=1");
    const row = conn.prepare("SELECT place, message FROM error_log ORDER BY id DESC LIMIT 1").get() as { place: string; message: string };
    expect(row.place).toBe("GET /ar/shop");
    expect(row.message).not.toMatch(/abc123|hunter2/);
    for (let i = 0; i < 1010; i++) errors.recordError("test", "x");
    expect((conn.prepare("SELECT COUNT(*) n FROM error_log").get() as { n: number }).n).toBeLessThanOrEqual(1001);
  });
  it("one or two errors do not alert; a burst of five in ten minutes alerts once", () => {
    conn.prepare("DELETE FROM error_log").run();
    errors.recordError("server", "a"); errors.recordError("server", "b");
    expect(errors.raiseErrorAlerts()).toBe(0);
    for (let i = 0; i < 4; i++) errors.recordError("server", "c");
    expect(errors.raiseErrorAlerts()).toBe(1);
    expect(errors.raiseErrorAlerts()).toBe(0);
    expect(alerts("أخطاء متكررة%")).toBe(1);
  });
  it("a normal mix of payments does not alert; mostly failed payments in the last hour alert once", () => {
    for (let i = 0; i < 4; i++) order({ at: new Date().toISOString().slice(0, 19).replace("T", " ") });
    order({ ps: "failed", at: new Date().toISOString().slice(0, 19).replace("T", " ") });
    expect(errors.raisePaymentFailureAlert()).toBe(0);
    for (let i = 0; i < 9; i++) order({ ps: "failed", at: new Date().toISOString().slice(0, 19).replace("T", " ") });
    expect(errors.raisePaymentFailureAlert()).toBe(1);
    expect(errors.raisePaymentFailureAlert()).toBe(0);
  });
  it("an outside service that fails three times in a row alerts once; a success in between resets the count", () => {
    errors.serviceResult("Courier-X", false); errors.serviceResult("Courier-X", false); errors.serviceResult("Courier-X", true); errors.serviceResult("Courier-X", false);
    expect(alerts("خدمة Courier-X%")).toBe(0);
    errors.serviceResult("Courier-X", false); errors.serviceResult("Courier-X", false); errors.serviceResult("Courier-X", false);
    expect(alerts("خدمة Courier-X%")).toBe(1);
  });
});

describe("real-visitor speed figures", () => {
  it("the 75th percentile is the value 3 out of 4 visits are at or under", async () => {
    const v = await import("../src/lib/ops/vitals");
    expect(v.p75([])).toBeNull();
    expect(v.p75([900])).toBe(900);
    expect(v.p75([4000, 1000, 2000, 3000])).toBe(3000);
    expect(v.p75(Array.from({ length: 100 }, (_, i) => i + 1))).toBe(75);
  });
  it("grades follow Google's published limits", async () => {
    const { grade } = await import("../src/lib/ops/vitals");
    expect([grade("lcp", 2500), grade("lcp", 2501), grade("lcp", 4001), grade("lcp", null)]).toEqual(["good", "mid", "poor", "none"]);
    expect([grade("inp", 200), grade("inp", 500), grade("inp", 501)]).toEqual(["good", "mid", "poor"]);
    expect([grade("cls", 100), grade("cls", 250), grade("cls", 251)]).toEqual(["good", "mid", "poor"]);
  });
  it("phones and computers are summarised apart, product pages are grouped, and a visit with no tap does not count as a reaction time", async () => {
    const v = await import("../src/lib/ops/vitals");
    for (const lcp of [1000, 2000, 3000, 4000]) v.recordVitals({ path: `/ar/shop/item-${lcp}`, lcp, cls: 20, inp: lcp === 1000 ? 0 : 150, width: 390 });
    v.recordVitals({ path: "/en", lcp: 700, cls: 0, inp: 80, width: 1440 });
    const s = v.vitalsSummary(28);
    expect(s.byDevice.find((d) => d.device === "phone")).toMatchObject({ visits: 4, lcp: 3000, inp: 150, cls: 20 });
    expect(s.byDevice.find((d) => d.device === "desktop")).toMatchObject({ visits: 1, lcp: 700 });
    expect(s.pages[0]).toMatchObject({ path: "/ar/shop/…", visits: 4, lcp: 3000 });
  });
});
