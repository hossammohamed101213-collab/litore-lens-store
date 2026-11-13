import { NextResponse } from "next/server";
import { getCommerce } from "@/lib/commerce";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getCommerce().getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ order });
}
