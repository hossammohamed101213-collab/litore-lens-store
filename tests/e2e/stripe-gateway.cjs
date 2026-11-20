// Stripe end to end against a FAKE Stripe on this machine (nothing is charged).
// Server env: SEED_SAMPLE=true STRIPE_ENDPOINT=http://localhost:4042/v1 (no PAYMENT_MODE)
// Run: DB_PATH=/path/to/l.db BASE=http://localhost:3100 node tests/e2e/stripe-gateway.cjs
const { chromium } = require('./_pw.cjs');
const http = require('http');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const q1 = (sql, ...a) => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare(sql).get(...a); } finally { d.close(); } };
const run = (sql, ...a) => { const d = new Database(process.env.DB_PATH); try { d.pragma('busy_timeout = 5000'); return d.prepare(sql).run(...a); } finally { d.close(); } };
const setting = (k) => (q1('SELECT value FROM settings WHERE key = ?', k) || {}).value || '';
const json = (res, o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
const read = (req) => new Promise((r) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => r(b)); });

const KEY = 'sk_test_FAKEKEY1234567890abcd';
const st = {}; let creates = 0; let expireWorks = true; const expired = [];
let next = { status: 'open', payment_status: 'unpaid' };
http.createServer(async (req, res) => {
  if (req.headers.authorization !== 'Bearer ' + KEY) return json(res, { error: { message: 'Invalid API Key provided: ' + String(req.headers.authorization).slice(7) } }, 401);
  if (req.method === 'GET' && req.url === '/v1/balance') return json(res, { object: 'balance', livemode: false });
  if (req.method === 'POST' && req.url === '/v1/checkout/sessions') {
    const p = Object.fromEntries(new URLSearchParams(await read(req)));
    const LOCALES = 'auto bg cs da de el en en-GB es es-419 et fi fil fr fr-CA hr hu id it ja ko lt lv ms mt nb nl pl pt pt-BR ro ru sk sl sv th tr vi zh zh-HK zh-TW'.split(' ');
    if (p.locale !== undefined && !LOCALES.includes(p.locale)) return json(res, { error: { message: 'Invalid locale: must be one of ' + LOCALES.join(', '), param: 'locale' } }, 400);
    const id = 'cs_test_' + (++creates);
    st[id] = { sent: p, idem: req.headers['idempotency-key'], ctype: req.headers['content-type'], amount_total: Number(p['line_items[0][price_data][unit_amount]']), currency: p['line_items[0][price_data][currency]'], client_reference_id: p.client_reference_id };
    return json(res, { id, url: 'http://localhost:4042/pay/' + id, livemode: false, status: 'open', payment_status: 'unpaid' });
  }
  const m = req.url.match(/^\/v1\/checkout\/sessions\/([^/]+)(\/expire)?$/); const o = m && st[m[1]]; if (!o) return json(res, { error: { message: 'No such session' } }, 404);
  if (m[2]) { if (!expireWorks) return json(res, { error: { message: 'cannot expire' } }, 400); o.forced = { status: 'expired', payment_status: 'unpaid' }; expired.push(m[1]); return json(res, { id: m[1], status: 'expired' }); }
  const s = o.forced || next;
  json(res, { id: m[1], status: s.status, payment_status: s.payment_status, amount_total: o.amount_total, currency: o.currency, client_reference_id: o.client_reference_id, livemode: false });
}).listen(4042);

