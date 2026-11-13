import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimited, sameOrigin } from "@/lib/auth/guards";

const schema = z.object({
  kind: z.enum(["review", "complaint", "suggestion"]),
  rating: z.number().int().min(1).max(5).optional(),
  name: z.string().trim().max(80).default(""),
  contact: z.string().trim().max(120).default(""),
  message: z.string().trim().max(1500).default(""),
}).refine((v) => v.kind === "review" ? v.rating != null : v.message.length >= 5, { message: "invalid" });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (rateLimited(`feedback:${clientIp(request)}`, 8, 60 * 60_000)) return NextResponse.json({ error: "too_many" }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const v = parsed.data;
  db().prepare("INSERT INTO feedback(id,kind,rating,name,contact,message) VALUES (?,?,?,?,?,?)")
    .run(randomUUID(), v.kind, v.kind === "review" ? v.rating : null, v.name, v.contact, v.message);
  return NextResponse.json({ ok: true });
}
