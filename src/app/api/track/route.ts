import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classifyReferrer, parseUA } from "@/lib/analytics";
import { rateLimited, sameOrigin } from "@/lib/auth/guards";

// Anonymous page-view beacon. Only sent by the browser after the visitor accepted statistics cookies.
// Stores no IP and no identifier beyond a random per-tab id; admin pages are never counted.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (rateLimited(`track:${ip}`, 120)) return NextResponse.json({ ok: false }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const path = String(b.path ?? "").split("?")[0].slice(0, 200);
  if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) return NextResponse.json({ ok: true });
  const ua = parseUA(req.headers.get("user-agent") ?? "");
  const host = new URL(req.url).hostname;
  const ref = classifyReferrer(String(b.ref ?? ""), req.headers.get("host")?.split(":")[0] ?? host);
  db().prepare("INSERT INTO page_views (ts, path, locale, device, browser, os, screen, referrer, source, visit) VALUES (?,?,?,?,?,?,?,?,?,?)").run(
    Date.now(), path, path.split("/")[1]?.slice(0, 2) ?? "", ua.device, ua.browser, ua.os,
    String(b.screen ?? "").replace(/[^0-9x]/g, "").slice(0, 12), ref.host.slice(0, 80), ref.source, String(b.visit ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 24),
  );
  return NextResponse.json({ ok: true });
}
