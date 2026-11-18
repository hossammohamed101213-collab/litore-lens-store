// Rare cases on the TEST server (stand-in gateway). Server needs TELR_ENDPOINT=http://localhost:4013/order.json PAYMENT_WATCH_MS=1500
//  - the gateway key expired / is refused          -> the customer is told payment is unavailable, no order and no stock is held
//  - the gateway says "too many requests" (429)     -> same clean refusal; works again when the gateway recovers
//  - the gateway is slow to answer a status check   -> the order stays "waiting", it is never marked paid or cancelled by guess
//  - the server restarts while a payment is waiting -> covered by state living in the database: the background check confirms it afterwards
//  - two admins change the same order in the same second -> one consistent result, stock returned at most once
const { chromium } = require('./_pw.cjs');
const http = require('http');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const q1 = (sql, ...a) => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare(sql).get(...a); } finally { d.close(); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let mode = 'ok'; const orders = {};
http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => b += d); req.on('end', async () => {
    const j = JSON.parse(b || '{}');
    if (mode === 'expired') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ error: { message: 'E01:Authentication failed', note: 'Invalid store or key' } })); }
    if (mode === 'rate') { res.statusCode = 429; res.setHeader('content-type', 'text/plain'); return res.end('Too Many Requests'); }
    res.setHeader('content-type', 'application/json');
    if (j.method === 'create') { const ref = 'RS' + Object.keys(orders).length; orders[ref] = { cartid: j.order.cartid, amount: j.order.amount, currency: j.order.currency, state: 'pending' }; return res.end(JSON.stringify({ order: { ref, url: 'http://localhost:4013/pay/' + ref } })); }
    const o = orders[j.order.ref]; if (mode === 'slow') await sleep(20000);
    res.end(JSON.stringify({ order: { cartid: o.cartid, amount: o.amount, currency: o.currency, status: { code: o.state === 'paid' ? 3 : 1 }, transaction: o.state === 'paid' ? { status: 'A' } : {} } }));
  });
}).listen(4013);

