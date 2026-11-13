import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getAdmin } from "@/lib/auth/session";
import { rateLimited } from "@/lib/auth/guards";
import { backupZip } from "@/lib/backup";
import { audit } from "@/lib/db/notify";
import { setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (rateLimited(`backup:${admin.id}`, 4)) return NextResponse.json({ error: "rate" }, { status: 429 });
  audit(admin.email, "تحميل نسخة احتياطية", "");
  setSetting("last_backup_at", new Date().toISOString());
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new Response(Readable.toWeb(Readable.from(backupZip())) as ReadableStream, {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="litore-backup-${stamp}.zip"`, "cache-control": "no-store" },
  });
}
