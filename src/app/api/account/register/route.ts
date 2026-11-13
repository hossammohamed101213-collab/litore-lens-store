import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notify } from "@/lib/db/notify";
import { applyReferral, codeTaken, normalizeCode, setOwnCode } from "@/lib/referrals";
import { normPhone } from "@/lib/phone";
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
  const { name, email, password, phone, referralCode, myCode } = parsed.data;
  const wantedCode = myCode ? normalizeCode(myCode) : null;
  if (myCode && !wantedCode) return NextResponse.json({ error: "invalid", field: "myCode" }, { status: 400 });
  if (wantedCode && codeTaken(wantedCode)) return NextResponse.json({ error: "code_taken", field: "myCode" }, { status: 409 });
  if (db().prepare("SELECT 1 FROM customers WHERE email = ?").get(email)) {
    return NextResponse.json({ error: "exists" }, { status: 409 });
  }
  const id = randomUUID();
  db().prepare("INSERT INTO customers(id,email,name,password_hash,phone) VALUES (?,?,?,?,?)").run(id, email, name, hashPassword(password), normPhone(phone ?? ""));
  if (wantedCode) setOwnCode(id, wantedCode);
  const welcome = referralCode ? applyReferral(id, referralCode) : null;
  notify("customer", "عميلة جديدة", `${name} — ${email}`, "/admin/customers");
  await createSession("customer", id, true);
  return NextResponse.json({ user: { id, email, name }, welcome, referralInvalid: !!referralCode && !welcome });
}
