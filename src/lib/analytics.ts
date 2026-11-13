import { db } from "@/lib/db";

export type Device = "mobile" | "tablet" | "desktop";

/** Classify a user agent. Nothing identifying is kept — only device class, browser and OS family. */
export function parseUA(ua: string): { device: Device; browser: string; os: string } {
  const u = ua || "";
  const tablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(u) || (/Macintosh/.test(u) && /Mobile/.test(u));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(u);
  const browser = /Edg\//.test(u) ? "Edge" : /OPR\/|Opera/.test(u) ? "Opera" : /SamsungBrowser/.test(u) ? "Samsung" : /CriOS|Chrome\//.test(u) ? "Chrome" : /FxiOS|Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "Other";
  const os = /Android/.test(u) ? "Android" : /iPhone|iPad|iPod/.test(u) ? "iOS" : /Windows/.test(u) ? "Windows" : /Mac OS X|Macintosh/.test(u) ? "macOS" : /Linux/.test(u) ? "Linux" : "Other";
  return { device: tablet ? "tablet" : mobile ? "mobile" : "desktop", browser, os };
}

const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia)\./i;
const SOCIAL = /(instagram|facebook|fb\.com|tiktok|snapchat|t\.co|twitter|x\.com|whatsapp|wa\.me|youtube|pinterest)/i;
export function classifyReferrer(ref: string, ownHost: string): { host: string; source: "direct" | "search" | "social" | "other" } {
  let host = "";
  try { host = new URL(ref).hostname.replace(/^www\./, ""); } catch { /* none */ }
  if (!host || host === ownHost.replace(/^www\./, "")) return { host: "", source: "direct" };
  if (SEARCH.test(host)) return { host, source: "search" };
  if (SOCIAL.test(host)) return { host, source: "social" };
  return { host, source: "other" };
}

export function logSearch(q: string, results: number) {
  const t = q.trim().toLowerCase().slice(0, 80);
  if (t.length < 2) return;
  try { db().prepare("INSERT INTO site_searches (ts, q, results) VALUES (?,?,?)").run(Date.now(), t, results); } catch { /* never break the page */ }
}

type Row = Record<string, string | number>;
const all = (sql: string, ...p: unknown[]) => db().prepare(sql).all(...p) as Row[];
const one = (sql: string, ...p: unknown[]) => db().prepare(sql).get(...p) as Row;

export type Snapshot = ReturnType<typeof snapshot>;

export function snapshot(rangeDays: number) {
  const now = Date.now(); const since = now - rangeDays * 86_400_000;
  const live = one("SELECT COUNT(DISTINCT visit) n FROM page_views WHERE ts > ?", now - 5 * 60_000).n as number;
  const totals = one("SELECT COUNT(*) views, COUNT(DISTINCT visit) visitors FROM page_views WHERE ts > ?", since);
  const prev = one("SELECT COUNT(*) views, COUNT(DISTINCT visit) visitors FROM page_views WHERE ts > ? AND ts <= ?", since - rangeDays * 86_400_000, since);
  const bucket = rangeDays <= 1 ? 3_600_000 : 86_400_000;
  const series = all(`SELECT (ts/${bucket})*${bucket} t, COUNT(*) views, COUNT(DISTINCT visit) visitors FROM page_views WHERE ts > ? GROUP BY t ORDER BY t`, since);
  const devices = all("SELECT device k, COUNT(*) v FROM page_views WHERE ts > ? GROUP BY device ORDER BY v DESC", since);
  const sources = all("SELECT source k, COUNT(*) v FROM page_views WHERE ts > ? GROUP BY source ORDER BY v DESC", since);
  const browsers = all("SELECT browser k, COUNT(*) v FROM page_views WHERE ts > ? GROUP BY browser ORDER BY v DESC LIMIT 6", since);
  const systems = all("SELECT os k, COUNT(*) v FROM page_views WHERE ts > ? GROUP BY os ORDER BY v DESC LIMIT 6", since);
  const pages = all("SELECT path k, COUNT(*) v FROM page_views WHERE ts > ? GROUP BY path ORDER BY v DESC LIMIT 8", since);
  const referrers = all("SELECT referrer k, COUNT(*) v FROM page_views WHERE ts > ? AND referrer != '' GROUP BY referrer ORDER BY v DESC LIMIT 6", since);
  const hours = all("SELECT CAST(strftime('%H', ts/1000, 'unixepoch', '+4 hours') AS INTEGER) h, COUNT(*) v FROM page_views WHERE ts > ? GROUP BY h", since);
  const searches = all("SELECT q k, COUNT(*) v, MIN(results) r FROM site_searches WHERE ts > ? GROUP BY q ORDER BY v DESC LIMIT 8", since);
  const searchTotal = one("SELECT COUNT(*) n, SUM(results = 0) empty FROM site_searches WHERE ts > ?", since);
  const liveList = all("SELECT visit, path, device, source, MAX(ts) ts FROM page_views WHERE ts > ? GROUP BY visit ORDER BY ts DESC LIMIT 30", now - 5 * 60_000);
  const recent = all("SELECT ts, path, device, browser, os, screen, source, referrer, locale FROM page_views ORDER BY id DESC LIMIT 40");
  const returns = all("SELECT status k, COUNT(*) v FROM returns GROUP BY status");
  const orders = one("SELECT COUNT(*) n FROM orders WHERE created_at >= datetime(?/1000, 'unixepoch')", since).n as number;
  return {
    at: now, rangeDays, live, liveList, views: totals.views as number, visitors: totals.visitors as number,
    prevViews: prev.views as number, prevVisitors: prev.visitors as number, bucket, series, devices, sources, browsers, systems, pages, referrers,
    hours, searches, searchTotal: { n: (searchTotal.n as number) ?? 0, empty: (searchTotal.empty as number) ?? 0 }, recent, returns, orders,
    organic: (sources.find((s) => s.k === "search")?.v as number) ?? 0,
  };
}
