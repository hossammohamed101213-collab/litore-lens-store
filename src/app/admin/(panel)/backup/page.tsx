import fs from "node:fs";
import path from "node:path";
import { db, getSetting, uploadDir } from "@/lib/db";
import { daysSince } from "@/lib/backup";

export const dynamic = "force-dynamic";
export default function BackupPage() {
  const last = getSetting("last_backup_at", "");
  const days = daysSince(last);
  const up = uploadDir(); const files = fs.existsSync(up) ? fs.readdirSync(up).filter((f) => fs.statSync(path.join(up, f)).isFile()) : [];
  const mb = (files.reduce((a, f) => a + fs.statSync(path.join(up, f)).size, 0) / 1048576).toFixed(1);
  const orders = (db().prepare("SELECT COUNT(*) n FROM orders").get() as { n: number }).n;
  const customers = (db().prepare("SELECT COUNT(*) n FROM customers").get() as { n: number }).n;
  const stale = days === null || days >= 7;
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="font-display text-3xl font-semibold">النسخة الاحتياطية</h1>
      <p className="text-sm">ملف واحد ينزل على جهازك فيه كل الطلبات والعملاء والمنتجات والإعدادات وصور المنتجات. لو حصل أي شيء للسيرفر نقدر نرجّع المتجر كما كان منه.</p>
      <div className={`rounded-card border p-4 text-sm ${stale ? "border-mauve bg-blush/50" : "border-gold/40 bg-surface"}`} role="status">
        {last ? <>آخر تحميل: <strong>{new Date(last).toLocaleString("ar-AE")}</strong> (قبل {days} يوم)</> : <strong>لم تُحمَّل أي نسخة بعد.</strong>}
        {stale && <p className="mt-1 font-bold">⚠ ننصح بتحميل نسخة جديدة مرة كل أسبوع.</p>}
      </div>
      <ul className="grid grid-cols-3 gap-3 text-center text-sm">
        <li className="rounded-card border border-gold/40 bg-surface p-3">الطلبات<p className="text-2xl font-bold">{orders}</p></li>
        <li className="rounded-card border border-gold/40 bg-surface p-3">العميلات<p className="text-2xl font-bold">{customers}</p></li>
        <li className="rounded-card border border-gold/40 bg-surface p-3">الصور<p className="text-2xl font-bold">{files.length}</p><p className="text-xs">{mb} MB</p></li>
      </ul>
      <a href="/api/admin/backup" download className="inline-flex min-h-14 items-center gap-3 rounded-full bg-mauve px-8 text-base font-bold text-white hover:bg-[#6f4353]">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M4 20h16" /></svg>
        تحميل نسخة احتياطية الآن
      </a>
      <p className="text-xs opacity-80">احتفظي بالملف في مكان خاص (فيه بيانات العملاء) ولا ترسليه لأحد. لا يحتوي على كلمات السر ولا جلسات الدخول.</p>
    </div>
  );
}
