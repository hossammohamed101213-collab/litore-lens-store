import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/session";
import { rateLimited } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { fetchQuiqupLabel } from "@/lib/shipping/quiqup";

export const dynamic = "force-dynamic";

/** Admin-only: downloads the Quiqup PDF label for an order (the API key never leaves the server). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (rateLimited(`label:${admin.id}`, 60)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const { id } = await params;
  if (!/^LT-[A-F0-9]{8,16}$/.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const row = db().prepare("SELECT carrier, carrier_ref FROM orders WHERE id = ?").get(id) as { carrier: string | null; carrier_ref: string | null } | undefined;
  if (!row || row.carrier !== "quiqup" || !row.carrier_ref) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const pdf = await fetchQuiqupLabel(row.carrier_ref).catch(() => null);
  if (!pdf) return NextResponse.json({ error: "label_unavailable" }, { status: 502 });
  return new Response(pdf as BodyInit, {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${id}.pdf"`, "cache-control": "no-store" },
  });
}
