import QRCode from "qrcode";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { getAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/secrets";
import { backupCodesFor, otpauthUri } from "@/lib/auth/totp";
import { changeAdminPassword, disableMfa, enableMfa, startMfa } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; setup?: string; mfa?: string }> }) {
  const { error, saved, setup, mfa } = await searchParams;
  const field = "min-h-11 w-full rounded-xl border border-gold/50 px-3";
  const card = "max-w-lg space-y-5 rounded-card border border-gold/40 bg-surface p-5";
  const me = await getAdmin();
  const row = me ? (db().prepare("SELECT totp_enabled, totp_backup, totp_secret FROM admins WHERE id = ?").get(me.id) as { totp_enabled: number; totp_backup: string | null; totp_secret: string | null }) : null;
  const on = row?.totp_enabled === 1;
  // While the set-up is open (started with the button, not switched on yet) the key and its backup codes can be shown; afterwards never again.
  let pending: { secret: string; qr: string; codes: string[] } | null = null;
  const secret = me && !on && setup === "1" ? decrypt(row?.totp_secret ?? "") : "";
  if (me && secret) pending = { secret, codes: backupCodesFor(secret), qr: await QRCode.toString(otpauthUri(secret, me.email), { type: "svg", margin: 1, width: 220 }) };
  return (
    <div className="space-y-8">
      {error && <p role="alert" className="max-w-lg rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
      {saved && <p role="status" className="max-w-lg rounded-xl bg-blush/40 p-3 text-sm font-medium">تم تغيير كلمة المرور.</p>}
      {mfa === "on" && <p role="status" className="max-w-lg rounded-xl bg-blush/40 p-3 text-sm font-medium">تم تفعيل التحقق بخطوتين. من الآن الدخول يحتاج كلمة المرور ورمزًا من التطبيق.</p>}
      {mfa === "off" && <p role="status" className="max-w-lg rounded-xl bg-blush/40 p-3 text-sm font-medium">تم إيقاف التحقق بخطوتين.</p>}
      <form action={changeAdminPassword} className={card}>
        <h1 className="font-display text-3xl font-semibold">تغيير كلمة المرور</h1>
        <p className="text-sm">اختاري كلمة مرور قوية (10 أحرف على الأقل). عند التغيير يُسجَّل خروجك من الأجهزة الأخرى.</p>
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

      <section className={card} aria-labelledby="mfa-title">
        <h2 id="mfa-title" className="font-display text-2xl font-semibold">التحقق بخطوتين</h2>
        <p className="text-sm">حماية إضافية للوحة التحكم: بعد كلمة المرور يُطلب رمز من 6 أرقام يتغيّر كل 30 ثانية من تطبيق على هاتفك (Google Authenticator أو Microsoft Authenticator). حتى لو عرف أحد كلمة المرور لن يستطيع الدخول.</p>
        {on ? (
          <form action={disableMfa} className="space-y-3">
            <p className="font-bold">الحالة: مفعّل ✅ <span className="font-normal">· الرموز الاحتياطية المتبقية: {(JSON.parse(row?.totp_backup || "[]") as string[]).length}</span></p>
            <div><label htmlFor="mfa_current" className="mb-1 block text-sm font-bold">كلمة المرور الحالية</label><PasswordInput id="mfa_current" name="current" required autoComplete="current-password" className={field} /></div>
            <div><label htmlFor="mfa_off_code" className="mb-1 block text-sm font-bold">رمز من التطبيق</label><input id="mfa_off_code" name="code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} className={field} /></div>
            <button className="min-h-11 rounded-full border border-mauve px-6 hover:bg-blush/40">إيقاف التحقق بخطوتين</button>
          </form>
        ) : pending ? (
          <div className="space-y-4">
            <ol className="list-decimal space-y-2 ps-5 text-sm">
              <li>افتحي تطبيق المصادقة على هاتفك واختاري «إضافة حساب» ثم امسحي هذا الرمز المربّع.</li>
              <li>احفظي الرموز الاحتياطية بالأسفل في مكان آمن (لن تُعرض بعد التفعيل).</li>
              <li>اكتبي الرمز الظاهر في التطبيق ثم اضغطي «تفعيل».</li>
            </ol>
            <div className="mx-auto w-56 rounded-xl bg-white p-2" role="img" aria-label="رمز مربّع لتطبيق المصادقة" dangerouslySetInnerHTML={{ __html: pending.qr }} />
            <p className="text-sm">أو أدخلي هذا المفتاح يدويًا في التطبيق: <b dir="ltr" className="break-all">{pending.secret}</b></p>
            <div>
              <p className="mb-1 text-sm font-bold">الرموز الاحتياطية (كل رمز يُستخدم مرة واحدة لو ضاع الهاتف):</p>
              <ul className="grid grid-cols-2 gap-1 rounded-xl bg-blush/30 p-3 text-sm" dir="ltr">{pending.codes.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
            </div>
            <form action={enableMfa} className="flex flex-wrap items-end gap-3">
              <div><label htmlFor="mfa_code" className="mb-1 block text-sm font-bold">الرمز من التطبيق</label><input id="mfa_code" name="code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} className={field} /></div>
              <button className="min-h-11 rounded-full bg-mauve px-8 text-white hover:bg-[#6f4353]">تفعيل</button>
            </form>
          </div>
        ) : (
          <form action={startMfa} className="flex flex-wrap items-center gap-3"><button className="min-h-11 rounded-full bg-mauve px-8 text-white hover:bg-[#6f4353]">ابدئي الإعداد</button><span className="text-sm">الحالة: غير مفعّل</span></form>
        )}
        <p className="text-xs">لو ضاع الهاتف والرموز الاحتياطية: إعادة ضبط كلمة المرور من السيرفر (ملف الصيانة) توقف التحقق بخطوتين.</p>
      </section>
    </div>
  );
}
