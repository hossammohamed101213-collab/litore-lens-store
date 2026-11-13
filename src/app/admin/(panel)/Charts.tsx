"use client";
import { useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/analytics";

export type KV = { k: string; v: number; r?: number };
export const RANGES: [number, string][] = [[1, "24 ساعة"], [7, "7 أيام"], [30, "30 يوم"], [90, "90 يوم"]];
export const DEV: Record<string, string> = { mobile: "جوال", tablet: "تابلت", desktop: "كمبيوتر" };
export const SRC: Record<string, string> = { direct: "دخول مباشر", search: "محركات البحث", social: "السوشيال", other: "مواقع أخرى" };
export const C = ["#e5739a", "#d9a441", "#8e6fd0", "#3fb59a", "#f08a5d", "#5b8def"];
const DEV_COLOR: Record<string, string> = { mobile: "#e5739a", tablet: "#8e6fd0", desktop: "#3fb59a" };

export function useCount(target: number) {
  const [n, setN] = useState(target); const from = useRef(target);
  useEffect(() => {
    const a = from.current; const t0 = performance.now(); let raf = 0;
    const step = (t: number) => { const p = Math.min(1, (t - t0) / 700); setN(Math.round(a + (target - a) * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); else from.current = target; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target]);
  return n;
}
export const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
export const ago = (ts: number, now: number) => { const s = Math.max(0, Math.round((now - ts) / 1000)); return s < 60 ? `قبل ${s} ث` : `قبل ${Math.round(s / 60)} د`; };

export function Gauge({ label, value, max, suffix = "", color, delta }: { label: string; value: number; max: number; suffix?: string; color: string; delta?: number }) {
  const n = useCount(value); const r = 52; const len = Math.PI * r; const f = Math.min(1, max ? value / max : 0);
  return (
    <div className="text-center">
      <svg viewBox="0 0 120 70" className="mx-auto w-full max-w-[170px]" role="img" aria-label={`${label}: ${value}${suffix}`}>
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="rgba(120,80,100,.14)" strokeWidth="9" strokeLinecap="round" />
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${len * f} ${len}`} style={{ transition: "stroke-dasharray .8s ease" }} />
        <text x="60" y="56" textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor">{n.toLocaleString("en")}{suffix}</text>
      </svg>
      <p className="text-sm font-bold">{label}</p>
      {delta !== undefined && <p className={`text-xs font-bold ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`} dir="ltr">{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%</p>}
    </div>
  );
}

type Live = Snapshot["liveList"];
/** Real-time radar: one dot per visitor active in the last 5 minutes. Fresh visitors sit near the centre. */
export function Radar({ list, now }: { list: Live; now: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const dots = list.map((v) => {
    const h = hash(String(v.visit)); const age = Math.min(1, (now - (v.ts as number)) / 300_000);
    const a = (h % 360) * (Math.PI / 180); const d = 9 + age * 34;
    return { x: 50 + Math.cos(a) * d, y: 50 + Math.sin(a) * d, color: DEV_COLOR[v.device as string] ?? "#fff", v };
  });
  const h = hover !== null ? dots[hover] : null;
  return (
    <div className="relative">
      <svg viewBox="0 0 100 100" className="mx-auto w-full max-w-[230px]" role="img" aria-label={`زوار الآن: ${list.length}`}>
        <circle cx="50" cy="50" r="48" fill="#1b1230" />
        {[46, 34, 22, 10].map((r) => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="rgba(240,171,252,.3)" strokeWidth=".6" />)}
        <path d="M50 2V98M2 50H98" stroke="rgba(240,171,252,.2)" strokeWidth=".5" />
        <g style={{ transformOrigin: "50px 50px", animation: "cockpit-sweep 4s linear infinite" }}>
          <path d="M50 50 L50 4 A46 46 0 0 1 82.5 17.5 Z" fill="url(#sw)" />
        </g>
        <defs><linearGradient id="sw" x1="0" x2="1"><stop offset="0" stopColor="#f0abfc" stopOpacity="0" /><stop offset="1" stopColor="#f0abfc" stopOpacity=".6" /></linearGradient></defs>
        {dots.map((d, i) => (
          <g key={String(d.v.visit)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} role="img" aria-label={`${DEV[d.v.device as string]} ${d.v.path}`}>
            <circle cx={d.x} cy={d.y} r="5" fill={d.color} opacity=".18" style={{ animation: "cockpit-ping 2s infinite" }} />
            <circle cx={d.x} cy={d.y} r={hover === i ? 3.6 : 2.4} fill={d.color} stroke="#fff" strokeWidth=".6" />
          </g>
        ))}
        <circle cx="50" cy="50" r="2.2" fill="#fcd34d" />
      </svg>
      {h && <div className="pointer-events-none absolute inset-x-2 bottom-0 rounded-lg bg-black/85 px-2 py-1 text-center text-[11px] text-white" dir="ltr">{DEV[h.v.device as string]} · {h.v.path} · {ago(h.v.ts as number, now)}</div>}
    </div>
  );
}

export function LiveList({ list, now }: { list: Live; now: number }) {
  if (!list.length) return <p className="text-center text-sm opacity-70">لا يوجد زوار الآن. تظهر هنا فورًا أي زيارة حقيقية للمتجر (للزوار الذين وافقوا على ملفات الإحصاء).</p>;
  return (
    <ul className="divide-y divide-mauve/10 text-sm">
      {list.map((v) => (
        <li key={String(v.visit)} className="flex items-center justify-between gap-2 py-1.5">
          <span><span className="me-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: DEV_COLOR[v.device as string] }} />{DEV[v.device as string]} <span dir="ltr" className="opacity-70">{v.path}</span></span>
          <span className="shrink-0 text-xs opacity-70">{SRC[v.source as string]} · {ago(v.ts as number, now)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Area({ s, tall = false }: { s: Snapshot; tall?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = tall ? 280 : 120, P = tall ? 28 : 8;
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
        <defs><linearGradient id={`ar${tall}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e5739a" stopOpacity=".5" /><stop offset="1" stopColor="#e5739a" stopOpacity="0" /></linearGradient></defs>
        {tall && [0, 0.5, 1].map((g) => <line key={g} x1={P} x2={W - P} y1={y(max * g)} y2={y(max * g)} stroke="rgba(120,80,100,.15)" />)}
        {pts.length > 0 && <><path d={`${line} L${x(pts.length - 1)} ${H - P} L${x(0)} ${H - P} Z`} fill={`url(#ar${tall})`} /><path d={line} fill="none" stroke="#e5739a" strokeWidth="2.5" strokeLinejoin="round" /></>}
        {tall && pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r={hover === i ? 5 : 2.5} fill="#e5739a" />)}
        {tall && hover !== null && pts[hover] && <line x1={x(hover)} x2={x(hover)} y1={P / 2} y2={H - P} stroke="#d9a441" strokeDasharray="3 3" />}
        {tall && <><text x={P} y={H - 6} fontSize="10" fill="currentColor" opacity=".6">{pts[0] ? fmt(pts[0].t) : ""}</text>
        <text x={W - P} y={H - 6} fontSize="10" textAnchor="end" fill="currentColor" opacity=".6">{pts.length ? fmt(pts[pts.length - 1].t) : ""}</text></>}
      </svg>
      {pts.length === 0 && <p className="absolute inset-0 grid place-items-center text-sm opacity-60">لا توجد زيارات مسجلة بعد</p>}
      {tall && hover !== null && pts[hover] && (
        <div className="pointer-events-none absolute top-2 rounded-lg bg-black/85 px-3 py-2 text-xs text-white" style={{ left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)" }}>
          <p className="font-bold">{fmt(pts[hover].t)}</p><p>مشاهدات: {pts[hover].v}</p><p>زوار: {pts[hover].u}</p>
        </div>
      )}
    </div>
  );
}

export function Donut({ data, labels, size = "w-32" }: { data: KV[]; labels: Record<string, string>; size?: string }) {
  const [hi, setHi] = useState<number | null>(null);
  const total = data.reduce((a, d) => a + d.v, 0) || 1; const r = 38, circ = 2 * Math.PI * r;
  const offs = data.map((_, i) => data.slice(0, i).reduce((a, d) => a + (d.v / total) * circ, 0));
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className={`${size} shrink-0 -rotate-90`} role="img" aria-label="توزيع الأجهزة">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(120,80,100,.12)" strokeWidth="14" />
        {data.map((d, i) => { const len = (d.v / total) * circ; return <circle key={d.k} cx="50" cy="50" r={r} fill="none" stroke={C[i % C.length]} strokeWidth={hi === i ? 18 : 14} strokeDasharray={`${len} ${circ}`} strokeDashoffset={-offs[i]} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ transition: "stroke-width .2s" }} />; })}
      </svg>
      <ul className="space-y-1 text-sm">
        {data.length === 0 && <li className="opacity-60">لا بيانات</li>}
        {data.map((d, i) => <li key={d.k} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} className={hi === i ? "font-bold" : ""}><span className="me-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: C[i % C.length] }} />{labels[d.k] ?? d.k}: {d.v} <span className="opacity-60">({Math.round((d.v / total) * 100)}%)</span></li>)}
      </ul>
    </div>
  );
}

export function Bars({ data, labels, color = "#e5739a", empty = "لا بيانات", limit }: { data: KV[]; labels?: Record<string, string>; color?: string; empty?: string; limit?: number }) {
  const rows = limit ? data.slice(0, limit) : data;
  const max = Math.max(1, ...rows.map((d) => d.v));
  if (!rows.length) return <p className="text-sm opacity-60">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((d) => (
        <li key={d.k}><div className="flex justify-between gap-2"><span className="truncate" dir="auto">{labels?.[d.k] ?? d.k}{d.r === 0 ? " ⚠" : ""}</span><strong>{d.v}</strong></div>
          <div className="h-1.5 rounded-full bg-mauve/10"><div className="h-full rounded-full" style={{ width: `${(d.v / max) * 100}%`, background: color, transition: "width .6s" }} /></div></li>
      ))}
    </ul>
  );
}

