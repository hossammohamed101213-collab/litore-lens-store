import { PasswordInput } from "@/components/ui/PasswordInput";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/session";
import { adminLogin } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdmin()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm items-center px-4">
      <form action={adminLogin} className="w-full space-y-4 rounded-card border border-gold/40 bg-surface p-6">
        <h1 className="text-center font-display text-3xl font-semibold">لوحة تحكم Litore</h1>
        {error && <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-bold">البريد الإلكتروني</label>
          <input id="email" name="email" type="email" dir="ltr" required autoComplete="username" className="min-h-11 w-full rounded-xl border border-gold/50 px-4" />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-bold">كلمة المرور</label>
          <PasswordInput id="password" name="password" required autoComplete="current-password" className="min-h-11 w-full rounded-xl border border-gold/50 px-4" />
        </div>
        <button className="min-h-12 w-full rounded-full bg-mauve text-white hover:bg-[#6f4353]">دخول</button>
      </form>
    </main>
  );
}
