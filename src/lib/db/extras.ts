import { db, fromMinor } from "@/lib/db";

export type Promo = { id: string; nameAr: string; nameEn: string; percent: number; priceAfter: number; active: boolean };
type PromoRow = { id: string; name_ar: string; name_en: string; discount_percent: number; price_after_minor: number; active: number };
const mapPromo = (r: PromoRow): Promo => ({ id: r.id, nameAr: r.name_ar, nameEn: r.name_en, percent: r.discount_percent, priceAfter: fromMinor(r.price_after_minor), active: !!r.active });

export const listPromos = (onlyActive = false): Promo[] =>
  (db().prepare(`SELECT * FROM promos ${onlyActive ? "WHERE active = 1" : ""} ORDER BY sort, rowid`).all() as PromoRow[]).map(mapPromo);

export type Feedback = { id: string; kind: string; rating: number | null; name: string; contact: string; message: string; status: string; created_at: string };
export const listFeedback = (): Feedback[] => db().prepare("SELECT * FROM feedback ORDER BY created_at DESC LIMIT 300").all() as Feedback[];

export function approvedReviews(limit = 6): Feedback[] {
  return db().prepare("SELECT * FROM feedback WHERE kind='review' AND status='approved' AND message != '' ORDER BY created_at DESC LIMIT ?").all(limit) as Feedback[];
}
export function ratingSummary(): { count: number; avg: number } {
  const r = db().prepare("SELECT COUNT(*) n, AVG(rating) a FROM feedback WHERE kind='review' AND status='approved' AND rating IS NOT NULL").get() as { n: number; a: number | null };
  return { count: r.n, avg: r.a ?? 0 };
}
