import { NextResponse } from "next/server";
import { snapshot } from "@/lib/analytics";
import { getAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const d = Number(new URL(req.url).searchParams.get("days"));
  return NextResponse.json(snapshot([1, 7, 30, 90].includes(d) ? d : 7), { headers: { "cache-control": "no-store" } });
}
