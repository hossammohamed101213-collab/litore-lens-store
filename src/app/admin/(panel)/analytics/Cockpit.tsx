"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/analytics";

type KV = { k: string; v: number; r?: number };
const RANGES: [number, string][] = [[1, "24 ساعة"], [7, "7 أيام"], [30, "30 يوم"], [90, "90 يوم"]];
const DEV: Record<string, string> = { mobile: "جوال", tablet: "تابلت", desktop: "كمبيوتر" };
const SRC: Record<string, string> = { direct: "دخول مباشر", search: "محركات البحث", social: "السوشيال", other: "مواقع أخرى" };
const C = ["#5eead4", "#f0abfc", "#fcd34d", "#7dd3fc", "#fda4af", "#a5b4fc"];

function useCount(target: number) {
  const [n, setN] = useState(target); const from = useRef(target);
  useEffect(() => {
    const a = from.current; const t0 = performance.now(); let raf = 0;
    const step = (t: number) => { const p = Math.min(1, (t - t0) / 700); setN(Math.round(a + (target - a) * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); else from.current = target; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target]);
  return n;
}
const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));

function Gauge({ label, value, max, suffix = "", color, delta }: { label: string; value: number; max: number; suffix?: string; color: string; delta?: number }) {
  const n = useCount(value); const r = 52; const len = Math.PI * r; const f = Math.min(1, max ? value / max : 0);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur">
      <svg viewBox="0 0 120 70" className="mx-auto w-full max-w-[190px]" role="img" aria-label={`${label}: ${value}${suffix}`}>
        <defs><filter id={`g-${label}`}><feGaussianBlur stdDeviation="2.2" /></filter></defs>
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="9" strokeLinecap="round" />
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${len * f} ${len}`} style={{ transition: "stroke-dasharray .8s ease" }} filter={`url(#g-${label})`} opacity=".7" />
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${len * f} ${len}`} style={{ transition: "stroke-dasharray .8s ease" }} />
        <text x="60" y="56" textAnchor="middle" fontSize="20" fontWeight="700" fill="#fff">{n.toLocaleString("en")}{suffix}</text>
      </svg>
      <p className="text-sm text-white/70">{label}</p>
      {delta !== undefined && <p className={`text-xs font-bold ${delta >= 0 ? "text-emerald-300" : "text-rose-300"}`} dir="ltr">{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%</p>}
    </div>
  );
}

function Radar({ live }: { live: number }) {
  const dots = Array.from({ length: Math.min(live, 14) }, (_, i) => { const a = i * 2.4; const d = 18 + ((i * 37) % 28); return [50 + Math.cos(a) * d, 50 + Math.sin(a) * d]; });
  return (
    <svg viewBox="0 0 100 100" className="mx-auto w-full max-w-[210px]" role="img" aria-label={`زوار الآن: ${live}`}>
      {[46, 34, 22, 10].map((r) => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="rgba(94,234,212,.25)" strokeWidth=".6" />)}
      <path d="M50 4V96M4 50H96" stroke="rgba(94,234,212,.18)" strokeWidth=".5" />
      <g style={{ transformOrigin: "50px 50px", animation: "cockpit-sweep 4s linear infinite" }}>
        <path d="M50 50 L50 4 A46 46 0 0 1 82.5 17.5 Z" fill="url(#sw)" />
      </g>
      <defs><linearGradient id="sw" x1="0" x2="1"><stop offset="0" stopColor="#5eead4" stopOpacity="0" /><stop offset="1" stopColor="#5eead4" stopOpacity=".55" /></linearGradient></defs>
      {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2" fill="#fcd34d" style={{ animation: `cockpit-ping 2s ${i * 0.2}s infinite` }} />)}
      <circle cx="50" cy="50" r="2.5" fill="#5eead4" />
    </svg>
  );
}

function Area({ s }: { s: Snapshot }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, P = 28;
  const pts = s.series.map((d) => ({ t: d.t as number, v: d.views as number, u: d.visitors as number }));
  const max = Math.max(1, ...pts.map((p) => p.v));
  const x = (i: number) => P + (pts.length < 2 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (pts.length - 1));
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p.v)}`).join(" ");
  const fmt = (t: number) => new Date(t).toLocaleString("ar-AE", s.bucket < 86_400_000 ? { hour: "numeric" } : { day: "numeric", month: "short" });
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="الزيارات عبر الوقت"
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; if (pts.length) setHover(Math.max(0, Math.min(pts.length - 1, Math.round(((px - P) / (W - 2 * P)) * (pts.length - 1))))); }}
        onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5eead4" stopOpacity=".45" /><stop offset="1" stopColor="#5eead4" stopOpacity="0" /></linearGradient></defs>
        {[0, 0.5, 1].map((g) => <line key={g} x1={P} x2={W - P} y1={y(max * g)} y2={y(max * g)} stroke="rgba(255,255,255,.08)" />)}
        {pts.length > 0 && <><path d={`${line} L${x(pts.length - 1)} ${H - P} L${x(0)} ${H - P} Z`} fill="url(#ar)" /><path d={line} fill="none" stroke="#5eead4" strokeWidth="2.5" strokeLinejoin="round" /></>}
        {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r={hover === i ? 5 : 2.5} fill="#5eead4" />)}
        {hover !== null && pts[hover] && <line x1={x(hover)} x2={x(hover)} y1={P / 2} y2={H - P} stroke="#fcd34d" strokeDasharray="3 3" />}
        <text x={P} y={H - 6} fontSize="10" fill="rgba(255,255,255,.5)">{pts[0] ? fmt(pts[0].t) : ""}</text>
        <text x={W - P} y={H - 6} fontSize="10" textAnchor="end" fill="rgba(255,255,255,.5)">{pts.length ? fmt(pts[pts.length - 1].t) : ""}</text>
      </svg>
      {pts.length === 0 && <p className="absolute inset-0 grid place-items-center text-sm text-white/50">لا توجد زيارات مسجلة بعد في هذه الفترة</p>}
      {hover !== null && pts[hover] && (
        <div className="pointer-events-none absolute top-2 rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-xs text-white" style={{ left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)" }}>
          <p className="font-bold">{fmt(pts[hover].t)}</p><p>مشاهدات: {pts[hover].v}</p><p>زوار: {pts[hover].u}</p>
        </div>
      )}
    </div>
  );
}

