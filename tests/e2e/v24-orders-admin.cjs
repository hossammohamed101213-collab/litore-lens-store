// E2E v24: emirate/city lists at checkout, admin delete order (stock rules) and "copy as new order". Server: PAYMENT_MODE=mock
const { chromium } = require('./_pw.cjs');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ locale: 'ar-AE' });
  const a = await ctx.newPage(); await a.goto(base + '/admin/login');
  await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  const db = new Database(process.env.DB_PATH);
  const v = db.prepare("SELECT id vid FROM variants WHERE stock>5 LIMIT 1").get();
  const stock = () => db.prepare('SELECT stock FROM variants WHERE id=?').get(v.vid).stock;
  const post = (o) => fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
  const body = (key) => ({ lines: [{ variantId: v.vid, quantity: 2 }], contact: { email: 'a@b.co', phone: '+971500000000' }, address: { name: 'Sara Ali', phone: '+971500000000', line1: 'Street 1 Bldg 5', city: 'Dubai', region: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: key, locale: 'ar' });
  const s0 = stock();
  let r = await post(body('adm-key-0001')); const o1 = await r.json(); ok(r.status === 200 && stock() === s0 - 2, 'order created and stock reduced');
  // copy as new order
  await a.goto(base + '/admin/orders/' + o1.orderId); await a.getByRole('button', { name: 'نسخ كطلب جديد' }).click(); await a.waitForURL(/\/admin\/orders\/LT-[A-F0-9]+\?saved=1/);
  const newId = a.url().match(/LT-[A-F0-9]+/)[0];
  const n = db.prepare('SELECT status, payment_status ps, email, total_minor t FROM orders WHERE id=?').get(newId); const old = db.prepare('SELECT total_minor t FROM orders WHERE id=?').get(o1.orderId);
  ok(newId !== o1.orderId && n.status === 'new' && n.ps === 'pending' && n.t === old.t && n.email === 'a@b.co', 'copy: new order, pending payment, same customer and total');
  ok(db.prepare('SELECT count(*) c FROM order_lines WHERE order_id=?').get(newId).c === 1 && stock() === s0 - 4, 'copy: products copied and stock reduced again');
  // delete requires the confirmation tick
  await a.getByRole('button', { name: 'حذف الطلب' }).click(); await a.waitForLoadState('networkidle');
  ok(!!db.prepare('SELECT 1 FROM orders WHERE id=?').get(newId) && /أؤكد/.test(await a.locator('p[role=alert]').innerText()), 'delete without ticking is refused');
  // delete the copy: stock returns (new order)
  await a.check('input[name=sure]'); await a.getByRole('button', { name: 'حذف الطلب' }).click(); await a.waitForURL(/\/admin\/orders\?deleted=1/);
  ok(!db.prepare('SELECT 1 FROM orders WHERE id=?').get(newId) && stock() === s0 - 2, 'delete: order gone and stock returned for a new order');
  ok(db.prepare('SELECT count(*) c FROM order_lines WHERE order_id=?').get(newId).c === 0, 'delete: its lines are gone too');
  // a PAID real order is a financial record: it can not be deleted
  r = await post(body('adm-key-0002')); const o2 = await r.json();
  db.prepare('UPDATE orders SET is_mock = 0 WHERE id=?').run(o2.orderId); // as if it held real products
  await a.goto(base + '/admin/orders/' + o2.orderId); await a.check('input[name=sure]'); await a.getByRole('button', { name: 'حذف الطلب' }).click(); await a.waitForLoadState('networkidle');
  ok(!!db.prepare('SELECT 1 FROM orders WHERE id=?').get(o2.orderId) && /مدفوع/.test(await a.locator('p[role=alert]').innerText()), 'a paid real order can not be deleted');
  db.prepare("UPDATE orders SET payment_status='pending' WHERE id=?").run(o2.orderId);
  await a.goto(base + '/admin/orders/' + o2.orderId); await a.check('input[name=sure]'); await a.getByRole('button', { name: 'حذف الطلب' }).click(); await a.waitForURL(/deleted=1/);
  ok(!db.prepare('SELECT 1 FROM orders WHERE id=?').get(o2.orderId) && stock() === s0 - 2, 'the same order, unpaid, can be deleted and its stock returns');
  // a shipped order is deleted without returning stock
  db.prepare("UPDATE orders SET status='shipped' WHERE id=?").run(o1.orderId);
  await a.goto(base + '/admin/orders/' + o1.orderId); await a.check('input[name=sure]'); await a.getByRole('button', { name: 'حذف الطلب' }).click(); await a.waitForURL(/deleted=1/);
  ok(!db.prepare('SELECT 1 FROM orders WHERE id=?').get(o1.orderId) && stock() === s0 - 2, 'delete shipped order: removed, stock NOT returned');
  // anonymous cannot call the actions
  const anon = await fetch(base + '/admin/orders/' + o1.orderId, { redirect: 'manual' }); ok(anon.status >= 300 && anon.status < 400, 'order page needs admin login');
  // copy refuses when stock is short
  db.prepare('UPDATE variants SET stock=1 WHERE id=?').run(v.vid);
  r = await post(body('adm-key-0002')); ok(r.status === 409 || r.status === 400, 'checkout refuses when stock is short (' + r.status + ')');
  db.prepare('UPDATE variants SET stock=10 WHERE id=?').run(v.vid);
  r = await post(body('adm-key-0003')); const o3 = await r.json();
  db.prepare('UPDATE variants SET stock=1 WHERE id=?').run(v.vid);
  await a.goto(base + '/admin/orders/' + o3.orderId); await a.getByRole('button', { name: 'نسخ كطلب جديد' }).click(); await a.waitForLoadState('networkidle');
  ok(/المخزون غير كافٍ/.test(await a.locator('p[role=alert]').innerText()) && db.prepare('SELECT count(*) c FROM orders').get().c === 1, 'copy with short stock shows a clear message and creates nothing');
  await b.close(); db.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
