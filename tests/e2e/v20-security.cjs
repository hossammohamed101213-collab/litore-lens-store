// Security hardening checks. Fresh DB + SEED_SAMPLE, PAYMENT_MODE=cod
const base = process.env.BASE || 'http://localhost:3100'; let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const r = await fetch(base + '/ar'); const h = r.headers;
  ok(/max-age=\d{7,}/.test(h.get('strict-transport-security') || ''), 'HSTS header present');
  ok(/frame-ancestors 'none'/.test(h.get('content-security-policy') || ''), 'CSP frame-ancestors none');
  ok(h.get('x-frame-options') === 'DENY' && h.get('x-content-type-options') === 'nosniff', 'framing + sniffing blocked');
  ok(!h.get('x-powered-by'), 'no x-powered-by');
  // product + checkout to get a real order id
  const D = require('better-sqlite3'); const dbc = new D(process.env.DB_PATH, { readonly: true }); const v = dbc.prepare('SELECT id FROM variants WHERE stock > 0 LIMIT 1').get().id; dbc.close();
  const body = { lines: [{ variantId: v, quantity: 1 }], contact: { email: 'sec@example.com', phone: '+971501234567' }, address: { name: 'Sec Test', phone: '+971501234567', line1: 'Street 1 Building 2', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: 'cod', idempotencyKey: 'sec-key-0001', locale: 'en' };
  const c = await fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await c.json();
  console.log(JSON.stringify(j).slice(0,200)); ok(c.status === 200 && /^LT-[A-F0-9]{12}$/.test(j.orderId || ''), 'order id is 12 hex chars (48 bits): ' + j.orderId);
  const o = await (await fetch(base + '/api/orders/' + j.orderId)).json();
  const txt = JSON.stringify(o);
  ok(o.order && o.order.status && !/sec@example|501234567|Street 1|Sec Test/.test(txt), 'public order API leaks no name/phone/email/address');
  ok((await fetch(base + '/api/orders/LT-00000000')).status === 404, 'unknown order -> 404');
  let limited = 0; for (let i = 0; i < 40; i++) { const x = await fetch(base + '/api/orders/LT-' + String(i).padStart(12, '0')); if (x.status === 429) limited++; }
  ok(limited > 0, 'order lookup is rate limited (' + limited + ' blocked)');
  // admin pages need login
  for (const u of ['/admin', '/admin/settings', '/admin/integrations/telr', '/admin/shipping/AE', '/api/admin/backup', '/api/admin/analytics']) { const x = await fetch(base + u, { redirect: 'manual' }); ok(x.status === 401 || x.status === 307 || x.status === 302 || x.status === 303, `${u} needs login (${x.status})`); }
  // forged cross-site POST rejected
  const f = await fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify(body) }); ok(f.status === 403, 'cross-site checkout POST rejected');
  // uploads can not escape the folder
  for (const u of ['/uploads/..%2f..%2fetc%2fpasswd', '/uploads/x.svg', '/uploads/../../package.json']) { const x = await fetch(base + u); ok(x.status === 404, `${u} -> 404`); }
  // quote endpoint limited
  let q = 0; for (let i = 0; i < 130; i++) { const x = await fetch(base + '/api/shipping/rates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ country: 'AE', city: 'Dubai', subtotal: 10 }) }); if (x.status === 429) q++; }
  ok(q > 0, 'shipping rates endpoint is rate limited');
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
