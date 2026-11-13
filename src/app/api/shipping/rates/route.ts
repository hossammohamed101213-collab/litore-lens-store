import { NextResponse } from "next/server";
import { z } from "zod";
import { getShipping } from "@/lib/providers";

const schema = z.object({
  country: z.enum(["AE", "SA", "KW", "QA", "BH", "OM"]),
  subtotal: z.number().min(0),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const rates = await getShipping().getRates({ name: "", phone: "", line1: "", city: "", country: parsed.data.country }, parsed.data.subtotal);
  return NextResponse.json({ rates });
}
