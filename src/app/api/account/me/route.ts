import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomer } from "@/lib/auth/session";

export async function GET() {
  const user = await getCustomer();
  if (!user) return NextResponse.json({ user: null });
  const addresses = db().prepare("SELECT id,label,name,phone,line1,city,country FROM addresses WHERE customer_id = ?").all(user.id);
  return NextResponse.json({ user: { ...user, addresses } });
}