(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const login = async () => { const c = await b.newContext({ locale: 'ar-AE' }); const p = await c.newPage(); await p.goto(base + '/admin/login'); await p.fill('#email', 'owner@example.com'); await p.fill('#password', 'Str0ng-Passw0rd!'); await p.locator('main button:not([type=button])').click(); await p.waitForURL(/\/admin$/); return p; };
  const a = await login();
  await a.goto(base + '/admin/integrations/telr'); await a.fill('#store', '12345'); await a.fill('#key', 'KEY-RES-1'); await a.check('input[name=enabled]'); await a.locator('main form').first().locator('button:not([type=button])').click(); await a.waitForURL(/saved=1/);
  const v = q1("SELECT v.id vid FROM variants v JOIN products p ON p.id = v.product_id WHERE p.status = 'active' AND p.price_minor > 0 LIMIT 1");
  { const d = new Database(process.env.DB_PATH); d.prepare('UPDATE variants SET stock = 50 WHERE id = ?').run(v.vid); d.close(); }
  let n = 0;
  const post = () => fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.7.0.${++n}` }, body: JSON.stringify({ lines: [{ variantId: v.vid, quantity: 1 }], contact: { email: `res${n}@example.com`, phone: '+971500000000' }, address: { name: 'Sara Ali', phone: '+971500000000', line1: 'Street 1 Bldg', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: 'online', idempotencyKey: `res-key-${String(n).padStart(5, '0')}`, locale: 'ar' }) }).then(async (r) => ({ s: r.status, j: await r.json().catch(() => ({})) }));
  const snap = () => ({ stock: q1('SELECT stock FROM variants WHERE id = ?', v.vid).stock, live: q1("SELECT COUNT(*) n FROM orders WHERE status != 'cancelled'").n, holding: q1("SELECT COALESCE(SUM(l.quantity),0) n FROM order_lines l JOIN orders o ON o.id = l.order_id WHERE o.status != 'cancelled' AND l.variant_id = ?", v.vid).n });

  // expired / refused key
  let s0 = snap(); mode = 'expired'; let r = await post(); let s1 = snap();
  ok(r.s !== 200 && !r.j.redirectUrl, `expired gateway key: checkout is refused cleanly (${r.s} ${r.j.error || ''})`);
  ok(s1.stock === s0.stock && s1.live === s0.live, 'expired gateway key: no order is left open and stock is not held');
  ok(!JSON.stringify(r.j).includes('KEY-RES-1') && !/Authentication|E01/.test(JSON.stringify(r.j)), 'expired gateway key: the customer sees no key and no gateway internals');

  // rate limited
  mode = 'rate'; r = await post(); s1 = snap();
  ok(r.s !== 200 && s1.stock === s0.stock && s1.live === s0.live, `gateway says "too many requests": refused cleanly (${r.s}), nothing held`);

  // gateway back
  mode = 'ok'; r = await post(); const id = r.j.orderId;
  ok(r.s === 200 && /localhost:4013\/pay\//.test(r.j.redirectUrl || ''), 'gateway back: the next customer is sent to the payment page');
  ok(snap().stock === s0.stock - 1 && q1('SELECT payment_status ps FROM orders WHERE id = ?', id).ps === 'pending', 'that order waits for payment and holds exactly one piece');

  // slow status check: never decide by guess
  mode = 'slow'; const t0 = Date.now();
  const back = await fetch(base + `/api/payment/telr/return?order=${id}&r=authorised&l=ar`, { redirect: 'manual' }).then((x) => x.status).catch(() => 0);
  const row = q1('SELECT payment_status ps, status st FROM orders WHERE id = ?', id);
  ok(row.ps === 'pending' && row.st !== 'cancelled' && Date.now() - t0 < 19000, `gateway slow to answer (${Math.round((Date.now() - t0) / 1000)}s, answer ${back}): the order stays "waiting", not paid and not cancelled`);

  // paid at the gateway while nobody is looking (customer closed the browser / the server was restarted): the background check confirms it
  mode = 'ok'; orders[q1('SELECT payment_ref r FROM orders WHERE id = ?', id).r].state = 'paid';
  let paid = false; for (let i = 0; i < 40 && !paid; i++) { await sleep(500); paid = q1('SELECT payment_status ps FROM orders WHERE id = ?', id).ps === 'paid'; }
  ok(paid, 'paid at the gateway with no browser return: the background check marks the order paid by itself');

  // two admins, same order, same moment: one cancels, one moves it to "processing"
  r = await post(); const o2 = r.j.orderId; orders[q1('SELECT payment_ref r FROM orders WHERE id = ?', o2).r].state = 'paid';
  for (let i = 0; i < 40 && q1('SELECT payment_status ps FROM orders WHERE id = ?', o2).ps !== 'paid'; i++) await sleep(500);
  const before = snap();
  const a2 = await login();
  await Promise.all([a.goto(`${base}/admin/orders/${o2}`), a2.goto(`${base}/admin/orders/${o2}`)]);
  await a.selectOption('#status', 'cancelled'); await a2.selectOption('#status', 'processing');
  await Promise.all([a.locator('form:has(#status) button').click(), a2.locator('form:has(#status) button').click()]);
  await Promise.all([a.waitForLoadState('networkidle'), a2.waitForLoadState('networkidle')]); await sleep(1200);
  const fin = q1('SELECT status st FROM orders WHERE id = ?', o2).st; const after = snap();
  const stockOk = fin === 'cancelled' ? after.stock === before.stock + 1 : after.stock === before.stock;
  ok(['cancelled', 'processing'].includes(fin) && stockOk, `two admins at once (cancel vs processing): order ends "${fin}" and stock is ${fin === 'cancelled' ? 'returned exactly once' : 'unchanged'}`);
  const logs = q1("SELECT COUNT(*) n FROM admin_log WHERE detail LIKE ?", '%' + o2 + '%').n;
  ok(logs >= 1, 'the activity log shows what was done to that order');
  // pressing "cancel" twice at once never returns stock twice
  r = await post(); const o3 = r.j.orderId; const b3 = snap();
  await Promise.all([a.goto(`${base}/admin/orders/${o3}`), a2.goto(`${base}/admin/orders/${o3}`)]);
  await a.selectOption('#status', 'cancelled'); await a2.selectOption('#status', 'cancelled');
  await Promise.all([a.locator('form:has(#status) button').click(), a2.locator('form:has(#status) button').click()]);
  await Promise.all([a.waitForLoadState('networkidle'), a2.waitForLoadState('networkidle')]); await sleep(1200);
  ok(q1('SELECT status st FROM orders WHERE id = ?', o3).st === 'cancelled' && snap().stock === b3.stock + 1, 'two admins cancel the same order at once: stock comes back exactly once');
  ok(q1('SELECT MIN(stock) m FROM variants').m >= 0, 'no stock is negative anywhere');
  await b.close(); console.log('FAILS', fails); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed', e && e.message); process.exit(1); });
