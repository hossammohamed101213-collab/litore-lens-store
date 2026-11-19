// Paymennt + Ziina end to end against FAKE gateways on this machine (nothing is charged).
// Server env: SEED_SAMPLE=true PAYMENNT_BASE=http://localhost:4040 ZIINA_ENDPOINT=http://localhost:4041 (no PAYMENT_MODE)
// Run: DB_PATH=/path/to/l.db BASE=http://localhost:3100 node tests/e2e/gateways.cjs
const { chromium } = require('./_pw.cjs');
const http = require('http');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const q1 = (sql, ...a) => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare(sql).get(...a); } finally { d.close(); } };
const setting = (k) => (q1('SELECT value FROM settings WHERE key = ?', k) || {}).value || '';
const json = (res, o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
const read = (req) => new Promise((r) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => r(b)); });

const pm = {}; let pmStatus = 'PAID'; let pmCreates = 0;
http.createServer(async (req, res) => {
  if (req.headers['x-paymennt-api-key'] !== 'PM-KEY-1') return json(res, { success: false, elapsed: 0, error: "Missing or invalid 'X-Paymennt-Api-Key' header in API request", errorCode: 0 }, 400);
  if (req.headers['x-paymennt-api-secret'] !== 'PM-SECRET-1') return json(res, { success: false, error: 'invalid secret' }, 401);
  if (req.method === 'POST' && req.url === '/checkout/web') { const j = JSON.parse(await read(req)); const b = j.billingAddress, miss = []; if (!b || !b.name || !b.address1 || !b.city || !b.country) miss.push('Parameter billingAddress must not be null.'); if (!Array.isArray(j.items) || !j.items.length || j.items.some((i) => typeof i.linetotal !== 'number' || !i.name || !(i.quantity > 0))) miss.push('Parameter items[0].linetotal must not be null.'); if (!j.customer || !j.customer.email || !j.customer.firstName || !j.customer.lastName) miss.push('Parameter customer must not be null.'); if (miss.length) return json(res, { success: false, elapsed: 1, error: miss.join(' ') }, 400); const id = 'pm' + (++pmCreates); pm[id] = j; return json(res, { success: true, result: { id, redirectUrl: 'http://localhost:4040/pay/' + id } }); }
  const id = req.url.split('/').pop(); const o = pm[id]; if (!o) return json(res, { success: false }, 404);
  json(res, { success: true, result: { status: pmStatus, grandtotal: o.amount, currency: o.currency, orderId: o.orderId } });
}).listen(4040);
const zn = {}; let znStatus = 'completed'; let znCreates = 0;
http.createServer(async (req, res) => {
  if (req.headers.authorization !== 'Bearer ZN-KEY-1') return json(res, {}, 401);
  if (req.method === 'POST' && req.url === '/payment_intent') { const j = JSON.parse(await read(req)); const id = 'zn' + (++znCreates); zn[id] = j; return json(res, { id, redirect_url: 'http://localhost:4041/pay/' + id, status: 'requires_payment_instrument' }); }
  const id = req.url.split('/').pop(); const o = zn[id]; if (!o) return json(res, {}, 404);
  json(res, { id, status: znStatus, amount: o.amount, currency_code: o.currency_code });
}).listen(4041);

