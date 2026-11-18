import { db } from "@/lib/db";

export type VitalsSummary = { device: "phone" | "desktop"; visits: number; lcp: number | null; inp: number | null; cls: number | null };
export type Grade = "good" | "mid" | "poor" | "none";

/** 75th percentile: the value 3 out of 4 visits are at or under (the figure Google judges a site by). */
export function p75(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.75) - 1)];
}
/** Google's published limits: LCP 2.5s / 4s, INP 200ms / 500ms, CLS 0.1 / 0.25. */
export const grade = (metric: "lcp" | "inp" | "cls", v: number | null): Grade =>
  v == null ? "none" : metric === "lcp" ? (v <= 2500 ? "good" : v <= 4000 ? "mid" : "poor") : metric === "inp" ? (v <= 200 ? "good" : v <= 500 ? "mid" : "poor") : (v <= 100 ? "good" : v <= 250 ? "mid" : "poor");

export function recordVitals(v: { path: string; lcp: number; cls: number; inp: number; width: number }): void {
  db().prepare("INSERT INTO web_vitals(path, device, lcp_ms, cls_x1000, inp_ms) VALUES (?,?,?,?,?)").run(v.path, v.width < 768 ? "phone" : "desktop", v.lcp, v.cls, v.inp);
  db().prepare("DELETE FROM web_vitals WHERE id <= (SELECT MAX(id) FROM web_vitals) - 20000").run(); // keep the newest 20,000 visits
}

type Row = { device: string; path: string; lcp_ms: number; cls_x1000: number; inp_ms: number };
/** Last `days` days. A page reaction time of 0 means the visitor never tapped anything, so it is left out of INP. */
export function vitalsSummary(days = 28): { byDevice: VitalsSummary[]; pages: { path: string; visits: number; lcp: number | null }[] } {
  const rows = db().prepare("SELECT device, path, lcp_ms, cls_x1000, inp_ms FROM web_vitals WHERE at >= datetime('now', ?)").all(`-${days} days`) as Row[];
  const byDevice = (["phone", "desktop"] as const).map((device) => {
    const r = rows.filter((x) => x.device === device);
    return { device, visits: r.length, lcp: p75(r.map((x) => x.lcp_ms)), inp: p75(r.filter((x) => x.inp_ms > 0).map((x) => x.inp_ms)), cls: p75(r.map((x) => x.cls_x1000)) };
  });
  const phone = rows.filter((x) => x.device === "phone");
  const groups = new Map<string, number[]>();
  for (const x of phone) { const k = x.path.replace(/\/shop\/[^/]+$/, "/shop/…"); groups.set(k, [...(groups.get(k) ?? []), x.lcp_ms]); }
  const pages = [...groups.entries()].map(([path, v]) => ({ path, visits: v.length, lcp: p75(v) })).sort((a, b) => b.visits - a.visits).slice(0, 10);
  return { byDevice, pages };
}
