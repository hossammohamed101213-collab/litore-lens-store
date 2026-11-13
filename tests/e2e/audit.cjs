// Pre-release audit: security probes + layout/accessibility sweep across devices.
const { chromium } = require('./_pw.cjs');
const Database = require('better-sqlite3');
const base = process.env.BASE; const dbPath = process.env.DB_PATH;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const FOREIGN = { origin: 'https://evil.example', 'content-type': 'application/json' };
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  // ---- security ----
  for (const p of ['/admin', '/admin/analytics', '/admin/returns', '/admin/referrals', '/admin/affiliates', '/admin/customers', '/admin/settings']) {
    const r = await fetch(base + p, { redirect: 'manual' }); ok(r.status >= 300 && r.status < 400 && /login/.test(r.headers.get('location') || ''), `guest redirected from ${p}`);
  }
  for (const p of ['/api/admin/analytics', '/api/account/returns', '/api/account/referral', '/api/account/me']) { const r = await fetch(base + p); ok([401, 403].includes(r.status) || (p.endsWith('/me') && r.status === 200), `guest blocked on ${p} (${r.status})`); }
  for (const [p, body] of [['/api/affiliate', { name: 'x', phone: '1' }], ['/api/account/returns', { orderId: 'x', reason: 'other' }], ['/api/account/referral/redeem', {}], ['/api/feedback', { kind: 'review', message: 'hi', rating: 5 }], ['/api/track', { path: '/a', visit: 'z' }], ['/api/account/forgot', { identifier: 'a@b.co' }], ['/api/account/register', { name: 'a', email: 'a@b.co', password: 'Passw0rd-123' }]]) {
    const r = await fetch(base + p, { method: 'POST', headers: FOREIGN, body: JSON.stringify(body) }); ok(r.status === 403, `cross-site POST refused on ${p} (${r.status})`);
  }
  const trav = await fetch(base + '/uploads/..%2f..%2f..%2fetc%2fpasswd'); ok(trav.status === 404 || trav.status === 400, 'path traversal on /uploads blocked (' + trav.status + ')');
  const h = (await fetch(base + '/ar')).headers; ok(h.get('x-frame-options') === 'DENY' && h.get('x-content-type-options') === 'nosniff' && !h.get('x-powered-by'), 'security headers present, no X-Powered-By');
  const sq = await fetch(base + "/ar/search?q=" + encodeURIComponent("' OR 1=1; DROP TABLE products;--")); ok(sq.status === 200, 'SQL-injection text in search is harmless');
  const db0 = new Database(dbPath, { readonly: true }); ok(db0.prepare('SELECT COUNT(*) n FROM products').get().n > 0, 'products table intact after injection probe'); db0.close();
  // XSS payloads end up escaped in admin pages (no dialog may fire)
  const XSS = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  const dialogs = []; const ax = await b.newContext(); const a = await ax.newPage(); a.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  const vx = await b.newContext(); const v = await vx.newPage();
  await v.goto(base + '/ar'); for (const [p, body] of [['/api/affiliate', { name: XSS, phone: '0555555555', social: XSS, about: XSS }], ['/api/feedback', { kind: 'complaint', message: XSS, name: XSS, contact: '0500000000' }]]) await v.evaluate(([p, b]) => fetch(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }), [p, body]);
  await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  for (const p of ['/admin/affiliates', '/admin/feedback', '/admin/notifications', '/admin/returns', '/admin/customers']) { await a.goto(base + p); await a.waitForTimeout(500); }
  ok(dialogs.length === 0, 'stored XSS payloads never execute in admin pages');
  // admin login brute-force throttle
  let blocked = false; const bx = await b.newContext(); const bp = await bx.newPage(); await bp.goto(base + '/admin/login');
  for (let i = 0; i < 9 && !blocked; i++) { await bp.waitForLoadState('networkidle'); await bp.fill('#email', 'nobody@example.com'); await bp.fill('#password', 'wrong' + i); await bp.locator('main button:not([type=button])').click(); await bp.waitForSelector('p[role=alert]'); await bp.waitForTimeout(300); blocked = /كثيرة/.test(await bp.locator('p[role=alert]').innerText()); }
  ok(blocked, 'admin login is throttled after repeated wrong passwords');
  // IDOR on returns
  const w = new Database(dbPath);
  const mkc = async (email) => { const x = await b.newContext(); const p = await x.newPage(); await p.addInitScript(() => sessionStorage.setItem('litore_splash', '1')); await p.goto(base + '/ar/account/register'); await p.fill('#name', 'عميلة'); await p.fill('#email', email); await p.fill('#password', 'Passw0rd-123'); await p.locator('form').getByRole('button', { name: 'إنشاء حساب' }).click(); await p.waitForURL(/\/ar\/account$/); return p; };
  const c1 = await mkc('one@example.com'); const c2 = await mkc('two@example.com');
  const id1 = w.prepare("SELECT id FROM customers WHERE email='one@example.com'").get().id;
  w.prepare("INSERT INTO orders (id,customer_id,email,phone,status,subtotal_minor,total_minor,currency,shipping_label_ar,shipping_label_en,address_json,idempotency_key) VALUES ('LT-IDOR','" + id1 + "','one@example.com','0500000000','delivered',1,1,'AED','x','x','{}','k-idor')").run(); w.close();
  const st = await c2.evaluate(async () => (await fetch('/api/account/returns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: 'LT-IDOR', reason: 'other' }) })).status);
  ok(st === 404, "customer cannot open a return on someone else's order (" + st + ')');
  const lst = await c2.evaluate(async () => (await (await fetch('/api/account/orders')).json()).orders.length); ok(lst === 0, "customer cannot list someone else's orders");
  // ---- layout / accessibility sweep ----
  const VP = [[360, 740], [390, 844], [768, 1024], [1024, 768], [1440, 900]];
  const PAGES = ['/ar', '/en', '/ar/shop', '/en/shop', '/ar/shop/sample-rose-quartz', '/ar/offers', '/ar/cart', '/ar/account/login', '/ar/account/register', '/ar/account/forgot', '/ar/affiliate', '/en/affiliate', '/ar/privacy', '/ar/terms', '/ar/faq', '/ar/contact', '/ar/track', '/ar/search?q=rose'];
  const errs = []; const bad = [];
  for (const [w2, h2] of VP) {
    const x = await b.newContext({ viewport: { width: w2, height: h2 } }); await x.addInitScript(() => { sessionStorage.setItem('litore_splash', '1'); localStorage.setItem('litore.cookies.v1', 'essential'); });
    const p = await x.newPage(); p.on('pageerror', e => errs.push(`${w2} ${e}`)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(`${w2} ${m.text().slice(0, 120)}`); });
    for (const path of PAGES) {
      const r = await p.goto(base + path); await p.waitForTimeout(250);
      const q = await p.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 1, noAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length, h1: document.querySelectorAll('h1').length, unnamed: [...document.querySelectorAll('button,a')].filter(e => !(e.textContent || '').trim() && !e.getAttribute('aria-label') && !e.getAttribute('title') && !e.querySelector('img[alt]:not([alt=""])')).length, smallTap: 0 }));
      if (r.status() >= 400 || q.over || q.noAlt || q.h1 !== 1 || q.unnamed) bad.push(`${w2}px ${path}: status ${r.status()} overflow=${q.over} noAlt=${q.noAlt} h1=${q.h1} unnamed=${q.unnamed}`);
    }
    if (w2 === 360 || w2 === 1440) { // admin pages
      const ac = await b.newContext({ viewport: { width: w2, height: h2 } }); const ap = await ac.newPage(); ap.on('pageerror', e => errs.push(`admin ${w2} ${e}`));
      await ap.goto(base + '/admin/login'); await ap.fill('#email', 'owner@example.com'); await ap.fill('#password', 'Str0ng-Passw0rd!'); await ap.locator('main button:not([type=button])').click(); await ap.waitForURL(/\/admin$/);
      for (const path of ['/admin', '/admin/analytics', '/admin/returns', '/admin/referrals', '/admin/affiliates', '/admin/products', '/admin/products/new', '/admin/settings', '/admin/orders', '/admin/feedback']) { await ap.goto(base + path); await ap.waitForTimeout(400); const over = await ap.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); if (over) bad.push(`admin ${w2}px ${path}: horizontal overflow`); }
    }
  }
  bad.forEach(x => console.log('  ', x)); ok(bad.length === 0, `layout/accessibility sweep clean (${bad.length} issues)`);
  ok(errs.length === 0, 'no console/page errors across devices ' + (errs.length ? '\n' + [...new Set(errs)].slice(0, 8).join('\n') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
