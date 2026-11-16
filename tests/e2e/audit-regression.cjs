// Pre-launch audit checks through the real HTTP API (no browser needed).
// Server: fresh DB, SEED_SAMPLE=true, PAYMENT_MODE=mock.  Run: DB_PATH=/path/to/l.db BASE=http://localhost:3100 node tests/e2e/audit-regression.cjs
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const J = { 'content-type': 'application/json' };
const ro = () => new Database(process.env.DB_PATH, { readonly: true });
const q1 = (sql, ...a) => { const d = ro(); try { return d.prepare(sql).get(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new Database(process.env.DB_PATH); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { ...J, ...headers }, body: JSON.stringify(body) });
const cookieOf = (res) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');

(async () => {
  const v = q1("SELECT v.id vid, p.price_minor price FROM variants v JOIN products p ON p.id = v.product_id WHERE v.stock >= 10 AND p.price_minor > 0 AND p.status = 'active' LIMIT 1");
  const order = (key, extra = {}, lines) => ({
    lines: lines ?? [{ variantId: v.vid, quantity: 1 }], contact: { email: 'audit@example.com', phone: '+971501234567' },
    address: { name: 'Audit Test', phone: '+971501234567', line1: 'Street 1 Building 2', city: 'Dubai', country: 'AE' },
    shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: key, locale: 'en', ...extra,
  });

  // ---- 1. prices come from the server only ----
  let r = await post('/api/checkout', { ...order('audit-tamper-0001', {}, [{ variantId: v.vid, quantity: 2, unitPrice: 0.01, price: 0.01 }]), total: 0.01, subtotal: 0.01, discount: 9999, shipping: -50, tax: -5, currency: 'USD', paymentStatus: 'paid' });
  let j = await r.json();
  let row = q1('SELECT subtotal_minor s, discount_minor d, total_minor t, currency c FROM orders WHERE id = ?', j.orderId);
  ok(r.status === 200 && row && row.s === v.price * 2 && row.d === 0 && row.t >= row.s && row.c === 'AED', `price / discount / currency sent by the browser are ignored (charged ${row && row.t / 100} AED for 2 x ${v.price / 100})`);

  // ---- 2. bad quantities and inputs ----
  for (const [qty, label] of [[0, 'zero'], [-3, 'negative'], [1000, 'huge'], [1.5, 'fractional'], ['2', 'string']]) {
    r = await post('/api/checkout', order('audit-qty-' + label + '-01', {}, [{ variantId: v.vid, quantity: qty }]));
    ok(r.status === 400, `quantity ${label} refused (${r.status})`);
  }
  r = await post('/api/checkout', order('audit-ship-0001', { shippingRateId: 'zone-SA' })); ok(r.status === 422, 'shipping rate of another country refused');
  r = await post('/api/checkout', order('audit-ctry-0001', { address: { ...order('x').address, country: 'US' } })); ok(r.status === 400, 'unsupported country refused');
  r = await post('/api/checkout', order('audit-addr-0001', { address: { ...order('x').address, line1: '' } })); ok(r.status === 400, 'missing address line refused');
  r = await post('/api/checkout', order('audit-pay-0001', { paymentMethod: 'cod' })); ok(r.status === 400, 'cash on delivery refused');
  r = await fetch(base + '/api/checkout', { method: 'POST', headers: J, body: '{not json' }); ok(r.status === 400, 'broken JSON -> 400, no crash');
  const errText = await r.text(); ok(!/at .*\.(js|ts):\d+|node_modules|SQLITE/i.test(errText), 'error answer shows no stack trace / internals');

  // ---- 3. idempotency: the same key never makes a second order ----
  const s0 = q1('SELECT stock FROM variants WHERE id = ?', v.vid).stock;
  const same = await Promise.all([1, 2, 3, 4, 5].map(() => post('/api/checkout', order('audit-idem-00001')).then((x) => x.json())));
  const ids = new Set(same.map((x) => x.orderId));
  ok(ids.size === 1 && q1("SELECT COUNT(*) n FROM orders WHERE idempotency_key = 'audit-idem-00001'").n === 1, '5 parallel submits with one key -> one order');
  ok(q1('SELECT stock FROM variants WHERE id = ?', v.vid).stock === s0 - 1, 'stock taken once only');

  // ---- 4. two customers, last piece ----
  const last = q1("SELECT v.id vid FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id != ? AND p.price_minor > 0 AND p.status = 'active' LIMIT 1", v.vid).vid;
  w('UPDATE variants SET stock = 1 WHERE id = ?', last);
  const race = await Promise.all(Array.from({ length: 8 }, (_, i) => post('/api/checkout', order('audit-race-000' + i, {}, [{ variantId: last, quantity: 1 }]))));
  const won = race.filter((x) => x.status === 200).length;
  ok(won === 1 && race.every((x) => x.status === 200 || x.status === 409), `8 buyers, 1 piece -> exactly one order (${won} succeeded, others 409)`);
  ok(q1('SELECT stock FROM variants WHERE id = ?', last).stock === 0, 'stock is 0, never negative');

  // ---- 5. one-time coupon ----
  w("INSERT OR REPLACE INTO coupons(code,kind,value,min_subtotal_minor,active,max_uses,used_count) VALUES ('AUDIT1','percent',50,0,1,1,0)");
  const cp = await Promise.all([0, 1, 2, 3].map((i) => post('/api/checkout', order('audit-coup-000' + i, { couponCode: 'AUDIT1' })).then(async (x) => ({ s: x.status, j: await x.json() }))));
  const discounted = cp.filter((x) => x.s === 200).map((x) => q1('SELECT discount_minor d FROM orders WHERE id = ?', x.j.orderId).d).filter((d) => d > 0).length;
  ok(discounted === 1 && q1("SELECT used_count u FROM coupons WHERE code = 'AUDIT1'").u === 1, `one-time coupon gave a discount exactly once in 4 parallel orders (${discounted})`);
  const qz = await (await post('/api/checkout/quote', { lines: [{ variantId: v.vid, quantity: 1 }], country: 'AE', couponCode: 'AUDIT1' })).json();
  ok(qz.couponValid === false && qz.totals.discount === 0, 'used-up coupon no longer shows a discount in the quote');

  // ---- 6. accounts: nobody can touch another customer's data ----
  const reg = async (email) => { const x = await post('/api/account/register', { name: 'Audit User', email, password: 'Passw0rd-audit-1', ref_balance: 100, id: 'hacked', is_admin: true }); return { status: x.status, cookie: cookieOf(x), body: await x.json() }; };
  const A = await reg('audit-a@example.com'); const B = await reg('audit-b@example.com');
  ok(A.status === 200 && B.status === 200 && A.body.user.id !== 'hacked', 'two customers registered (extra fields ignored)');
  ok(q1("SELECT ref_balance b FROM customers WHERE email = 'audit-a@example.com'").b === 0, 'reward balance can not be set from the sign-up form');
  ok(/HttpOnly/i.test((await post('/api/account/login', { email: 'audit-a@example.com', password: 'Passw0rd-audit-1' })).headers.getSetCookie().join(';')), 'session cookie is HttpOnly');
  const ad = await (await post('/api/account/addresses', { label: 'home', name: 'Audit A', phone: '+971501234567', line1: 'Private street 9', city: 'Dubai', country: 'AE' }, { cookie: A.cookie })).json();
  await fetch(base + '/api/account/addresses?id=' + ad.address.id, { method: 'DELETE', headers: { cookie: B.cookie } });
  ok(!!q1('SELECT 1 x FROM addresses WHERE id = ?', ad.address.id), "customer B can not delete customer A's address");
  const oa = await (await post('/api/checkout', order('audit-own-00001'), { cookie: A.cookie })).json();
  w("UPDATE orders SET status = 'delivered' WHERE id = ?", oa.orderId);
  r = await post('/api/account/returns', { orderId: oa.orderId, reason: 'other', details: 'not mine' }, { cookie: B.cookie });
  ok(r.status === 404, "customer B can not open a return on customer A's order");
  const bo = await (await fetch(base + '/api/account/orders', { headers: { cookie: B.cookie } })).json();
  const ao = await (await fetch(base + '/api/account/orders', { headers: { cookie: A.cookie } })).json();
  ok(bo.orders.length === 0 && ao.orders.some((o) => o.id === oa.orderId), 'each customer sees only her own orders');
  const meB = await (await fetch(base + '/api/account/me', { headers: { cookie: B.cookie } })).json();
  ok(!JSON.stringify(meB).includes('Private street 9'), "customer B's profile shows none of A's addresses");
  for (const u of ['/api/account/orders', '/api/account/returns', '/api/account/referral', '/api/account/sync']) ok((await fetch(base + u)).status === 401, u + ' needs login');
  const pub = JSON.stringify(await (await fetch(base + '/api/orders/' + oa.orderId)).json());
  ok(!/audit@example|501234567|Street 1|Audit Test/.test(pub), 'public order status shows no personal data');

  // ---- 7. password change signs out the other devices ----
  const second = cookieOf(await post('/api/account/login', { email: 'audit-a@example.com', password: 'Passw0rd-audit-1' }));
  r = await post('/api/account/password', { current: 'wrong-password', next: 'New-Passw0rd-2' }, { cookie: A.cookie }); ok(r.status === 403, 'password change needs the current password');
  r = await post('/api/account/password', { current: 'Passw0rd-audit-1', next: 'New-Passw0rd-2' }, { cookie: A.cookie }); ok(r.status === 200, 'password changed');
  ok((await (await fetch(base + '/api/account/me', { headers: { cookie: second } })).json()).user === null, 'the other device is signed out after the password change');
  ok((await (await fetch(base + '/api/account/me', { headers: { cookie: A.cookie } })).json()).user !== null, 'the device that changed it stays signed in');
  ok((await post('/api/account/login', { email: 'audit-a@example.com', password: 'Passw0rd-audit-1' })).status === 401, 'old password no longer works');
  r = await post('/api/account/logout', {}, { cookie: A.cookie });
  ok((await (await fetch(base + '/api/account/me', { headers: { cookie: A.cookie } })).json()).user === null, 'logout really ends the session on the server');

  // ---- 8. login / forgot do not reveal who has an account ----
  const l1 = await post('/api/account/login', { email: 'audit-b@example.com', password: 'bad-password' }); const l2 = await post('/api/account/login', { email: 'nobody-here@example.com', password: 'bad-password' });
  ok(l1.status === 401 && l2.status === 401 && (await l1.text()) === (await l2.text()), 'wrong password and unknown e-mail give the same answer');
  const f1 = await (await post('/api/account/forgot', { identifier: 'audit-b@example.com' })).text(); const f2 = await (await post('/api/account/forgot', { identifier: 'nobody-here@example.com' })).text();
  ok(f1 === f2, 'password-reset request gives the same answer for any e-mail');
  let blocked = 0; for (let i = 0; i < 12; i++) if ((await post('/api/account/login', { email: 'audit-b@example.com', password: 'guess-' + i })).status === 429) blocked++;
  ok(blocked > 0, `password guessing is slowed down (${blocked} of 12 blocked)`);
  ok(q1("SELECT password_hash h FROM customers WHERE email = 'audit-b@example.com'").h.startsWith('scrypt$'), 'passwords are stored hashed (scrypt)');
  ok(/^[a-f0-9]{64}$/.test(q1('SELECT token_hash t FROM sessions LIMIT 1').t), 'only a hash of the session token is stored');

  // ---- 9. forged requests, webhook, redirects, injection ----
  r = await post('/api/account/register', { name: 'Evil', email: 'evil@example.com', password: 'Passw0rd-audit-1' }, { origin: 'https://evil.example' }); ok(r.status === 403, 'cross-site sign-up POST refused');
  r = await post('/api/webhooks/quiqup', { payload: { id: 1, state: 'delivery_complete' } }); ok(r.status === 401, 'unsigned courier webhook refused');
  r = await post('/api/webhooks/quiqup', { payload: { id: 1, state: 'delivery_complete' } }, { 'x-quiqup-signature': 'a'.repeat(64), 'x-quiqup-timestamp': String(Math.floor(Date.now() / 1000)) }); ok(r.status === 401, 'wrongly signed courier webhook refused');
  r = await fetch(base + '/api/payment/telr/return?order=LT-ZZZZ&r=authorised&l=//evil.example', { redirect: 'manual' });
  ok(r.status === 303 && !/evil\.example/.test(r.headers.get('location') || ''), 'payment return can not redirect to another site');
  r = await fetch(base + `/api/payment/telr/return?order=${oa.orderId}&r=authorised&l=en`, { redirect: 'manual' });
  ok(q1('SELECT payment_status p FROM orders WHERE id = ?', oa.orderId).p === 'paid' && /\/order\//.test(r.headers.get('location') || ''), 'opening the "authorised" return link does not change an order');
  const up0 = w("UPDATE orders SET payment_status = 'pending' WHERE id = ?", oa.orderId); void up0;
  await fetch(base + `/api/payment/telr/return?order=${oa.orderId}&r=authorised&l=en`, { redirect: 'manual' });
  ok(q1('SELECT payment_status p FROM orders WHERE id = ?', oa.orderId).p === 'pending', 'a forged "authorised" return link never marks an unpaid order as paid');
  r = await fetch(base + "/en/search?q=" + encodeURIComponent("' OR 1=1 -- <script>alert(1)</script>")); const html = await r.text();
  ok(r.status === 200 && !html.includes('<script>alert(1)</script>'), 'search: SQL characters are harmless and the text is escaped');
  r = await fetch(base + '/api/products?ids=' + encodeURIComponent("x' OR '1'='1")); ok(r.status === 200 && (await r.json()).products.length === 0, 'product lookup: injection attempt returns nothing');
  for (const u of ['/uploads/..%2f..%2fdata%2flitore.db', '/uploads/secret.key', '/data/litore.db', '/.env.production', '/.env', '/.git/config']) { const x = await fetch(base + u, { redirect: 'manual' }); ok(x.status === 404 || x.status === 307 || x.status === 308, `${u} is not served (${x.status})`); }
  r = await fetch(base + '/api/checkout', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
  ok(!r.headers.get('access-control-allow-origin'), 'no CORS permission for other sites');

  // ---- 10. coupon guessing is capped ----
  let lim = 0; for (let i = 0; i < 260; i++) { const x = await post('/api/cart/validate', { lines: [{ variantId: v.vid, quantity: 1 }], coupon: 'GUESS' + i }); if (x.status === 429) lim++; }
  ok(lim > 0, `coupon / cart check is rate limited (${lim} blocked of 260)`);

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
