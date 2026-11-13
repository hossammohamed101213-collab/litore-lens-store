import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notify } from "@/lib/db/notify";
import { clientIp, rateLimited, sameOrigin } from "@/lib/auth/guards";
import { normPhone } from "@/lib/phone";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,17}$/),
  email: z.string().trim().toLowerCase().email().max(160).optional().or(z.literal("")),
  social: z.string().trim().max(300).default(""),
  about: z.string().trim().max(1000).default(""),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (rateLimited(`affiliate:${clientIp(request)}`, 5, 60 * 60_000)) return NextResponse.json({ error: "too_many" }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid", field: parsed.error.issues[0]?.path[0] }, { status: 400 });
  const v = parsed.data;
  const phone = normPhone(v.phone);
  if (db().prepare("SELECT 1 FROM affiliates WHERE phone = ? AND status != 'rejected'").get(phone)) return NextResponse.json({ ok: true }); // same answer, no duplicate
  db().prepare("INSERT INTO affiliates(id,name,phone,email,social,about) VALUES (?,?,?,?,?,?)").run(randomUUID(), v.name, phone, v.email ?? "", v.social, v.about);
  notify("affiliate", "طلب انضمام مسوّقة بالعمولة", `${v.name} — ${phone}`, "/admin/affiliates");
  return NextResponse.json({ ok: true });
}
