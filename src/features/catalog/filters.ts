import type { ProductQuery } from "@/lib/commerce/types";

const sorts = ["recommended", "newest", "price-asc", "price-desc"] as const;

export type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseQuery(params: RawParams): ProductQuery & { sort: (typeof sorts)[number] } {
  const sort = one(params.sort);
  return {
    search: one(params.q)?.trim() || undefined,
    colorFamily: one(params.color) || undefined,
    sort: (sorts as readonly string[]).includes(sort ?? "") ? (sort as (typeof sorts)[number]) : "recommended",
  };
}

/** Build a shop URL, keeping only meaningful params (filters live in the URL). */
export function buildHref(base: string, params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && v !== "recommended") usp.set(k, v);
  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
}
