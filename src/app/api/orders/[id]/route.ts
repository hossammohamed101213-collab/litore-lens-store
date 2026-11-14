import { NextResponse } from "next/server";
import { getCommerce } from "@/lib/commerce";
import { clientIp, rateLimited } from "@/lib/auth/guards";

// Public status check by order number. It returns no name, phone, email or address (the order number is the only key).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (rateLimited(`order-status:${clientIp(req)}`, 30)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const { id } = await params;
  const order = await getCommerce().getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ order: { id: order.id, status: order.status, paymentStatus: order.paymentStatus, trackingNumber: order.trackingNumber, createdAt: order.createdAt } });
}
