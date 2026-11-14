"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "@/lib/analytics";
import type { HubStats } from "@/lib/hub";
import { Area, Bars, Donut, DEV, Gauge, Heat, Keyframes, LiveList, Radar, RANGES, SRC, pct, useCount, type KV } from "./Charts";

export type HubData = Snapshot & { hub: HubStats };

const TONES = [
  "from-[#ffe3ec] to-[#ffc9db] border-[#ec9bb4]", "from-[#fff1d1] to-[#f8dc9c] border-[#d9b36c]",
  "from-[#ece3fb] to-[#d6c6f3] border-[#b9a2e0]", "from-[#dcf5ea] to-[#bfe9d6] border-[#8fd3b6]", "from-[#ffe8d9] to-[#fbcfb0] border-[#f5b48a]",
];
const money = (n: number) => new Intl.NumberFormat("ar-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

function Card({ href, icon, title, value, sub, alert, tone, children }: { href: string; icon: string; title: string; value?: string | number; sub?: string; alert?: boolean; tone: number; children?: React.ReactNode }) {
  return (
    <Link href={href} className={`group relative flex min-h-36 flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${TONES[tone % 5]}`}>
      <span aria-hidden="true" className="absolute -end-4 -top-4 text-6xl opacity-20 transition group-hover:scale-110">{icon}</span>
      <div>
        <p className="flex items-center gap-2 text-sm font-bold"><span aria-hidden="true">{icon}</span>{title}{alert && <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" style={{ animation: "cockpit-pulse 1.4s infinite" }} aria-label="يحتاج انتباه" />}</p>
        {value !== undefined && <p className="mt-1 text-3xl font-bold">{value}</p>}
        {sub && <p className="text-xs opacity-75">{sub}</p>}
      </div>
      {children}
      <span className="mt-2 text-xs font-bold opacity-70 group-hover:opacity-100">عرض التفاصيل ←</span>
    </Link>
  );
}

export function Hub({ initial }: { initial: HubData }) {
  const [s, setS] = useState(initial); const [days, setDays] = useState(7); const [err, setErr] = useState(false); const [now, setNow] = useState(initial.at);
  const load = useCallback(async (d: number) => {
    try { const r = await fetch(`/api/admin/analytics?days=${d}&hub=1`, { cache: "no-store" }); if (!r.ok) throw new Error(); const j = (await r.json()) as HubData; setS(j); setNow(j.at); setErr(false); } catch { setErr(true); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(days), 0); return () => clearTimeout(t); }, [days, load]);
  useEffect(() => { const t = setInterval(() => void load(days), 8000); return () => clearInterval(t); }, [days, load]);
  const h = s.hub;
  const total = s.devices.reduce((a, d) => a + (d.v as number), 0) || 1;
  const mobileShare = Math.round((((s.devices.find((d) => d.k === "mobile")?.v as number) ?? 0) / total) * 100);
  const organicShare = s.views ? Math.round((s.organic / s.views) * 100) : 0;
  const live = useCount(s.live);
  const peak = [...(s.hours as unknown as { h: number; v: number }[])].sort((a, b) => b.v - a.v)[0];
  const A = "/admin/analytics";

  const manage = [
    { href: "/admin/notifications", icon: "🔔", title: "الإشعارات", value: h.unread, sub: `غير مقروءة من ${h.notifTotal}`, alert: h.unread > 0 },
    { href: "/admin/orders", icon: "🛍️", title: "الطلبات", value: h.newOrders, sub: `جديدة · الإجمالي ${h.orders} · مبيعات ${money(h.revenue)}`, alert: h.newOrders > 0 },
    { href: "/admin/products", icon: "💎", title: "المنتجات", value: h.products, sub: h.lowStock ? `${h.lowStock} مخزون منخفض` : "المخزون جيد", alert: h.lowStock > 0 },
    { href: "/admin/returns", icon: "↩️", title: "المرتجعات", value: h.returnsNew, sub: `جديدة من ${h.returnsAll}`, alert: h.returnsNew > 0 },
    { href: "/admin/customers", icon: "👩", title: "العميلات", value: h.customers, sub: `${h.customersWeek} جديدة هذا الأسبوع` },
    { href: "/admin/feedback", icon: "💬", title: "الآراء والشكاوى", value: h.feedbackNew, sub: `جديدة من ${h.feedbackAll}`, alert: h.feedbackNew > 0 },
    { href: "/admin/coupons", icon: "🏷️", title: "الكوبونات", value: h.coupons, sub: "كوبون فعّال" },
    { href: "/admin/settings", icon: "⚙️", title: "الإعدادات", sub: `الشحن، الربط، الضريبة، الخلفية، السوشيال، كلمة السر، النسخ الاحتياطي${h.backupDays === null || h.backupDays >= 7 ? " · تنبيه: حمّلي نسخة الآن" : ""}`, alert: h.backupDays === null || h.backupDays >= 7 },
    { href: "/admin/referrals", icon: "🎁", title: "الإحالات", value: h.redeemPending, sub: `طلب استبدال ينتظر · ${h.referrals} إحالة`, alert: h.redeemPending > 0 },
    { href: "/admin/affiliates", icon: "🤝", title: "المسوّقون", value: h.affPending, sub: `طلب انضمام جديد من ${h.affAll}`, alert: h.affPending > 0 },
    { href: "/admin/resets", icon: "🔑", title: "استرجاع كلمة السر", value: h.resetsPending, sub: "طلب ينتظر المعالجة", alert: h.resetsPending > 0 },
  ];

  return (
    <div className="space-y-6">
      <Keyframes />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">مركز التحكم</h1>
          <p className="text-xs opacity-70"><span className="me-1 inline-block h-2 w-2 rounded-full bg-emerald-500" style={{ animation: "cockpit-pulse 1.4s infinite" }} />{err ? "انقطع الاتصال… نعيد المحاولة" : `يتحدّث تلقائيًا كل 8 ثوانٍ · آخر تحديث ${new Date(s.at).toLocaleTimeString("ar-AE")}`}</p>
        </div>
        <div role="group" aria-label="الفترة" className="flex gap-1 rounded-full bg-white/70 p-1 shadow-sm">
          {RANGES.map(([d, l]) => <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d} className={`min-h-10 rounded-full px-4 text-sm ${days === d ? "bg-mauve font-bold text-white" : "hover:bg-blush/50"}`}>{l}</button>)}
        </div>
      </div>

      <section aria-label="المراقبة الحية" className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#b9a2e0] bg-gradient-to-br from-[#ece3fb] to-[#f9e3ee] p-4">
          <h2 className="mb-2 text-center text-sm font-bold">رادار الزوار الآن · <span className="text-2xl text-mauve">{live}</span></h2>
          <Radar list={s.liveList} now={now} />
          <p className="mt-2 text-center text-[11px] opacity-70">كل نقطة = زائر حقيقي نشط في آخر 5 دقائق (الأقرب للمركز = الأحدث)</p>
        </div>
        <div className="rounded-2xl border border-[#ec9bb4] bg-gradient-to-br from-[#fff5f8] to-[#ffe3ec] p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-bold">من يتصفح المتجر الآن</h2>
          <div className="max-h-[260px] overflow-y-auto"><LiveList list={s.liveList} now={now} /></div>
        </div>
      </section>

      <section aria-label="مؤشرات الفترة" className="grid grid-cols-2 gap-4 rounded-2xl border border-[#d9b36c] bg-gradient-to-br from-[#fffaf0] to-[#fff1d1] p-4 lg:grid-cols-4">
        <Gauge label="المشاهدات" value={s.views} max={Math.max(s.views, s.prevViews, 10)} color="#e5739a" delta={pct(s.views, s.prevViews)} />
        <Gauge label="الزوار" value={s.visitors} max={Math.max(s.visitors, s.prevVisitors, 10)} color="#8e6fd0" delta={pct(s.visitors, s.prevVisitors)} />
        <Gauge label="من الجوال" value={mobileShare} max={100} suffix="%" color="#d9a441" />
        <Gauge label="من محركات البحث" value={organicShare} max={100} suffix="%" color="#3fb59a" />
      </section>

      <section aria-labelledby="h-an">
        <h2 id="h-an" className="mb-3 text-lg font-bold">الزيارات والتحليلات <span className="text-xs font-normal opacity-60">— اضغطي أي بطاقة لعرض كل التفاصيل</span></h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card href={`${A}/traffic`} icon="📈" title="حركة الزيارات" value={s.views} sub={`مشاهدة · ${s.visitors} زائر`} tone={0}><div className="mt-1"><Area s={s} /></div></Card>
          <Card href={`${A}/devices`} icon="📱" title="الأجهزة" sub="جوال / تابلت / كمبيوتر" tone={2}><div className="mt-2"><Donut data={s.devices as KV[]} labels={DEV} size="w-20" /></div></Card>
          <Card href={`${A}/sources`} icon="🧭" title="مصادر الزيارات" sub={`${s.organic} من محركات البحث`} tone={3}><div className="mt-2"><Bars data={s.sources as KV[]} labels={SRC} color="#3fb59a" limit={3} /></div></Card>
          <Card href={`${A}/pages`} icon="📄" title="أكثر الصفحات مشاهدة" tone={1}><div className="mt-2"><Bars data={s.pages as KV[]} color="#d9a441" limit={3} /></div></Card>
          <Card href={`${A}/searches`} icon="🔎" title="بحث الزوار داخل المتجر" value={s.searchTotal.n} sub={`${s.searchTotal.empty} بحث بلا نتائج`} tone={4} alert={s.searchTotal.empty > 0} />
          <Card href={`${A}/hours`} icon="⏰" title="أوقات الذروة" sub={peak ? `الذروة الساعة ${peak.h}:00 (${peak.v} زيارة)` : "لا بيانات بعد"} tone={0}><div className="mt-2"><Heat hours={s.hours as unknown as { h: number; v: number }[]} compact /></div></Card>
          <Card href={`${A}/tech`} icon="🌐" title="المتصفحات والأنظمة" sub={`${(s.browsers[0]?.k as string) ?? "—"} · ${(s.systems[0]?.k as string) ?? "—"} الأكثر استخدامًا`} tone={2} />
          <Card href={`${A}/referrers`} icon="🔗" title="جوجل والمواقع المُحيلة" value={s.organic} sub="زيارة من محركات البحث" tone={3} />
          <Card href={`${A}/visits`} icon="🧾" title="سجل الزيارات" sub="تفاصيل كل زيارة: الجهاز، المتصفح، الشاشة، المصدر" tone={1}>
            <ul className="mt-2 space-y-0.5 text-xs" dir="ltr">{s.recent.slice(0, 3).map((r, i) => <li key={i} className="truncate">{DEV[r.device as string]} · {r.path}</li>)}</ul>
          </Card>
        </div>
      </section>

      <section aria-labelledby="h-mg">
        <h2 id="h-mg" className="mb-3 text-lg font-bold">إدارة المتجر <span className="text-xs font-normal opacity-60">— الأرقام حيّة، والنقطة الحمراء تعني شيئًا ينتظرك</span></h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {manage.map((c, i) => <Card key={c.href} tone={i} {...c} />)}
        </div>
      </section>
    </div>
  );
}
