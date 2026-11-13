// E2E v9: admin password eye, multi-photo upload + 360 viewer, pending reviews, cookie banner, referrals, affiliates.
// Fresh DB (SEED_SAMPLE=true) + admin owner@example.com / Str0ng-Passw0rd!. DB_PATH env = sqlite file of the running server.
const { chromium, devices } = require('playwright');
const Database = require('better-sqlite3');
const zlib = require('zlib');
const base = process.env.BASE || 'http://localhost:3200';
const dbPath = process.env.DB_PATH;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const errors = [];
function png(r, g, b) { // tiny valid 8x8 PNG of one colour
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(8, 0); ihdr.writeUInt32BE(8, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(8 * (1 + 24)); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const o = y * 25 + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const watch = (p, tag) => { p.on('pageerror', e => errors.push(tag + ' pageerror ' + String(e).slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(tag + ' console ' + m.text().slice(0, 200)); }); };
  const noSplash = (p) => p.addInitScript(() => { sessionStorage.setItem('litore_splash', '1'); });

  // ---------- admin login eye ----------
  const actx = await b.newContext(); const a = await actx.newPage(); watch(a, 'admin');
  await a.goto(base + '/admin/login');
  ok(await a.locator('#password').getAttribute('type') === 'password', 'admin password hidden by default');
  await a.getByRole('button', { name: 'إظهار كلمة المرور' }).click(); ok(await a.locator('#password').getAttribute('type') === 'text', 'admin eye shows password');
  await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.getByRole('button', { name: 'إخفاء كلمة المرور' }).click();
  await a.locator('main button[type=submit], main form > button, main button:has-text("دخول")').last().click(); await a.waitForURL(/\/admin$/);

  // ---------- multi-photo upload + 360 ----------
  await a.goto(base + '/admin/products/new');
  ok(await a.getByRole('button', { name: /إضافة صور/ }).isVisible(), 'upload has a clear visible button');
  await a.fill('[name=name_ar]', 'عدسة دوّارة'); await a.fill('[name=name_en]', 'Spin Lens'); await a.fill('[name=price]', '99');
  await a.selectOption('[name=status]', 'active');
  await a.setInputFiles('#images', [0, 1, 2, 3].map(i => ({ name: `a${i}.png`, mimeType: 'image/png', buffer: png(60 * i, 120, 255 - 60 * i) })));
  await a.waitForSelector('text=صور جديدة سيتم رفعها'); ok(await a.locator('main ul li img').count() === 4, 'chosen photos preview before saving (4)');
  await a.locator('input[name=spin]').check();
  await a.locator('input[name=v_sku_0]').fill('SPIN-1'); await a.locator('input[name=v_stock_0]').fill('9');
  await a.locator('form button:has-text("حفظ")').first().click(); await a.waitForURL(/saved=1/);
  ok(await a.locator('input[name^=img_sort_]').count() === 4, 'saved product lists 4 photos with order/delete controls');
  const m = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' }); const p = await m.newPage(); watch(p, 'mobile'); await noSplash(p);
  await p.goto(base + '/ar/shop/spin-lens'); await p.waitForSelector('text=360°');
  const frame = () => p.evaluate(() => [...document.querySelectorAll('main img')].filter(i => getComputedStyle(i).opacity === '1' && i.closest('.aspect-square')).map(i => i.getAttribute('src')).join('|'));
  const f1 = await frame(); await p.waitForTimeout(900); const f2 = await frame(); ok(f1 !== f2, '360 turntable rotates by itself');
  const dctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ar-AE' }); const d = await dctx.newPage(); watch(d, 'desktop'); await noSplash(d);
  await d.goto(base + '/ar/shop/spin-lens'); await d.waitForSelector('text=360°');
  const box = await d.locator('div.cursor-ew-resize').boundingBox(); await d.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
  const dframe = () => d.evaluate(() => [...document.querySelectorAll('main img')].filter(i => getComputedStyle(i).opacity === '1' && i.closest('.aspect-square')).map(i => i.getAttribute('src')).join('|'));
  const g1 = await dframe(); await d.waitForTimeout(900); const g2 = await dframe(); ok(g1 === g2, 'rotation stops while mouse rests on it');
  await d.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2); await d.waitForTimeout(250); const g3 = await dframe(); ok(g3 !== g2, 'moving the mouse sideways turns the product by hand');
  await d.mouse.move(5, 5); await d.waitForTimeout(900); ok(await dframe() !== g3, 'rotation resumes when mouse leaves');
  await d.goto(base + '/ar/shop'); ok(await d.locator('a[href="/ar/shop/spin-lens"] img').count() >= 2, 'card shows second angle for hover');

  // ---------- pending review visible only to its author ----------
  const rv = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' }); const r = await rv.newPage(); watch(r, 'review'); await noSplash(r);
  await r.goto(base + '/ar'); const vial = r.locator('[aria-label="تقييمك"], div.touch-none').first(); await vial.scrollIntoViewIfNeeded();
  await r.getByRole('radio', { name: /5/ }).first().click(); await r.fill('textarea', 'عدسات ناعمة جدًا'); await r.locator('form:has(textarea) button').click();
  await r.waitForSelector('text=عدسات ناعمة جدًا'); ok(await r.locator('text=قيد مراجعة').count() === 0, 'author sees her review as normal, no pending label');
  const other = await b.newContext({ locale: 'ar-AE' }); const o = await other.newPage(); await noSplash(o); await o.goto(base + '/ar');
  ok(!(await o.content()).includes('عدسات ناعمة جدًا'), 'review is NOT public before approval');
  await a.goto(base + '/admin/feedback'); await a.getByRole('button', { name: 'نشر' }).first().click(); await a.waitForTimeout(800);
  await o.reload(); ok((await o.content()).includes('عدسات ناعمة جدًا'), 'review public after admin approval');
  await r.reload(); await r.waitForTimeout(500); ok(await r.locator('text=عدسات ناعمة جدًا').count() === 1, 'approved review shown once (no duplicate)');

  // ---------- cookie banner ----------
  const ck = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' }); const c = await ck.newPage(); watch(c, 'cookie');
  await c.addInitScript(() => sessionStorage.setItem('litore_splash', '1'));
  await c.goto(base + '/ar'); await c.waitForSelector('[role=dialog] >> text=قبول الكل'); ok(true, 'cookie banner appears on first visit');
  const fit = await c.evaluate(() => { const r = document.querySelector('[role=dialog][aria-labelledby=ck-t]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }); ok(fit, 'cookie banner fits the phone screen');
  await c.getByRole('button', { name: 'الضرورية فقط' }).click(); ok(await c.locator('[aria-labelledby=ck-t]').count() === 0, 'banner closes after choice');
  await c.reload(); await c.waitForTimeout(1200); ok(await c.locator('[aria-labelledby=ck-t]').count() === 0, 'choice remembered');
  await c.getByRole('button', { name: 'إعدادات ملفات الارتباط' }).click(); await c.waitForSelector('[aria-labelledby=ck-t]'); ok(true, 'footer link reopens cookie settings');
  await c.goto(base + '/ar/privacy'); ok(/لتحسين جودة خدمتك وتجربتك في التسوق/.test(await c.locator('main').innerText()), 'privacy says data is collected only to improve service and experience');
  await c.goto(base + '/ar/terms'); ok(/ملفات الارتباط/.test(await c.locator('main').innerText()), 'terms mention cookies');

  // ---------- referrals ----------
  const reg = async (ctxOpts, name, email, extra) => {
    const x = await b.newContext({ ...ctxOpts, locale: 'ar-AE' }); const pg = await x.newPage(); watch(pg, name); await noSplash(pg);
    await pg.goto(base + '/ar/account/register'); await pg.fill('#name', name); await pg.fill('#email', email); await pg.fill('#password', 'Passw0rd-123');
    if (extra.ref) await pg.fill('#referral', extra.ref); if (extra.mine) await pg.fill('#myCode', extra.mine);
    await pg.locator('form').getByRole('button', { name: 'إنشاء حساب' }).click();
    return { pg, x };
  };
  const A = await reg(devices['iPhone 13'], 'منى', 'mona@example.com', { mine: 'mona 10' });
  await A.pg.waitForURL(/\/ar\/account$/); await A.pg.goto(base + '/ar/account/referrals'); await A.pg.waitForSelector('#refcode');
  ok(await A.pg.locator('#refcode').inputValue() === 'MONA10', 'own free-text code created at sign-up (normalised)');
  const dup = await reg({}, 'سلمى', 'salma@example.com', { mine: 'MONA10' }); await dup.pg.waitForSelector('text=هذا الكود مستخدم'); ok(true, 'duplicate own code rejected with message'); await dup.x.close();
  const B = await reg({}, 'هدى', 'huda@example.com', { ref: 'mona10' }); await B.pg.waitForURL(/\/ar\/account$/);
  const cart = await B.pg.evaluate(() => JSON.parse(localStorage.getItem('litore.cart.v1')).coupon); ok(/^WELCOME-/.test(cart || ''), 'friend with code gets a welcome coupon applied to her cart (' + cart + ')');
  const sql = new Database(dbPath, { readonly: true });
  const wc = sql.prepare("SELECT value,max_uses,customer_id FROM coupons WHERE code = ?").get(cart); ok(wc && wc.value === 10 && wc.max_uses === 1 && !!wc.customer_id, 'welcome coupon is 10%, single-use, personal');
  ok(sql.prepare("SELECT ref_balance b FROM customers WHERE email='mona@example.com'").get().b === 5, 'owner collects 5% balance');
  const vid = sql.prepare('SELECT id FROM variants LIMIT 1').get().id;
  const quote = (pg, code) => pg.evaluate(async ([vid, code]) => (await fetch('/api/cart/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ variantId: vid, quantity: 1 }], coupon: code }) })).json(), [vid, code]);
  const qB = await quote(B.pg, cart); ok(qB.coupon.valid && qB.discount > 0, 'welcome coupon works for her');
  const qA = await quote(A.pg, cart); ok(!qA.coupon.valid, 'welcome coupon does not work for someone else');
  const guest = await b.newContext(); const gp = await guest.newPage(); await gp.goto(base + '/ar'); ok(!(await quote(gp, cart)).coupon.valid, 'welcome coupon does not work for a guest');
  const rw = new Database(dbPath); rw.prepare('UPDATE coupons SET used_count = 1 WHERE code = ?').run(cart); rw.close();
  ok(!(await quote(B.pg, cart)).coupon.valid, 'used coupon is exhausted (one use only)');
  const self = await reg({}, 'نور', 'nour@example.com', { mine: 'NOUR7' }); await self.pg.waitForURL(/\/ar\/account$/);
  // self-referral and bad code
  const bad = await reg({}, 'ليلى', 'layla@example.com', { ref: 'NOSUCH' }); await bad.pg.waitForURL(/\/ar\/account$/); ok(true, 'unknown referral code does not block sign-up');
  ok(sql.prepare("SELECT COUNT(*) n FROM referrals WHERE referee_id = (SELECT id FROM customers WHERE email='layla@example.com')").get().n === 0, 'unknown code gives no reward');
  // redeem
  await A.pg.reload(); await A.pg.waitForSelector('text=رصيدك المتراكم'); ok(/5%/.test(await A.pg.locator('main').innerText()), 'owner sees balance 5% in profile');
  await A.pg.getByRole('button', { name: 'استلام الرصيد كخصم' }).click(); await A.pg.waitForSelector('text=تم إرسال طلبك');
  await a.goto(base + '/admin/notifications'); ok(/طلب استلام رصيد إحالات/.test(await a.locator('main').innerText()), 'admin notified of redemption request');
  await a.goto(base + '/admin/referrals'); await a.getByRole('button', { name: 'موافقة وإنشاء كود' }).click(); await a.waitForSelector('text=تمت الموافقة');
  await A.pg.reload(); await A.pg.waitForSelector('text=أكواد خصمك'); ok(/REF-/.test(await A.pg.locator('main').innerText()), 'owner receives her discount code after approval');
  // admin code
  await a.goto(base + '/admin/referrals'); await a.fill('[name=code]', 'LITORE10'); await a.getByRole('button', { name: 'إضافة' }).click(); await a.waitForSelector('text=LITORE10');
  const C = await reg({}, 'دانة', 'dana@example.com', { ref: 'litore10' }); await C.pg.waitForURL(/\/ar\/account$/);
  ok(/^WELCOME-/.test(await C.pg.evaluate(() => JSON.parse(localStorage.getItem('litore.cart.v1')).coupon || '')), 'admin-issued code also gives the 10% welcome coupon');
  ok(sql.prepare("SELECT COALESCE(SUM(ref_balance),0) s FROM customers WHERE email != 'mona@example.com'").get().s === 0, 'admin code gives no balance to anyone');
  await a.goto(base + '/admin/referrals'); ok(/سجل الإحالات/.test(await a.locator('main').innerText()) && /mona|منى|MONA10/i.test(await a.locator('main').innerText()), 'admin referral log shows entries');
  sql.close();

  // ---------- affiliates ----------
  const af = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' }); const f = await af.newPage(); watch(f, 'aff'); await noSplash(f);
  await f.goto(base + '/ar/affiliate'); await f.fill('#a-name', 'ريم'); await f.fill('#a-phone', '0555555555'); await f.fill('#a-social', 'instagram.com/reem'); await f.getByRole('button', { name: 'إرسال الطلب' }).click();
  await f.waitForSelector('text=وصلنا طلبك'); ok(true, 'affiliate application sent');
  await a.goto(base + '/admin/affiliates'); ok(/ريم/.test(await a.locator('main').innerText()), 'admin sees the affiliate request');
  await a.locator('select[name=status]').first().selectOption('approved'); await a.locator('input[name=commission]').first().fill('12'); await a.locator('input[name=code]').first().fill('REEM12');
  await a.locator('form:has(select[name=status]) button').first().click(); await a.waitForURL(/saved=1/); ok(/REEM12/.test(await a.content()), 'admin approved with commission + code');
  await a.goto(base + '/admin/notifications'); ok(/مسوّقة بالعمولة/.test(await a.locator('main').innerText()), 'admin notified of affiliate request');
  await a.goto(base + '/admin/activity'); ok(/إنشاء كود إحالة من الإدارة/.test(await a.locator('main').innerText()) && /تحديث مسوّقة/.test(await a.locator('main').innerText()), 'activity log records referral + affiliate actions');

  // ---------- overflow + English ----------
  for (const path of ['/ar/affiliate', '/ar/account/referrals', '/en/affiliate', '/en/shop/spin-lens']) { await p.goto(base + path); await p.waitForTimeout(300); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `mobile ${path} no horizontal overflow`); }
  await d.goto(base + '/en/account/register'); ok(/Have a referral code/.test(await d.locator('form').innerText()) && /Create your own referral code/.test(await d.locator('form').innerText()), 'EN register has referral fields');
  await p.goto(base + '/ar/shop/spin-lens'); await p.screenshot({ path: '/tmp/w/product-spin-mobile.png' });
  await a.goto(base + '/admin/referrals'); await a.screenshot({ path: '/tmp/w/admin-referrals.png', fullPage: true });
  await A.pg.goto(base + '/ar/account/referrals'); await A.pg.screenshot({ path: '/tmp/w/referrals-mobile.png', fullPage: true });
  const e = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' }); const ep = await e.newPage(); await ep.goto(base + '/ar'); await ep.waitForTimeout(1500); await ep.screenshot({ path: '/tmp/w/cookie-mobile.png' });

  ok(errors.length === 0, 'no console/page errors ' + (errors.length ? '\n' + errors.join('\n') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
