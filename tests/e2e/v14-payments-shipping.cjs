// E2E v14: Telr online payment (fake Telr server), key encryption, ship-now with manual carrier. Server needs TELR_ENDPOINT=http://localhost:4010/order.json
const { chromium } = require('./_pw.cjs');
const http = require('http');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const orders = {}; let nextResult = 'paid';
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => b += d); req.on('end', () => {
    const j = JSON.parse(b || '{}'); res.setHeader('content-type', 'application/json');
    if (j.authkey !== 'SECRET-KEY-123') return res.end(JSON.stringify({ error: { message: 'bad auth' } }));
    if (j.method === 'create') { const ref = 'REF' + Object.keys(orders).length; orders[ref] = { cartid: j.order.cartid, amount: j.order.amount, currency: j.order.currency, ret: j.return }; return res.end(JSON.stringify({ order: { ref, url: 'http://localhost:4010/pay/' + ref } })); }
    const o = orders[j.order.ref]; const paid = nextResult === 'paid';
    res.end(JSON.stringify({ order: { cartid: o.cartid, amount: o.amount, currency: o.currency, status: { code: paid ? 3 : -2 }, transaction: { status: paid ? 'A' : 'D' } } }));
  });
}).listen(4010);
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ locale: 'ar-AE' });
  const a = await ctx.newPage(); await a.goto(base + '/admin/login');
  await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  for (const u of ['/admin/payments', '/admin/shipping']) { const r = await a.goto(base + u); ok(r.status() === 200, u + ' renders'); }
  await a.goto(base + '/admin/payments');
  await a.fill('#store', '12345'); await a.fill('#key', 'SECRET-KEY-123'); await a.check('input[name=enabled]'); await a.locator('main form').first().locator('button:not([type=button])').click(); await a.waitForLoadState('networkidle');
  const db = new Database(process.env.DB_PATH, { readonly: true });
  const stored = db.prepare("SELECT value FROM settings WHERE key='pay_telr_key'").get().value;
  ok(stored.startsWith('enc:') && !stored.includes('SECRET'), 'auth key stored encrypted');
  ok(!(await a.content()).includes('SECRET-KEY-123'), 'key never shown back in the page');
  await a.goto(base + '/admin/payments'); await a.locator('main form').nth(1).locator('button').click(); await a.waitForLoadState('networkidle');
  ok(/الاتصال سليم/.test(await a.locator('main').innerText()), 'test connection works');

  // find a purchasable variant: the seeded sample products
  const prod = await (await fetch(base + '/api/products')).json().catch(() => null);
  const v = db.prepare("SELECT v.id vid FROM variants v JOIN products p ON p.id=v.product_id WHERE v.stock>1 AND p.price_minor>0 LIMIT 1").get()
    || db.prepare("SELECT id vid FROM variants WHERE stock>1 LIMIT 1").get();
  const body = (key, pm) => ({ lines: [{ variantId: v.vid, quantity: 1 }], contact: { email: 'a@b.co', phone: '+971500000000' }, address: { name: 'Sara Ali', phone: '+971500000000', line1: 'Street 1 Bldg', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: pm, idempotencyKey: key, locale: 'ar' });
  const post = (o) => fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
  let r = await post(body('online-key-0001', 'cod')); ok(r.status === 400, 'cod refused while online payment is on');
  r = await post(body('online-key-0002', 'online')); const j = await r.json();
  ok(r.status === 200 && /localhost:4010\/pay\//.test(j.redirectUrl || ''), 'checkout returns the payment page URL');
  const row = (id) => db.prepare('SELECT payment_status ps, status, payment_ref pr FROM orders WHERE id=?').get(id);
  ok(row(j.orderId).ps === 'pending' && !!row(j.orderId).pr, 'order waits as pending with payment ref');
  let rr = await fetch(base + `/api/payment/telr/return?order=${j.orderId}&r=authorised&l=ar`, { redirect: 'manual' });
  ok(rr.status === 303 && rr.headers.get('location').includes('/order/' + j.orderId), 'return redirects to the order page');
  ok(row(j.orderId).ps === 'paid', 'order marked paid after server-side check');
  // fake "authorised" return for an unpaid order must NOT mark it paid
  nextResult = 'declined';
  r = await post(body('online-key-0003', 'online')); const j2 = await r.json();
  const stockBefore = db.prepare('SELECT stock FROM variants WHERE id=?').get(v.vid).stock;
  rr = await fetch(base + `/api/payment/telr/return?order=${j2.orderId}&r=authorised&l=ar`, { redirect: 'manual' });
  ok(rr.headers.get('location').includes('/checkout/failed') && row(j2.orderId).ps === 'failed' && row(j2.orderId).status === 'cancelled', 'declined payment: not paid, cancelled');
  ok(db.prepare('SELECT stock FROM variants WHERE id=?').get(v.vid).stock === stockBefore + 1, 'stock returned after failed payment');

  // ship now (manual carrier)
  await a.goto(base + '/admin/shipping'); await a.check('input[name=car_quiqup_enabled]'); await a.fill('#car_quiqup_track', 'https://t.example/{n}');
  await a.locator('main form').nth(1).locator('button').last().click(); await a.waitForLoadState('networkidle');
  await a.goto(base + '/admin/orders/' + j.orderId); await a.selectOption('#carrier', 'quiqup'); await a.fill('#ship_tracking', 'QQ123');
  await a.getByRole('button', { name: 'اشحن الآن' }).click(); await a.waitForLoadState('networkidle');
  const o = db.prepare('SELECT status, tracking_number t, carrier c FROM orders WHERE id=?').get(j.orderId);
  ok(o.status === 'shipped' && o.t === 'QQ123' && o.c === 'quiqup', 'ship now saves carrier + tracking and marks shipped');
  ok((await a.content()).includes('https://t.example/QQ123'), 'tracking link shown');
  // aramex without config gives a clear error
  await a.goto(base + '/admin/shipping'); await a.check('input[name=car_aramex_enabled]'); await a.locator('main form').nth(1).locator('button').last().click(); await a.waitForLoadState('networkidle');
  r = await post(body('online-key-0004', 'online')); const j3 = await r.json(); nextResult = 'paid';
  await a.goto(base + '/admin/orders/' + j3.orderId); await a.selectOption('#carrier', 'aramex'); await a.getByRole('button', { name: 'اشحن الآن' }).click(); await a.waitForLoadState('networkidle');
  ok(/فعّل Aramex|Aramex/.test(await a.locator('p[role=alert]').innerText()), 'aramex without keys shows a clear message');
  await b.close(); fake.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
