"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type N = { id: number; kind: string; title: string; body: string; link: string; is_read: number; created_at: string };
const icon: Record<string, string> = { order: "🛍", customer: "👤", review: "⭐", complaint: "⚠", suggestion: "💡", reset: "🔑", stock: "📦" };

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<N[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const [seen, setSeen] = useState(initialUnread);
  if (seen !== initialUnread) { setSeen(initialUnread); setUnread(initialUnread); } // server count changed (navigation/refresh)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { items: N[]; unread: number };
      setItems(d.items);
      setUnread(d.unread);
    } catch { /* offline: keep what we have */ }
  }, []);

  // refresh the count while the page is visible, so the bell starts shaking soon after something new arrives
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open, load]);

  async function read(n: N) {
    setOpen(false);
    if (!n.is_read) {
      setItems((l) => l && l.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)));
      setUnread((u) => Math.max(0, u - 1));
      try { await fetch("/api/admin/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: n.id }) }); } catch { /* ignore */ }
    }
    router.push(n.link || "/admin/notifications");
    router.refresh();
  }

  async function readAll() {
    setItems((l) => l && l.map((x) => ({ ...x, is_read: 1 })));
    setUnread(0);
    try { await fetch("/api/admin/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); } catch { /* ignore */ }
    router.refresh();
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => { if (!open) void load(); setOpen((o) => !o); }}
        aria-label={unread ? `${unread} إشعارات غير مقروءة` : "الإشعارات"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative inline-flex size-11 items-center justify-center rounded-full bg-white/70 text-xl hover:bg-white"
      >
        <span aria-hidden="true" className={unread > 0 ? "bell-shake inline-block" : "inline-block"}>🔔</span>
        {unread > 0 && <span aria-hidden="true" className="absolute -end-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="الإشعارات" className="absolute end-0 top-12 z-50 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gold/40 bg-white text-[#3b2530] shadow-[0_18px_40px_-12px_rgba(90,51,66,.45)]">
          <div className="flex items-center justify-between border-b border-gold/30 px-3 py-2 text-sm">
            <strong>الإشعارات</strong>
            {unread > 0 && <button type="button" onClick={readAll} className="min-h-9 rounded-full px-3 text-xs underline">تحديد الكل كمقروء</button>}
          </div>
          <ul className="max-h-[55dvh] divide-y divide-gold/20 overflow-y-auto">
            {items === null ? <li className="p-4 text-center text-sm opacity-70">جارٍ التحميل…</li>
              : items.length === 0 ? <li className="p-4 text-center text-sm opacity-70">لا توجد إشعارات.</li>
              : items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => read(n)} className={`block w-full px-3 py-2.5 text-start text-sm hover:bg-blush/30 ${n.is_read ? "" : "bg-blush/30"}`}>
                    <span className="flex items-start gap-2">
                      <span aria-hidden="true">{icon[n.kind] ?? "🔔"}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block break-words ${n.is_read ? "" : "font-bold"}`}>{n.title}</span>
                        {n.body && <span className="mt-0.5 line-clamp-2 block break-words text-xs opacity-70">{n.body}</span>}
                      </span>
                      {!n.is_read && <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-rose-500" />}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          <Link href="/admin/notifications" onClick={() => setOpen(false)} className="block border-t border-gold/30 px-3 py-2 text-center text-xs underline">عرض كل الإشعارات</Link>
        </div>
      )}
    </div>
  );
}
