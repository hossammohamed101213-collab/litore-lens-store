import { db } from "@/lib/db";

/** Adds an entry to the admin notification centre. Never throws: a failed notice must not break an order. */
export function notify(kind: string, title: string, body = "", link = "") {
  try {
    db().prepare("INSERT INTO notifications(kind,title,body,link) VALUES (?,?,?,?)").run(kind, title, body.slice(0, 400), link);
  } catch {
    /* ignore */
  }
}

export function unreadCount(): number {
  return (db().prepare("SELECT COUNT(*) c FROM notifications WHERE is_read = 0").get() as { c: number }).c;
}

export function audit(adminEmail: string, action: string, detail = "") {
  try {
    db().prepare("INSERT INTO admin_log(admin_email,action,detail) VALUES (?,?,?)").run(adminEmail, action, detail.slice(0, 300));
  } catch {
    /* ignore */
  }
}
