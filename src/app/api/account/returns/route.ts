import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getCustomer } from "@/lib/auth/session";
import { rateLimited, sameOrigin } from "@/lib/auth/guards";
import { notify } from "@/lib/db/notify";
import { getSetting } from "@/lib/db";

const REASONS = ["damaged", "wrong", "color", "comfort", "other"];

export async function GET() {
  const u = await getCustomer();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = db().prepare("SELECT id, order_id orderId, reason, status, created_at createdAt FROM returns WHERE customer_id = ? ORDER BY created_at DESC").all(u.id);
  return NextResponse.json({ returns: rows });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const u = await getCustomer();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (rateLimited(`ret:${u.id}`, 10)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const orderId = String(b.orderId ?? ""); const reason = String(b.reason ?? ""); const details = String(b.details ?? "").trim().slice(0, 600);
  if (!REASONS.includes(reason)) return NextResponse.json({ error: "reason" }, { status: 400 });
  const c = db();
  // days since delivery (or since the order, for older orders without a delivery date)
  const o = c.prepare(`SELECT id, status, julianday('now') - julianday(COALESCE(delivered_at, created_at)) AS days FROM orders WHERE id = ? AND customer_id = ?`).get(orderId, u.id) as
    | { id: string; status: string; days: number } | undefined;
  if (!o) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (o.status !== "delivered" && o.status !== "shipped") return NextResponse.json({ error: "not_delivered" }, { status: 409 });
  // the return window promised on the returns page (14 days after delivery unless the owner changes it; 0 = no limit)
  const windowDays = Math.max(0, Math.min(365, Number(getSetting("returns_window_days", "14")) || 0));
  if (o.status === "delivered" && windowDays > 0 && o.days > windowDays) return NextResponse.json({ error: "window", days: windowDays }, { status: 409 });
  if (c.prepare("SELECT 1 FROM returns WHERE order_id = ? AND status IN ('requested','approved','received')").get(orderId)) return NextResponse.json({ error: "exists" }, { status: 409 });
  const id = randomUUID();
  c.prepare("INSERT INTO returns (id, order_id, customer_id, reason, details) VALUES (?,?,?,?,?)").run(id, orderId, u.id, reason, details);
  notify("return", `طلب مرتجع جديد للطلب ${orderId}`, `${u.name}: ${details || reason}`, "/admin/returns");
  return NextResponse.json({ ok: true, id });
}