(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ locale: 'ar-AE' });
  const v = q1("SELECT v.id vid FROM variants v JOIN products p ON p.id = v.product_id WHERE v.stock > 5 AND p.price_minor > 0 LIMIT 1");
  let n = 0; const stock0 = q1('SELECT stock FROM variants WHERE id = ?', v.vid).stock;
  const post = (pmethod) => fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ variantId: v.vid, quantity: 1 }], contact: { email: 'gw@example.com', phone: '+971500000000' }, address: { name: 'Sara Ali', phone: '+971500000000', line1: 'Street 1 Bldg', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: pmethod, idempotencyKey: 'gateway-key-' + String(++n).padStart(4, '0'), locale: 'ar' }) });
  const row = (id) => q1('SELECT payment_status ps, status, payment_ref pr, payment_gateway gw, total_minor t FROM orders WHERE id = ?', id);
  const back = (gw, id) => fetch(base + `/api/payment/${gw}/return?order=${id}&l=ar`, { redirect: 'manual' });

  // a live server with no gateway: no free "sample" payment, no online payment
  let r = await post('mock-paid'); ok(r.status === 400, 'no gateway saved: the free sample payment is refused');
  r = await post('online'); ok(r.status === 400 && q1('SELECT COUNT(*) n FROM orders').n === 0, 'no gateway saved: online payment is closed and no order is created');
  // guests can not reach the new settings pages or webhooks
  for (const u of ['/admin/integrations/paymennt', '/admin/integrations/ziina']) { const g = await fetch(base + u, { redirect: 'manual' }); ok(g.status >= 300 && g.status < 400 && (g.headers.get('location') || '').includes('/admin/login'), 'guest is sent to the login page from ' + u); }
  r = await fetch(base + '/api/webhooks/paymennt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'checkout.paid', data: { id: 'pm1' } }) });
  ok(r.status === 401, 'Paymennt webhook without a saved secret / signature is refused');

  const a = await ctx.newPage(); await a.goto(base + '/admin/login');
  await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  const save = async (name, fields) => { await a.goto(base + '/admin/integrations/' + name); for (const [k, val] of Object.entries(fields)) await a.fill('#' + k, val); await a.check('input[name=enabled]'); await a.locator('main form').first().locator('button:not([type=button])').click(); await a.waitForURL(/saved=1/); };
  await save('paymennt', { key: 'PM-KEY-1', secret: 'PM-SECRET-1' });
  ok(setting('pay_paymennt_key').startsWith('enc:') && setting('pay_paymennt_secret').startsWith('enc:') && !setting('pay_paymennt_key').includes('PM-KEY') && setting('pay_paymennt_enabled') === '1', 'Paymennt keys are saved encrypted');
  ok(!(await a.content()).includes('PM-KEY-1') && !(await a.content()).includes('PM-SECRET-1'), 'the keys are never shown back in the page');
  await a.locator('main form').nth(1).locator('button').click(); await a.waitForURL(/msg=/);
  ok(/الاتصال سليم/.test(await a.locator('main').innerText()), 'the Paymennt "test connection" button works and reports the result');
  ok(q1("SELECT COUNT(*) n FROM admin_log WHERE action LIKE '%Paymennt%'").n >= 2, 'changing and testing Paymennt is written to the activity log');

  // Paymennt purchase
  r = await post('mock-paid'); ok(r.status === 400, 'with a real gateway on, the sample payment stays refused');
  r = await post('online'); let j = await r.json();
  ok(r.status === 200 && /localhost:4040\/pay\/pm/.test(j.redirectUrl || ''), 'checkout sends the customer to the Paymennt page');
  ok(row(j.orderId).ps === 'pending' && row(j.orderId).gw === 'paymennt' && !!row(j.orderId).pr, 'the order waits as unpaid and remembers it belongs to Paymennt');
  const sent = pm[row(j.orderId).pr];
  ok(Math.round(sent.amount * 100) === row(j.orderId).t && sent.currency === 'AED' && sent.orderId === j.orderId && sent.returnUrl.includes('/api/payment/paymennt/return?order=' + j.orderId), 'Paymennt was asked for exactly the order total, in AED, for this order');
  ok(!!sent.billingAddress && sent.billingAddress.country === 'AE' && !!sent.billingAddress.address1 && !!sent.billingAddress.city && sent.items[0].linetotal === sent.amount, 'Paymennt gets the billing address and the line total it requires');
  pmStatus = 'PENDING'; let rr = await back('paymennt', j.orderId);
  ok(rr.status === 303 && row(j.orderId).ps === 'pending', 'coming back before paying does not mark the order paid');
  pmStatus = 'PAID'; rr = await back('paymennt', j.orderId);
  ok(rr.status === 303 && rr.headers.get('location').includes('/order/' + j.orderId) && row(j.orderId).ps === 'paid', 'after Paymennt confirms, the order is paid');
  r = await post('online'); j = await r.json(); pmStatus = 'FAILED'; rr = await back('paymennt', j.orderId);
  ok(rr.headers.get('location').includes('/checkout/failed') && row(j.orderId).status === 'cancelled' && row(j.orderId).ps === 'failed', 'a failed Paymennt payment cancels the order and shows the failure page');
  r = await post('online'); j = await r.json(); pm[row(j.orderId).pr].amount = 1; pmStatus = 'PAID'; rr = await back('paymennt', j.orderId);
  ok(row(j.orderId).ps === 'pending' && q1("SELECT COUNT(*) n FROM notifications WHERE kind = 'payment' AND title LIKE ?", '%' + j.orderId + '%').n === 1, 'a Paymennt payment of a different amount is not accepted and the owner is alerted');
  rr = await fetch(base + '/api/payment/paymennt/return?order=LT-NOTREAL&l=ar&next=https://evil.example', { redirect: 'manual' });
  ok(rr.status === 303 && !rr.headers.get('location').includes('evil'), 'the return link can not send the customer to another site');

  // an action sent after signing out changes nothing
  await a.goto(base + '/admin/integrations/ziina'); await a.fill('#key', 'ATTACKER-KEY'); await a.check('input[name=enabled]');
  await ctx.clearCookies(); await a.locator('main form').first().locator('button:not([type=button])').click(); await a.waitForLoadState('networkidle');
  ok(/\/admin\/login/.test(a.url()) && setting('pay_ziina_key') === '' && setting('pay_ziina_enabled') !== '1', 'saving gateway keys without being signed in is refused (nothing saved)');

  // Ziina: Paymennt off, Ziina on
  await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  await a.goto(base + '/admin/integrations/paymennt'); await a.uncheck('input[name=enabled]'); await a.locator('main form').first().locator('button:not([type=button])').click(); await a.waitForURL(/saved=1/);
  ok(setting('pay_paymennt_enabled') === '0' && setting('pay_paymennt_key').startsWith('enc:'), 'switching Paymennt off keeps its saved keys');
  await save('ziina', { key: 'ZN-KEY-1' });
  ok(setting('pay_ziina_key').startsWith('enc:') && setting('pay_ziina_enabled') === '1', 'Ziina key is saved encrypted');
  await a.locator('main form').nth(1).locator('button').click(); await a.waitForURL(/msg=/);
  ok(/الاتصال سليم/.test(await a.locator('main').innerText()), 'the Ziina "test connection" button works');
  r = await post('online'); j = await r.json();
  ok(r.status === 200 && /localhost:4041\/pay\/zn/.test(j.redirectUrl || '') && row(j.orderId).gw === 'ziina', 'checkout sends the customer to the Ziina page and remembers it');
  const zs = zn[row(j.orderId).pr];
  ok(zs.amount === row(j.orderId).t && zs.currency_code === 'AED' && zs.test === true && [zs.success_url, zs.cancel_url, zs.failure_url].every((u) => u.includes('/api/payment/ziina/return?order=' + j.orderId)), 'Ziina was asked for the exact total in fils, in test mode, with our return address');
  znStatus = 'requires_payment_instrument'; rr = await back('ziina', j.orderId);
  ok(rr.status === 303 && row(j.orderId).ps === 'pending', 'coming back from Ziina before paying does not mark the order paid');
  znStatus = 'completed'; rr = await back('ziina', j.orderId);
  ok(rr.headers.get('location').includes('/order/' + j.orderId) && row(j.orderId).ps === 'paid', 'after Ziina confirms, the order is paid');
  r = await post('online'); j = await r.json(); znStatus = 'canceled'; rr = await back('ziina', j.orderId);
  ok(rr.headers.get('location').includes('/checkout/failed') && row(j.orderId).status === 'cancelled', 'a payment cancelled at Ziina cancels the order');
  // the old Paymennt order with the wrong amount is still Paymennt's: Ziina being on does not touch it
  const stuck = q1("SELECT id FROM orders WHERE payment_gateway = 'paymennt' AND payment_status = 'pending' LIMIT 1").id;
  znStatus = 'completed'; await back('ziina', stuck);
  ok(row(stuck).ps === 'pending', 'an order is only ever confirmed by the gateway that took it');
  const stock = q1('SELECT stock FROM variants WHERE id = ?', v.vid).stock; const live = q1("SELECT COUNT(*) n FROM orders WHERE status != 'cancelled'").n;
  ok(q1('SELECT COUNT(*) n FROM orders').n === 5 && live === 3 && stock === stock0 - live, `stock is held only by the orders that are not cancelled (${live} of 5, stock ${stock0} -> ${stock})`);
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
