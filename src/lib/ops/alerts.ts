import { db } from "@/lib/db";
import { notify } from "@/lib/db/notify";
import { emailEnabled, sendEmail, siteUrl } from "@/lib/email";

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);

/**
 * An alert the owner must not miss: it goes to the bell in the admin panel AND, when e-mail is set up, to every
 * admin's inbox (so she hears about it without opening the panel). Raised once per title. Never throws.
 */
export function alertOwner(kind: string, title: string, body: string, link = ""): boolean {
  try {
    if (db().prepare("SELECT 1 FROM notifications WHERE kind = ? AND title = ?").get(kind, title)) return false;
  } catch { return false; }
  notify(kind, title, body, link);
  if (emailEnabled()) {
    let to: string[] = [];
    try { to = (db().prepare("SELECT email FROM admins").all() as { email: string }[]).map((a) => a.email).filter((e) => /@/.test(e) && !e.endsWith("@example.com")); } catch { /* no admins table yet */ }
    const url = link ? siteUrl() + link : siteUrl() + "/admin/notifications";
    const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.8;color:#3a2a33"><p><strong>${esc(title)}</strong></p><p>${esc(body)}</p><p><a href="${esc(url)}">افتحي لوحة التحكم</a></p><p style="font-size:12px;color:#8a7a83">تنبيه تلقائي من متجر Litore.</p></div>`;
    for (const addr of to.slice(0, 5)) void sendEmail(addr, `تنبيه Litore: ${title}`.slice(0, 150), html, `${title}\n\n${body}\n\n${url}`).catch(() => false);
  }
  return true;
}

/** Key that changes once an hour / once a day (UAE time): used to raise a repeating problem again, but not every minute. */
export const hourKey = (d = new Date()) => new Date(d.getTime() + 4 * 3600_000).toISOString().slice(0, 13).replace("T", " ") + "h";
export const dayKey = (d = new Date()) => new Date(d.getTime() + 4 * 3600_000).toISOString().slice(0, 10);
