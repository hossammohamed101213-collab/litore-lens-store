import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/session";
import { unreadCount } from "@/lib/db/notify";
import { adminLogout } from "../actions";
import { BackBar } from "./BackBar";
import { FormPending } from "./FormPending";
import { NotificationBell } from "./NotificationBell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  const unread = unreadCount();
  return (
    <div className="min-h-dvh bg-[linear-gradient(160deg,#fff7fa,#fdeef4_45%,#f4effc)]">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-gradient-to-l from-[#f7c4d6] via-[#f6e0ae] to-[#d8c7f2] shadow-[0_6px_24px_-10px_rgba(134,84,102,.5)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-white/80 text-2xl shadow">🎀</span>
            <span><span className="block font-display text-2xl font-semibold leading-tight text-[#5a3342]">Litore</span><span className="block text-xs font-bold text-[#7a4f60]">لوحة تحكم المتجر</span></span>
          </Link>
          <form action={adminLogout} className="flex items-center gap-3 text-sm">
            <NotificationBell initialUnread={unread} />
            <span dir="ltr" className="hidden text-[#5a3342] sm:inline">{admin.email}</span>
            <button className="min-h-11 rounded-full bg-white/80 px-5 font-bold text-[#5a3342] hover:bg-white">خروج</button>
          </form>
        </div>
      </header>
      <BackBar />
      <FormPending />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
