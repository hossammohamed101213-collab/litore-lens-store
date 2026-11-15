import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
type N = { id: number; kind: string; title: string; body: string; link: string; is_read: number; created_at: string };

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = db().prepare("SELECT id,kind,title,body,link,is_read,created_at FROM notifications ORDER BY id DESC LIMIT 15").all() as N[];
  const unread = (db().prepare("SELECT COUNT(*) c FROM notifications WHERE is_read = 0").get() as { c: number }).c;
  return NextResponse.json({ items, unread }, { headers: { "cache-control": "no-store" } });
}

/** Marks one notification (body {id}) or all of them (empty body) as read. */
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: number };
  if (b.id) db().prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(Number(b.id));
  else db().prepare("UPDATE notifications SET is_read = 1").run();
  const unread = (db().prepare("SELECT COUNT(*) c FROM notifications WHERE is_read = 0").get() as { c: number }).c;
  return NextResponse.json({ ok: true, unread }, { headers: { "cache-control": "no-store" } });
}
