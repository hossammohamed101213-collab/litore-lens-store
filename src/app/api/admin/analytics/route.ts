import { NextResponse } from "next/server";
import { snapshot } from "@/lib/analytics";
import { hubStats } from "@/lib/hub";
import { getAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const d = Number(q.get("days"));
  const snap = snapshot([1, 7, 30, 90].includes(d) ? d : 7);
  return NextResponse.json(q.get("hub") ? { ...snap, hub: hubStats() } : snap, { headers: { "cache-control": "no-store" } });
}
