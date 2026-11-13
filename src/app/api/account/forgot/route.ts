import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notify } from "@/lib/db/notify";
import { clientIp, rateLimited, sameOrigin } from "@/lib/auth/guards";
import { normPhone } from "@/lib/phone";
import { emailEnabled, resetEmail, sendEmail, siteUrl } from "@/lib/email";

const schema = z.object({ identifier: z.string().trim().min(5).max(160), locale: z.enum(["ar", "en"]).optional() });

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
    ? c.prepare("SELECT id,name,email FROM customers WHERE email = ?").get(ident)
    : c.prepare("SELECT id,name,email FROM customers WHERE phone = ? AND phone != ''").get(ident)) as { id: string; name: string; email: string } | undefined;
  if (cust && emailEnabled()) {
    // Self-service: e-mail a one-hour link to the address on the account (works for e-mail or phone lookups).
    const token = randomBytes(32).toString("base64url");
    const id = randomUUID();
    c.prepare("UPDATE password_resets SET status='cancelled', token_hash=NULL WHERE customer_id = ? AND status IN ('pending','sent')").run(cust.id);
    c.prepare("INSERT INTO password_resets(id,identifier,customer_id,status,token_hash,expires_at) VALUES (?,?,?,'sent',?,?)")
      .run(id, ident, cust.id, createHash("sha256").update(token).digest("hex"), Math.floor(Date.now() / 1000) + 3600);
    const mail = resetEmail(parsed.data.locale ?? "ar", cust.name, `${siteUrl()}/${parsed.data.locale ?? "ar"}/account/reset?token=${token}`);
    const sent = await sendEmail(cust.email, mail.subject, mail.html, mail.text);
    if (!sent) {
      // The e-mail service failed (key changed, quota, outage): never leave her stuck — hand the request to the owner.
      c.prepare("UPDATE password_resets SET status='pending', token_hash=NULL, expires_at=NULL WHERE id = ?").run(id);
      notify("reset", "طلب استرجاع كلمة سر (تعذّر إرسال الإيميل)", ident, "/admin/resets");
    }
  } else if (cust && !c.prepare("SELECT 1 FROM password_resets WHERE customer_id = ? AND status IN ('pending','sent')").get(cust.id)) {
    // No e-mail service yet: the owner sends the link on WhatsApp.
    c.prepare("INSERT INTO password_resets(id,identifier,customer_id) VALUES (?,?,?)").run(randomUUID(), ident, cust.id);
    notify("reset", "طلب استرجاع كلمة سر", ident, "/admin/resets");
  }
  return NextResponse.json({ ok: true, via: emailEnabled() ? "email" : "whatsapp" });
}
