import fs from "node:fs";
import path from "node:path";
import { db, getSetting } from "@/lib/db";
import { notify } from "@/lib/db/notify";

const once = (kind: string, title: string) => !db().prepare("SELECT 1 FROM notifications WHERE kind = ? AND title = ?").get(kind, title);

/**
 * Things the owner should hear about without opening every page (run by the background watch):
 *  - a paid order that nobody shipped for two days (setting ship_alert_hours, 0 = off);
 *  - the disk that holds the database and photos is almost full.
 * Each alert is raised once. Never throws.
 */
export function raiseOpsAlerts(): number {
  let raised = 0;
  try {
    const hours = Math.max(0, Math.min(24 * 30, Number(getSetting("ship_alert_hours", "48")) || 0));
    if (hours > 0) {
      const late = db().prepare(`SELECT id FROM orders WHERE payment_status = 'paid' AND status IN ('new','processing')
        AND created_at <= datetime('now', ?) AND created_at >= datetime('now','-60 days') ORDER BY created_at ASC LIMIT 20`).all(`-${hours} hours`) as { id: string }[];
      for (const o of late) {
        const title = `طلب مدفوع لم يُشحن ${o.id}`;
        if (!once("order", title)) continue;
        notify("order", title, `مرّ أكثر من ${hours} ساعة على دفع الطلب ولم يُشحن بعد.`, `/admin/orders/${o.id}`);
        raised++;
      }
    }
  } catch (e) {
    console.log("[ops-alert-error]", e instanceof Error ? e.message : String(e));
  }
  try {
    const dir = path.dirname(process.env.DATABASE_PATH ?? "./data/litore.db");
    const st = fs.statfsSync(dir);
    const freePct = Math.round((Number(st.bavail) / Number(st.blocks)) * 100);
    if (Number.isFinite(freePct) && freePct < 10) {
      const title = `مساحة التخزين تكاد تمتلئ (${new Date().toISOString().slice(0, 10)})`;
      if (once("system", title)) { notify("system", title, `المتبقي ${freePct}% فقط من مساحة السيرفر. احذفي النسخ القديمة أو كبّري المساحة قبل أن يتوقف المتجر.`, "/admin/backup"); raised++; }
    }
  } catch { /* statfs is not available everywhere */ }
  return raised;
}
