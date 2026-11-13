import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { uploadDir } from "@/lib/db";
import { MIME } from "@/lib/uploads";

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = /^[a-f0-9-]+\.(jpg|png|webp)$/.exec(file);
  if (!m) return new NextResponse("Not found", { status: 404 });
  const full = path.join(uploadDir(), file);
  if (!fs.existsSync(full)) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(fs.readFileSync(full)), {
    headers: { "content-type": MIME[m[1]], "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
