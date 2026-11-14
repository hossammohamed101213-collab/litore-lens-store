import { NextResponse } from "next/server";
import { z } from "zod";
import { getShipping } from "@/lib/providers";
import { clientIp, rateLimited } from "@/lib/auth/guards";

const schema = z.object({
  country: z.enum(["AE", "SA", "KW", "QA", "BH", "OM"]),
  city: z.string().trim().max(60).optional(),
  subtotal: z.number().min(0),
});

export async function POST(request: Request) {
  if (rateLimited(`rates:${clientIp(request)}`, 120)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const rates = await getShipping().getRates({ name: "", phone: "", line1: "", city: parsed.data.city ?? "", country: parsed.data.country }, parsed.data.subtotal);
  return NextResponse.json({ rates });
}