export function Heat({ hours, compact = false }: { hours: { h: number; v: number }[]; compact?: boolean }) {
  const m = new Map(hours.map((x) => [Number(x.h), Number(x.v)])); const max = Math.max(1, ...m.values());
  return (
    <div>
      <ul className={`grid gap-1 ${compact ? "grid-cols-12" : "grid-cols-6 sm:grid-cols-12"}`} dir="ltr">
        {Array.from({ length: 24 }, (_, h) => { const v = m.get(h) ?? 0; return <li key={h} title={`${h}:00 — ${v}`} className={`grid ${compact ? "h-5" : "aspect-square"} place-items-center rounded text-[10px] text-black/70`} style={{ background: `rgba(229,115,154,${0.1 + (v / max) * 0.9})` }}>{compact ? "" : h}</li>; })}
      </ul>
      {!compact && <p className="mt-2 text-xs opacity-60">ساعات اليوم بتوقيت الإمارات — الأغمق = أكثر زيارات</p>}
    </div>
  );
}

export function VisitsTable({ rows }: { rows: Snapshot["recent"] }) {
  if (!rows.length) return <p className="text-sm opacity-60">لا توجد زيارات مسجلة بعد. الزيارات تُحسب للزوار الذين وافقوا على ملفات الإحصاء.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-start text-sm">
        <thead className="text-xs opacity-60"><tr><th className="py-1 text-start">الوقت</th><th className="text-start">الصفحة</th><th className="text-start">الجهاز</th><th className="text-start">المتصفح / النظام</th><th className="text-start">الشاشة</th><th className="text-start">المصدر</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} className="border-t border-mauve/10"><td className="py-1.5">{new Date(r.ts as number).toLocaleString("ar-AE", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}</td><td dir="ltr" className="max-w-[220px] truncate text-start">{r.path}</td>
            <td><span className="rounded-full bg-blush/60 px-2 py-0.5 text-xs">{DEV[r.device as string]}</span></td><td dir="ltr" className="text-start">{r.browser} · {r.os}</td><td dir="ltr" className="text-start">{r.screen || "—"}</td><td>{r.referrer || SRC[r.source as string]}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export const Keyframes = () => <style>{`@keyframes cockpit-sweep{to{transform:rotate(360deg)}}@keyframes cockpit-ping{0%,100%{opacity:.9}50%{opacity:.25}}@keyframes cockpit-pulse{0%{box-shadow:0 0 0 0 rgba(52,211,153,.7)}100%{box-shadow:0 0 0 12px rgba(52,211,153,0)}}`}</style>;
