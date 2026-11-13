import { PasswordInput } from "@/components/ui/PasswordInput";
import { changeAdminPassword } from "../../actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const field = "min-h-11 w-full rounded-xl border border-gold/50 px-3";
  return (
    <form action={changeAdminPassword} className="max-w-lg space-y-5">
      <h1 className="font-display text-3xl font-semibold">تغيير كلمة المرور</h1>
      <p className="text-sm">اختاري كلمة مرور قوية (10 أحرف على الأقل). عند التغيير يُسجَّل خروجك من الأجهزة الأخرى.</p>
      {error && <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
      {saved && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تم تغيير كلمة المرور.</p>}
      <div>
        <label htmlFor="current" className="mb-1 block text-sm font-bold">كلمة المرور الحالية</label>
        <PasswordInput id="current" name="current" required autoComplete="current-password" className={field} />
      </div>
      <div>
        <label htmlFor="next" className="mb-1 block text-sm font-bold">كلمة المرور الجديدة</label>
        <PasswordInput id="next" name="next" required minLength={10} maxLength={128} autoComplete="new-password" className={field} />
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm font-bold">تأكيد كلمة المرور الجديدة</label>
        <PasswordInput id="confirm" name="confirm" required minLength={10} maxLength={128} autoComplete="new-password" className={field} />
      </div>
      <button className="min-h-12 rounded-full bg-mauve px-10 text-white hover:bg-[#6f4353]">حفظ</button>
    </form>
  );
}
