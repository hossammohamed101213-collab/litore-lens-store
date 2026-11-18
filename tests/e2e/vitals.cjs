// Real-visitor speed measurement on the TEST server: anonymous, only with consent, bad input refused, shown to the owner.
// Run: DB_PATH=/path/to/l.db BASE=http://localhost:3100 node tests/e2e/vitals.cjs
const pw = require('playwright'); const wrapped = require('./_pw.cjs');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const q = (sql, ...a) => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const count = () => q('SELECT COUNT(*) n FROM web_vitals')[0].n;
const post = (body, headers = { origin: base }) => fetch(base + '/api/vitals', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }).then((r) => r.status);
(async () => {
  const good = { path: '/ar/shop', lcp: 1800, cls: 12, inp: 90, w: 390 };
  ok(await post(good) === 200 && count() === 1, 'a valid speed report is stored');
  ok(await post(good, { origin: 'https://evil.example' }) === 403 && count() === 1, 'a report from another site is refused');
  const bad = [{ ...good, path: '/admin/orders' }, { ...good, path: 'https://x.y/ar' }, { ...good, lcp: -5 }, { ...good, lcp: 'fast' }, { ...good, lcp: 99999999 }, { ...good, cls: null }, { path: '/ar' }];
  const codes = []; for (const b of bad) codes.push(await post(b));
  ok(codes.every((c) => c === 400) && count() === 1, `made-up or out-of-range reports are refused (${codes.join(',')})`);
  const cols = q('PRAGMA table_info(web_vitals)').map((c) => c.name).join(',');
  ok(cols === 'id,at,path,device,lcp_ms,cls_x1000,inp_ms', 'only page, device type and three numbers are kept: no address, no identifier');

  // a real browser: nothing is sent without consent; with consent one report per page view
  const b = await wrapped.chromium.launch({ args: ['--no-proxy-server'] });
  const visit = async (consent) => { const ctx = await b.newContext({ locale: 'ar-AE', viewport: { width: 390, height: 844 }, isMobile: true });
    await ctx.addInitScript((c) => { try { localStorage.setItem('litore.cookies.v1', c); } catch {} }, consent);
    const p = await ctx.newPage(); await p.goto(base + '/ar', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.goto(base + '/ar/shop', { waitUntil: 'networkidle' }); await p.waitForTimeout(800); await ctx.close(); };
  let n0 = count(); await visit('essential');
  ok(count() === n0, 'a visitor who did not accept statistics cookies is not measured');
  n0 = count(); await visit('all'); await new Promise((r) => setTimeout(r, 800));
  const rows = q('SELECT path, device, lcp_ms, cls_x1000, inp_ms FROM web_vitals ORDER BY id DESC LIMIT ?', Math.max(0, count() - n0));
  ok(rows.length >= 1 && rows.some((r) => r.path === '/ar' && r.device === 'phone' && r.lcp_ms > 0 && r.lcp_ms < 60000), `with consent the page reports its own speed (${rows.map((r) => r.path + ' ' + r.lcp_ms + 'ms').join(', ') || 'nothing'})`);

  // the owner's page
  const g = await fetch(base + '/admin/speed', { redirect: 'manual' }); ok(g.status >= 300 && g.status < 400, 'the speed page needs an admin session');
  const ctx = await b.newContext({ locale: 'ar-AE' }); const a = await ctx.newPage();
  await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  const res = await a.goto(base + '/admin/speed'); const text = await a.locator('main').innerText();
  ok(res.status() === 200 && /الموبايل/.test(text) && /\d\.\d ث/.test(text), 'the owner sees the phone figures on the speed page');
  ok(/لا توجد بيانات بعد|الرقم يصبح موثوقًا/.test(text), 'with few visits the page says the figure is not reliable yet');
  await b.close(); void pw; console.log('FAILS', fails); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed', e && e.message); process.exit(1); });
