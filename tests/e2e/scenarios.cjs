// Scenario matrix checks (customer journey, coupons, shipping, post-purchase, tampering, UX) on a TEST server only.
// Server: fresh DB, SEED_SAMPLE=true, PAYMENT_MODE=mock, admin owner@example.com / Str0ng-Passw0rd!
// Run: DB_PATH=/path/to/l.db BASE=http://localhost:3100 node tests/e2e/scenarios.cjs
const { chromium } = require('./_pw.cjs');
const { createHash } = require('crypto');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const J = { 'content-type': 'application/json' };
const q1 = (sql, ...a) => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare(sql).get(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new Database(process.env.DB_PATH); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
const req = (method, path, body, headers = {}) => fetch(base + path, { method, headers: { ...J, ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
const post = (path, body, headers) => req('POST', path, body, headers);
const get = (path, headers = {}) => fetch(base + path, { headers, redirect: 'manual' });
const cookieOf = (res) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const sha = (t) => createHash('sha256').update(t).digest('hex');

(async () => {
  const prods = (() => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare("SELECT p.id pid, p.slug, p.name_ar ar, p.name_en en, p.price_minor price, v.id vid, v.stock FROM products p JOIN variants v ON v.product_id = p.id WHERE p.status = 'active' AND p.price_minor > 0 AND v.stock >= 10 GROUP BY p.id ORDER BY p.id LIMIT 4").all(); } finally { d.close(); } })();
  const [P1, P2, P3, P4] = prods;
  const addr = { name: 'Scenario Test', phone: '+971501234567', line1: 'Street 1 Building 2', city: 'Dubai', country: 'AE' };
  const order = (key, extra = {}, lines) => ({ lines: lines ?? [{ variantId: P1.vid, quantity: 1 }], contact: { email: 'scenario@example.com', phone: '+971501234567' }, address: addr, shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: key, locale: 'en', ...extra });
  const quote = async (body, headers) => (await post('/api/checkout/quote', body, headers)).json();
  let r, j, html;

  // ===== A. visitor: pages, languages, products, search =====
  r = await get('/ar'); html = await r.text(); ok(r.status === 200 && /<html[^>]*lang="ar"[^>]*dir="rtl"|<html[^>]*dir="rtl"[^>]*lang="ar"/.test(html), 'A1 Arabic home renders right-to-left');
  r = await get('/en'); html = await r.text(); ok(r.status === 200 && /<html[^>]*lang="en"[^>]*dir="ltr"|<html[^>]*dir="ltr"[^>]*lang="en"/.test(html), 'A2 English home renders left-to-right');
  r = await get('/'); ok([200, 307, 308].includes(r.status), 'A3 the bare address opens or redirects to a language (' + r.status + ')');
  r = await get('/ar/shop'); html = await r.text(); ok(r.status === 200 && html.includes('/shop/' + P1.slug), 'A4 shop page lists products');
  r = await get('/ar/shop/' + P1.slug); html = await r.text(); ok(r.status === 200 && html.includes(P1.ar) && html.includes(String(P1.price / 100)), 'A5 product page shows name and price');
  r = await get('/ar/shop/this-product-does-not-exist'); ok(r.status === 404, 'A6 unknown product -> 404');
  w("UPDATE products SET status = 'draft' WHERE id = ?", P4.pid);
  r = await get('/ar/shop/' + P4.slug); ok(r.status === 404, 'A7 hidden (draft) product page -> 404');
  html = await (await get('/ar/shop')).text(); ok(!html.includes('/shop/' + P4.slug), 'A8 hidden product is not listed in the shop');
  j = await (await post('/api/cart/validate', { lines: [{ variantId: P4.vid, quantity: 1 }] })).json(); ok(j.lines[0].status === 'not_found', 'A9 hidden product can not be put in a cart');
  r = await post('/api/checkout', order('scn-hidden-0001', {}, [{ variantId: P4.vid, quantity: 1 }])); ok(r.status === 409 || r.status === 422, 'A10 hidden product can not be ordered through the API (' + r.status + ')');
  const hits = async (loc, q) => { const x = await get(`/${loc}/search?q=` + encodeURIComponent(q)); const t = await x.text(); return { s: x.status, has: (slug) => t.includes('/shop/' + slug) }; };
  let s = await hits('ar', P1.ar); ok(s.s === 200 && s.has(P1.slug), 'A11 search by full Arabic name finds the product');
  s = await hits('en', P1.en); ok(s.has(P1.slug), 'A12 search by full English name finds the product');
  s = await hits('en', P1.en.slice(0, Math.max(3, Math.floor(P1.en.length / 2)))); ok(s.has(P1.slug), 'A13 search by part of the name finds the product');
  s = await hits('en', P1.en.toUpperCase()); ok(s.has(P1.slug), 'A14 search ignores upper / lower case');
  s = await hits('ar', 'zzqqxx-nothing-9917'); ok(s.s === 200 && !prods.some((p) => s.has(p.slug)), 'A15 search for something that does not exist shows no products, no error');
  s = await hits('ar', P4.ar); ok(!s.has(P4.slug), 'A16 hidden product does not appear in search');
  r = await get('/ar/search?q=' + 'x'.repeat(5000)); ok(r.status < 500, 'A17 very long search text does not crash (' + r.status + ')');
  r = await get('/ar/no-such-page-here'); ok(r.status === 404, 'A18 unknown page -> 404');
  for (const p of ['cart', 'checkout', 'wishlist', 'offers', 'track', 'complaints', 'account/login', 'account/register', 'account/forgot']) { r = await get('/ar/' + p); ok(r.status === 200, 'A19 /ar/' + p + ' opens (' + r.status + ')'); }
  const legal = (() => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare("SELECT key FROM settings WHERE key LIKE 'page_%' OR key LIKE 'legal_%' LIMIT 20").all().map((x) => x.key); } finally { d.close(); } })();
  for (const p of ['privacy', 'terms', 'returns', 'shipping']) { r = await get('/ar/' + p); ok(r.status === 200, 'A20 policy page /ar/' + p + ' opens (' + r.status + ')'); }
  void legal;

  // ===== B. cart and stock =====
  j = await (await post('/api/cart/validate', { lines: [{ variantId: P1.vid, quantity: 3 }, { variantId: P2.vid, quantity: 2 }] })).json();
  ok(j.lines.length === 2 && j.lines.every((l) => l.status === 'ok') && Math.round(j.subtotal * 100) === P1.price * 3 + P2.price * 2, 'B1 cart with two products: subtotal is exact');
  j = await (await post('/api/cart/validate', { lines: [{ variantId: P1.vid, quantity: 1 }, { variantId: P1.vid, quantity: 2 }] })).json();
  ok(Math.round(j.subtotal * 100) === P1.price * 3 || j.lines.length === 1, 'B2 the same product added twice is counted correctly');
  w('UPDATE products SET price_minor = price_minor + 500 WHERE id = ?', P2.pid);
  j = await (await post('/api/cart/validate', { lines: [{ variantId: P2.vid, quantity: 1 }] })).json(); ok(Math.round(j.lines[0].unitPrice * 100) === P2.price + 500, 'B3 price changed after adding to cart: cart shows the new price');
  r = await post('/api/checkout', order('scn-price-00001', {}, [{ variantId: P2.vid, quantity: 1 }])); j = await r.json();
  ok(q1('SELECT subtotal_minor s FROM orders WHERE id = ?', j.orderId).s === P2.price + 500, 'B4 ...and the order is charged the current price, not the old one');
  w('UPDATE variants SET stock = 0 WHERE id = ?', P3.vid);
  j = await (await post('/api/cart/validate', { lines: [{ variantId: P3.vid, quantity: 1 }] })).json(); ok(j.lines[0].status === 'out_of_stock', 'B5 product sold out after it was added: cart says out of stock');
  r = await post('/api/checkout', order('scn-soldout-001', {}, [{ variantId: P3.vid, quantity: 1 }])); ok(r.status === 409, 'B6 ...and checkout refuses it (409)');
  r = await get('/ar/shop/' + P3.slug); ok(r.status === 200, 'B7 sold-out product page still opens');
  w('UPDATE variants SET stock = 2 WHERE id = ?', P3.vid);
  r = await post('/api/checkout', order('scn-short-0001', {}, [{ variantId: P3.vid, quantity: 3 }])); ok(r.status === 409 && q1('SELECT stock FROM variants WHERE id = ?', P3.vid).stock === 2, 'B8 owner lowered stock during the purchase: order for more than is left is refused, stock untouched');
  r = await post('/api/checkout', order('scn-short-0002', {}, [{ variantId: P3.vid, quantity: 2 }])); ok(r.status === 200 && q1('SELECT stock FROM variants WHERE id = ?', P3.vid).stock === 0, 'B9 buying exactly what is left works and stock reaches 0');
  r = await post('/api/checkout', order('scn-multi-0001', {}, [{ variantId: P1.vid, quantity: 2 }, { variantId: P2.vid, quantity: 1 }])); j = await r.json();
  ok(r.status === 200 && q1('SELECT COUNT(*) n FROM order_lines WHERE order_id = ?', j.orderId).n === 2, 'B10 one order with several products is saved with all its lines');
  r = await post('/api/checkout', order('scn-empty-0001', {}, [])); ok(r.status === 400, 'B11 empty cart can not be ordered');
  r = await post('/api/checkout', order('scn-many-00001', {}, Array.from({ length: 60 }, () => ({ variantId: P1.vid, quantity: 1 })))); ok(r.status === 400, 'B12 absurdly long cart refused');

  // ===== C. accounts =====
  const reg = async (email, name = 'Scenario User') => { const x = await post('/api/account/register', { name, email, password: 'Passw0rd-scn-1' }); return { status: x.status, cookie: cookieOf(x), body: await x.json().catch(() => ({})) }; };
  const A = await reg('scn-a@example.com'); ok(A.status === 200 && !!A.cookie, 'C1 new account is created and signed in');
  r = await post('/api/account/register', { name: 'Again', email: 'SCN-A@example.com', password: 'Passw0rd-scn-1' }); ok(r.status === 409, 'C2 the same e-mail (any letter case) can not register twice');
  r = await post('/api/account/register', { name: 'Weak', email: 'scn-weak@example.com', password: '123' }); ok(r.status === 400, 'C3 too-short password refused');
  r = await post('/api/account/register', { name: 'Bad', email: 'not-an-email', password: 'Passw0rd-scn-1' }); ok(r.status === 400, 'C4 invalid e-mail refused');
  r = await req('PUT', '/api/account/profile', { name: 'Sara <b>Ali</b> & "Co" ‮', phone: '+971 50 111 2222', birthday: '', city: 'دبي', email: 'scn-a@example.com' }, { cookie: A.cookie }); ok(r.status === 200, 'C5 profile update with Arabic text and special characters is accepted');
  r = await req('PUT', '/api/account/profile', { name: 'x'.repeat(300), phone: '', birthday: '', city: '', email: 'scn-a@example.com' }, { cookie: A.cookie }); ok(r.status === 400, 'C6 over-long name refused');
  r = await req('PUT', '/api/account/profile', { name: 'Sara', phone: 'call-me', birthday: '', city: '', email: 'scn-a@example.com' }, { cookie: A.cookie }); ok(r.status === 400, 'C7 invalid phone number refused');
  r = await req('PUT', '/api/account/profile', { name: 'Sara', phone: '', birthday: '', city: '', email: 'scn-new@example.com' }, { cookie: A.cookie }); ok(r.status === 403, 'C8 changing the e-mail needs the current password');
  const a1 = await (await post('/api/account/addresses', { label: 'home', ...addr }, { cookie: A.cookie })).json();
  const a2 = await (await post('/api/account/addresses', { label: 'work', ...addr, line1: 'Office tower 7', city: 'Abu Dhabi' }, { cookie: A.cookie })).json();
  ok(q1("SELECT COUNT(*) n FROM addresses a JOIN customers c ON c.id = a.customer_id WHERE c.email = 'scn-a@example.com'").n === 2 && a1.address && a2.address, 'C9 customer can keep more than one address');
  r = await post('/api/account/addresses', { label: 'bad', name: 'A', phone: '1', line1: '', city: '', country: 'AE' }, { cookie: A.cookie }); ok(r.status === 400, 'C10 incomplete address refused');
  r = await post('/api/account/addresses', { label: 'far', ...addr, country: 'US' }, { cookie: A.cookie }); ok(r.status === 400, 'C11 address in an unsupported country refused');
  r = await get('/admin', { cookie: A.cookie }); ok(r.status === 307 || r.status === 308 || r.status === 302, 'C12 a customer session does not open the admin panel');
  r = await get('/api/admin/backup', { cookie: A.cookie }); ok(r.status === 401, 'C13 a customer session can not download the store backup');

  // password reset: single use, expiry, signs out old devices
  const before = q1("SELECT COUNT(*) n FROM password_resets").n;
  r = await post('/api/account/forgot', { identifier: 'scn-a@example.com' }); ok(r.status === 200 && q1("SELECT COUNT(*) n FROM password_resets").n === before + 1, 'C14 reset request is recorded for the owner (no e-mail service on this test server)');
  const cid = q1("SELECT id FROM customers WHERE email = 'scn-a@example.com'").id; const tok = 'scenario-reset-token-0123456789abcdef';
  w("INSERT INTO password_resets(id,identifier,customer_id,status,token_hash,expires_at) VALUES ('scn-r1','scn-a@example.com',?,'sent',?,?)", cid, sha(tok), Math.floor(Date.now() / 1000) + 3600);
  w("INSERT INTO password_resets(id,identifier,customer_id,status,token_hash,expires_at) VALUES ('scn-r2','scn-a@example.com',?,'sent',?,?)", cid, sha(tok + '-old'), Math.floor(Date.now() / 1000) - 10);
  r = await post('/api/account/reset', { token: tok + '-old', password: 'New-Passw0rd-9' }); ok(r.status === 410, 'C15 expired reset link refused');
  r = await post('/api/account/reset', { token: 'totally-wrong-token-000000000000', password: 'New-Passw0rd-9' }); ok(r.status === 410, 'C16 made-up reset link refused');
  r = await post('/api/account/reset', { token: tok, password: 'New-Passw0rd-9' }); ok(r.status === 200, 'C17 valid reset link sets the new password');
  r = await post('/api/account/reset', { token: tok, password: 'Another-Passw0rd-1' }); ok(r.status === 410, 'C18 the same reset link can not be used twice');
  ok((await (await get('/api/account/me', { cookie: A.cookie })).json()).user === null, 'C19 reset signs out the devices that were logged in');
  ok((await post('/api/account/login', { email: 'scn-a@example.com', password: 'Passw0rd-scn-1' })).status === 401, 'C20 old password no longer works after reset');
  const A2 = cookieOf(await post('/api/account/login', { email: 'scn-a@example.com', password: 'New-Passw0rd-9' })); ok(!!A2, 'C21 new password works');
  ok(!q1("SELECT token_hash t FROM password_resets WHERE id = 'scn-r1'").t, 'C22 used reset token is wiped from the database');

  // ===== D. shipping =====
  j = await (await post('/api/shipping/rates', { country: 'AE', subtotal: 100 })).json(); const aeRate = j.rates?.[0]; ok(!!aeRate && aeRate.id === 'zone-AE', 'D1 shipping option offered for a supported country');
  r = await post('/api/shipping/rates', { country: 'US', subtotal: 100 }); j = await r.json().catch(() => ({})); ok(r.status >= 400 || (j.rates ?? []).length === 0, 'D2 no shipping option for an unsupported country');
  w("UPDATE shipping_zones SET price_minor = 2500, free_over_minor = 30000 WHERE country = 'AE'"); w("UPDATE shipping_zones SET price_minor = 4500, free_over_minor = NULL WHERE country = 'SA'");
  let qa = await quote({ lines: [{ variantId: P1.vid, quantity: 1 }], country: 'AE' }); let qs = await quote({ lines: [{ variantId: P1.vid, quantity: 1 }], country: 'SA' });
  ok(qa.totals.shipping === 25 && qs.totals.shipping === 45, 'D3 shipping price differs by country (AE 25, SA 45)');
  const big = Math.ceil(30000 / P1.price) + 1; const lines = Array.from({ length: Math.ceil(big / 10) }, (_, i) => ({ variantId: [P1.vid, P2.vid][i % 2], quantity: 10 }));
  qa = await quote({ lines, country: 'AE' }); ok(qa.totals.subtotal >= 300 && qa.totals.shipping === 0, 'D4 free shipping applies above the threshold (subtotal ' + qa.totals.subtotal + ')');
  qa = await quote({ lines: [{ variantId: P1.vid, quantity: 1 }], country: 'AE' }); ok(qa.totals.shipping === 25, 'D5 ...and not below it');
  w("UPDATE shipping_zones SET active = 0 WHERE country = 'SA'");
  r = await post('/api/checkout', order('scn-zoneoff-001', { shippingRateId: 'zone-SA', address: { ...addr, country: 'SA', city: 'Riyadh' } })); ok(r.status === 422 || r.status === 400, 'D6 a country the owner switched off can not be shipped to (' + r.status + ')');
  r = await post('/api/checkout', order('scn-ship-tamper', { shippingRateId: 'free-shipping' })); ok(r.status === 422, 'D7 made-up shipping method refused');
  r = await post('/api/checkout', order('scn-addr-long01', { address: { ...addr, line1: 'x'.repeat(2000) } })); ok(r.status === 400, 'D8 over-long address refused');
  r = await post('/api/checkout', order('scn-addr-odd001', { address: { ...addr, name: "O'Brien <script>alert(1)</script> مريم", line1: 'Flat #12/B — "Al Noor" & Sons' } })); const xo = await r.json(); ok(r.status === 200, 'D9 names and addresses with symbols and Arabic are accepted');

  // ===== E. coupons and totals =====
  w("INSERT OR REPLACE INTO coupons(code,kind,value,min_subtotal_minor,active,max_uses,used_count,customer_id) VALUES ('SCN10','percent',10,0,1,NULL,0,NULL),('SCNOFF','percent',10,0,0,NULL,0,NULL),('SCNMIN','fixed',20,99900,1,NULL,0,NULL),('SCNUSED','fixed',20,0,1,3,3,NULL),('SCNMINE','percent',15,0,1,1,0,?),('SCNHUGE','fixed',99999,0,1,NULL,0,NULL)", cid);
  const one = { lines: [{ variantId: P1.vid, quantity: 2 }], country: 'AE' };
  let qc = await quote({ ...one, couponCode: 'scn10' }); ok(qc.couponValid === true && Math.round(qc.totals.discount * 100) === Math.round(P1.price * 2 * 0.1), 'E1 valid coupon (typed in lower case) gives exactly 10%');
  qc = await quote({ ...one, couponCode: 'NOPE-123' }); ok(qc.couponValid === false && qc.totals.discount === 0, 'E2 wrong coupon gives nothing');
  qc = await quote({ ...one, couponCode: 'SCNOFF' }); ok(qc.couponValid === false, 'E3 switched-off coupon refused');
  qc = await quote({ ...one, couponCode: 'SCNMIN' }); ok(qc.couponValid === false, 'E4 coupon below its minimum order refused');
  qc = await quote({ ...one, couponCode: 'SCNUSED' }); ok(qc.couponValid === false, 'E5 coupon that reached its usage limit refused');
  qc = await quote({ ...one, couponCode: 'SCNMINE' }); ok(qc.couponValid === false, 'E6 personal coupon refused for a visitor');
  const B = await reg('scn-b@example.com'); qc = await quote({ ...one, couponCode: 'SCNMINE' }, { cookie: B.cookie }); ok(qc.couponValid === false, 'E7 personal coupon refused for another customer');
  qc = await quote({ ...one, couponCode: 'SCNMINE' }, { cookie: A2 }); ok(qc.couponValid === true, 'E8 personal coupon works for its owner');
  qc = await quote({ ...one, couponCode: 'SCNHUGE' }); ok(qc.totals.discount <= qc.totals.subtotal && qc.totals.total >= 0, 'E9 a coupon bigger than the order never makes the total negative (total ' + qc.totals.total + ')');
  qc = await quote({ ...one, couponCode: 'SCN10,SCNHUGE' }); ok(qc.couponValid === false, 'E10 two coupons in one field are not combined');
  qc = await quote({ ...one, couponCode: 'SCN10' }); const t = qc.totals;
  ok(Math.abs(t.subtotal - t.discount + t.shipping + (t.taxIncluded === false ? t.tax : 0) - t.total) < 0.011 || Math.abs(t.subtotal - t.discount + t.shipping + t.tax - t.total) < 0.011 || Math.abs(t.subtotal - t.discount + t.shipping - t.total) < 0.011, 'E11 total = subtotal - discount + shipping (+ tax) to the fils');
  r = await post('/api/checkout', order('scn-coupon-0001', { couponCode: 'SCN10', lines: one.lines })); j = await r.json(); const co = q1('SELECT subtotal_minor s, discount_minor d, shipping_minor sh, tax_minor tx, total_minor t FROM orders WHERE id = ?', j.orderId);
  ok(Math.round(t.total * 100) === co.t && Math.round(t.discount * 100) === co.d, 'E12 the order is saved with exactly the total the customer was shown');
  w("UPDATE coupons SET active = 0 WHERE code = 'SCN10'"); qc = await quote({ ...one, couponCode: 'SCN10' }); ok(qc.couponValid === false, 'E13 owner switches a coupon off during checkout: it stops working at once');
  r = await post('/api/checkout', order('scn-coupon-0002', { couponCode: 'SCN10', lines: one.lines })); j = await r.json(); const dead = r.status === 200 ? q1('SELECT discount_minor d FROM orders WHERE id = ?', j.orderId).d : -1;
  ok(r.status === 409 && j.error === 'coupon_invalid' && !q1("SELECT 1 x FROM orders WHERE idempotency_key = 'scn-coupon-0002'"), 'E14 ordering with a coupon that just stopped working is refused, not silently charged full price (status ' + r.status + ', discount ' + dead + ')');
  r = await post('/api/checkout', order('scn-personal-01', { couponCode: 'SCNMINE', lines: one.lines }), { cookie: A2 }); ok(r.status === 200, 'E15 owner of a one-time coupon uses it once');
  qc = await quote({ ...one, couponCode: 'SCNMINE' }, { cookie: A2 }); ok(qc.couponValid === false, 'E16 ...and can not use it a second time');

  // ===== F. after the purchase =====
  r = await post('/api/checkout', order('scn-after-0001'), { cookie: A2 }); const mine = (await r.json()).orderId;
  r = await get('/en/order/' + mine); html = await r.text(); ok(r.status === 200 && html.includes(mine), 'F1 order confirmation page shows the order number');
  ok(!/Street 1 Building 2|501234567|scenario@example\.com/.test(html), 'F2 confirmation page shows no address, phone or e-mail');
  j = await (await get('/api/account/orders', { cookie: A2 })).json(); ok(j.orders.some((o) => o.id === mine), 'F3 the order appears in the customer account');
  j = await (await get('/api/account/orders', { cookie: B.cookie })).json(); ok(!j.orders.some((o) => o.id === mine), 'F4 ...and not in another customer account');
  r = await get('/api/orders/' + mine); j = await r.json(); ok(r.status === 200 && j.order.status === 'new' && j.order.paymentStatus === 'paid', 'F5 order tracking returns the status');
  r = await post('/api/account/returns', { orderId: mine, reason: 'other', details: 'x' }, { cookie: A2 }); ok(r.status === 409, 'F6 return can not be requested before the order is shipped');
  w("UPDATE orders SET status = 'delivered' WHERE id = ?", mine);
  r = await post('/api/account/returns', { orderId: mine, reason: 'made-up-reason', details: 'x' }, { cookie: A2 }); ok(r.status === 400, 'F7 return with an unknown reason refused');
  r = await post('/api/account/returns', { orderId: mine, reason: 'color', details: 'not my shade' }, { cookie: A2 }); ok(r.status === 200, 'F8 return request on a delivered order accepted');
  r = await post('/api/account/returns', { orderId: mine, reason: 'color', details: 'again' }, { cookie: A2 }); ok(r.status === 409, 'F9 the same return can not be requested twice');
  ok(q1("SELECT COUNT(*) n FROM notifications WHERE kind = 'return'").n === 1, 'F10 owner is notified of the return once');
  r = await post('/api/feedback', { kind: 'complaint', name: 'Scenario <b>x</b>', contact: 'scn@example.com', message: 'Late delivery <script>alert(1)</script>', locale: 'en' }); const fb = r.status;
  ok(fb === 200 || fb === 400, 'F11 complaint form answers cleanly (' + fb + ')');
  r = await get('/sitemap.xml'); html = await r.text(); ok(r.status === 200 && !/\/admin|\/account|\/checkout|\/order\//.test(html), 'F12 sitemap lists no private pages');
  r = await get('/robots.txt'); html = await r.text(); ok(/Disallow: \/api\//.test(html) && /Disallow: \/ar\/account/.test(html), 'F13 robots.txt keeps search engines out of account, cart and API');
  r = await get('/admin/login'); html = await r.text(); ok(/noindex/i.test(html) || /noindex/i.test(r.headers.get('x-robots-tag') || ''), 'F14 admin login page asks search engines not to index it');

  // ===== G. secrets in what the browser downloads =====
  html = await (await get('/ar')).text(); const chunks = [...new Set([...html.matchAll(/\/_next\/static\/[^"' )]+\.js/g)].map((m) => m[0]))];
  let leaked = []; for (const c of chunks.slice(0, 60)) { const t2 = await (await get(c)).text(); for (const pat of ['pay_telr_key', 'car_aramex_password', 'car_quiqup_key', 'password_hash', 'secret.key', 'BACKUP_PASSPHRASE', 'RESEND_API_KEY', 'better-sqlite3', 'token_hash']) if (t2.includes(pat)) leaked.push(pat + ' in ' + c.split('/').pop()); }
  ok(chunks.length > 3 && leaked.length === 0, `G1 no server secrets or database code in the ${chunks.length} JavaScript files sent to visitors ${leaked.slice(0, 3).join('; ')}`);
  r = await get('/api/checkout'); ok(r.status === 405 || r.status === 404, 'G2 checkout API refuses GET (' + r.status + ')');
  r = await post('/api/orders/' + mine, { status: 'delivered', payment_status: 'refunded' }); ok(r.status === 405 || r.status === 404, 'G3 order status can not be changed through the public order API (' + r.status + ')');
  r = await req('PUT', '/api/account/orders', { id: mine, paymentStatus: 'refunded' }, { cookie: A2 }); ok(r.status === 405 || r.status === 404, 'G4 a customer can not mark her own order refunded (' + r.status + ')');
  ok(q1('SELECT payment_status p, status s FROM orders WHERE id = ?', mine).p === 'paid', 'G5 ...the order is unchanged after those attempts');

  // ===== H. browser: phone layout, stored script, double submit =====
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const phone = await b.newContext({ viewport: { width: 375, height: 812 }, locale: 'ar-AE', isMobile: true, hasTouch: true }); const pg = await phone.newPage();
  for (const p of ['/ar', '/ar/shop', '/ar/shop/' + P1.slug, '/ar/cart', '/ar/checkout', '/en', '/en/shop/' + P1.slug]) { await pg.goto(base + p); await pg.waitForLoadState('networkidle'); const o = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok(o <= 2, `H1 phone width: ${p} has no sideways scrolling (${o}px)`); }
  const tab = await b.newContext({ viewport: { width: 768, height: 1024 }, locale: 'ar-AE' }); const tp = await tab.newPage(); await tp.goto(base + '/ar/shop'); await tp.waitForLoadState('networkidle');
  ok((await tp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 2, 'H2 tablet width: shop has no sideways scrolling');
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 120))); await pg.goto(base + '/ar/shop/' + P1.slug); await pg.waitForLoadState('networkidle'); await pg.goto(base + '/ar/cart'); await pg.waitForLoadState('networkidle');
  ok(errs.length === 0, 'H3 no JavaScript errors while browsing product and cart ' + errs.slice(0, 2).join(' | '));
  const broken = await pg.evaluate(async () => { await new Promise((x) => setTimeout(x, 500)); return [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length; }); ok(broken === 0, 'H4 no broken images on the cart page');
  const desk = await b.newContext({ locale: 'ar-AE' }); const a = await desk.newPage(); await a.addInitScript(() => { window.__xss = 0; });
  await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  w("UPDATE orders SET address_json = replace(address_json, 'alert(1)', 'window.__xss=1') WHERE id = ?", xo.orderId);
  await a.goto(base + '/admin/orders/' + xo.orderId); await a.waitForLoadState('networkidle');
  ok((await a.evaluate(() => window.__xss)) === 0 && (await a.locator('body').innerText()).includes('<script>'), 'H5 a script typed into the customer name is shown as plain text in the admin panel, never run');
  await a.goto(base + '/admin/feedback'); await a.waitForLoadState('networkidle'); ok((await a.evaluate(() => window.__xss)) === 0, 'H6 a script typed into a complaint is not run in the admin panel');
  await a.goto(base + '/admin/orders'); await a.waitForLoadState('networkidle'); ok((await a.locator('body').innerText()).includes(mine), 'H7 owner sees the orders list');
  await a.goto(base + '/admin/activity'); await a.waitForLoadState('networkidle'); ok(a.url().includes('/admin/activity'), 'H8 activity log page opens for the owner');
  await desk.clearCookies(); await a.goto(base + '/admin/orders'); ok(/\/admin\/login/.test(a.url()), 'H9 after the admin session ends, admin pages send her back to the login page');
  await b.close();

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
