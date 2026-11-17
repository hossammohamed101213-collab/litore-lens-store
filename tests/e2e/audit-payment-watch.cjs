// E2E (audit): background payment watch + 60-minute expiry of unpaid orders, with a fake Telr server.
// Server needs: TELR_ENDPOINT=http://localhost:4011/order.json PAYMENT_WATCH_MS=1500  (fresh DB, SEED_SAMPLE=true, admin owner@example.com / Str0ng-Passw0rd!)
const { chromium } = require('./_pw.cjs');
const http = require('http');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const orders = {}; let nextResult = 'pending';
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => b += d); req.on('end', () => {
    const j = JSON.parse(b || '{}'); res.setHeader('content-type', 'application/json');
    if (j.method === 'create') { const ref = 'REF' + Object.keys(orders).length; orders[ref] = { cartid: j.order.cartid, amount: j.order.amount, currency: j.order.currency }; return res.end(JSON.stringify({ order: { ref, url: 'http://localhost:4011/pay/' + ref } })); }
    const o = orders[j.order.ref];
    res.end(JSON.stringify({ order: { cartid: o.cartid, amount: o.amount, currency: o.currency, status: { code: nextResult === 'paid' ? 3 : 1 }, transaction: nextResult === 'paid' ? { status: 'A' } : {} } }));
  });
}).listen(4011);
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ locale: 'ar-AE' });
  const a = await ctx.newPage(); await a.goto(base + '/admin/login');
  await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  await a.goto(base + '/admin/integrations/telr');
  await a.fill('#store', '12345'); await a.fill('#key', 'SECRET-KEY-123'); await a.check('input[name=enabled]'); await a.locator('main form').first().locator('button:not([type=button])').click(); await a.waitForLoadState('networkidle');
  await a.goto('about:blank'); // from here on, no page of the store or the admin panel is opened
  const db = new Database(process.env.DB_PATH, { readonly: true });
  const v = db.prepare("SELECT v.id vid FROM variants v JOIN products p ON p.id=v.product_id WHERE v.stock>3 AND p.price_minor>0 LIMIT 1").get();
  const body = (key, pm) => ({ lines: [{ variantId: v.vid, quantity: 1 }], contact: { email: 'a@b.co', phone: '+971500000000' }, address: { name: 'Sara Ali', phone: '+971500000000', line1: 'Street 1 Bldg', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: pm, idempotencyKey: key, locale: 'ar' });
  const post = (o) => fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
  const row = (id) => db.prepare('SELECT payment_status ps, status FROM orders WHERE id=?').get(id);
  let r;
  const wdb = new Database(process.env.DB_PATH);
  const waitFor = async (fn, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await new Promise((x) => setTimeout(x, 300)); } return false; };
  nextResult = 'pending';
  r = await post(body('online-key-0005', 'online')); const j5 = await r.json();
  r = await post(body('online-key-0006', 'online')); const j6 = await r.json();
  const stockMid = db.prepare('SELECT stock FROM variants WHERE id=?').get(v.vid).stock;
  await new Promise((x) => setTimeout(x, 3500));
  ok(row(j5.orderId).ps === 'pending' && row(j6.orderId).status === 'new', 'a fresh unpaid order is left alone while the customer may still be paying');
  wdb.prepare("UPDATE orders SET created_at = datetime('now','-61 minutes') WHERE id=?").run(j6.orderId);
  ok(await waitFor(() => row(j6.orderId).status === 'cancelled' && row(j6.orderId).ps === 'failed'), 'unpaid for more than 60 minutes: cancelled automatically, no page opened');
  ok(db.prepare('SELECT stock FROM variants WHERE id=?').get(v.vid).stock === stockMid + 1 && row(j5.orderId).ps === 'pending', 'its stock is free again; the younger order still waits');
  nextResult = 'paid';
  ok(await waitFor(() => row(j5.orderId).ps === 'paid'), 'paid at Telr, customer never came back, admin panel closed: marked paid automatically');
  ok(await waitFor(() => !!db.prepare("SELECT 1 FROM notifications WHERE kind='payment' AND title LIKE ?").get('%' + j6.orderId + '%')), 'payment arriving after the automatic cancellation raises an alert for the owner');
  ok(row(j6.orderId).status === 'cancelled', 'that order is not silently re-opened');
  wdb.close();
  await b.close(); fake.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
