import Link from "next/link";
import { db } from "@/lib/db";
import { markNotifications } from "../../actions";

export const dynamic = "force-dynamic";
type N = { id: number; kind: string; title: string; body: string; link: string; is_read: number; created_at: string };
const icon: Record<string, string> = { order: "🛍", customer: "👤", review: "⭐", complaint: "⚠", suggestion: "💡", reset: "🔑", stock: "📦" };

export default function NotificationsPage() {
  const rows = db().prepare("SELECT * FROM notifications ORDER BY id DESC LIMIT 200").all() as N[];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">مركز الإشعارات</h1>
        <form action={markNotifications}><button className="min-h-11 rounded-full border border-mauve px-5 hover:bg-blush/40">تحديد الكل كمقروء</button></form>
      </div>
      <p className="text-sm">كل جديد يظهر هنا: طلبات، عميلات جديدة، آراء وشكاوى، طلبات استرجاع كلمة السر، ومخزون منخفض.</p>
      {rows.length === 0 ? <p>لا توجد إشعارات بعد.</p> : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-card border p-4 text-sm ${n.is_read ? "border-gold/30 bg-surface" : "border-mauve bg-blush/30"}`}>
              <div className="min-w-0 flex-1">
                <p className="font-bold"><span aria-hidden="true">{icon[n.kind] ?? "🔔"} </span>{n.title}</p>
                {n.body && <p className="mt-1 break-words opacity-80">{n.body}</p>}
                <p className="mt-1 text-xs opacity-60" dir="ltr">{n.created_at} UTC</p>
              </div>
              <div className="flex gap-2">
                {n.link && <Link href={n.link} className="inline-flex min-h-11 items-center rounded-full border border-mauve px-4 hover:bg-blush/40">فتح</Link>}
                {!n.is_read && <form action={markNotifications}><input type="hidden" name="id" value={n.id} /><button className="min-h-11 rounded-full px-4 underline">مقروء</button></form>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
