// E2E for the LIVE defaults: needs a fresh DB and a server started WITHOUT PAYMENT_MODE (NODE_ENV=production => cash on delivery).
// Run: BASE=http://localhost:3101 node tests/e2e/payment-and-password.cjs   (admin owner@example.com / Str0ng-Passw0rd!, SEED_SAMPLE=true)
const { chromium } = require('./_pw.cjs');
const base = process.env.BASE || 'http://localhost:3101'; let fails = 0;
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage();

  // 1) Live checkout offers cash on delivery only (no sample "paid" option)
  await pg.goto(base + '/en/shop'); const href = await pg.$eval('a[href*="/en/shop/"]', a => a.getAttribute('href'));
  await pg.goto(base + href); await pg.getByRole('button', { name: 'Add to cart' }).first().click(); await pg.waitForSelector('[role=dialog]');
  ok(await pg.locator('[role=dialog] [role=status]').count() > 0, 'cart drawer confirms the item was added');
  await pg.locator('[role=dialog] a[href$="/checkout"]').click(); await pg.waitForURL(/checkout/);
  const txt = await pg.locator('main').innerText();
  ok(/Cash on delivery/.test(txt) && !/Sample payment/.test(txt), 'checkout shows cash on delivery and no sample payment');

  // 2) A forged "mock-paid" request is refused on the live server
  const body = { lines: [{ variantId: 'x', quantity: 1 }], contact: { email: 'a@b.co', phone: '+971500000000' }, address: { name: 'A B', phone: '+971500000000', line1: 'Street 1 Bldg', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: 'forged-key-12345', locale: 'en' };
  const r = await fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  ok(r.status === 400 && (await r.json()).error === 'invalid_payment_method', 'forged sample-paid payment is rejected (400)');

  // 3) Admin: change password + payment status
  const a = await ctx.newPage(); await a.goto(base + '/admin/login');
  await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  await a.goto(base + '/admin/account');
  const set = async (cur, nx, cf) => { await a.goto(base + '/admin/account'); await a.fill('#current', cur); await a.fill('#next', nx); await a.fill('#confirm', cf); await a.locator('main form button:not([type=button])').click(); await a.waitForLoadState('networkidle'); };
  await set('wrong-current-pw', 'NewPassw0rd-2026', 'NewPassw0rd-2026'); ok(await a.locator('[role=alert]').count() > 0, 'wrong current password refused');
  await set('Str0ng-Passw0rd!', 'NewPassw0rd-2026', 'different-confirm1'); ok(await a.locator('[role=alert]').count() > 0, 'mismatched confirmation refused');
  await a.goto(base + '/admin/account'); await a.fill('#current', 'Str0ng-Passw0rd!'); await a.fill('#next', 'short'); await a.fill('#confirm', 'short');
  await a.evaluate(() => document.querySelectorAll('input').forEach(i => i.removeAttribute('minlength'))); await a.locator('main form button:not([type=button])').click(); await a.waitForLoadState('networkidle');
  ok(await a.locator('[role=alert]').count() > 0, 'too-short new password refused by the server');
  await set('Str0ng-Passw0rd!', 'NewPassw0rd-2026', 'NewPassw0rd-2026'); ok(/account\?saved=1/.test(a.url()), 'password changed');
  const fresh = await (await b.newContext()).newPage(); await fresh.goto(base + '/admin/login');
  await fresh.fill('#email', 'owner@example.com'); await fresh.fill('#password', 'Str0ng-Passw0rd!'); await fresh.locator('main button:not([type=button])').click(); await fresh.waitForSelector('[role=alert]'); ok(true, 'old password no longer works');
  await fresh.goto(base + '/admin/login'); await fresh.waitForLoadState('networkidle'); await fresh.fill('#email', 'owner@example.com'); await fresh.fill('#password', 'NewPassw0rd-2026'); await fresh.locator('main button:not([type=button])').click(); await fresh.waitForURL(/\/admin$/, { timeout: 60000 }); ok(true, 'new password works');

  // 4) A real cash-on-delivery order: created as pending, owner confirms payment
  const adm = fresh; // logged in with the new password
  await adm.goto(base + '/admin/shipping'); await adm.check('[name=active_AE]'); await adm.fill('[name=price_AE]', '15'); await adm.fill('[name=label_en_AE]', 'Standard'); await adm.fill('[name=label_ar_AE]', 'عادي');
  await adm.locator('main form button:not([type=button])').click(); await adm.waitForURL(/shipping\?saved=1/);
  const sp = await ctx.newPage(); await sp.goto(base + '/en/cart'); await sp.waitForLoadState('networkidle');
  await sp.goto(base + '/en/checkout'); await sp.waitForSelector('button[type=submit]'); await sp.waitForFunction(() => !document.querySelector('button[type=submit]')?.disabled, null, { timeout: 60000 });
  await sp.fill('#email', 'cod@example.com'); await sp.fill('#phone', '+971501234567'); await sp.fill('#name', 'Cod Buyer'); await sp.fill('#city', 'Dubai'); await sp.fill('#line1', 'Street 1 Building');
  await sp.locator('button[type=submit]').click(); await sp.waitForURL(/order\/LT-/, { timeout: 60000 });
  const id = sp.url().split('/').pop(); const t1 = await sp.locator('main').innerText();
  ok(/Awaiting payment/.test(t1) && !/Paid/.test(t1), `COD order ${id} is created as payment pending (not paid)`);
  await adm.goto(base + '/admin/orders/' + id); await adm.selectOption('[name=payment]', 'paid'); await adm.locator('main form button:not([type=button])').click(); await adm.waitForURL(/saved=1/);
  await sp.reload(); ok(/Paid/.test(await sp.locator('main').innerText()), 'after the owner confirms collection, the order shows as paid');
  await b.close(); console.log('FAILS', fails); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(String(e).slice(0, 800)); process.exit(1); });
