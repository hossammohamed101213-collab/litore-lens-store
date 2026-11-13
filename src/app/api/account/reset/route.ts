import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimited, sameOrigin } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";

const schema = z.object({ token: z.string().min(20).max(100), password: z.string().min(8).max(200) });
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (rateLimited(`reset:${clientIp(request)}`, 15)) return NextResponse.json({ error: "too_many" }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const c = db();
  const row = c.prepare("SELECT id,customer_id,expires_at FROM password_resets WHERE token_hash = ? AND status = 'sent'").get(sha(parsed.data.token)) as
    | { id: string; customer_id: string; expires_at: number } | undefined;
  if (!row || row.expires_at < Math.floor(Date.now() / 1000)) return NextResponse.json({ error: "expired" }, { status: 410 });
  c.transaction(() => {
    c.prepare("UPDATE customers SET password_hash = ? WHERE id = ?").run(hashPassword(parsed.data.password), row.customer_id);
    c.prepare("UPDATE password_resets SET status='done', token_hash=NULL WHERE id = ?").run(row.id);
    c.prepare("DELETE FROM sessions WHERE kind='customer' AND user_id = ?").run(row.customer_id); // sign out every device
  })();
  return NextResponse.json({ ok: true });
}
