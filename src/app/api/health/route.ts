import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** For uptime monitors and the post-deploy check: says only whether the store and its database answer. No data, no secrets. */
export async function GET() {
  try {
    const ok = (db().prepare("SELECT 1 AS n").get() as { n: number }).n === 1;
    return NextResponse.json({ ok }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
