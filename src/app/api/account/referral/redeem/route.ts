import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notify } from "@/lib/db/notify";
import { rateLimited, sameOrigin } from "@/lib/auth/guards";
import { getCustomer } from "@/lib/auth/session";

/** Asks the owner to turn the collected reward percent into a discount coupon (or a free product at 100%). The balance is held until the owner decides. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const me = await getCustomer();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (rateLimited(`redeem:${me.id}`, 10, 60 * 60_000)) return NextResponse.json({ error: "too_many" }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { kind?: string } | null;
  const kind = body?.kind === "free_product" ? "free_product" : "discount";
  const c = db();
  let percent = 0;
  c.transaction(() => {
    const b = (c.prepare("SELECT ref_balance b FROM customers WHERE id = ?").get(me.id) as { b: number }).b;
    if (b <= 0 || (kind === "free_product" && b < 100)) return;
    percent = b;
    c.prepare("UPDATE customers SET ref_balance = 0 WHERE id = ?").run(me.id);
    c.prepare("INSERT INTO redemptions(id,customer_id,percent,kind) VALUES (?,?,?,?)").run(randomUUID(), me.id, b, kind);
  })();
  if (!percent) return NextResponse.json({ error: "no_balance" }, { status: 400 });
  notify("redeem", "طلب استلام رصيد إحالات", `${me.name}: ${percent}% (${kind === "free_product" ? "منتج مجاني" : "خصم"})`, "/admin/referrals");
  return NextResponse.json({ ok: true, percent });
}
