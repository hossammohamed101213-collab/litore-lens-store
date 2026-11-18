import { NextResponse } from "next/server";
import { rateLimited, sameOrigin } from "@/lib/auth/guards";
import { recordVitals } from "@/lib/ops/vitals";

const int = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : null);

// Anonymous speed report from a visitor's browser (sent only after they accepted statistics cookies).
// Stores the page, phone/desktop and three numbers. No IP, no identifier, nothing about the person.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (rateLimited(`vitals:${ip}`, 60)) return NextResponse.json({ ok: false }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const path = String(b.path ?? "").split("?")[0].slice(0, 120);
  const lcp = int(b.lcp, 120_000), cls = int(b.cls, 10_000), inp = int(b.inp, 60_000), width = int(b.w, 10_000);
  if (!/^\/(ar|en)(\/[\w\-./%]*)?$/.test(path) || lcp == null || lcp === 0 || cls == null || inp == null || width == null) return NextResponse.json({ ok: false }, { status: 400 });
  try { recordVitals({ path, lcp, cls, inp, width }); } catch { return NextResponse.json({ ok: false }, { status: 503 }); }
  return NextResponse.json({ ok: true });
}
