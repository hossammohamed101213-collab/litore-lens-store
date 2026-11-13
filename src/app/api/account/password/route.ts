import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimited, sameOrigin } from "@/lib/auth/guards";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getCustomer } from "@/lib/auth/session";

const schema = z.object({ current: z.string().max(200), next: z.string().min(8).max(200) });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const me = await getCustomer();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (rateLimited(`pw-change:${me.id}`, 6)) return NextResponse.json({ error: "too_many" }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const row = db().prepare("SELECT password_hash FROM customers WHERE id = ?").get(me.id) as { password_hash: string };
  if (!verifyPassword(parsed.data.current, row.password_hash)) return NextResponse.json({ error: "wrong_password" }, { status: 403 });
  db().prepare("UPDATE customers SET password_hash = ? WHERE id = ?").run(hashPassword(parsed.data.next), me.id);
  return NextResponse.json({ ok: true });
}
