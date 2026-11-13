import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sameOrigin } from "@/lib/auth/guards";
import { getCustomer } from "@/lib/auth/session";

const schema = z.object({
  cart: z.object({
    lines: z.array(z.object({ variantId: z.string().max(80), quantity: z.number().int().min(1).max(99) })).max(60),
    coupon: z.string().max(40).nullable().optional(),
  }).optional(),
  wishlist: z.array(z.string().max(80)).max(300).optional(),
});

/** The saved cart + favourites of the signed-in customer, so they follow her to any device. */
export async function GET() {
  const me = await getCustomer();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  const row = db().prepare("SELECT cart,wishlist FROM customer_data WHERE customer_id = ?").get(me.id) as { cart: string; wishlist: string } | undefined;
  return NextResponse.json({
    cart: row ? JSON.parse(row.cart) : { lines: [], coupon: null },
    wishlist: row ? JSON.parse(row.wishlist) : [],
  });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const me = await getCustomer();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { cart, wishlist } = parsed.data;
  const c = db();
  c.prepare("INSERT OR IGNORE INTO customer_data(customer_id) VALUES (?)").run(me.id);
  if (cart) c.prepare("UPDATE customer_data SET cart=?, updated_at=datetime('now') WHERE customer_id=?").run(JSON.stringify(cart), me.id);
  if (wishlist) c.prepare("UPDATE customer_data SET wishlist=?, updated_at=datetime('now') WHERE customer_id=?").run(JSON.stringify(wishlist), me.id);
  return NextResponse.json({ ok: true });
}
