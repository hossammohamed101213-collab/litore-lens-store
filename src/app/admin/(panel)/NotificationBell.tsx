"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type N = { id: number; kind: string; title: string; body: string; link: string; is_read: number; created_at: string };
const icon: Record<string, string> = { order: "🛍", customer: "👤", review: "⭐", complaint: "⚠", suggestion: "💡", reset: "🔑", stock: "📦", shipping: "🚚" };

/** Short "how long ago" label; created_at is stored as UTC "YYYY-MM-DD HH:MM:SS". */
export function ago(createdAt: string, now: number = Date.now()): string {
  const t = Date.parse(createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return "";
  const m = Math.max(0, Math.floor((now - t) / 60000));
  if (m < 1) return "الآن";
  if (m < 60) return `${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} س`;
  return `${Math.floor(h / 24)} ي`;
}

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
        <div role="dialog" aria-label="الإشعارات" className="fixed inset-x-3 top-[4.75rem] z-50 mx-auto max-w-sm overflow-hidden rounded-2xl border border-gold/30 bg-white/95 text-[#3b2530] shadow-[0_14px_34px_-14px_rgba(90,51,66,.45)] backdrop-blur sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:mx-0 sm:w-80">
          <div className="flex items-center justify-between gap-2 px-3.5 pb-1.5 pt-2.5">
            <strong className="text-[13px] text-[#5a3342]">الإشعارات{unread > 0 && <span className="ms-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[11px] font-bold text-rose-600">{unread}</span>}</strong>
            {unread > 0 && <button type="button" onClick={readAll} className="min-h-9 rounded-full px-2 text-[11px] font-bold text-[#7a4f60] hover:bg-blush/40">تحديد الكل كمقروء</button>}
          </div>
          <ul className="max-h-[46dvh] overflow-y-auto overscroll-contain px-1.5 pb-1">
            {items === null ? <li className="p-4 text-center text-xs opacity-70">جارٍ التحميل…</li>
              : items.length === 0 ? <li className="p-5 text-center text-xs opacity-70">لا توجد إشعارات ✨</li>
              : items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => read(n)} className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-start hover:bg-blush/30 ${n.is_read ? "opacity-75" : "bg-blush/25"}`}>
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-blush/50 text-sm">{icon[n.kind] ?? "🔔"}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[13px] leading-5 ${n.is_read ? "" : "font-bold"}`}>{n.title}</span>
                      {n.body && <span className="block truncate text-[11px] leading-4 opacity-70">{n.body}</span>}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] opacity-60">{ago(n.created_at)}</span>
                      {!n.is_read && <span aria-hidden="true" className="size-1.5 rounded-full bg-rose-500" />}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          <Link href="/admin/notifications" onClick={() => setOpen(false)} className="block border-t border-gold/20 px-3 py-2.5 text-center text-[11px] font-bold text-[#7a4f60] hover:bg-blush/30">عرض كل الإشعارات ←</Link>
        </div>
      )}
    </div>
  );
}
