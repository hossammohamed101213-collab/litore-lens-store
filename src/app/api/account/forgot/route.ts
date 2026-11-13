import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notify } from "@/lib/db/notify";
import { clientIp, rateLimited, sameOrigin } from "@/lib/auth/guards";
import { normPhone } from "@/lib/phone";

const schema = z.object({ identifier: z.string().trim().min(5).max(160) });

/**
 * Starts a password reset. The answer is ALWAYS the same, whether or not an account exists,
 * so nobody can use this form to find out who shops here. The owner sends the link on WhatsApp.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (rateLimited(`forgot:${clientIp(request)}`, 5, 60 * 60_000)) return NextResponse.json({ error: "too_many" }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const raw = parsed.data.identifier;
  const isEmail = raw.includes("@");
  const ident = isEmail ? raw.toLowerCase() : normPhone(raw);
  if (!isEmail && ident.length < 8) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const c = db();
  const cust = (isEmail
    ? c.prepare("SELECT id FROM customers WHERE email = ?").get(ident)
    : c.prepare("SELECT id FROM customers WHERE phone = ? AND phone != ''").get(ident)) as { id: string } | undefined;
  if (cust && !c.prepare("SELECT 1 FROM password_resets WHERE customer_id = ? AND status IN ('pending','sent')").get(cust.id)) {
    c.prepare("INSERT INTO password_resets(id,identifier,customer_id) VALUES (?,?,?)").run(randomUUID(), ident, cust.id);
    notify("reset", "طلب استرجاع كلمة سر", ident, "/admin/resets");
  }
  return NextResponse.json({ ok: true });
}