function Donut({ data, labels }: { data: KV[]; labels: Record<string, string> }) {
  const [hi, setHi] = useState<number | null>(null);
  const total = data.reduce((a, d) => a + d.v, 0) || 1; const r = 38, circ = 2 * Math.PI * r;
  const offs = data.map((_, i) => data.slice(0, i).reduce((a, d) => a + (d.v / total) * circ, 0));
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-32 shrink-0 -rotate-90" role="img" aria-label="توزيع الأجهزة">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="14" />
        {data.map((d, i) => { const len = (d.v / total) * circ; const acc = offs[i]; return <circle key={d.k} cx="50" cy="50" r={r} fill="none" stroke={C[i % C.length]} strokeWidth={hi === i ? 18 : 14} strokeDasharray={`${len} ${circ}`} strokeDashoffset={-acc} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ transition: "stroke-width .2s" }} />; })}
      </svg>
      <ul className="space-y-1 text-sm">
        {data.length === 0 && <li className="text-white/50">لا بيانات</li>}
        {data.map((d, i) => <li key={d.k} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} className={hi === i ? "font-bold" : ""}><span className="me-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: C[i % C.length] }} />{labels[d.k] ?? d.k}: {d.v} <span className="text-white/50">({Math.round((d.v / total) * 100)}%)</span></li>)}
      </ul>
    </div>
  );
}

