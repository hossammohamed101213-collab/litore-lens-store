// E2E: on phone widths no page scrolls sideways and nothing sticks out of the screen (storefront + admin, AR + EN).
const { chromium } = require('./_pw.cjs');
const base = process.env.BASE || 'http://localhost:3100';
const SHOTS = process.env.SHOTS || '';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const probe = () => {
  const vw = document.documentElement.clientWidth, out = [];
  const clipped = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; } return false; };
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) continue;
    if (r.right > vw + 1 || r.left < -1) { if (clipped(el)) continue; out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} [${Math.round(r.left)}..${Math.round(r.right)}]`); }
  }
  const scrollers = [...document.querySelectorAll('*')].filter((e) => e.scrollWidth > e.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowX) && e.clientWidth > 0).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} ${e.scrollWidth}/${e.clientWidth}`);
  return { vw, sw: document.documentElement.scrollWidth, out: out.slice(0, 4), n: out.length, scrollers };
};
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  for (const width of [360, 412]) {
    const ctx = await b.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar-AE' });
    await ctx.addInitScript(() => { try { localStorage.setItem('litore.cookies.v1', JSON.stringify({ choice: 'necessary', at: Date.now() })); sessionStorage.setItem('litore.splash', '1'); } catch {} });
    const pg = await ctx.newPage();
    const check = async (label, url, after) => {
      if (url) await pg.goto(base + url, { waitUntil: 'networkidle' }).catch(() => {});
      if (after) await after();
      await pg.waitForTimeout(250);
      const r = await pg.evaluate(probe);
      ok(r.sw <= r.vw + 1 && r.n === 0, `${width}px ${label}: fits the screen` + (r.sw > r.vw + 1 || r.n ? ` (page ${r.sw}/${r.vw}; ${r.n} outside: ${r.out.join(' | ')})` : ''));
      if (r.scrollers.length) console.log(`NOTE ${width}px ${label}: sideways-scrolling box: ${r.scrollers.slice(0, 3).join(' | ')}`);
      if (SHOTS) await pg.screenshot({ path: `${SHOTS}/${width}-${label.replace(/[^a-z0-9]+/gi, '_')}.png` });
    };
    // storefront
    await pg.goto(base + '/ar/shop', { waitUntil: 'networkidle' });
    const slug = await pg.evaluate(() => { const a = [...document.querySelectorAll('a[href*="/shop/"]')].map((x) => new URL(x.href).pathname.split('/').pop()).filter(Boolean); return a[0]; });
    for (const loc of ['ar', 'en']) {
      for (const p of ['', '/shop', `/shop/${slug}`, '/cart', '/track', '/account', '/wishlist', '/offers', '/prices', '/search?q=a', '/complaints', '/terms', '/privacy', '/returns', '/shipping', '/contact', '/about'])
        await check(`${loc}${p || '/home'}`, `/${loc}${p}`);
      await check(`${loc} cart drawer`, `/${loc}/shop/${slug}`, async () => { await pg.getByRole('button', { name: loc === 'ar' ? 'أضيفي إلى السلة' : /add to cart/i }).first().click(); await pg.waitForSelector('[role=dialog]'); });
      await check(`${loc} cart with item`, `/${loc}/cart`);
      await check(`${loc} checkout`, `/${loc}/checkout`);
    }
    // one real-looking order, so the order pages and tables have content to lay out
    const vid = await pg.evaluate(() => JSON.parse(localStorage.getItem('litore.cart.v1') || '{"lines":[]}').lines[0]?.variantId);
    const oid = vid && await pg.evaluate(async ([v, k]) => (await (await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ variantId: v, quantity: 1 }], contact: { email: 'layout-check-long-address@example.com', phone: '+971501234567' }, address: { name: 'Layout Check Customer With A Long Name', phone: '+971501234567', line1: 'Street 1 Building 2 Apartment 345 Near The Big Mall', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: k, locale: 'ar' }) })).json()).orderId, [vid, `layout-key-${width}-0001`]);
    ok(!!oid, `${width}px sample order placed`);
    // admin
    await pg.goto(base + '/admin/login'); await check('admin login', null);
    await pg.fill('#email', 'owner@example.com'); await pg.fill('#password', 'Str0ng-Passw0rd!'); await pg.locator('main button:not([type=button])').click(); await pg.waitForURL(/\/admin$/);
    await pg.request.post(base + '/api/feedback', { data: { kind: 'complaint', message: 'شكوى اختبار طويلة جدًا للتأكد من أن النص الطويل لا يكسر عرض قائمة الإشعارات على الموبايل أبدًا', name: 'نور' }, headers: { origin: base } });
    for (const p of ['', '/orders', '/products', '/coupons', '/customers', '/feedback', '/notifications', '/integrations', '/integrations/telr', '/integrations/ziina', '/integrations/stripe', '/integrations/quiqup', '/integrations/aramex', '/integrations/sender', '/settings', '/shipping', '/tax', '/payments', '/reconciliation', '/errors', '/speed', '/analytics', '/activity', '/backup', '/returns', '/resets', '/account', '/social', '/ticker', '/background', '/affiliates', '/referrals'])
      await check(`admin${p || '/home'}`, `/admin${p}`);
    await check('admin bell open', '/admin', async () => { await pg.locator('button[aria-haspopup=dialog]').tap(); await pg.getByRole('dialog', { name: 'الإشعارات' }).waitFor(); });
    await pg.goto(base + '/admin/products', { waitUntil: 'networkidle' });
    const edit = await pg.evaluate(() => { const a = [...document.querySelectorAll('a[href^="/admin/products/"]')].map((x) => x.getAttribute('href')); return a[0] || ''; });
    if (edit) await check('admin product edit', edit);
    await pg.goto(base + '/admin/orders', { waitUntil: 'networkidle' });
    const ord = await pg.evaluate(() => { const a = [...document.querySelectorAll('a[href^="/admin/orders/"]')].map((x) => x.getAttribute('href')); return a[0] || ''; });
    await check('admin orders with data', '/admin/orders'); if (ord) await check('admin order detail', ord); if (ord) await check('admin label print page', '/admin/orders/print?id=' + ord.split('/').pop());
    await check('admin customers with data', '/admin/customers'); await check('admin payments with data', '/admin/payments');
    await ctx.close();
  }
  console.log(fails ? `FAILS ${fails}` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
