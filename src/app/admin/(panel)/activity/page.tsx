import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
type L = { id: number; admin_email: string; action: string; detail: string; created_at: string };

export default function ActivityPage() {
  const rows = db().prepare("SELECT * FROM admin_log ORDER BY id DESC LIMIT 300").all() as L[];
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold">سجل النشاط</h1>
      <p className="text-sm">كل ما يتم من لوحة التحكم: من فعل ماذا ومتى. السجل لا يمكن تعديله من اللوحة.</p>
      <div className="overflow-x-auto rounded-card border border-gold/40 bg-surface">
        <table className="w-full text-start text-sm">
          <thead><tr className="border-b border-gold/40"><th className="p-3 text-start">الوقت (UTC)</th><th className="p-3 text-start">المستخدم</th><th className="p-3 text-start">الإجراء</th><th className="p-3 text-start">تفاصيل</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gold/20 align-top">
                <td className="p-3" dir="ltr">{r.created_at}</td>
                <td className="p-3" dir="ltr">{r.admin_email}</td>
                <td className="p-3 font-bold">{r.action}</td>
                <td className="p-3 break-all" dir="auto">{r.detail}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="p-3" colSpan={4}>لا يوجد نشاط بعد.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
