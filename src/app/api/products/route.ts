import { NextResponse } from "next/server";
import { getCommerce } from "@/lib/commerce";

/** Public catalog lookup by ids (used by the wishlist page). */
export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.get("ids")?.split(",").filter(Boolean).slice(0, 50) ?? [];
  const all = await getCommerce().listProducts();
  return NextResponse.json({ products: all.filter((p) => ids.includes(p.id)) });
}
