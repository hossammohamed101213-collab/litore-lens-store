import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth/guards";
import { destroySession } from "@/lib/auth/session";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await destroySession("customer");
  return NextResponse.json({ ok: true });
}
