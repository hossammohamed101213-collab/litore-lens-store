// Playwright wrapper: pre-answers the cookie banner so older suites are not blocked by the new overlay.
const pw = require('playwright');
const wrap = (bt) => { const l = bt.launch.bind(bt); bt.launch = async (o) => { const br = await l(o); const nc = br.newContext.bind(br);
  br.newContext = async (opts) => { const c = await nc(opts); await c.addInitScript(() => { try { if (!location.pathname.startsWith('/admin') || true) localStorage.setItem('litore.cookies.v1', 'essential'); } catch {} }); return c; }; return br; }; return bt; };
module.exports = { ...pw, chromium: wrap(pw.chromium) };
