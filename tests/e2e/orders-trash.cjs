// Orders list: tick orders (or all), delete them together; paid orders are never deleted; deleted orders wait 48 hours
// in "المحذوفات", can be restored as they were, then are removed for good. Server: PAYMENT_MODE=mock
const { chromium } = require('./_pw.cjs');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ locale: 'ar-AE' });
  const a = await ctx.newPage(); await a.goto(base + '/admin/login');
  await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  const db = new Database(process.env.DB_PATH);
  const v = db.prepare('SELECT id vid FROM variants WHERE stock > 5 ORDER BY stock DESC LIMIT 1').get(); db.prepare('UPDATE variants SET stock = 40 WHERE id = ?').run(v.vid); const stock = () => db.prepare('SELECT stock FROM variants WHERE id = ?').get(v.vid).stock;
  let k = 0; const make = async (name) => (await (await fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ variantId: v.vid, quantity: 2 }], contact: { email: name + '@example.com', phone: '+971500000000' }, address: { name: 'Sara ' + name, phone: '+971500000000', line1: 'Street 1 Bldg 5', city: 'Dubai', region: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: 'trash-key-' + String(++k).padStart(6, '0'), locale: 'ar' }) })).json()).orderId;
  const A = await make('aa'), B = await make('bb'), C = await make('cc'), D = await make('dd');
  db.prepare("UPDATE orders SET is_mock = 0, payment_status = 'pending', status = 'new' WHERE id IN (?, ?)").run(A, D);            // unpaid, still holding their pieces
  db.prepare("UPDATE orders SET is_mock = 0, payment_status = 'failed', status = 'cancelled' WHERE id = ?").run(B);               // cancelled, failed payment
  db.prepare("UPDATE orders SET is_mock = 0, payment_status = 'paid', status = 'processing' WHERE id = ?").run(C);                 // a real paid order
  const has = (id) => !!db.prepare('SELECT 1 FROM orders WHERE id = ?').get(id); const trashed = (id) => !!db.prepare('SELECT 1 FROM deleted_orders WHERE id = ?').get(id);
  const snap = (id) => JSON.stringify([db.prepare('SELECT * FROM orders WHERE id = ?').get(id), db.prepare('SELECT * FROM order_lines WHERE order_id = ? ORDER BY id').all(id)]);
  const box = (id) => a.locator(`input[name=id][value="${id}"]`); const del = () => a.getByRole('button', { name: /حذف المحدد/ }); const sure = () => a.locator('#print-orders input[name=sure]');
  const before = snap(A); const s0 = stock();

  await a.goto(base + '/admin/orders');
  ok(await box(A).count() === 1 && await box(B).count() === 1 && await box(C).count() === 1, 'every order in the list has a tick box');
  // no confirmation -> nothing happens
  await box(A).check(); await box(B).check(); await del().click(); await a.waitForURL(/error=/);
  ok(has(A) && has(B) && /أؤكد الحذف/.test(await a.locator('p[role=alert]').innerText()), 'without the "I confirm" tick nothing is deleted and the page says why');
  // nothing ticked -> nothing happens
  await sure().check(); await del().click(); await a.waitForURL(/error=/);
  ok(has(A) && has(B) && has(C) && has(D), 'with no order ticked nothing is deleted');
  // tick three (one of them paid) and delete together
  await box(A).check(); await box(B).check(); await box(C).check(); await sure().check(); await del().click(); await a.waitForURL(/deleted=2&kept=1/);
  const note = await a.locator('p[role=status]').innerText();
  ok(!has(A) && !has(B) && has(C), 'the ticked unpaid orders are deleted together, the paid one stays');
  ok(/تم حذف 2 طلب/.test(note) && /1 طلب مدفوع لم يُحذف/.test(note) && /48 ساعة/.test(note), 'the page says how many were deleted, how many paid ones were kept, and that they can be restored for 48 hours');
  ok(stock() === s0 + 2, 'the order that still held its pieces gives them back; the cancelled one does not give them twice');
  ok(db.prepare('SELECT count(*) c FROM order_lines WHERE order_id IN (?, ?)').get(A, B).c === 0 && trashed(A) && trashed(B) && !trashed(C), 'the deleted orders wait in the deleted list with their products');
  ok(/المحذوفات \(2\)/.test(await a.locator('[data-trash-link]').innerText()), 'the list shows a link to the deleted orders with their number');
  // select all
  await a.goto(base + '/admin/orders'); await a.locator('[data-select-all]').check(); await sure().check(); await del().click(); await a.waitForURL(/deleted=\d+&kept=1/);
  ok(!has(D) && has(C) && trashed(D), '"select all" then delete removes every unpaid order and still keeps the paid one');
  // a customer no longer sees a deleted order
  ok(!/Sara aa|aa@example\.com/.test(await (await fetch(base + '/ar/order/' + A)).text()) && (await (await fetch(base + '/api/orders/' + A)).json().catch(() => ({}))).status === undefined, 'a deleted order is gone from the shop side');

  // ---- the deleted list
  await a.goto(base + '/admin/orders/trash');
  ok(await a.locator('[data-trashed]').count() === 3 && /48 ساعة/.test(await a.locator(`[data-trashed="${A}"]`).innerText()), 'the deleted list shows each order and the hours left');
  await a.getByRole('button', { name: `استرجاع ${A}` }).click(); await a.waitForURL(/restored=/);
  ok(has(A) && !trashed(A) && snap(A) === before, 'restore puts the order back exactly as it was: same data, same products');
  ok(stock() === s0 + 2, 'and takes its pieces from the stock again (the other restored-less order still gave its own back)');
  await a.goto(base + '/admin/orders/' + A); ok(/Sara aa/.test(await a.locator('main').innerText()), 'the restored order opens in the panel again');
  // pieces sold meanwhile -> restore refused, nothing half-restored
  const keep = stock(); db.prepare('UPDATE variants SET stock = 1 WHERE id = ?').run(v.vid);
  await a.goto(base + '/admin/orders/trash'); await a.getByRole('button', { name: `استرجاع ${D}` }).click(); await a.waitForURL(/error=/);
  ok(!has(D) && trashed(D) && stock() === 1 && /المخزون/.test(await a.locator('p[role=alert]').innerText()), 'when its pieces were sold meanwhile the order is not restored, nothing is half done, and the page says why');
  db.prepare('UPDATE variants SET stock = ? WHERE id = ?').run(keep, v.vid);
  // 48 hours later -> gone for good
  db.prepare('UPDATE deleted_orders SET deleted_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000) - 47 * 3600, D);
  db.prepare('UPDATE deleted_orders SET deleted_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000) - 49 * 3600, B);
  await a.goto(base + '/admin/orders/trash');
  ok(!trashed(B) && trashed(D) && await a.locator(`[data-trashed="${B}"]`).count() === 0 && /1 ساعة/.test(await a.locator(`[data-trashed="${D}"]`).innerText()), 'after 48 hours a deleted order is removed for good; one deleted 47 hours ago is still there with 1 hour left');
  ok(!has(B) && db.prepare('SELECT count(*) c FROM order_lines WHERE order_id = ?').get(B).c === 0, 'nothing of the removed order is left');

  // ---- deleting from inside one order goes to the same list; a paid order still can not be deleted there
  await a.goto(base + '/admin/orders/' + A); await a.check('input[name=sure]'); await a.getByRole('button', { name: 'حذف الطلب' }).click(); await a.waitForURL(/deleted=1/);
  ok(!has(A) && trashed(A), 'deleting from inside an order sends it to the deleted list too');
  await a.goto(base + '/admin/orders/' + C); await a.check('input[name=sure]'); await a.getByRole('button', { name: 'حذف الطلب' }).click(); await a.waitForLoadState('networkidle');
  ok(has(C) && !trashed(C), 'a paid order can not be deleted from inside the order either');
  ok(db.prepare("SELECT count(*) c FROM admin_log WHERE action IN ('حذف طلبات محددة', 'استرجاع طلب محذوف')").get().c >= 4, 'every bulk delete and every restore is written in the activity log');
  // ---- a visitor
  const g = await fetch(base + '/admin/orders/trash', { redirect: 'manual' }); const gb = await g.text();
  ok(g.status === 307 && gb.length < 200 && !gb.includes(D), 'the deleted list is closed to visitors');
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
