// Playwright wrapper: pre-answers the cookie banner so older suites are not blocked by the new overlay.
// E2E_BROWSER picks the engine the suites run on: chromium (default), firefox, webkit (Safari's engine) or msedge.
const pw = require('playwright');
const engine = process.env.E2E_BROWSER || 'chromium';
const type = engine === 'firefox' ? pw.firefox : engine === 'webkit' ? pw.webkit : pw.chromium;
const wrap = (bt) => { const l = bt.launch.bind(bt); const out = Object.create(bt);
  out.launch = async (o = {}) => { const br = await l(engine === 'msedge' ? { ...o, channel: 'msedge' } : o); const nc = br.newContext.bind(br);
    br.newContext = async (opts = {}) => { const o2 = { ...opts }; if (engine === 'firefox') delete o2.isMobile; // Firefox has no phone emulation flag; the phone viewport still applies
      const c = await nc(o2); await c.addInitScript(() => { try { localStorage.setItem('litore.cookies.v1', 'essential'); } catch {} }); return c; }; return br; };
  return out; };
module.exports = { ...pw, chromium: wrap(type) };
