import { NextResponse } from "next/server";
import { getCommerce } from "@/lib/commerce";
import { sumLines } from "@/lib/commerce/totals";
import { validateCartSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const parsed = validateCartSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const commerce = getCommerce();
  const lines = await commerce.validateLines(parsed.data.lines);
  const subtotal = sumLines(lines);
  const coupon = parsed.data.coupon ? await commerce.validateCoupon(parsed.data.coupon, subtotal) : null;
  return NextResponse.json({
    lines,
    subtotal,
    currency: lines[0]?.currency ?? "AED",
    coupon,
    discount: coupon?.valid ? coupon.discount : 0,
  });
}
