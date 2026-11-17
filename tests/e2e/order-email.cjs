// Order confirmation e-mail, against a FAKE e-mail service on this machine (nothing is really sent).
// Server env: SEED_SAMPLE=true PAYMENT_MODE=mock RESEND_API_KEY=test-key RESEND_ENDPOINT=http://localhost:4030/emails PAYMENT_WATCH_MS=1500
// Run: DB_PATH=/path/to/l.db BASE=http://localhost:3100 node tests/e2e/order-email.cjs
const http = require('http');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const w = (sql, ...a) => { const d = new Database(process.env.DB_PATH); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
const q1 = (sql, ...a) => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare(sql).get(...a); } finally { d.close(); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mails = []; let down = false; let auth = '';
const fake = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
  auth = req.headers.authorization || '';
  if (down) { res.writeHead(500); return res.end('{}'); }
  mails.push(JSON.parse(b)); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"id":"fake"}');
}); });
const to = (e) => mails.filter((m) => m.to[0] === e);
const order = (email, key, extra = {}) => fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
  lines: [{ variantId: 'mock-1-v1', quantity: 1 }], contact: { email, phone: '+971501234567' },
  address: { name: 'Mail Test', phone: '+971501234567', line1: 'Street 1 Building 2', city: 'Dubai', country: 'AE' },
  shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: key, locale: 'en', ...extra }) });

(async () => {
  await new Promise((r) => fake.listen(4030, r));
  let r = await order('en@example.com', 'mail-key-0001'); let j = await r.json(); await sleep(800);
  let m = to('en@example.com');
  ok(r.status === 200 && m.length === 1, `paid order -> exactly one confirmation e-mail (${m.length})`);
  ok(m[0] && m[0].subject.includes(j.orderId) && m[0].html.includes(`/en/order/${j.orderId}`) && m[0].html.includes('dir="ltr"'), 'English e-mail has the order number and the tracking link');
  const row = q1('SELECT total_minor t FROM orders WHERE id = ?', j.orderId);
  ok(m[0] && m[0].html.includes((row.t / 100).toFixed(2)) && m[0].html.includes('× 1'), 'e-mail shows the products and the exact total that was charged');
  ok(auth === 'Bearer test-key' && !JSON.stringify(m[0]).includes('test-key'), 'the service key travels in the header only, never in the message');
  ok(!/\+9715|Street 1/.test(m[0].html), 'e-mail does not repeat the phone number or the address');
  r = await order('en@example.com', 'mail-key-0001'); await sleep(600);
  ok(to('en@example.com').length === 1, 'pressing confirm twice (same order) sends no second e-mail');
  r = await order('ar@example.com', 'mail-key-0002', { locale: 'ar' }); j = await r.json(); await sleep(800); m = to('ar@example.com');
  ok(m.length === 1 && m[0].html.includes('dir="rtl"') && m[0].html.includes(`/ar/order/${j.orderId}`) && m[0].subject.includes('تم تأكيد طلبك'), 'Arabic order gets the Arabic, right-to-left e-mail');
  r = await order('x@example.com', 'mail-key-0003', { address: { name: '<script>alert(1)</script>', phone: '+971501234567', line1: 'Street 1 Building 2', city: 'Dubai', country: 'AE' } }); await sleep(800); m = to('x@example.com');
  ok(m.length === 1 && !m[0].html.includes('<script>') && m[0].html.includes('&lt;script&gt;'), 'a script typed as the customer name is shown as plain text in the e-mail');
  r = await order('fail@example.com', 'mail-key-0004', { paymentMethod: 'mock-fail' }); await sleep(800);
  ok(r.status === 402 && to('fail@example.com').length === 0, 'failed payment -> no confirmation e-mail');
  // e-mail service down: the order must still succeed, and the e-mail goes out later
  down = true; r = await order('down@example.com', 'mail-key-0005'); j = await r.json(); await sleep(800);
  ok(r.status === 200 && j.orderId && q1('SELECT payment_status p FROM orders WHERE id = ?', j.orderId).p === 'paid' && to('down@example.com').length === 0, 'e-mail service down: the order is still created and paid');
  ok(q1('SELECT confirm_mail_at c FROM orders WHERE id = ?', j.orderId).c === null, '...and it is remembered as "not sent yet"');
  down = false; await sleep(4500);
  ok(to('down@example.com').length === 1, `service back: the e-mail goes out by itself, once (${to('down@example.com').length})`);
  await sleep(3500); ok(to('down@example.com').length === 1 && to('en@example.com').length === 1, 'the background check never sends an e-mail twice');
  // an order that waits for payment gets no e-mail until it is paid
  r = await order('late@example.com', 'mail-key-0006'); j = await r.json(); await sleep(500);
  const before = to('late@example.com').length;
  w("UPDATE orders SET payment_status = 'pending', confirm_mail_at = NULL WHERE id = ?", j.orderId); await sleep(3500);
  ok(before === 1 && to('late@example.com').length === 1, 'an unpaid (waiting) order gets no e-mail');
  w("UPDATE orders SET payment_status = 'paid' WHERE id = ?", j.orderId); await sleep(4000);
  ok(to('late@example.com').length === 2, 'once it becomes paid (for example confirmed by the owner) the e-mail goes out');
  // cancelled or old orders never get a late e-mail
  r = await order('old@example.com', 'mail-key-0007'); j = await r.json(); await sleep(600);
  w("UPDATE orders SET confirm_mail_at = NULL, created_at = datetime('now','-5 days') WHERE id = ?", j.orderId);
  r = await order('gone@example.com', 'mail-key-0008'); const j2 = await r.json(); await sleep(600);
  w("UPDATE orders SET confirm_mail_at = NULL, status = 'cancelled' WHERE id = ?", j2.orderId); await sleep(4000);
  ok(j.orderId && j2.orderId && to('old@example.com').length === 1 && to('gone@example.com').length === 1, `old or cancelled orders never get a late e-mail (${r.status} ${to('old@example.com').length} ${to('gone@example.com').length})`);
  fake.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
