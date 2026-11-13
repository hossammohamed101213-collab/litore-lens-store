"use client";
import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "@/lib/analytics";
import { Area, Bars, Donut, DEV, Heat, Keyframes, LiveList, RANGES, SRC, VisitsTable, type KV } from "../../Charts";

import { TOPICS } from "./topics";

const Box = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-gold/50 bg-white/80 p-5 shadow-sm"><h2 className="mb-3 font-bold">{title}</h2>{children}</section>
);

export function Detail({ topic, initial }: { topic: string; initial: Snapshot }) {
  const [s, setS] = useState(initial); const [days, setDays] = useState(7);
  const load = useCallback(async (d: number) => { try { const r = await fetch(`/api/admin/analytics?days=${d}`, { cache: "no-store" }); if (r.ok) setS(await r.json()); } catch { /* keep last */ } }, []);
  useEffect(() => { const t = setTimeout(() => void load(days), 0); return () => clearTimeout(t); }, [days, load]);
  useEffect(() => { const t = setInterval(() => void load(days), 8000); return () => clearInterval(t); }, [days, load]);
  const hours = s.hours as unknown as { h: number; v: number }[];
  return (
    <div className="space-y-5">
      <Keyframes />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">{TOPICS[topic]}</h1>
        <div role="group" aria-label="الفترة" className="flex gap-1 rounded-full bg-white/70 p-1 shadow-sm">
          {RANGES.map(([d, l]) => <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d} className={`min-h-10 rounded-full px-4 text-sm ${days === d ? "bg-mauve font-bold text-white" : "hover:bg-blush/50"}`}>{l}</button>)}
        </div>
      </div>
      {topic === "traffic" && <>
        <Box title={`المشاهدات عبر الوقت — ${s.views} مشاهدة · ${s.visitors} زائر`}><Area s={s} tall /></Box>
        <div className="grid gap-4 sm:grid-cols-3">
          <Box title="المشاهدات"><p className="text-4xl font-bold">{s.views}</p><p className="text-xs opacity-70">الفترة السابقة: {s.prevViews}</p></Box>
          <Box title="الزوار"><p className="text-4xl font-bold">{s.visitors}</p><p className="text-xs opacity-70">الفترة السابقة: {s.prevVisitors}</p></Box>
          <Box title="الطلبات"><p className="text-4xl font-bold">{s.orders}</p><p className="text-xs opacity-70">معدل التحويل {s.visitors ? ((s.orders / s.visitors) * 100).toFixed(1) : "0"}%</p></Box>
        </div>
        <Box title="الآن على المتجر"><LiveList list={s.liveList} now={s.at} /></Box>
      </>}
      {topic === "devices" && <Box title="توزيع الأجهزة"><Donut data={s.devices as KV[]} labels={DEV} size="w-44" /></Box>}
      {topic === "sources" && <Box title="من أين يصل الزوار؟"><Bars data={s.sources as KV[]} labels={SRC} color="#3fb59a" /></Box>}
      {topic === "pages" && <Box title="أكثر الصفحات مشاهدة"><Bars data={s.pages as KV[]} color="#d9a441" /></Box>}
      {topic === "searches" && <Box title={`${s.searchTotal.n} عملية بحث · ${s.searchTotal.empty} بلا نتائج`}><Bars data={s.searches as KV[]} color="#e5739a" empty="لا توجد عمليات بحث بعد" /><p className="mt-3 text-xs opacity-60">⚠ = كلمة بحث بلا نتائج (فرصة لإضافة منتج)</p></Box>}
      {topic === "hours" && <Box title="الزيارات حسب ساعات اليوم"><Heat hours={hours} /></Box>}
      {topic === "tech" && <div className="grid gap-4 md:grid-cols-2"><Box title="المتصفحات"><Bars data={s.browsers as KV[]} color="#d9a441" /></Box><Box title="أنظمة التشغيل"><Bars data={s.systems as KV[]} color="#8e6fd0" /></Box></div>}
      {topic === "referrers" && <>
        <Box title="زيارات من محركات البحث (جوجل وغيره)"><p className="text-4xl font-bold">{s.organic}</p></Box>
        <Box title="المواقع التي أحالت زوارًا"><Bars data={s.referrers as KV[]} color="#5b8def" empty="لا توجد مواقع محيلة بعد" /></Box>
        <Box title="ظهور المتجر في نتائج جوجل">
          <p className="text-sm">عدد مرات ظهور المتجر في نتائج جوجل (Impressions) تقيسه جوجل نفسها فقط، ولا يمكن لأي متجر قياسه من داخله. يُربط عبر أداة Google Search Console المجانية بحساب جوجل الخاص بكِ.</p>
          <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-mauve px-5 text-sm font-bold text-white">فتح Search Console</a>
        </Box>
      </>}
      {topic === "visits" && <Box title="آخر 40 زيارة — تفاصيل كل زيارة"><VisitsTable rows={s.recent} /></Box>}
    </div>
  );
}
