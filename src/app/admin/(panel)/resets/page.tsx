import { db } from "@/lib/db";
import { cancelReset, createResetLink } from "../../actions";

export const dynamic = "force-dynamic";
type R = { id: string; identifier: string; status: string; created_at: string; name: string; phone: string };
const st: Record<string, string> = { pending: "بانتظارك", sent: "تم إنشاء الرابط", done: "تم التغيير", cancelled: "ملغي" };

export default async function ResetsPage({ searchParams }: { searchParams: Promise<{ token?: string; id?: string }> }) {
  const { token, id } = await searchParams;
  const rows = db().prepare(`SELECT r.id,r.identifier,r.status,r.created_at,c.name,c.phone FROM password_resets r
    LEFT JOIN customers c ON c.id = r.customer_id ORDER BY r.created_at DESC LIMIT 100`).all() as R[];
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://litore.store").replace(/\/$/, "");
  const btn = "inline-flex min-h-11 items-center rounded-full border border-mauve px-4 hover:bg-blush/40";
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold">طلبات استرجاع كلمة السر</h1>
      <ol className="list-decimal space-y-1 ps-5 text-sm">
        <li>العميلة تكتب بريدها أو جوالها في صفحة «نسيت كلمة السر» فيظهر طلبها هنا.</li>
        <li>اضغطي «إنشاء رابط» (صالح ساعة واحدة).</li>
        <li>اضغطي «إرسال واتساب» وابعتي لها الرسالة الجاهزة.</li>
      </ol>
      {rows.length === 0 ? <p>لا توجد طلبات.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const link = token && id === r.id ? `${site}/ar/account/reset?token=${token}` : null;
            const msg = `مرحبًا ${r.name || ""} 🌸 هذا رابط تعيين كلمة سر جديدة لحسابك في Litore (صالح لمدة ساعة):\n${link ?? ""}`;
            const wa = link ? `https://wa.me/${r.phone || ""}?text=${encodeURIComponent(msg)}` : null;
            return (
              <li key={r.id} className="rounded-card border border-gold/40 bg-surface p-4 text-sm">
                <p className="font-bold">{r.name || "—"} · <span dir="ltr">{r.identifier}</span></p>
                <p className="opacity-70">{st[r.status]} · <span dir="ltr">{r.created_at} UTC</span></p>
                {link && (
                  <div className="mt-3 space-y-2 rounded-xl bg-blush/30 p-3">
                    <p className="font-bold">الرابط (يظهر مرة واحدة فقط، انسخيه الآن):</p>
                    <p dir="ltr" className="break-all select-all">{link}</p>
                    {wa && <a className={btn} href={wa} target="_blank" rel="noopener noreferrer">إرسال واتساب</a>}
                  </div>
                )}
                {(r.status === "pending" || r.status === "sent") && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={createResetLink}><input type="hidden" name="id" value={r.id} /><button className={btn}>{r.status === "sent" ? "إنشاء رابط جديد" : "إنشاء رابط"}</button></form>
                    <form action={cancelReset}><input type="hidden" name="id" value={r.id} /><button className="min-h-11 rounded-full px-4 underline">إلغاء الطلب</button></form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
