import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sameOrigin } from "@/lib/auth/guards";
import { getCustomer } from "@/lib/auth/session";
import { addressInputSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const user = await getCustomer();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = addressInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const a = parsed.data;
  const id = randomUUID();
  db().prepare("INSERT INTO addresses(id,customer_id,label,name,phone,line1,city,country) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, user.id, a.label, a.name, a.phone, a.line1, a.city, a.country);
  return NextResponse.json({ address: { id, ...a } });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const user = await getCustomer();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  db().prepare("DELETE FROM addresses WHERE id = ? AND customer_id = ?").run(id, user.id);
  return NextResponse.json({ ok: true });
}
