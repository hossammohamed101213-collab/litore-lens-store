import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapOrder } from "@/lib/commerce/db-provider";
import { getCustomer } from "@/lib/auth/session";

export async function GET() {
  const user = await getCustomer();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = db().prepare("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC").all(user.id) as Parameters<typeof mapOrder>[0][];
  return NextResponse.json({ orders: rows.map(mapOrder) });
}
