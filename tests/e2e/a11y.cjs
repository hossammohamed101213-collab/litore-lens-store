// Accessibility (WCAG 2.2 AA rules that a machine can check) on the whole buying journey + account + admin, in Arabic and English,
// on a phone-sized and a desktop-sized screen. Uses axe-core. TEST server only (fresh DB, SEED_SAMPLE=true, PAYMENT_MODE=mock).
// Run: DB_PATH=/path/to/l.db BASE=http://localhost:3100 node tests/e2e/a11y.cjs
const { chromium } = require('./_pw.cjs');
const fs = require('fs');
const Database = require('better-sqlite3');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const q1 = (sql, ...a) => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare(sql).get(...a); } finally { d.close(); } };
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function check(pg, name) {
  await pg.waitForLoadState('networkidle').catch(() => {});
  await pg.evaluate(() => document.querySelectorAll('[data-splash], .splash').forEach((n) => n.remove())).catch(() => {});
  await pg.waitForTimeout(700); // let entrance animations finish so colours are measured at rest
  await pg.addScriptTag({ content: axeSource });
  const res = await pg.evaluate(async (tags) => { const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0].target.join(' ').slice(0, 90), why: (v.nodes[0].failureSummary || '').split('\n').slice(1, 2).join(' ').trim().slice(0, 120) })); }, TAGS);
  const bad = res.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  ok(bad.length === 0, `${name}: no serious accessibility problems${bad.length ? ' -> ' + bad.map((v) => `${v.id} x${v.n} [${v.sample}] ${v.why}`).join(' | ') : ''}`);
  for (const v of res.filter((x) => !bad.includes(x))) console.log('NOTE', name, v.impact, v.id, 'x' + v.n, v.sample);
}

(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const p = q1("SELECT p.slug, v.id vid FROM products p JOIN variants v ON v.product_id = p.id WHERE p.status = 'active' AND p.price_minor > 0 AND v.stock > 3 LIMIT 1");
  for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1366, height: 900 }]]) {
    for (const loc of ['ar', 'en']) {
      const ctx = await b.newContext({ viewport, locale: loc === 'ar' ? 'ar-AE' : 'en-AE' }); const pg = await ctx.newPage(); const tag = `${label}/${loc}`;
      for (const [path, name] of [[`/${loc}`, 'home'], [`/${loc}/shop`, 'shop'], [`/${loc}/search?q=rose`, 'search'], [`/${loc}/search?q=zzzz-none`, 'search (no results)'], [`/${loc}/shop/${p.slug}`, 'product'], [`/${loc}/returns`, 'returns policy'], [`/${loc}/track`, 'track order'], [`/${loc}/account/login`, 'customer sign-in'], [`/${loc}/account/register`, 'customer sign-up'], [`/${loc}/nope-404`, 'not found']]) {
        await pg.goto(base + path); await check(pg, `${tag} ${name}`);
      }
      await pg.goto(`${base}/${loc}/shop/${p.slug}`); await pg.getByRole('button', { name: loc === 'ar' ? 'أضيفي إلى السلة' : /add to cart/i }).first().click(); await pg.waitForSelector('[role=dialog]'); await check(pg, `${tag} cart panel open`);
      await pg.goto(`${base}/${loc}/cart`); await check(pg, `${tag} cart`);
      await pg.goto(`${base}/${loc}/checkout`); await pg.waitForFunction(() => { const x = document.querySelector('button[type=submit]'); return x && !x.disabled; }); await check(pg, `${tag} checkout`);
      await pg.locator('button[type=submit]').click(); await pg.waitForTimeout(600); await check(pg, `${tag} checkout with error messages`);
      const reg = await pg.evaluate(async (e) => (await fetch('/api/account/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'A11y Test', email: e, password: 'Str0ng-Passw0rd!', phone: '+971501234567' }) })).status, `a11y-${label}-${loc}@example.com`);
      const oid = await pg.evaluate(async ([vid, k, l]) => (await (await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ variantId: vid, quantity: 1 }], contact: { email: 'a11y@example.com', phone: '+971501234567' }, address: { name: 'A11y Test', phone: '+971501234567', line1: 'Street 1 Building 2', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: k, locale: l }) })).json()).orderId, [p.vid, `a11y-key-${label}-${loc}`, loc]);
      ok(reg < 300 && !!oid, `${tag} test account and order created`);
      for (const [path, name] of [[`/${loc}/order/${oid}`, 'order confirmation'], [`/${loc}/account`, 'account'], [`/${loc}/account/orders`, 'my orders'], [`/${loc}/account/orders/${oid}/invoice`, 'invoice'], [`/${loc}/account/addresses`, 'addresses'], [`/${loc}/wishlist`, 'wishlist'], [`/${loc}/checkout/failed`, 'payment failed']]) {
        await pg.goto(base + path); await check(pg, `${tag} ${name}`);
      }
      await ctx.close();
    }
    const actx = await b.newContext({ viewport, locale: 'ar-AE' }); const a = await actx.newPage();
    await a.goto(base + '/admin/login'); await check(a, `${label} admin sign-in`);
    await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
    const oid = q1('SELECT id FROM orders LIMIT 1').id;
    for (const [path, name] of [['/admin', 'admin home'], ['/admin/orders', 'admin orders'], [`/admin/orders/${oid}`, 'admin order'], [`/admin/orders/${oid}/invoice`, 'admin invoice'], [`/admin/orders/print?id=${oid}`, 'admin label print'], ['/admin/products', 'admin products'], ['/admin/account', 'admin account'], ['/admin/integrations', 'admin integrations'], ['/admin/notifications', 'admin notifications']]) {
      await a.goto(base + path); await check(a, `${label} ${name}`);
    }
    await actx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
