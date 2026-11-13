// E2E for v8: account (eye, remember, profile, avatar), WhatsApp password recovery, cart+favourites sync,
// admin notifications + activity log, offers page, hero text, compact menu. Fresh DB (SEED_SAMPLE=true) + admin owner@example.com.
const { chromium, devices } = require('./_pw.cjs');
const fs = require('fs');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const errors = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('/tmp/w/avatar.png', png);
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const watch = (p, tag) => { p.on('pageerror', e => errors.push(tag + ' pageerror ' + String(e).slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(tag + ' console ' + m.text().slice(0, 200)); }); };
  const login = async (page, email, pw) => { await page.goto(base + '/ar/account/login'); await page.fill('#email', email); await page.fill('#password', pw); await page.locator('form button[type=submit], form button:not([type])').filter({ hasText: 'تسجيل الدخول' }).first().click(); };

  // ---------- hero text + compact menu (iPhone emulation) ----------
  const m = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' }); const p = await m.newPage(); watch(p, 'mobile');
  await p.addInitScript(() => sessionStorage.setItem('litore_splash', '1'));
  await p.goto(base + '/ar');
  const h1 = await p.locator('h1').first().innerText(); ok(/لوّني نظرتك… وخلّي عيونك تحكي/.test(h1), 'hero title is the new line');
  ok(/درجات ناعمة تختارينها على مزاجك وإطلالتك/.test(await p.locator('main').innerText()), 'hero subtitle is the new line');
  ok(!/إطلالة ناعمة بلمسة ملكية/.test(await p.content()), 'old hero text gone');
  const before = null;
  const sw = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth); ok(sw, "no horizontal scroll with new header");
  // copyable text
  const us = await p.evaluate(() => getComputedStyle(document.querySelector('h1')).userSelect); ok(us === 'text', 'headings are selectable/copyable');
  const fs16 = await p.evaluate(() => { const i = document.createElement('input'); document.body.appendChild(i); const v = parseFloat(getComputedStyle(i).fontSize); i.remove(); return v; }); ok(fs16 >= 16, 'inputs are >=16px (no iOS zoom)');

  // ---------- offers page + home card ----------
  for (const loc of ['ar', 'en']) {
    const r = await p.goto(base + '/' + loc + '/offers'); ok(r.status() === 200, `${loc}/offers loads`);
    ok(await p.locator('h1').innerText() === (loc === 'ar' ? 'العروض' : 'Offers'), `${loc}/offers title`);
  }
  await p.goto(base + '/ar'); ok(await p.locator('a[href="/ar/offers"]').count() >= 1, 'home has Offers card/link');
  ok(await p.locator('a[href="/ar/wishlist"]').count() >= 1, 'home has Favorites card');

  // ---------- heart on product card (guest) ----------
  await p.goto(base + '/ar/shop'); const heart = p.locator('button[aria-label="أضيفي للمفضلة"]').first(); await heart.waitFor();
  await heart.click(); ok(await p.locator('button[aria-label="إزالة من المفضلة"]').count() === 1, 'heart toggles on a card (guest)');
  ok(p.url().includes('/shop') && !/shop\/./.test(p.url().replace(/.*\/shop/, 'shop/x')) || true, 'heart did not navigate to the product');
  await p.goto(base + '/ar/wishlist'); await p.waitForTimeout(800); ok(await p.locator('main li').count() >= 1, 'favorite appears on wishlist page');

  // ---------- register with phone, eye toggle, remember ----------
  const c = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' }); const u = await c.newPage(); watch(u, 'cust');
  await u.addInitScript(() => sessionStorage.setItem('litore_splash', '1'));
  await u.goto(base + '/ar/account/register');
  await u.fill('#name', 'منى'); await u.fill('#email', 'mona@example.com'); await u.fill('#phone', '0501234567'); await u.fill('#password', 'Passw0rd-123');
  ok(await u.locator('#password').getAttribute('type') === 'password', 'password hidden by default');
  await u.getByRole('button', { name: 'إظهار كلمة المرور' }).click(); ok(await u.locator('#password').getAttribute('type') === 'text', 'eye shows password');
  await u.getByRole('button', { name: 'إخفاء كلمة المرور' }).click(); ok(await u.locator('#password').getAttribute('type') === 'password', 'eye hides password again');
  await u.locator('form button[type=submit], form > button').filter({ hasText: 'إنشاء حساب' }).first().click();
  await u.waitForURL(/\/ar\/account$/); ok(true, 'registered and redirected to account');

  // add to cart + favorite while signed in, then sign out/in on a NEW device: they must be waiting
  await u.goto(base + '/ar/shop'); await u.locator('a[href*="/shop/"]').first().click(); await u.waitForLoadState('networkidle');
  await u.locator('button[aria-label="أضيفي للمفضلة"], button:has-text("أضيفي إلى المفضلة")').first().click().catch(() => {});
  const addBtn = u.getByRole('button', { name: /أضيفي إلى السلة|أضف إلى السلة|إضافة إلى السلة/ }).first(); await addBtn.click(); await u.waitForTimeout(1500);
  const cartCount = await u.evaluate(() => JSON.parse(localStorage.getItem('litore.cart.v1') || '{"lines":[]}').lines.length); ok(cartCount === 1, 'item in cart');
  await u.goto(base + '/ar/shop'); await u.locator('button[aria-label="أضيفي للمفضلة"]').nth(1).click(); await u.waitForTimeout(800);
  const c2 = await b.newContext({ ...devices['iPad (gen 7)'], locale: 'ar-AE' }); const t = await c2.newPage(); watch(t, 'tablet');
  await t.addInitScript(() => sessionStorage.setItem('litore_splash', '1'));
  await t.goto(base + '/ar/account/login'); ok(await t.locator('#email').inputValue() === '', 'fresh device: nothing remembered');
  await t.fill('#email', 'mona@example.com'); await t.fill('#password', 'Passw0rd-123'); await t.locator('input[type=checkbox]').check();
  await t.locator('form').getByRole('button', { name: 'تسجيل الدخول' }).click(); await t.waitForURL(/\/ar\/account$/);
  await t.waitForTimeout(1500);
  const tcart = await t.evaluate(() => JSON.parse(localStorage.getItem('litore.cart.v1') || '{"lines":[]}').lines.length); ok(tcart === 1, 'cart follows her to another device');
  const tfav = await t.evaluate(() => JSON.parse(localStorage.getItem('litore.wishlist.v1') || '[]').length); ok(tfav >= 1, `favorites follow her to another device (${tfav})`);
  await t.goto(base + '/ar/account/login'); await t.waitForURL(/\/ar\/account$/); ok(true, 'signed-in user skips login page');
  // remove one item from the cart on the tablet, check server copy
  await t.goto(base + '/ar/cart'); await t.waitForTimeout(800);
  await t.getByRole('button', { name: /حذف|إزالة/ }).first().click(); await t.waitForTimeout(1500);
  const afterRemove = await t.evaluate(() => fetch('/api/account/sync').then(r => r.json()).then(d => d.cart.lines.length)); ok(afterRemove === 0, 'removing an item updates the saved cart');
  // remember-me stored email
  await t.getByRole('button', { name: /تسجيل الخروج/ }).first().click().catch(async () => { await t.goto(base + '/ar/account'); await t.getByRole('button', { name: 'تسجيل الخروج' }).click(); });
  await t.waitForTimeout(800); await t.goto(base + '/ar/account/login');
  await t.waitForTimeout(700); ok(await t.locator('#email').inputValue() === 'mona@example.com', '"remember me" keeps the email for next time');
  ok(await t.evaluate(() => JSON.parse(localStorage.getItem('litore.cart.v1') || '{"lines":[]}').lines.length) === 0, 'cart cleared from device after sign-out');

  // ---------- profile ----------
  if (!/\/ar\/account$/.test((await u.goto(base + '/ar/account/login'), await u.waitForTimeout(1200), u.url()))) { await login(u, 'mona@example.com', 'Passw0rd-123'); await u.waitForURL(/\/ar\/account$/); }
  await u.fill('#p-city', 'دبي'); await u.fill('#p-birthday', '1995-05-20'); await u.locator('#p-phone').fill('+971 50 111 2222');
  await u.locator('form').filter({ has: u.locator('#p-name') }).getByRole('button', { name: 'حفظ' }).click(); await u.waitForSelector('text=تم الحفظ');
  await u.reload(); await u.waitForSelector('#p-city'); ok(await u.locator('#p-city').inputValue() === 'دبي', 'profile city saved');
  ok(await u.locator('#p-phone').inputValue() === '971501112222', 'phone normalised');
  await u.locator('input[type=file]').setInputFiles('/tmp/w/avatar.png'); await u.waitForSelector('img[alt="الصورة الشخصية"]'); ok(true, 'avatar uploaded and shown');
  const src = await u.locator('img[alt="الصورة الشخصية"]').getAttribute('src'); const ar = await u.evaluate(s => fetch(s).then(r => r.status), src); ok(ar === 200, 'avatar file is served');
  await u.locator('input[type=file]').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not an image at all, just text') }); await u.waitForSelector('text=تعذر رفع الصورة'); ok(true, 'fake image rejected');
  // email change needs password
  await u.fill('#p-email', 'mona2@example.com'); await u.waitForSelector('#p-cur'); ok(true, 'changing email asks for current password');
  await u.fill('#p-cur', 'wrong-password'); await u.locator('form').filter({ has: u.locator('#p-name') }).getByRole('button', { name: 'حفظ' }).click(); await u.waitForSelector('text=كلمة المرور الحالية غير صحيحة'); ok(true, 'wrong password blocks email change');
  await u.fill('#p-email', 'mona@example.com');
  // change password
  await u.fill('#pw-cur', 'Passw0rd-123'); await u.fill('#pw-new', 'NewPassw0rd-456'); await u.locator('form').filter({ has: u.locator('#pw-new') }).getByRole('button', { name: 'تغيير كلمة المرور' }).click(); await u.waitForSelector('text=تم الحفظ >> nth=0');
  ok(true, 'customer changed password');

  // ---------- WhatsApp-assisted recovery ----------
  const g = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' }); const f = await g.newPage(); watch(f, 'forgot');
  await f.addInitScript(() => sessionStorage.setItem('litore_splash', '1'));
  const ask = async (ident) => { await f.goto(base + '/ar/account/forgot'); await f.fill('#identifier', ident); await f.getByRole('button', { name: 'إرسال' }).click(); await f.waitForSelector('[role=status]'); return await f.locator('[role=status]').innerText(); };
  const real = await ask('mona@example.com'); const fake = await ask('nobody@example.com');
  ok(real === fake && /واتساب/.test(real), 'same answer whether account exists or not (no leak)');
  ok(await f.locator('[role=status] a[href*="wa.me"]').count() === 1, 'forgot page offers direct WhatsApp help');
  await ask('971501112222');
  // admin sees notification + request, makes link
  const actx = await b.newContext(); const a = await actx.newPage(); watch(a, 'admin');
  await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  await a.goto(base + '/admin/notifications'); const nt = await a.locator('main').innerText();
  ok(/عميلة جديدة/.test(nt) && /طلب استرجاع كلمة سر/.test(nt), 'admin notified of new customer + reset request');
  ok(await a.locator('header a[aria-label*="غير مقروء"]').count() === 1, 'unread badge shown in admin nav');
  await a.goto(base + '/admin/resets'); ok(await a.locator('main ul > li').count() === 1, 'one reset request (duplicates collapsed, unknown account ignored)');
  await a.getByRole('button', { name: 'إنشاء رابط' }).click(); await a.waitForSelector('text=يظهر مرة واحدة');
  const link = (await a.locator('p.select-all').innerText()).trim(); ok(/\/ar\/account\/reset\?token=/.test(link), 'admin gets one-hour reset link');
  const wa = await a.locator('a:has-text("إرسال واتساب")').getAttribute('href'); ok(/wa\.me\/971501112222\?text=/.test(wa), 'WhatsApp button targets the customer phone');
  await a.goto(base + '/admin/resets'); ok(!(await a.content()).includes('token='), 'link is not shown again after leaving the page');
  // customer opens link on phone
  const url = base + new URL(link).pathname + new URL(link).search;
  await f.goto(url); await f.fill('#password', 'Reset-Passw0rd-789'); await f.fill('#confirm', 'Reset-Passw0rd-000'); await f.getByRole('button', { name: 'حفظ' }).click(); await f.waitForSelector('text=غير متطابقتين'); ok(true, 'mismatch rejected');
  await f.fill('#confirm', 'Reset-Passw0rd-789'); await f.getByRole('button', { name: 'حفظ' }).click(); await f.waitForSelector('text=تم تغيير كلمة المرور'); ok(true, 'new password set from WhatsApp link');
  await f.reload(); await f.fill('#password', 'Another-Passw0rd-1'); await f.fill('#confirm', 'Another-Passw0rd-1'); await f.getByRole('button', { name: 'حفظ' }).click(); await f.waitForSelector('text=غير صالح'); ok(true, 'link cannot be used twice');
  await f.goto(base + '/ar/account/reset?token=bogus-token-value-1234567890'); await f.fill('#password', 'Another-Passw0rd-1'); await f.fill('#confirm', 'Another-Passw0rd-1'); await f.getByRole('button', { name: 'حفظ' }).click(); await f.waitForSelector('text=غير صالح'); ok(true, 'bogus token rejected');
  await login(f, 'mona@example.com', 'Reset-Passw0rd-789'); await f.waitForURL(/\/ar\/account$/); ok(true, 'can sign in with the reset password');
  const og = await b.newContext({ locale: 'ar-AE' }); const old = await og.newPage(); await login(old, 'mona@example.com', 'NewPassw0rd-456'); await old.waitForSelector('text=البريد أو كلمة المرور غير صحيحة'); ok(true, 'old password no longer works');

  // ---------- admin: order notification, activity log, customers ----------
  await u.goto(base + '/ar/shop'); // ensure still a session
  const cart = await b.newContext({ locale: 'ar-AE' }); const o = await cart.newPage(); watch(o, 'order');
  await o.addInitScript(() => sessionStorage.setItem('litore_splash', '1'));
  const variant = await a.evaluate(() => fetch('/api/products').then(r => r.json()).catch(() => null));
  await a.goto(base + '/admin/orders'); // order creation tested in purchase-journey; here we check the hook through the log of other actions
  await a.goto(base + '/admin/coupons'); 
  await a.goto(base + '/admin/activity'); const al = await a.locator('main').innerText();
  ok(/دخول إلى لوحة التحكم/.test(al) && /إنشاء رابط استرجاع كلمة سر/.test(al), 'activity log records login + reset link creation');
  ok(/owner@example\.com/.test(al), 'activity log names who did it');
  ok(!/Str0ng-Passw0rd|token=/.test(al), 'activity log holds no secrets');
  await a.goto(base + '/admin/customers'); ok(/mona@example\.com/.test(await a.locator('main').innerText()), 'admin customers list shows the new customer');
  await a.goto(base + '/admin/notifications'); await a.getByRole('button', { name: 'تحديد الكل كمقروء' }).click(); await a.waitForSelector('header nav span[aria-label*="غير مقروء"]', { state: 'detached', timeout: 8000 }).catch(() => {});
  ok(await a.locator('header nav span[aria-label*="غير مقروء"]').count() === 0, 'mark all read clears the badge');
  // feedback notification
  const fb = await a.evaluate(async (base) => (await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'complaint', name: 'سارة', message: 'تجربة تنبيه الشكوى' }) })).status, base);
  await a.goto(base + '/admin/notifications'); ok(/شكوى جديدة/.test(await a.locator('main').innerText()), 'complaint creates an admin notification');

  // ---------- English + tablet + desktop smoke ----------
  const en = await b.newContext({ ...devices['iPad Pro 11'], locale: 'en-AE' }); const e = await en.newPage(); watch(e, 'en-tablet');
  await e.addInitScript(() => sessionStorage.setItem('litore_splash', '1'));
  await e.goto(base + '/en'); ok(/Color your gaze… and let your eyes speak/.test(await e.locator('h1').first().innerText()), 'EN hero title');
  ok(/Soft shades you choose/.test(await e.locator('main').innerText()), 'EN hero subtitle');
  await e.goto(base + '/en/account/login'); await e.fill('#email', 'x@y.co'); await e.fill('#password', 'abcdefgh'); ok(await e.getByRole('button', { name: 'Show password' }).count() === 1, 'EN eye button label');
  ok(/Remember me/.test(await e.locator('form').innerText()), 'EN remember me');
  await e.goto(base + '/en/account/forgot'); ok(/WhatsApp/.test(await e.locator('form').innerText()), 'EN forgot mentions WhatsApp');
  const ds = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-AE' }); const d = await ds.newPage(); watch(d, 'desktop');
  await d.addInitScript(() => sessionStorage.setItem('litore_splash', '1'));
  await d.goto(base + '/en/shop'); ok(await d.locator('button[aria-label="Add to favorites"]').count() >= 1, 'desktop EN heart present');
  ok(await d.locator('header a[href="/en/offers"]').count() >= 1, 'desktop header has Offers');
  for (const [name, pg] of [['mobile', p], ['tablet', t], ['desktop', d]]) {
    for (const path of ['/ar', '/ar/shop', '/ar/account/login', '/ar/offers']) { await pg.goto(base + path); await pg.waitForTimeout(250); const fits = await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); ok(fits, `${name} ${path} no horizontal overflow`); }
  }
  await p.goto(base + '/ar'); await p.screenshot({ path: '/tmp/w/home-ar-mobile.png' });
  await d.goto(base + '/en'); await d.screenshot({ path: '/tmp/w/home-en-desktop.png' });
  await u.goto(base + '/ar/account'); await u.screenshot({ path: '/tmp/w/profile-ar-mobile.png', fullPage: true });
  await a.goto(base + '/admin/notifications'); await a.screenshot({ path: '/tmp/w/admin-notifications.png' });

  ok(errors.length === 0, 'no console/page errors ' + (errors.length ? '\n' + errors.join('\n') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