function Bars({ data, labels, color = "#7dd3fc", empty = "لا بيانات" }: { data: KV[]; labels?: Record<string, string>; color?: string; empty?: string }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  if (!data.length) return <p className="text-sm text-white/50">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm">
      {data.map((d) => (
        <li key={d.k}><div className="flex justify-between gap-2"><span className="truncate" dir="auto">{labels?.[d.k] ?? d.k}{d.r === 0 ? " ⚠" : ""}</span><strong>{d.v}</strong></div>
          <div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${(d.v / max) * 100}%`, background: color, transition: "width .6s" }} /></div></li>
      ))}
    </ul>
  );
}

function Heat({ hours }: { hours: { h: number; v: number }[] }) {
  const m = new Map(hours.map((x) => [Number(x.h), Number(x.v)])); const max = Math.max(1, ...m.values());
  return (
    <div>
      <ul className="grid grid-cols-12 gap-1" dir="ltr">
        {Array.from({ length: 24 }, (_, h) => { const v = m.get(h) ?? 0; return <li key={h} title={`${h}:00 — ${v}`} className="grid aspect-square place-items-center rounded text-[10px] text-black/70" style={{ background: `rgba(94,234,212,${0.08 + (v / max) * 0.92})` }}>{h}</li>; })}
      </ul>
      <p className="mt-2 text-xs text-white/50">ساعات اليوم بتوقيت الإمارات — الأفتح = أكثر زيارات</p>
    </div>
  );
}

const Panel = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
  <section className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur ${className}`}><h2 className="mb-3 text-xs font-bold tracking-wide text-teal-200">{title}</h2>{children}</section>
);

export function Cockpit({ initial }: { initial: Snapshot }) {
  const [s, setS] = useState(initial); const [days, setDays] = useState(7); const [err, setErr] = useState(false); const [tick, setTick] = useState(0);
  const load = useCallback(async (d: number) => {
    try { const r = await fetch(`/api/admin/analytics?days=${d}`, { cache: "no-store" }); if (!r.ok) throw new Error(); setS(await r.json()); setErr(false); } catch { setErr(true); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(days), 0); return () => clearTimeout(t); }, [days, load]);
  useEffect(() => { const t = setInterval(() => { setTick((x) => x + 1); void load(days); }, 8000); return () => clearInterval(t); }, [days, load]);
  const total = s.devices.reduce((a, d) => a + (d.v as number), 0) || 1;
  const mobileShare = Math.round((((s.devices.find((d) => d.k === "mobile")?.v as number) ?? 0) / total) * 100);
  const organicShare = s.views ? Math.round((s.organic / s.views) * 100) : 0;
  const live = useCount(s.live);
  const ret = (k: string) => (s.returns.find((r) => r.k === k)?.v as number) ?? 0;
  return (
    <div dir="rtl" className="-mx-4 -my-8 min-h-[80dvh] space-y-4 bg-[#070b17] px-4 py-6 text-white" style={{ backgroundImage: "radial-gradient(circle at 20% 0%,rgba(94,234,212,.12),transparent 40%),radial-gradient(circle at 90% 20%,rgba(240,171,252,.1),transparent 40%)" }}>
      <style>{`@keyframes cockpit-sweep{to{transform:rotate(360deg)}}@keyframes cockpit-ping{0%,100%{opacity:1}50%{opacity:.25}}@keyframes cockpit-pulse{0%{box-shadow:0 0 0 0 rgba(52,211,153,.7)}100%{box-shadow:0 0 0 12px rgba(52,211,153,0)}}`}</style>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-3xl font-semibold">مركز المراقبة</h1><p className="text-xs text-white/60">يتحدّث تلقائيًا كل 8 ثوانٍ <span className="mx-1 inline-block h-2 w-2 rounded-full bg-emerald-400" style={{ animation: "cockpit-pulse 1.4s infinite" }} /> {err ? "انقطع الاتصال… نعيد المحاولة" : `آخر تحديث ${new Date(s.at).toLocaleTimeString("ar-AE")}`}<span className="sr-only">{tick}</span></p></div>
        <div role="group" aria-label="الفترة" className="flex gap-1 rounded-full bg-white/10 p-1">
          {RANGES.map(([d, l]) => <button key={d} onClick={() => setDays(d)} aria-pressed={days === d} className={`min-h-10 rounded-full px-4 text-sm ${days === d ? "bg-teal-300 font-bold text-black" : "hover:bg-white/10"}`}>{l}</button>)}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-4">
        <Panel title="زوار الآن (آخر 5 دقائق)" className="text-center"><Radar live={s.live} /><p className="text-5xl font-bold text-teal-300">{live}</p></Panel>
        <div className="grid grid-cols-2 gap-4 lg:col-span-3 lg:grid-cols-4">
          <Gauge label="المشاهدات" value={s.views} max={Math.max(s.views, s.prevViews, 10)} color="#5eead4" delta={pct(s.views, s.prevViews)} />
          <Gauge label="الزوار" value={s.visitors} max={Math.max(s.visitors, s.prevVisitors, 10)} color="#f0abfc" delta={pct(s.visitors, s.prevVisitors)} />
          <Gauge label="من الجوال" value={mobileShare} max={100} suffix="%" color="#fcd34d" />
          <Gauge label="من محركات البحث" value={organicShare} max={100} suffix="%" color="#7dd3fc" />
          <Panel title="الطلبات في الفترة"><p className="text-4xl font-bold text-amber-200">{s.orders}</p><p className="text-xs text-white/60">معدل التحويل {s.visitors ? ((s.orders / s.visitors) * 100).toFixed(1) : "0"}%</p></Panel>
          <Panel title="مرتجعات"><p className="text-4xl font-bold text-rose-200">{ret("requested")}</p><p className="text-xs text-white/60">جديدة · {ret("approved") + ret("received")} قيد المعالجة · {ret("refunded")} مستردة</p><Link href="/admin/returns" className="mt-1 inline-block text-xs underline">فتح المرتجعات</Link></Panel>
          <Panel title="بحث داخل المتجر"><p className="text-4xl font-bold text-fuchsia-200">{s.searchTotal.n}</p><p className="text-xs text-white/60">{s.searchTotal.empty} بحث بلا نتائج</p></Panel>
          <Panel title="زيارات من جوجل"><p className="text-4xl font-bold text-sky-200">{s.organic}</p><p className="text-xs text-white/60">زيارات وصلت من محركات البحث</p></Panel>
        </div>
      </div>

      <Panel title="حركة الزيارات"><Area s={s} /></Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="الأجهزة (جوال / تابلت / كمبيوتر)"><Donut data={s.devices as KV[]} labels={DEV} /></Panel>
        <Panel title="مصادر الزيارات"><Bars data={s.sources as KV[]} labels={SRC} color="#f0abfc" /></Panel>
        <Panel title="أكثر الصفحات مشاهدة"><Bars data={s.pages as KV[]} color="#5eead4" /></Panel>
        <Panel title="المتصفحات"><Bars data={s.browsers as KV[]} color="#fcd34d" /></Panel>
        <Panel title="أنظمة التشغيل"><Bars data={s.systems as KV[]} color="#a5b4fc" /></Panel>
        <Panel title="مواقع أحالت زوارًا"><Bars data={s.referrers as KV[]} color="#7dd3fc" empty="لا توجد مواقع محيلة بعد" /></Panel>
        <Panel title="أكثر ما يبحث عنه الزوار داخل المتجر"><Bars data={s.searches as KV[]} color="#fda4af" empty="لا توجد عمليات بحث بعد" /><p className="mt-2 text-xs text-white/50">⚠ = كلمة بحث بلا نتائج (فرصة لإضافة منتج)</p></Panel>
        <Panel title="أوقات الذروة"><Heat hours={s.hours as unknown as { h: number; v: number }[]} /></Panel>
        <Panel title="ظهور المتجر في جوجل">
          <p className="text-sm text-white/80">عدد مرات ظهور المتجر في نتائج جوجل (Impressions) تقيسه جوجل نفسها فقط، ولا يمكن لأي متجر قياسه من داخله. ربطه يكون عبر أداة Google Search Console المجانية بحساب جوجل الخاص بكِ.</p>
          <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-teal-300 px-5 text-sm font-bold text-black">فتح Search Console</a>
          <p className="mt-2 text-xs text-white/50">الزيارات الفعلية القادمة من البحث موجودة أعلاه ومحسوبة تلقائيًا.</p>
        </Panel>
      </div>

      <Panel title="آخر الزيارات — تفاصيل كل زيارة">
        {s.recent.length === 0 ? <p className="text-sm text-white/50">لا توجد زيارات مسجلة بعد. الزيارات تُحسب للزوار الذين وافقوا على ملفات الإحصاء.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-start text-sm">
              <thead className="text-xs text-white/50"><tr><th className="py-1 text-start">الوقت</th><th className="text-start">الصفحة</th><th className="text-start">الجهاز</th><th className="text-start">المتصفح / النظام</th><th className="text-start">الشاشة</th><th className="text-start">المصدر</th></tr></thead>
              <tbody>{s.recent.map((r, i) => (
                <tr key={i} className="border-t border-white/10"><td className="py-1.5">{new Date(r.ts as number).toLocaleTimeString("ar-AE")}</td><td dir="ltr" className="max-w-[220px] truncate text-start">{r.path}</td>
                  <td><span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{DEV[r.device as string]}</span></td><td dir="ltr" className="text-start">{r.browser} · {r.os}</td><td dir="ltr" className="text-start">{r.screen || "—"}</td><td>{r.referrer || SRC[r.source as string]}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
