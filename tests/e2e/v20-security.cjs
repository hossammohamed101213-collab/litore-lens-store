// Security hardening checks. Fresh DB + SEED_SAMPLE, PAYMENT_MODE=mock
const base = process.env.BASE || 'http://localhost:3100'; let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const r = await fetch(base + '/ar'); const h = r.headers;
  ok(/max-age=\d{7,}/.test(h.get('strict-transport-security') || ''), 'HSTS header present');
  ok(/frame-ancestors 'none'/.test(h.get('content-security-policy') || ''), 'CSP frame-ancestors none');
  ok(h.get('x-frame-options') === 'DENY' && h.get('x-content-type-options') === 'nosniff', 'framing + sniffing blocked');
  ok(!h.get('x-powered-by'), 'no x-powered-by');
  // product + checkout to get a real order id
  const D = require('better-sqlite3'); const dbc = new D(process.env.DB_PATH, { readonly: true }); const v = dbc.prepare('SELECT id FROM variants WHERE stock > 0 LIMIT 1').get().id; dbc.close();
  const body = { lines: [{ variantId: v, quantity: 1 }], contact: { email: 'sec@example.com', phone: '+971501234567' }, address: { name: 'Sec Test', phone: '+971501234567', line1: 'Street 1 Building 2', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: 'sec-key-0001', locale: 'en' };
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
  // the admin panel tells a visitor nothing: every admin address, opened without a session, answers with a bare redirect
  { const fs = require('fs'), path = require('path'); const root = path.join(__dirname, '..', '..', 'src', 'app', 'admin'); const pages = [];
    const walk = (d, r) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(d, e.name), /^\(.*\)$/.test(e.name) ? r : r + '/' + e.name); else if (e.name === 'page.tsx') pages.push(r || '/'); } };
    walk(root, ''); const urls = pages.filter((x) => x !== '/login').map((x) => '/admin' + (x === '/' ? '' : x).replace(/\[id\]/g, j.orderId).replace(/\[[^\]]+\]/g, 'stripe')).concat(['/admin/orders/print?id=' + j.orderId, '/admin/orders?q=sec', '/admin/does-not-exist']);
    const secrets = ['Sec Test', '501234567', 'sec@example.com', 'Street 1 Building 2', j.orderId]; const bad = [];
    const probe = async (u, headers) => { const x = await fetch(base + u, { redirect: 'manual', headers }); const b = await x.text(); const hit = secrets.filter((t) => b.includes(t)); const act = headers && headers['next-action']; const sent = act ? x.status === 303 && /^\/admin\/login/.test(x.headers.get('x-action-redirect') || '') : x.status === 307 && /\/admin\/login$/.test(x.headers.get('location') || ''); if (!sent || b.length > 200 || hit.length) bad.push(u + ' -> ' + x.status + ' ' + b.length + 'b ' + hit.length + ' leaked'); };
    for (const u of urls) await probe(u, {});
    ok(urls.length >= 38 && bad.length === 0, 'every admin page (' + urls.length + ' addresses) answers a visitor with an empty redirect to the sign-in page: no order, name, phone, e-mail or address in the answer' + (bad.length ? ' | ' + bad.slice(0, 4).join(' ; ') : ''));
    const n0 = bad.length; for (const u of ['/admin/orders', '/admin/orders/' + j.orderId, '/admin/customers']) { await probe(u, { cookie: 'litore_admin=' + 'A'.repeat(43) }); await probe(u, { cookie: 'litore_session=' + 'A'.repeat(43) }); await probe(u, { 'next-action': '0'.repeat(40), rsc: '1' }); }
    ok(bad.length === n0, 'a made-up admin cookie, a customer cookie or a raw app request opens nothing either' + (bad.length > n0 ? ' | ' + bad.slice(n0, n0 + 3).join(' ; ') : ''));
    const lg = await fetch(base + '/admin/login'); ok(lg.status === 200 && /type="password"/.test(await lg.text()), 'the sign-in page itself still opens');
    for (const u of ['/api/admin/notifications', '/api/admin/analytics', '/api/admin/backup', '/api/admin/orders/' + j.orderId + '/label']) { const x = await fetch(base + u); const b = await x.text(); if (x.status < 400 || secrets.some((t) => b.includes(t))) bad.push(u + ' -> ' + x.status); }
    ok(bad.length === n0, 'admin data addresses refuse a visitor' + (bad.length > n0 ? ' | ' + bad.slice(n0).join(' ; ') : ''));
    const inv = await fetch(base + '/en/account/orders/' + j.orderId + '/invoice', { redirect: 'manual' }); const ib = await inv.text(); const ord = await (await fetch(base + '/en/order/' + j.orderId)).text();
    ok(!secrets.slice(0, 4).some((t) => ib.includes(t)) && !secrets.slice(0, 4).some((t) => ord.includes(t)), 'the invoice and the public order page give a visitor no name, phone, e-mail or street'); }
  // quote endpoint limited
  let q = 0; for (let i = 0; i < 130; i++) { const x = await fetch(base + '/api/shipping/rates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ country: 'AE', city: 'Dubai', subtotal: 10 }) }); if (x.status === 429) q++; }
  ok(q > 0, 'shipping rates endpoint is rate limited');
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