(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ locale: 'ar-AE' });
  const v = q1("SELECT v.id vid FROM variants v JOIN products p ON p.id = v.product_id WHERE v.stock > 8 AND p.price_minor > 0 LIMIT 1");
  let n = 0;
  const post = (pmethod) => fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ variantId: v.vid, quantity: 1 }], contact: { email: 'gw@example.com', phone: '+971500000000' }, address: { name: 'Sara Ali', phone: '+971500000000', line1: 'Street 1 Bldg', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: pmethod, idempotencyKey: 'stripe-key-' + String(++n).padStart(4, '0'), locale: 'ar' }) });
  const row = (id) => q1('SELECT payment_status ps, status, payment_ref pr, payment_gateway gw, total_minor t FROM orders WHERE id = ?', id);
  const back = (id) => fetch(base + `/api/payment/stripe/return?order=${id}&l=ar`, { redirect: 'manual' });

  let g = await fetch(base + '/admin/integrations/stripe', { redirect: 'manual' });
  ok(g.status >= 300 && g.status < 400 && (g.headers.get('location') || '').includes('/admin/login'), 'guest is sent to the login page from the Stripe settings');
  let r = await post('online'); ok(r.status === 400 && q1('SELECT COUNT(*) n FROM orders').n === 0, 'no gateway saved: online payment is closed and no order is created');

  const a = await ctx.newPage(); await a.goto(base + '/admin/login');
  await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  const submit = async (key, mode, on) => { await a.goto(base + '/admin/integrations/stripe'); if (key) await a.fill('#key', key); await a.selectOption('#mode', mode); if (on) await a.check('input[name=enabled]'); else await a.uncheck('input[name=enabled]'); await a.locator('main form').first().locator('button:not([type=button])').click(); await a.waitForURL(/saved=1|error=/); return a.url(); };
  // other gateways already on: Stripe must take over alone
  run("INSERT INTO settings(key,value) VALUES('pay_ziina_enabled','1') ON CONFLICT(key) DO UPDATE SET value='1'");

  let u = await submit('pk_test_PUBLISHABLEKEY12345', 'test', true);
  ok(/error=/.test(u) && setting('pay_stripe_key') === '' && setting('pay_stripe_enabled') !== '1', 'a publishable key (pk_) is refused: nothing saved, not switched on');
  u = await submit(KEY, 'live', true);
  ok(/error=/.test(u) && setting('pay_stripe_enabled') !== '1', 'a TEST key in LIVE mode is not switched on (test cards could not be mistaken for money)');
  r = await post('online'); ok(r.status === 400, 'checkout stays closed while the key does not match the mode');
  u = await submit('', 'test', true);
  ok(/saved=1/.test(u) && setting('pay_stripe_key').startsWith('enc:') && !setting('pay_stripe_key').includes('FAKEKEY') && setting('pay_stripe_enabled') === '1', 'the Stripe key is saved encrypted and switched on in test mode');
  ok(setting('pay_ziina_enabled') === '0', 'switching Stripe on switches the other gateway off');
  ok(!(await a.content()).includes(KEY), 'the key is never shown back in the page');
  await a.locator('main form').nth(1).locator('button').click(); await a.waitForURL(/msg=/);
  ok(/الاتصال سليم/.test(await a.locator('main').innerText()), 'the Stripe "test connection" button works');
  ok(q1("SELECT COUNT(*) n FROM admin_log WHERE action LIKE '%Stripe%'").n >= 2, 'changing and testing Stripe is written to the activity log');
  await a.goto(base + '/admin/integrations'); ok(/Stripe/.test(await a.locator('main').innerText()), 'Stripe has a card on the integrations page');

  // purchase
  r = await post('mock-paid'); ok(r.status === 400, 'with Stripe on, the free sample payment stays refused');
  r = await post('online'); let j = await r.json();
  ok(r.status === 200 && /localhost:4042\/pay\/cs_test_/.test(j.redirectUrl || ''), 'checkout sends the customer to the Stripe page');
  ok(row(j.orderId).ps === 'pending' && row(j.orderId).gw === 'stripe' && !!row(j.orderId).pr, 'the order waits as unpaid and remembers it belongs to Stripe');
  const s = st[row(j.orderId).pr], p = s.sent, mins = (Number(p.expires_at) - Date.now() / 1000) / 60;
  ok(s.amount_total === row(j.orderId).t && s.currency === 'aed' && p.client_reference_id === j.orderId && p.mode === 'payment' && p['line_items[0][quantity]'] === '1', 'Stripe was asked for exactly the order total in fils, in AED, for this order');
  ok(p.success_url.includes('/api/payment/stripe/return?order=' + j.orderId) && p.cancel_url === p.success_url + '&left=1' && p.customer_email === 'gw@example.com', 'the customer returns to our own address whatever she clicks');
  ok(s.idem === 'litore-' + j.orderId && /x-www-form-urlencoded/.test(s.ctype) && mins > 55 && mins < 61, `the same order can not open two payments, and the page closes by itself after the waiting time (${Math.round(mins)} min)`);
  next = { status: 'open', payment_status: 'unpaid' }; let rr = await back(j.orderId);
  ok(rr.status === 303 && row(j.orderId).ps === 'pending', 'coming back before paying does not mark the order paid');
  next = { status: 'complete', payment_status: 'unpaid' }; rr = await back(j.orderId);
  ok(row(j.orderId).ps === 'pending' && row(j.orderId).status !== 'cancelled', 'a payment Stripe has not confirmed yet is neither paid nor cancelled');
  next = { status: 'complete', payment_status: 'paid' }; rr = await back(j.orderId);
  ok(rr.status === 303 && rr.headers.get('location').includes('/order/' + j.orderId) && row(j.orderId).ps === 'paid', 'after Stripe confirms, the order is paid');
  const paidId = j.orderId;

  r = await post('online'); j = await r.json(); next = { status: 'expired', payment_status: 'unpaid' }; rr = await back(j.orderId);
  ok(rr.headers.get('location').includes('/checkout/failed') && row(j.orderId).status === 'cancelled' && row(j.orderId).ps === 'failed', 'an expired Stripe page cancels the order and shows the failure page');
  r = await post('online'); j = await r.json(); st[row(j.orderId).pr].amount_total = 100; next = { status: 'complete', payment_status: 'paid' }; rr = await back(j.orderId);
  ok(row(j.orderId).ps === 'pending' && q1("SELECT COUNT(*) n FROM notifications WHERE kind = 'payment' AND title LIKE ?", '%' + j.orderId + '%').n === 1, 'a Stripe payment of a different amount is not accepted and the owner is alerted');
  r = await post('online'); j = await r.json(); st[row(j.orderId).pr].client_reference_id = paidId; rr = await back(j.orderId);
  ok(row(j.orderId).ps === 'pending', 'a payment that belongs to another order is not accepted');
  // an English customer gets the English Stripe page; Arabic is not offered by Stripe, so the page follows her browser
  { const e = await fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ variantId: v.vid, quantity: 1 }], contact: { email: 'gw@example.com', phone: '+971500000000' }, address: { name: 'Sara Ali', phone: '+971500000000', line1: 'Street 1 Bldg', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: 'online', idempotencyKey: 'stripe-key-en-0001', locale: 'en' }) }); const ej = await e.json();
    ok(e.status === 200 && st[row(ej.orderId).pr].sent.locale === 'en' && p.locale === 'auto', 'Stripe is only ever asked for a page language it supports (Arabic order -> auto, English order -> en)');
    next = { status: 'expired', payment_status: 'unpaid' }; await back(ej.orderId); }
  rr = await fetch(base + '/api/payment/stripe/return?order=LT-NOTREAL&l=ar&next=https://evil.example', { redirect: 'manual' });
  ok(rr.status === 303 && !rr.headers.get('location').includes('evil'), 'the return link can not send the customer to another site');

  // waiting time over while the Stripe page is still open: the page is closed first, then the order is cancelled
  r = await post('online'); j = await r.json(); next = { status: 'open', payment_status: 'unpaid' };
  run("UPDATE orders SET created_at = datetime('now','-3 hours') WHERE id = ?", j.orderId);
  expireWorks = false; rr = await back(j.orderId);
  ok(row(j.orderId).ps === 'pending' && row(j.orderId).status !== 'cancelled', 'if Stripe will not close the page, the order is NOT cancelled (it could still be paid)');
  expireWorks = true; rr = await back(j.orderId);
  ok(expired.includes(row(j.orderId).pr) && row(j.orderId).status === 'cancelled' && row(j.orderId).ps === 'failed', 'after the waiting time the Stripe page is closed and the order cancelled');

  // ---- the customer's own journey: the cart survives the trip to the payment page, a payment she walks away from
  //      frees the stock at once, and an unpaid order is never shown as "received, thank you"
  {
    const cart = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('litore.cart.v1') || '{"lines":[]}').lines.length);
    const stock = () => q1('SELECT stock s FROM variants WHERE id = ?', v.vid).s;
    const c = await (await b.newContext({ locale: 'en-AE' })).newPage();
    await c.route('http://localhost:4042/pay/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>fake Stripe page</h1>' }));
    await c.goto(base + '/en'); await c.evaluate((vid) => localStorage.setItem('litore.cart.v1', JSON.stringify({ lines: [{ variantId: vid, quantity: 1 }], coupon: null })), v.vid);
    const s0 = stock(); const before = q1('SELECT COUNT(*) n FROM orders').n; next = { status: 'open', payment_status: 'unpaid' };
    await c.goto(base + '/en/checkout'); await c.fill('#email', 'walk@example.com'); await c.fill('#phone', '+971501234567'); await c.fill('#name', 'Walk Away'); await c.selectOption('#region', 'Dubai'); await c.selectOption('#city', 'Dubai'); await c.fill('#line1', 'Street 1 Building');
    await c.getByRole('button', { name: 'Place order' }).click(); await c.waitForURL(/localhost:4042\/pay\//, { timeout: 20000 });
    const o1 = q1('SELECT id, payment_ref pr FROM orders ORDER BY rowid DESC LIMIT 1'); await c.goto(base + '/en');
    ok(q1('SELECT COUNT(*) n FROM orders').n === before + 1 && await cart(c) === 1, 'going to the payment page keeps the cart (it used to be emptied before the payment)');
    ok(stock() === s0 - 1, 'the unpaid order holds its stock while the payment page is open');
    const sent = st[o1.pr].sent; ok(/left=1/.test(sent.cancel_url) && !/left=1/.test(sent.success_url), 'Stripe gets a separate "came back without paying" address');
    await c.goto(sent.cancel_url);
    ok(/\/en\/checkout\/failed$/.test(c.url()) && row(o1.id).status === 'cancelled' && row(o1.id).ps === 'failed' && expired.includes(o1.pr), 'back from Stripe without paying: its page is closed and the order cancelled at once');
    ok(stock() === s0 && await cart(c) === 1, 'the stock is free again and her cart is still full');
    await c.getByRole('link', { name: 'Try again' }).click(); await c.waitForURL(/\/en\/checkout$/); await c.locator('#email').waitFor();
    ok(await c.locator('#email').count() === 1 && await cart(c) === 1, '"Try again" opens the checkout with her items, not an empty cart');
    // the "left" mark is never trusted: a paid order stays paid, and a page Stripe will not close stays waiting
    r = await post('online'); j = await r.json(); next = { status: 'complete', payment_status: 'paid' };
    rr = await fetch(base + `/api/payment/stripe/return?order=${j.orderId}&l=en&left=1`, { redirect: 'manual' });
    ok(row(j.orderId).ps === 'paid' && row(j.orderId).status !== 'cancelled' && /\/order\//.test(rr.headers.get('location')), 'a paid order opened through the "came back" address stays paid');
    r = await post('online'); j = await r.json(); next = { status: 'open', payment_status: 'unpaid' }; expireWorks = false;
    rr = await fetch(base + `/api/payment/stripe/return?order=${j.orderId}&l=en&left=1`, { redirect: 'manual' });
    ok(row(j.orderId).ps === 'pending' && row(j.orderId).status !== 'cancelled', 'if Stripe will not close its page the order is left waiting, never cancelled');
    expireWorks = true;
    // unpaid order page: honest wording and a way to finish; paid: thank you, and only then the cart is emptied
    await c.evaluate((id) => localStorage.setItem('litore-pending-order', id), j.orderId);
    await c.goto(base + `/en/order/${j.orderId}`); let t = await c.locator('main').innerText();
    ok(await c.locator('[data-order-state=pending]').count() === 1 && /Payment not completed yet/.test(t) && !/Your order was received|Thank you/.test(t) && !/on delivery/i.test(t), 'an unpaid order is not shown as "received, thank you" and no longer says "on delivery"');
    ok(await c.getByRole('link', { name: 'Complete order and pay' }).count() === 1 && await cart(c) === 1, 'it offers to complete the order, with the cart still full');
    next = { status: 'complete', payment_status: 'paid' }; await c.goto(base + `/en/order/${j.orderId}`); t = await c.locator('main').innerText();
    await c.waitForFunction(() => JSON.parse(localStorage.getItem('litore.cart.v1') || '{"lines":[]}').lines.length === 0, null, { timeout: 8000 }).catch(() => {});
    ok(/Your order was received/.test(t) && await cart(c) === 0 && await c.evaluate(() => localStorage.getItem('litore-pending-order')) === null, 'once the payment is confirmed she sees the thank-you page and the cart is emptied');
    await c.evaluate((vid) => localStorage.setItem('litore.cart.v1', JSON.stringify({ lines: [{ variantId: vid, quantity: 2 }], coupon: null })), v.vid);
    await c.goto(base + `/en/order/${j.orderId}`); await c.waitForTimeout(1200);
    ok(await cart(c) === 1, 'opening an old paid order later never empties a new cart');
    // she paid but never came back to the store's page: the cart is emptied on her next visit, from any page
    r = await post('online'); const away = (await r.json()).orderId; next = { status: 'complete', payment_status: 'paid' }; await back(away);
    await c.evaluate((id) => localStorage.setItem('litore-pending-order', id), away); await c.goto(base + '/en/shop');
    await c.waitForFunction(() => JSON.parse(localStorage.getItem('litore.cart.v1') || '{"lines":[]}').lines.length === 0, null, { timeout: 8000 }).catch(() => {});
    ok(row(away).ps === 'paid' && await cart(c) === 0 && await c.evaluate(() => localStorage.getItem('litore-pending-order')) === null, 'paid while she was away: the cart is emptied on her next visit');
    await c.evaluate(([vid, id]) => { localStorage.setItem('litore.cart.v1', JSON.stringify({ lines: [{ variantId: vid, quantity: 1 }], coupon: null })); localStorage.setItem('litore-pending-order', id); }, [v.vid, o1.id]);
    await c.goto(base + '/en/shop'); await c.waitForFunction(() => localStorage.getItem('litore-pending-order') === null, null, { timeout: 8000 }).catch(() => {});
    ok(await cart(c) === 1 && await c.evaluate(() => localStorage.getItem('litore-pending-order')) === null, 'a cancelled payment leaves her cart alone and only forgets the reminder');
    await c.goto(base + `/ar/order/${o1.id}`); t = await c.locator('main').innerText();
    ok(await c.locator('[data-order-state=failed]').count() === 1 && /لم يكتمل هذا الطلب/.test(t) && !/تم استلام طلبك/.test(t), 'a cancelled, unpaid order says so in Arabic too');
    const note = q1("SELECT body FROM notifications WHERE kind = 'order' AND title = ?", 'طلب جديد ' + o1.id);
    ok(!!note && /بانتظار الدفع/.test(note.body), 'the owner\'s "new order" notice says the order is still unpaid');
    await a.goto(base + '/admin/settings'); ok(/1 مفعّل/.test(await a.locator('a[href="/admin/integrations"]').innerText()), 'the settings page counts Stripe among the connected services');
    await c.context().close(); next = { status: 'open', payment_status: 'unpaid' };
  }

  // switched off: no new payments, but an order already at Stripe is still confirmed by Stripe
  r = await post('online'); j = await r.json(); const late = j.orderId;
  u = await submit('', 'test', false);
  ok(setting('pay_stripe_enabled') === '0' && setting('pay_stripe_key').startsWith('enc:'), 'switching Stripe off keeps its saved key');
  r = await post('online'); ok(r.status === 400, 'with Stripe off, checkout is closed again');
  next = { status: 'complete', payment_status: 'paid' }; await back(late);
  ok(row(late).ps === 'paid', 'an order already sent to Stripe is still confirmed after Stripe is switched off');
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
