import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimited, sameOrigin } from "@/lib/auth/guards";
import { verifyPassword } from "@/lib/auth/password";
import { getCustomer } from "@/lib/auth/session";
import { normPhone } from "@/lib/phone";
import { deleteImage, saveImage } from "@/lib/uploads";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(20).regex(/^([+\d][\d\s-]{6,17})?$/),
  birthday: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  city: z.string().trim().max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  currentPassword: z.string().max(200).optional(),
});

/** Update the signed-in customer's profile. Changing the e-mail needs the current password. */
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const me = await getCustomer();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid", field: parsed.error.issues[0]?.path[0] }, { status: 400 });
  const v = parsed.data;
  if (v.email !== me.email) {
    if (rateLimited(`email-change:${me.id}`, 5)) return NextResponse.json({ error: "too_many" }, { status: 429 });
    const row = db().prepare("SELECT password_hash FROM customers WHERE id = ?").get(me.id) as { password_hash: string };
    if (!v.currentPassword || !verifyPassword(v.currentPassword, row.password_hash)) return NextResponse.json({ error: "wrong_password" }, { status: 403 });
    if (db().prepare("SELECT 1 FROM customers WHERE email = ? AND id != ?").get(v.email, me.id)) return NextResponse.json({ error: "exists" }, { status: 409 });
  }
  db().prepare("UPDATE customers SET name=?, phone=?, birthday=?, city=?, email=? WHERE id=?")
    .run(v.name, normPhone(v.phone), v.birthday, v.city, v.email, me.id);
  return NextResponse.json({ ok: true });
}

/** Upload (multipart "avatar") or remove (?remove=1) the profile photo. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const me = await getCustomer();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (rateLimited(`avatar:${me.id}`, 20, 60 * 60_000)) return NextResponse.json({ error: "too_many" }, { status: 429 });
  const url = new URL(request.url);
  if (url.searchParams.get("remove")) {
    deleteImage(me.avatar);
    db().prepare("UPDATE customers SET avatar='' WHERE id=?").run(me.id);
    return NextResponse.json({ ok: true, avatar: "" });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("avatar");
  if (!(file instanceof File)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const saved = await saveImage(file);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });
  deleteImage(me.avatar);
  db().prepare("UPDATE customers SET avatar=? WHERE id=?").run(saved.name, me.id);
  return NextResponse.json({ ok: true, avatar: saved.name });
}
