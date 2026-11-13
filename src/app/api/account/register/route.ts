import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, rateLimited, sameOrigin } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (rateLimited(`register:${clientIp(request)}`, 10)) return NextResponse.json({ error: "too_many" }, { status: 429 });
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return NextResponse.json({ error: "invalid", field }, { status: 400 });
  }
  const { name, email, password } = parsed.data;
  if (db().prepare("SELECT 1 FROM customers WHERE email = ?").get(email)) {
    return NextResponse.json({ error: "exists" }, { status: 409 });
  }
  const id = randomUUID();
  db().prepare("INSERT INTO customers(id,email,name,password_hash) VALUES (?,?,?,?)").run(id, email, name, hashPassword(password));
  await createSession("customer", id);
  return NextResponse.json({ user: { id, email, name } });
}
