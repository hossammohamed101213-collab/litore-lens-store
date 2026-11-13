import { randomBytes, randomUUID } from "node:crypto";
import { db, getSetting } from "@/lib/db";
import { notify } from "@/lib/db/notify";

export const refRefereePct = () => Number(getSetting("ref_referee_pct", "10")) || 10;
export const refOwnerPct = () => Number(getSetting("ref_owner_pct", "5")) || 5;

/** Referral codes are free text (letters of any language, digits, _ and -), 3 to 24 characters, case-insensitive for Latin. */
export function normalizeCode(raw: string): string | null {
  const c = raw.trim().normalize("NFKC").replace(/\s+/g, "").toUpperCase();
  return /^[\p{L}\p{N}_-]{3,24}$/u.test(c) ? c : null;
}

export const codeTaken = (code: string, exceptOwner?: string) =>
  !!db().prepare("SELECT 1 FROM referral_codes WHERE code = ? AND (owner_id IS NULL OR owner_id != ?)").get(code, exceptOwner ?? "");

export function setOwnCode(customerId: string, code: string) {
  const c = db();
  c.prepare("DELETE FROM referral_codes WHERE owner_id = ?").run(customerId);
  c.prepare("INSERT INTO referral_codes(code,owner_id) VALUES (?,?)").run(code, customerId);
}

function newCouponCode(prefix: string) {
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** One-time personal coupon (percent off the cart). */
export function issueCoupon(customerId: string, percent: number, prefix: string): string {
  const code = newCouponCode(prefix);
  db().prepare("INSERT INTO coupons(code,kind,value,min_subtotal_minor,active,max_uses,used_count,customer_id) VALUES (?,?,?,?,1,1,0,?)")
    .run(code, "percent", Math.min(100, Math.max(1, percent)), 0, customerId);
  return code;
}

/**
 * A new customer used a referral code: she gets a one-time welcome coupon, and the owner of the code (if it belongs to a customer)
 * collects reward points (percent) towards a future discount. Returns the welcome coupon, or null if the code is not usable.
 */
export function applyReferral(refereeId: string, rawCode: string): { coupon: string; percent: number } | null {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const c = db();
  const row = c.prepare("SELECT code,owner_id FROM referral_codes WHERE code = ? AND active = 1").get(code) as { code: string; owner_id: string | null } | undefined;
  if (!row || row.owner_id === refereeId) return null;
  const refPct = refRefereePct();
  const ownPct = row.owner_id ? refOwnerPct() : 0;
  let coupon = "";
  c.transaction(() => {
    c.prepare("INSERT INTO referrals(id,code,owner_id,referee_id,referee_pct,owner_pct) VALUES (?,?,?,?,?,?)").run(randomUUID(), row.code, row.owner_id, refereeId, refPct, ownPct);
    coupon = issueCoupon(refereeId, refPct, "WELCOME");
    if (row.owner_id) c.prepare("UPDATE customers SET ref_balance = MIN(100, ref_balance + ?) WHERE id = ?").run(ownPct, row.owner_id);
  })();
  notify("referral", "إحالة جديدة", `كود ${row.code} — عميلة جديدة سجّلت به`, "/admin/referrals");
  return { coupon, percent: refPct };
}
