import Link from "next/link";

const TONES = [
  "from-[#ffe3ec] to-[#ffc9db] border-[#ec9bb4]", "from-[#fff1d1] to-[#f8dc9c] border-[#d9b36c]",
  "from-[#ece3fb] to-[#d6c6f3] border-[#b9a2e0]", "from-[#dcf5ea] to-[#bfe9d6] border-[#8fd3b6]", "from-[#ffe8d9] to-[#fbcfb0] border-[#f5b48a]",
];

/** A big tappable card: one service, one tap. `status` is a short live state (e.g. "مفعّل"), `on` colours it green. */
export function AdminCard({ href, icon, title, sub, status, on, tone = 0 }: { href: string; icon: string; title: string; sub?: string; status?: string; on?: boolean; tone?: number }) {
  return (
    <Link href={href} className={`group relative flex min-h-36 flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${TONES[tone % 5]}`}>
      <span aria-hidden="true" className="absolute -end-4 -top-4 text-6xl opacity-20 transition group-hover:scale-110">{icon}</span>
      <div>
        <p className="flex items-center gap-2 text-base font-bold"><span aria-hidden="true">{icon}</span>{title}</p>
        {sub && <p className="mt-1 text-sm leading-6">{sub}</p>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {status ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-emerald-100 text-emerald-900" : "bg-white/70"}`}>{status}</span> : <span />}
        <span className="text-xs font-bold opacity-80 group-hover:opacity-100">فتح ←</span>
      </div>
    </Link>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function PageTitle({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <header className="mb-6">
      <h1 className="font-display text-3xl font-semibold"><span aria-hidden="true">{icon} </span>{title}</h1>
      {sub && <p className="mt-1 text-sm leading-6">{sub}</p>}
    </header>
  );
}

export function Flash({ saved, error, msg }: { saved?: string; error?: string; msg?: string }) {
  return (
    <>
      {error && <p role="alert" className="mb-4 rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
      {saved && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium">✅ تم الحفظ.</p>}
      {msg && <p role="status" className="mb-4 rounded-xl bg-blush/40 p-3 text-sm font-medium">{msg}</p>}
    </>
  );
}

export const inputCls = "min-h-11 w-full rounded-xl border border-gold/50 bg-surface px-3";
export const saveCls = "min-h-12 rounded-full bg-mauve px-10 text-white hover:bg-[#6f4353]";
export const panelCls = "max-w-xl space-y-4 rounded-card border border-gold/40 bg-surface p-5";
