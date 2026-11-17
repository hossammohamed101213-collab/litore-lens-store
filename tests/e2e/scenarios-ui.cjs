// Scenario matrix, browser part: tabs, cart buttons, lost connection, slow server, keyboard, account cart. TEST server only.
// Server: fresh DB, SEED_SAMPLE=true, PAYMENT_MODE=mock.  Run: DB_PATH=/path/to/l.db BASE=http://localhost:3100 node tests/e2e/scenarios-ui.cjs
const { chromium } = require('./_pw.cjs');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const q1 = (sql, ...a) => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare(sql).get(...a); } finally { d.close(); } };
const orders = (email) => q1('SELECT COUNT(*) n FROM orders WHERE email = ?', email).n;
const slug = 'sample-rose-quartz';
const text = (pg) => pg.locator('body').innerText();

(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const fill = async (pg, email) => {
    await pg.fill('#email', email); await pg.fill('#phone', '+971501234567'); await pg.fill('#name', 'Scenario UI');
    await pg.selectOption('#region', 'Dubai'); await pg.selectOption('#city', 'Dubai'); await pg.fill('#line1', 'Street 1 Building 2');
  };
  const add = async (pg) => { await pg.goto(`${base}/ar/shop/${slug}`); await pg.getByRole('button', { name: 'أضيفي إلى السلة' }).first().click(); await pg.waitForSelector('[role=dialog]'); };
  const ready = (pg) => pg.waitForFunction(() => { const x = document.querySelector('button[type=submit]'); return x && !x.disabled; });

  // ---- tabs and cart buttons ----
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-AE' });
  const t1 = await ctx.newPage(); await add(t1);
  const t2 = await ctx.newPage(); await t2.goto(`${base}/ar/cart`); await t2.waitForFunction(() => document.body.textContent.includes('100'));
  ok(true, 'U1 a product added in one tab is in the cart of a second tab');
  await t2.getByRole('button', { name: 'زيادة الكمية' }).first().click(); await t2.waitForFunction(() => document.body.textContent.includes('200'));
  ok(true, 'U2 the + button in the cart raises the quantity and the total (200)');
  await t2.getByRole('button', { name: 'تقليل الكمية' }).first().click(); await t2.waitForFunction(() => !document.body.textContent.includes('200'));
  ok((await text(t2)).includes('100'), 'U3 the - button lowers it again (100)');
  ok(await t2.getByRole('button', { name: 'تقليل الكمية' }).first().isDisabled(), 'U4 the quantity can not go below 1 from the cart');
  await t2.getByRole('button', { name: /حذف/ }).first().click(); await t2.waitForFunction(() => document.body.textContent.includes('سلتك فارغة'));
  ok(true, 'U5 removing the product empties the cart');
  await t1.reload(); await t1.goto(`${base}/ar/cart`); await t1.waitForTimeout(600);
  ok((await text(t1)).includes('سلتك فارغة'), 'U6 ...and the first tab shows the same empty cart after reload');
  await t1.goto(`${base}/ar/checkout`); await t1.waitForTimeout(800);
  ok(!(await t1.getByRole('button', { name: 'تأكيد الطلب' }).isEnabled().catch(() => false)), 'U7 checkout with an empty cart can not be confirmed');
  await ctx.close();

  // ---- keyboard only ----
  const kctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-AE' }); const kp = await kctx.newPage();
  await kp.goto(`${base}/ar/shop/${slug}`); await kp.waitForLoadState('networkidle');
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) { await kp.keyboard.press('Tab'); reached = await kp.evaluate(() => (document.activeElement?.textContent || '').includes('أضيفي إلى السلة')); }
  ok(reached, 'U8 the add-to-cart button can be reached with the Tab key');
  await kp.keyboard.press('Enter'); const opened = await kp.waitForSelector('[role=dialog]', { timeout: 5000 }).then(() => true).catch(() => false);
  ok(opened, 'U9 pressing Enter adds the product (cart panel opens)');
  await kp.keyboard.press('Escape'); await kp.waitForTimeout(400);
  ok((await kp.locator('[role=dialog]').count()) === 0, 'U10 Escape closes the cart panel');
  await kctx.close();

  // ---- lost connection, form kept, slow server, double click ----
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-AE' }); const pg = await c2.newPage();
  await add(pg); await pg.goto(`${base}/ar/checkout`); await ready(pg);
  ok(/125|100/.test(await pg.locator('aside').last().innerText()) && (await text(pg)).includes('الإجمالي'), 'U11 the final total is shown on the checkout page before paying');
  await pg.fill('#email', 'kept@example.com'); await pg.getByRole('button', { name: 'تأكيد الطلب' }).click();
  ok((await pg.inputValue('#email')) === 'kept@example.com' && (await pg.locator('[aria-invalid=true]').count()) >= 3, 'U12 after a validation error the typed data is still in the form');
  await fill(pg, 'offline@example.com'); await ready(pg);
  await pg.route('**/api/checkout', (route) => route.abort('internetdisconnected')); await pg.getByRole('button', { name: 'تأكيد الطلب' }).click(); await pg.waitForSelector('[role=alert]', { timeout: 8000 }).catch(() => {});
  const offText = await text(pg);
  ok(/checkout$/.test(pg.url()) && (await pg.locator('[role=alert]').count()) > 0 && !/TypeError|fetch|undefined|stack/i.test(offText), 'U13 connection lost while confirming: a plain message, no technical text, the customer stays on the page');
  ok((await pg.inputValue('#email')) === 'offline@example.com' && orders('offline@example.com') === 0, 'U14 ...the form is kept and no order was created');
  await pg.unroute('**/api/checkout'); await ready(pg);
  let hold = true; let seen = 0;
  await pg.route('**/api/checkout', async (route) => { seen++; if (hold) await new Promise((r) => setTimeout(r, 2500)); await route.continue(); });
  const btn = pg.locator('button[type=submit]');
  await btn.click(); await pg.waitForTimeout(500);
  const busy = await btn.isDisabled(); const label = await btn.innerText();
  ok(busy && label.includes('جاري'), 'U15 slow server: the button is locked and shows "working" while the order is being created');
  await btn.click({ force: true, timeout: 1000 }).catch(() => {}); await btn.click({ force: true, timeout: 1000 }).catch(() => {});
  hold = false; await pg.waitForURL(/\/order\/LT-/, { timeout: 20000 });
  ok(orders('offline@example.com') === 1 && seen === 1, `U16 retry after the connection came back + extra clicks while waiting -> exactly one order (${orders('offline@example.com')} order, ${seen} request)`);
  const orderUrl = pg.url();
  await pg.reload(); ok((await text(pg)).includes(orderUrl.split('/').pop()), 'U17 reloading the confirmation page shows the same order');
  await pg.goBack(); await pg.waitForTimeout(1200);
  const backBtn = await pg.getByRole('button', { name: 'تأكيد الطلب' }).isEnabled().catch(() => false);
  ok(!backBtn && orders('offline@example.com') === 1, 'U18 going Back to checkout after ordering can not place the order again');
  await c2.close();

  // ---- the cart of a signed-in customer follows her ----
  const d1 = await b.newContext({ locale: 'ar-AE' }); const p1 = await d1.newPage(); await add(p1);
  const email = 'uicart@example.com';
  const reg = await p1.evaluate(async (e) => (await fetch('/api/account/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'UI Cart', email: e, password: 'Str0ng-Passw0rd!', phone: '+971501234567' }) })).status, email);
  await p1.goto(`${base}/ar/cart`); await p1.waitForFunction(() => document.body.textContent.includes('100')); await p1.waitForTimeout(1500);
  ok(reg === 200 || reg === 201, 'U19 the cart is still there after creating an account / signing in');
  const d2 = await b.newContext({ locale: 'ar-AE' }); const p2 = await d2.newPage(); await p2.goto(`${base}/ar`);
  const login = await p2.evaluate(async (e) => (await fetch('/api/account/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: e, password: 'Str0ng-Passw0rd!' }) })).status, email);
  await p2.goto(`${base}/ar/cart`); const followed = await p2.waitForFunction(() => document.body.textContent.includes('100'), null, { timeout: 8000 }).then(() => true).catch(() => false);
  ok(login === 200 && followed, 'U20 signing in on a second device shows the same cart');
  await p1.evaluate(async () => { await fetch('/api/account/logout', { method: 'POST' }); }); await p1.goto(`${base}/ar/account`); await p1.waitForTimeout(800);
  ok(!/uicart@example\.com/.test(await text(p1)), 'U21 after signing out the account page no longer shows the customer');
  await d1.close(); await d2.close();

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
