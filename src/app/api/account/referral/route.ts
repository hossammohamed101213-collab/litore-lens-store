import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimited, sameOrigin } from "@/lib/auth/guards";
import { getCustomer } from "@/lib/auth/session";
import { codeTaken, normalizeCode, refOwnerPct, refRefereePct, setOwnCode } from "@/lib/referrals";

/** The signed-in customer's referral code, reward balance, personal coupons and redemption requests. */
export async function GET() {
  const me = await getCustomer();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  const c = db();
  const code = (c.prepare("SELECT code FROM referral_codes WHERE owner_id = ?").get(me.id) as { code: string } | undefined)?.code ?? null;
  const balance = (c.prepare("SELECT ref_balance b FROM customers WHERE id = ?").get(me.id) as { b: number }).b;
  const joined = (c.prepare("SELECT COUNT(*) n FROM referrals WHERE owner_id = ?").get(me.id) as { n: number }).n;
  const coupons = c.prepare("SELECT code,value FROM coupons WHERE customer_id = ? AND active = 1 AND (max_uses IS NULL OR used_count < max_uses) ORDER BY rowid DESC").all(me.id);
  const redemptions = c.prepare("SELECT id,percent,kind,status,coupon_code,created_at FROM redemptions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20").all(me.id);
  return NextResponse.json({ code, balance, joined, coupons, redemptions, refereePct: refRefereePct(), ownerPct: refOwnerPct() });
}

/** Create or change her own referral code (free text). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const me = await getCustomer();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (rateLimited(`refcode:${me.id}`, 15, 60 * 60_000)) return NextResponse.json({ error: "too_many" }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = normalizeCode(body?.code ?? "");
  if (!code) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (codeTaken(code, me.id)) return NextResponse.json({ error: "code_taken" }, { status: 409 });
  setOwnCode(me.id, code);
  return NextResponse.json({ ok: true, code });
}
