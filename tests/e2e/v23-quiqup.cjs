// E2E v23: Quiqup automatic shipping (fake Quiqup server on :4030), encrypted key, label proxy, signed webhook. Server needs QUIQUP_BASE=http://localhost:4030 PAYMENT_MODE=cod
const { chromium } = require('./_pw.cjs');
const http = require('http');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const KEY = 'QQ-KEY-123', WH = 'whsec-abc-123';
let mode = 'ok'; const got = []; const UUID_BASE = 'aaaaaaaa-bbbb-4ccc-8ddd-';
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => b += d); req.on('end', () => {
    if (req.headers.authorization !== `Bearer ${KEY}`) { res.statusCode = 401; res.setHeader('content-type', 'application/json'); return res.end('{"error":"unauthorized"}'); }
    if (req.method === 'POST' && req.url === '/orders') {
      const j = JSON.parse(b); got.push(j); res.setHeader('content-type', 'application/json');
      if (mode === 'unprocessable') { res.statusCode = 422; return res.end('{"api_error":{"message":""}}'); }
      res.statusCode = 201; const n = 700 + got.length;
      return res.end(JSON.stringify({ order: { id: n, uuid: UUID_BASE + String(n).padStart(12, '0'), state: 'pending', partner_order_id: j.partner_order_id, tracking_url: 'https://track-parcel.quiqup.com/' + UUID_BASE + String(n).padStart(12, '0') } }));
    }
    const m = req.url.match(/^\/order_label\/(\d+)$/);
    if (m) { res.setHeader('content-type', 'application/pdf'); return res.end(Buffer.from('%PDF-1.4 fake label ' + m[1])); }
    res.statusCode = 404; res.end('{}');
  });
}).listen(4030);
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ locale: 'ar-AE' });
  const a = await ctx.newPage(); await a.goto(base + '/admin/login');
  await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  const db = new Database(process.env.DB_PATH, { readonly: true });
  // sender + quiqup setup
  await a.goto(base + '/admin/integrations/sender');
  await a.fill('#ship_name', 'Litore'); await a.fill('#ship_phone', '0527645570'); await a.fill('#ship_line1', 'Abu Dhabi, Office 1'); await a.fill('#ship_city', 'Abu Dhabi');
  await a.getByRole('button', { name: 'حفظ' }).click(); await a.waitForURL(/saved=1/);
  const r0 = await a.goto(base + '/admin/integrations/quiqup'); ok(r0.status() === 200, 'quiqup page renders');
  await a.fill('#key', KEY); await a.fill('#whsec', WH); await a.check('input[name=enabled]'); await a.getByRole('button', { name: 'حفظ' }).click(); await a.waitForURL(/saved=1/);
  const sk = db.prepare("SELECT value FROM settings WHERE key='car_quiqup_key'").get().value;
  ok(sk.startsWith('enc:') && !sk.includes('QQ-KEY'), 'API key stored encrypted');
  ok(db.prepare("SELECT value FROM settings WHERE key='car_quiqup_whsec'").get().value.startsWith('enc:'), 'webhook secret stored encrypted');
  ok(!(await a.content()).includes(KEY), 'key never shown back in the page');
  // keep-secret-when-empty
  await a.goto(base + '/admin/integrations/quiqup'); await a.getByRole('button', { name: 'حفظ' }).click(); await a.waitForURL(/saved=1/);
  ok(db.prepare("SELECT value FROM settings WHERE key='car_quiqup_key'").get().value === sk, 'empty key field keeps the saved key');

  // make orders
  const v = db.prepare("SELECT id vid FROM variants WHERE stock>3 LIMIT 1").get();
  const body = (key, ph) => ({ lines: [{ variantId: v.vid, quantity: 1 }], contact: { email: 'a@b.co', phone: ph }, address: { name: 'Sara Ali', phone: ph, line1: 'Street 1 Bldg 5', line2: 'Apt 12', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: 'cod', idempotencyKey: key, locale: 'ar' });
  const post = (o) => fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
  let r = await post(body('quiqup-key-0001', '+971500000000')); const o1 = await r.json(); ok(r.status === 200 && o1.orderId, 'order 1 created (' + r.status + ')');
  const total1 = db.prepare('SELECT total_minor/100.0 t FROM orders WHERE id=?').get(o1.orderId).t;

  // ship with Quiqup (auto)
  await a.goto(base + '/admin/orders/' + o1.orderId); await a.selectOption('#carrier', 'quiqup');
  await a.getByRole('button', { name: 'اشحن الآن' }).click(); await a.waitForLoadState('networkidle');
  const row = db.prepare('SELECT status, tracking_number t, carrier c, carrier_ref ref, label_url l FROM orders WHERE id=?').get(o1.orderId);
  ok(row.status === 'shipped' && row.c === 'quiqup' && row.ref === '701' && row.t === UUID_BASE + '000000000701', 'shipped: carrier, quiqup order id and tracking uuid saved (' + JSON.stringify(row) + ')');
  const sent = got[0] || {};
  ok(sent.partner_order_id === o1.orderId && sent.kind === 'partner_next_day' && sent.ready_for_collection === true, 'request: reference, next-day kind, released');
  ok(sent.payment_mode === 'paid_on_delivery' && Math.abs(sent.payment_amount - total1) < 0.01, 'unpaid COD order sends amount to collect (' + sent.payment_amount + ' vs ' + total1 + ')');
  ok(sent.destination && sent.destination.contact_phone === '+971500000000' && sent.origin.contact_phone === '+971527645570', 'phones sent as E.164 with one +');
  ok(sent.destination.address.address1 === 'Street 1 Bldg 5' && sent.destination.address.address2 === 'Apt 12' && sent.destination.address.country === 'AE', 'destination address mapped');
  ok(Array.isArray(sent.items) && sent.items[0].name.startsWith('Litore LT-') && sent.items[0].quantity === 1 && /^[0-9a-f-]{36}$/.test(sent.uuid), 'one parcel and an idempotency uuid');
  const html = await a.content();
  ok(html.includes('https://track-parcel.quiqup.com/' + row.t) && html.includes('طباعة الملصق'), 'tracking link and print-label link shown');

  // label proxy
  const anon = await fetch(base + `/api/admin/orders/${o1.orderId}/label`); ok(anon.status === 401, 'label route needs admin login');
  const lab = await a.request.get(base + `/api/admin/orders/${o1.orderId}/label`);
  ok(lab.status() === 200 && /pdf/.test(lab.headers()['content-type']) && (await lab.text()).includes('fake label 701'), 'admin gets the PDF label through the proxy');
  const bad = await a.request.get(base + `/api/admin/orders/..%2F..%2Fx/label`); ok(bad.status() === 404, 'label route rejects bad ids');

  // double shipping is blocked and the uuid is stable per order
  await a.goto(base + '/admin/orders/' + o1.orderId); await a.getByRole('button', { name: 'اشحن الآن' }).click(); await a.waitForLoadState('networkidle');
  ok(got.length === 1 && /مشحون بالفعل/.test(await a.locator('p[role=alert]').innerText()), 'shipping the same order twice is refused (no second Quiqup order)');
  // webhook
  const send = (payload, o = {}) => { const raw = JSON.stringify({ action: 'update', type: 'order', sent_at: new Date().toISOString(), payload }); const ts = o.ts ?? String(Math.floor(Date.now() / 1000)); const sig = o.sig ?? crypto.createHmac('sha256', o.secret ?? WH).update(`${ts}.${raw}`).digest('hex');
    return fetch(base + '/api/webhooks/quiqup', { method: 'POST', headers: { 'content-type': 'application/json', 'x-quiqup-signature': sig, 'x-quiqup-timestamp': ts }, body: raw }); };
  const st = () => db.prepare('SELECT status FROM orders WHERE id=?').get(o1.orderId).status;
  ok((await send({ id: 701, state: 'delivery_complete' }, { secret: 'wrong' })).status === 401 && st() === 'shipped', 'webhook with a wrong signature is refused');
  ok((await send({ id: 701, state: 'delivery_complete' }, { ts: String(Math.floor(Date.now() / 1000) - 3600) })).status === 401 && st() === 'shipped', 'old timestamp (replay) is refused');
  ok((await send({ id: 701, state: 'out_for_delivery' })).status === 200 && st() === 'shipped', 'other states do not change the order');
  ok((await send({ id: 999, state: 'delivery_complete' })).status === 200 && st() === 'shipped', 'unknown quiqup order id changes nothing');
  ok((await send({ id: 701, state: 'delivery_complete' })).status === 200 && st() === 'delivered', 'signed delivery_complete marks the order delivered');

  // paid order => prepaid; wrong phone; quiqup errors
  r = await post(body('quiqup-key-0002', '+971500000001')); const o2 = await r.json();
  db.close(); const w = new Database(process.env.DB_PATH); w.prepare("UPDATE orders SET payment_status='paid' WHERE id=?").run(o2.orderId); w.close();
  await a.goto(base + '/admin/orders/' + o2.orderId); await a.selectOption('#carrier', 'quiqup'); await a.getByRole('button', { name: 'اشحن الآن' }).click(); await a.waitForLoadState('networkidle');
  ok(got[1] && got[1].payment_mode === 'pre_paid' && got[1].payment_amount === undefined, 'paid order is sent as pre_paid without an amount');
  mode = 'unprocessable'; r = await post(body('quiqup-key-0003', '+971500000002')); const o3 = await r.json();
  await a.goto(base + '/admin/orders/' + o3.orderId); await a.selectOption('#carrier', 'quiqup'); await a.getByRole('button', { name: 'اشحن الآن' }).click(); await a.waitForLoadState('networkidle');
  ok(/غير مفعّلة|Quiqup/.test(await a.locator('p[role=alert]').innerText()), 'a 422 from Quiqup shows a clear Arabic message');
  const chk = new Database(process.env.DB_PATH, { readonly: true });
  ok(chk.prepare('SELECT status FROM orders WHERE id=?').get(o3.orderId).status !== 'shipped', 'failed Quiqup call does not mark the order shipped');
  chk.close();
  // owner switch for cash on delivery
  await a.goto(base + '/admin/integrations/telr'); await a.uncheck('input[name=cod]'); await a.locator('form:has(input[name=cod]) button').click(); await a.waitForURL(/saved=1/);
  r = await post(body('quiqup-key-0004', '+971500000003')); ok(r.status === 400, 'cod refused when the owner closes it');
  await a.goto(base + '/admin/integrations/telr'); await a.check('input[name=cod]'); await a.locator('form:has(input[name=cod]) button').click(); await a.waitForURL(/saved=1/);
  r = await post(body('quiqup-key-0005', '+971500000004')); ok(r.status === 200, 'cod accepted again after reopening');
  await b.close(); fake.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
