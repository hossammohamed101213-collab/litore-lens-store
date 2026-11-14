import { NextResponse } from "next/server";
import { z } from "zod";
import { buildQuote } from "@/lib/checkout/quote";
import { clientIp, rateLimited } from "@/lib/auth/guards";

const schema = z.object({
  lines: z.array(z.object({ variantId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(99) })).min(1).max(50),
  country: z.enum(["AE", "SA", "KW", "QA", "BH", "OM"]),
  city: z.string().trim().max(60).optional(),
  couponCode: z.string().max(40).optional(),
  shippingRateId: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  // each quote may ask Aramex for a live price, so cap what one visitor can trigger
  if (rateLimited(`quote:${clientIp(request)}`, 120)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  return NextResponse.json(await buildQuote(parsed.data));
}
