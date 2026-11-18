// Professional-store checks: structured data, delivery info, invoice, return window, order rules, refunds, order search,
// one gateway at a time, two-step sign-in, health check. TEST server only (fresh DB, SEED_SAMPLE=true, PAYMENT_MODE=mock).
// Run: DB_PATH=/path/to/l.db BASE=http://localhost:3100 node tests/e2e/quality.cjs
const { chromium } = require('./_pw.cjs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const w = (sql, ...a) => { const d = new Database(process.env.DB_PATH); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
const q1 = (sql, ...a) => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare(sql).get(...a); } finally { d.close(); } };
const setting = (k) => (q1('SELECT value FROM settings WHERE key = ?', k) || {}).value || '';
const A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32 = (t) => { let bits = 0, v = 0; const out = []; for (const ch of t) { v = (v << 5) | A32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret, step) => { const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(step)); const h = crypto.createHmac('sha1', b32(secret)).update(m).digest(); const o = h[h.length - 1] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0'); };
const now = () => Math.floor(Date.now() / 30000);

(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  // ---- health check
  let r = await fetch(base + '/api/health'); let j = await r.json();
  ok(r.status === 200 && j.ok === true && Object.keys(j).length === 1, 'health check answers ok and nothing else');

  // ---- headers, cookies, cross-site reading
  r = await fetch(base + '/en', { headers: { origin: 'https://evil.example' } }); const h = r.headers;
  ok(!h.get('access-control-allow-origin'), 'pages do not allow other sites to read them (no CORS header)');
  r = await fetch(base + '/api/products', { headers: { origin: 'https://evil.example' } });
  ok(!r.headers.get('access-control-allow-origin') && !r.headers.get('access-control-allow-credentials'), 'the API does not allow other sites to read it');
  const csp = h.get('content-security-policy') || '';
  ok(/default-src 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp) && /form-action 'self'/.test(csp), 'content security policy is sent and forbids framing, plugins and foreign form targets');
  ok(h.get('x-content-type-options') === 'nosniff' && /DENY|SAMEORIGIN/i.test(h.get('x-frame-options') || '') && !!h.get('referrer-policy') && !h.get('x-powered-by'), 'nosniff, frame protection and referrer policy are sent; the server does not advertise its software');
  r = await fetch(base + '/api/account/register', { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ name: 'Cookie Test', email: 'cookie@example.com', password: 'Str0ng-Passw0rd!', phone: '+971501234567' }) });
  const ck = (r.headers.get('set-cookie') || '').toLowerCase();
  ok(r.status < 300 && /httponly/.test(ck) && /samesite=(lax|strict)/.test(ck) && /secure/.test(ck) && /path=\//.test(ck), 'the session cookie is HttpOnly, Secure and SameSite');
  ok(!/str0ng|password/.test(ck) && !/cookie@example/.test(ck), 'the session cookie carries no personal data');

  // ---- product page: structured data + delivery / returns / payment box
  const p = q1("SELECT p.id, p.slug, p.price_minor pm, v.id vid, v.stock FROM products p JOIN variants v ON v.product_id = p.id WHERE p.status = 'active' AND p.price_minor > 0 AND v.stock > 3 LIMIT 1");
  let html = await (await fetch(`${base}/en/shop/${p.slug}`)).text();
  ok(!html.includes('application/ld+json'), 'a sample product carries no search-engine product data');
  w('UPDATE products SET is_sample = 0 WHERE id = ?', p.id); w("UPDATE shipping_zones SET price_minor = 2500, free_over_minor = 30000, min_days = 1, max_days = 3 WHERE country = 'AE'");
  html = await (await fetch(`${base}/en/shop/${p.slug}`)).text();
  const m = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s); let ld = null; try { ld = JSON.parse(m[1]); } catch { /* stays null */ }
  ok(ld && ld['@type'] === 'Product' && ld.offers.priceCurrency === 'AED' && ld.offers.price === (p.pm / 100).toFixed(2) && ld.offers.availability.endsWith('/InStock'), 'product data for search engines has the same price, currency and availability as the page');
  ok(ld && ld.offers.shippingDetails.shippingRate.value === '25.00' && ld.offers.hasMerchantReturnPolicy.merchantReturnDays === 14 && ld.offers.url.endsWith(`/en/shop/${p.slug}`), '...and the delivery price and the 14-day return period ' + JSON.stringify(ld && [ld.offers.shippingDetails, ld.offers.hasMerchantReturnPolicy, ld.offers.url]).slice(0, 400));
  ok(/Delivery in the UAE/.test(html) && /1–3 working days/.test(html) && /Returns within 14 days/.test(html) && /never store your card/.test(html), 'the product page shows delivery cost and time, the return period and the payment note before buying');
  ok(/property="og:image"/.test(html) || !/\/uploads\//.test(html), 'the product page has a share image when the product has a photo');
  w('UPDATE variants SET stock = 0 WHERE id = ?', p.vid);
  html = await (await fetch(`${base}/en/shop/${p.slug}`)).text();
  ok(/OutOfStock/.test((html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s) || [])[1] || ''), 'when stock runs out the product data says out of stock');
  w('UPDATE variants SET stock = ? WHERE id = ?', p.stock, p.vid);

  // ---- cart: free-shipping hint
  const ctx = await b.newContext({ locale: 'en-AE', viewport: { width: 1280, height: 900 } }); const pg = await ctx.newPage();
  await pg.goto(`${base}/en/shop/${p.slug}`); await pg.getByRole('button', { name: /add to cart/i }).first().click(); await pg.waitForSelector('[role=dialog]');
  await pg.goto(`${base}/en/cart`); const hint = await pg.waitForFunction(() => /more for free shipping in the UAE/.test(document.body.innerText), null, { timeout: 8000 }).then(() => true).catch(() => false);
  ok(hint, 'the cart says how much is missing for free shipping');

  // ---- customer: invoice + return window
  const reg = async (email) => { const c = await b.newContext(); const x = await c.newPage(); await x.goto(base + '/en'); const s = await x.evaluate(async (e) => (await fetch('/api/account/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Quality Test', email: e, password: 'Str0ng-Passw0rd!', phone: '+971501234567' }) })).status, email); return { c, x, s }; };
  const A = await reg('qa1@example.com'); const B = await reg('qa2@example.com');
  const buy = (x, key) => x.evaluate(async ([vid, k]) => { const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ variantId: vid, quantity: 1 }], contact: { email: 'qa1@example.com', phone: '+971501234567' }, address: { name: 'Quality Test', phone: '+971501234567', line1: 'Street 1 Building 2', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: k, locale: 'en' }) }); return (await r.json()).orderId; }, [p.vid, key]);
  const o1 = await buy(A.x, 'quality-key-0001'); const o2 = await buy(A.x, 'quality-key-0002'); const o3 = await buy(A.x, 'quality-key-0003');
  ok(A.s < 300 && !!o1 && !!o2 && !!o3, 'customer account and three paid orders created');
  let res = await A.x.goto(`${base}/en/account/orders/${o1}/invoice`); let body = await A.x.locator('body').innerText();
  const t1 = q1('SELECT total_minor t FROM orders WHERE id = ?', o1).t;
  ok(res.status() === 200 && body.includes(o1) && body.includes((t1 / 100).toFixed(2)) && /Invoice/.test(body) && /Paid/.test(body), 'the customer can open a printable invoice with the order number and the exact total');
  ok((await A.x.locator('meta[name=robots]').getAttribute('content') || '').includes('noindex'), 'the invoice page is not indexed');
  res = await B.x.goto(`${base}/en/account/orders/${o1}/invoice`); ok(res.status() === 404, 'another customer can not open that invoice');
  const guest = await fetch(`${base}/en/account/orders/${o1}/invoice`, { redirect: 'manual' });
  ok(guest.status >= 300 && guest.status < 400 && (guest.headers.get('location') || '').includes('/account/login'), 'a visitor is sent to the login page instead of the invoice');
  const ret = (x, id) => x.evaluate(async (i) => { const r = await fetch('/api/account/returns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: i, reason: 'damaged', details: '' }) }); return [r.status, (await r.json()).error || '']; }, id);
  w("UPDATE orders SET status = 'delivered', delivered_at = datetime('now','-15 days') WHERE id = ?", o1);
  w("UPDATE orders SET status = 'delivered', delivered_at = datetime('now','-13 days') WHERE id = ?", o2);
  let rr = await ret(A.x, o1); ok(rr[0] === 409 && rr[1] === 'window', 'a return 15 days after delivery is refused (the policy says 14)');
  rr = await ret(A.x, o2); ok(rr[0] === 200, 'a return 13 days after delivery is accepted');
  await A.x.goto(`${base}/en/account/orders`); await A.x.waitForSelector('text=' + o1);
  const li = A.x.locator('li', { hasText: o1 }); await li.getByRole('button', { name: /Request a return/ }).click(); await li.getByRole('button', { name: /Send request/ }).click();
  ok(await li.getByText(/return period for this order has ended/).waitFor({ timeout: 6000 }).then(() => true).catch(() => false), 'the customer is told the return period ended (not "request received")');
  ok(await A.x.locator('li', { hasText: o3 }).getByRole('link', { name: 'Invoice' }).count() === 1, 'each order in the account has an invoice link');

  // ---- admin: search, status rules, refund, invoice
  const actx = await b.newContext({ locale: 'ar-AE' }); const a = await actx.newPage();
  // a form button: wait until the server has answered the POST and the page has settled (never race the redirect)
  const submit = async (loc) => { const done = a.waitForResponse((r) => r.request().method() === 'POST', { timeout: 20000 }).catch(() => {}); await loc.click(); await done; await a.waitForLoadState('networkidle'); await a.waitForTimeout(200); };
  const login = async (code) => { await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); if (code !== undefined) await a.fill('#code', code); await submit(a.locator('main button:not([type=button])')); return /\/admin$/.test(a.url()); };
  ok(await login(), 'owner signs in (two-step is off by default: no code needed)');
  await a.goto(base + '/admin/orders?q=qa1%40example.com'); let rows = await a.locator('tbody tr').count();
  ok(rows === 3, `order search by e-mail finds exactly that customer's orders (${rows})`);
  await a.goto(base + '/admin/orders?q=' + o3.slice(-6)); ok(await a.locator('tbody tr').count() === 1, 'order search by part of the order number works');
  await a.goto(base + '/admin/orders?view=toship'); ok(await a.locator('tbody tr', { hasText: o3 }).count() === 1 && await a.locator('tbody tr', { hasText: o1 }).count() === 0, 'the "paid, waiting to ship" list shows only orders that still need shipping');
  const setStatus = async (id, st) => { await a.goto(`${base}/admin/orders/${id}`); await a.selectOption('#status', st); await submit(a.locator('form:has(#status) button')); return a.url(); };
  let u = await setStatus(o1, 'new'); ok(/error=/.test(u) && q1('SELECT status s FROM orders WHERE id = ?', o1).s === 'delivered', 'a delivered order can not be moved back to "new"');
  const stockBefore = q1('SELECT stock FROM variants WHERE id = ?', p.vid).stock;
  u = await setStatus(o1, 'cancelled'); ok(/error=/.test(u) && q1('SELECT stock FROM variants WHERE id = ?', p.vid).stock === stockBefore, 'a delivered order can not be cancelled, and stock is not touched');
  u = await setStatus(o3, 'processing'); ok(/saved=1/.test(u) && q1('SELECT status s FROM orders WHERE id = ?', o3).s === 'processing', 'moving an order forward works');
  ok(!!q1("SELECT 1 x FROM admin_log WHERE detail LIKE ? AND detail LIKE '%processing%'", '%' + o3 + '%'), 'the activity log says who changed which order to which status');
  const refund = async (id, amt) => { await a.goto(`${base}/admin/orders/${id}`); await a.evaluate(() => { const i = document.querySelector('#refund_amount'); if (i) i.removeAttribute('max'); }); await a.fill('#refund_amount', String(amt)); await submit(a.locator('form:has(#refund_amount) button')); return a.url(); };
  const t3 = q1('SELECT total_minor t FROM orders WHERE id = ?', o3).t;
  u = await refund(o3, (t3 / 100 + 1).toFixed(2)); ok(/error=/.test(u) && q1('SELECT refund_minor r FROM orders WHERE id = ?', o3).r === 0, 'a refund larger than what was paid is refused');
  u = await refund(o3, '10'); ok(/saved=1/.test(u) && q1('SELECT refund_minor r, payment_status ps FROM orders WHERE id = ?', o3).r === 1000, 'a partial refund of 10.00 is recorded');
  u = await refund(o3, '10'); ok(/error=/.test(u) && q1('SELECT refund_minor r FROM orders WHERE id = ?', o3).r === 1000, 'the same refund entered again straight away is refused (double click)');
  ok(!!q1("SELECT 1 x FROM admin_log WHERE action LIKE '%استرداد%' AND detail LIKE ?", '%' + o3 + '%'), 'the refund is written to the activity log');
  res = await a.goto(`${base}/admin/orders/${o3}/invoice`); body = await a.locator('article').innerText();
  ok(res.status() === 200 && body.includes(o3) && /10[.,٫]00|١٠[٫.]٠٠/.test(body) && /المسترد/.test(body), 'the owner invoice shows the order and the refunded amount');
  const gi = await fetch(`${base}/admin/orders/${o3}/invoice`, { redirect: 'manual' }); ok(gi.status >= 300 && gi.status < 400, 'the owner invoice needs an admin session');

  // ---- operations pages: daily reconciliation and the error log (owner only)
  for (const pg of ['reconciliation', 'errors']) {
    const g = await fetch(`${base}/admin/${pg}`, { redirect: 'manual' }); res = await a.goto(`${base}/admin/${pg}`);
    ok(g.status >= 300 && g.status < 400 && res.status() === 200 && await a.locator('main h1').count() === 1, `the ${pg} page opens for the owner and sends a visitor to the login page`);
  }
  // ---- no page of the admin panel shows raw text codes (like \\u0628) instead of Arabic words
  const rawCodes = [];
  for (const pg of ['', 'orders', 'products', 'customers', 'coupons', 'returns', 'feedback', 'notifications', 'settings', 'shipping', 'backup', 'account', 'integrations', 'integrations/telr', 'integrations/paymennt', 'integrations/ziina', 'integrations/aramex', 'integrations/quiqup', 'integrations/sender', 'reconciliation', 'errors', 'speed', 'analytics']) {
    const rr = await a.goto(`${base}/admin/${pg}`); if (!rr || rr.status() !== 200) continue;
    if (/\\u[0-9A-Fa-f]{4}/.test(await a.locator('body').innerText())) rawCodes.push(pg || 'home');
  }
  ok(rawCodes.length === 0, `no admin page shows raw text codes instead of words (${rawCodes.join(', ') || 'none'})`);
  // ---- one gateway at a time, only with saved keys
  await a.goto(base + '/admin/integrations/ziina'); await a.check('input[name=enabled]'); await a.locator('main form').first().locator('button:not([type=button])').click(); await a.waitForURL(/[?&](error|saved)=/, { timeout: 15000 }).catch(() => {});
  ok(/error=/.test(a.url()) && setting('pay_ziina_enabled') !== '1', 'a gateway can not be switched on before its keys are saved');
  await a.goto(base + '/admin/integrations/telr'); await a.fill('#store', '12345'); await a.fill('#key', 'TELR-KEY-1'); await a.check('input[name=enabled]'); await a.locator('main form').first().locator('button:not([type=button])').click(); await a.waitForURL(/saved=1/);
  await a.goto(base + '/admin/integrations/paymennt'); await a.fill('#key', 'PM-K'); await a.fill('#secret', 'PM-S'); await a.check('input[name=enabled]'); await a.locator('main form').first().locator('button:not([type=button])').click(); await a.waitForURL(/saved=1/);
  ok(setting('pay_paymennt_enabled') === '1' && setting('pay_telr_enabled') === '0' && setting('pay_ziina_enabled') !== '1', 'switching one gateway on switches the others off (one at a time)');

  // ---- two-step sign-in
  await a.goto(base + '/admin/account?setup=1'); ok(await a.locator('b.break-all').count() === 0, 'opening the set-up address alone creates nothing'); await a.goto(base + '/admin/account'); await a.locator('form:has(button:has-text("ابدئي الإعداد")) button').click(); await a.waitForURL(/setup=1/); const secret = (await a.locator('b.break-all').innerText()).trim(); const backups = await a.locator('ul code').allInnerTexts();
  ok(/^[A-Z2-7]{32}$/.test(secret) && backups.length === 8 && await a.locator('[role=img] svg').count() === 1, 'two-step set-up shows a QR code, a manual key and 8 backup codes');
  const stored = q1("SELECT totp_secret s, totp_backup b, totp_enabled e FROM admins WHERE email = 'owner@example.com'");
  ok(stored.s.startsWith('enc:') && !stored.s.includes(secret) && !backups.some((c) => stored.b.includes(c)) && stored.e === 0, 'the key is stored encrypted and the backup codes only as hashes; nothing is active yet');
  await a.fill('#mfa_code', '000000'); await submit(a.locator('form:has(#mfa_code) button'));
  ok(q1("SELECT totp_enabled e FROM admins WHERE email = 'owner@example.com'").e === 0, 'a wrong code does not switch two-step on');
  const secret2 = (await a.locator('b.break-all').innerText()).trim(); const backups2 = await a.locator('ul code').allInnerTexts();
  ok(secret2 === secret && backups2.join() === backups.join(), 'after a wrong code the same key stays on screen (no need to scan again)');
  await a.fill('#mfa_code', totp(secret2, now())); await a.locator('form:has(#mfa_code) button').click(); await a.waitForURL(/mfa=on/);
  ok(q1("SELECT totp_enabled e FROM admins WHERE email = 'owner@example.com'").e === 1, 'the right code from the app switches two-step on');
  await actx.clearCookies();
  ok(!(await login()), 'after that, the password alone is not enough to sign in');
  ok(!(await login('123456')), 'a wrong code is refused');
  // (the sign-in page allows 6 tries per 15 minutes, so the steps below are kept to that; "same code twice" is covered by the unit tests)
  ok(await login(backups2[0]), 'a backup code signs in when the phone is not available');
  ok(q1("SELECT COUNT(*) n FROM notifications WHERE kind = 'security' AND title LIKE '%رمز احتياطي%'").n === 1, 'using a backup code alerts the owner');
  await actx.clearCookies(); ok(!(await login(backups2[0])), 'a backup code works only once');
  ok(await login(totp(secret2, Math.max(now(), q1("SELECT totp_last l FROM admins WHERE email = 'owner@example.com'").l + 1))), 'password + a fresh code from the app signs in (the code used at set-up is not accepted again)');
  await a.goto(base + '/admin/account'); ok(/مفعّل ✅/.test(await a.locator('main').innerText()), 'the account page shows two-step as active');
  await a.fill('#mfa_current', 'wrong-password'); await a.fill('#mfa_off_code', '000000'); await submit(a.locator('form:has(#mfa_off_code) button:not([type=button])'));
  ok(q1("SELECT totp_enabled e FROM admins WHERE email = 'owner@example.com'").e === 1, 'switching it off needs the password and a valid code');
  w("UPDATE admins SET totp_last = -1 WHERE email = 'owner@example.com'");
  await a.goto(base + '/admin/account'); await a.fill('#mfa_current', 'Str0ng-Passw0rd!'); await a.fill('#mfa_off_code', totp(secret2, now())); await a.locator('form:has(#mfa_off_code) button:not([type=button])').click(); await a.waitForURL(/mfa=off/);
  const off = q1("SELECT totp_enabled e, totp_secret s FROM admins WHERE email = 'owner@example.com'");
  ok(off.e === 0 && off.s === null, 'with password + code it is switched off and the key is erased');
  ok(q1("SELECT COUNT(*) n FROM admin_log WHERE action LIKE '%التحقق بخطوتين%'").n === 2, 'switching two-step on and off is written to the activity log');

  // ---- repeated wrong sign-ins alert the owner
  await actx.clearCookies();
  for (let i = 0; i < 8; i++) { await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'wrong-' + i); await submit(a.locator('main button:not([type=button])')); }
  ok(q1("SELECT COUNT(*) n FROM notifications WHERE kind = 'security' AND title LIKE '%محاولات دخول%'").n === 1, 'repeated wrong sign-ins are stopped and the owner gets one alert');
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
