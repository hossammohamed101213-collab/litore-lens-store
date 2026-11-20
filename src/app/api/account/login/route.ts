import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearFailures, clientIp, noteFailure, rateLimited, sameOrigin, tooManyFailures } from "@/lib/auth/guards";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { email, password, remember } = parsed.data;
  if (rateLimited(`login:${clientIp(request)}:${email}`, 8)) return NextResponse.json({ error: "too_many" }, { status: 429 });
  // The limit above is per visitor address. This one is per account, whatever address the guesses come from, so a
  // password can not be guessed from many addresses. Only wrong passwords count; a correct sign-in clears the count.
  if (tooManyFailures(email)) return NextResponse.json({ error: "too_many" }, { status: 429 });

  const row = db().prepare("SELECT id,name,password_hash FROM customers WHERE email = ?").get(email) as
    | { id: string; name: string; password_hash: string } | undefined;
  // Always run a hash check so timing doesn't reveal whether the email exists.
  const ok = verifyPassword(password, row?.password_hash ?? DUMMY_HASH) && !!row;
  if (!ok || !row) { noteFailure(email); return NextResponse.json({ error: "invalid_credentials" }, { status: 401 }); }
  clearFailures(email);
  await createSession("customer", row.id, remember !== false);
  return NextResponse.json({ user: { id: row.id, email, name: row.name } });
}
