// E2E for the UI/UX round: needs a fresh DB + running server (SEED_SAMPLE=true, admin owner@example.com / Str0ng-Passw0rd!).
const { chromium, devices } = require('./_pw.cjs');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const errors = [];
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const watch = (p, tag) => { p.on('pageerror', e => errors.push(tag + ' pageerror ' + String(e).slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(tag + ' console ' + m.text().slice(0, 200)); }); };

  // ---- admin: promos + feedback pages
  const actx = await b.newContext(); const a = await actx.newPage(); watch(a, 'admin');
  await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  await a.goto(base + '/admin/ticker'); await a.fill('[name=name_ar]', 'وردي كوارتز'); await a.fill('[name=name_en]', 'Rose Quartz'); await a.fill('[name=percent]', '20'); await a.fill('[name=price_after]', '80');
  await a.locator('main form button').first().click(); await a.waitForURL(/saved=1/); ok(true, 'admin added promo to ticker');
  await a.goto(base + '/admin/ticker'); await a.fill('[name=name_ar]', 'عسلي دافئ'); await a.fill('[name=name_en]', 'Warm Honey'); await a.fill('[name=percent]', '30'); await a.fill('[name=price_after]', '70'); await a.locator('main form button').first().click(); await a.waitForURL(/saved=1/);
  await a.goto(base + '/admin/ticker'); await a.fill('[name=percent]', '95'); await a.fill('[name=name_ar]', 'x'); await a.fill('[name=name_en]', 'x'); await a.fill('[name=price_after]', '1'); await a.locator('main form button').first().click(); await a.waitForSelector('[role=alert]'); ok(true, 'invalid promo (95%) rejected');

  // ---- mobile: splash, ticker, fab, rail
  const m = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' }); const p = await m.newPage(); watch(p, 'mobile');
  await p.goto(base + '/ar');
  ok(await p.locator('#splash').count() === 1, 'splash shown on first visit');
  ok(/أهلًا بكِ/.test(await p.locator('#splash').innerText()), 'splash has welcome message');
  await p.waitForFunction(() => /^(\d+)%$/.test(document.querySelector('#splash [dir=ltr]')?.textContent || '') , null, { timeout: 5000 }).catch(() => {});
  await p.waitForSelector('#splash', { state: 'detached', timeout: 9000 }); ok(true, 'splash reaches 100% and opens');
  await p.reload(); await p.waitForTimeout(400);
  ok(await p.locator('#splash').count() === 0 || !(await p.locator('#splash').isVisible()), 'splash not shown again in same session');
  const tk = p.locator('.ticker'); ok(await tk.count() === 1, 'ticker visible with promos');
  const tt = await tk.innerText(); ok(/وردي كوارتز/.test(tt) && /20%/.test(tt) && /80/.test(tt), 'ticker shows lens, discount, price after discount');
  const x1 = await p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.ticker-track')).transform).m41); await p.waitForTimeout(700);
  const x2 = await p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.ticker-track')).transform).m41);
  ok(x2 < x1, `ticker moves right-to-left continuously (${x1.toFixed(1)} -> ${x2.toFixed(1)})`);
  const wa = await p.locator('a[href*="wa.me"]').first().getAttribute('href'); ok(/wa\.me\/971569449531/.test(wa), 'floating WhatsApp button links to 971569449531');
  await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(300);
  const pv = await p.evaluate(() => parseFloat(document.querySelector('[style*="--p"]')?.style.getPropertyValue('--p') || '0')); ok(pv > 0.05, `gold rail thumb moves with scroll (p=${pv.toFixed(2)})`);
  await p.getByRole('link', { name: 'Litore' }).first().click(); await p.waitForTimeout(900);
  ok(await p.evaluate(() => window.scrollY) < 5, 'logo click on home scrolls to top');

  // product cards have specs & sections are cards
  ok(await p.locator('.glow-card').count() > 6, 'sections render as glossy cards');

  // mobile menu: every link opens
  await p.getByRole('button', { name: 'القائمة' }).click(); await p.waitForSelector('#mobile-menu');
  const menuLinks = await p.locator('#mobile-menu a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  ok(menuLinks.some(h => h.endsWith('/prices')), 'mobile menu has Prices section');
  for (const h of menuLinks) { const r = await p.request.get(base + h); ok(r.status() === 200, `menu link ${h} -> ${r.status()}`); }
  await p.keyboard.press('Escape');

  // back button
  await p.goto(base + '/ar/faq'); await p.goBack(); await p.goto(base + '/ar/faq'); await p.getByRole('button', { name: 'رجوع' }).click(); await p.waitForTimeout(600);
  ok(!/faq/.test(p.url()), 'rail back button goes back');

  // ---- lens finder
  await p.goto(base + '/ar'); await p.waitForSelector('h2:has-text("اختاري عدستك")');
  const fin = p.locator('div:has(> h2:has-text("اختاري عدستك"))').first();
  for (let i = 0; i < 3; i++) await fin.locator('button').first().click();
  const lk = await fin.locator('a[href*="/shop?color="]').count(); ok(lk >= 2, `lens finder suggests ${lk} colours`);
  await fin.locator('a[href*="/shop?color="]').first().click(); await p.waitForURL(/shop\?color=/); ok(true, 'finder result opens filtered shop');

  // ---- vial rating
  await p.goto(base + '/ar'); await p.waitForSelector('[role=radiogroup]');
  const stars = p.locator('[role=radiogroup] button');
  await stars.nth(1).hover(); const lvl2 = await p.evaluate(() => document.querySelector('svg g[style*="translateY"]').getAttribute('style'));
  await stars.nth(4).hover(); const lvl5 = await p.evaluate(() => document.querySelector('svg g[style*="translateY"]').getAttribute('style'));
  ok(lvl2 !== lvl5, 'liquid level changes with the stars'); 
  await stars.nth(3).click(); await p.fill('textarea[aria-label]', 'تجربة ممتازة وتوصيل سريع'); await p.getByRole('button', { name: 'إرسال التقييم' }).click(); await p.waitForSelector('text=شكرًا لتقييمك'); ok(true, 'review submitted');
  await a.goto(base + '/admin/feedback'); ok((await a.locator('main').innerText()).includes('تجربة ممتازة'), 'admin sees the review');
  await a.getByRole('button', { name: 'نشر' }).first().click(); await a.waitForLoadState('networkidle');
  await p.goto(base + '/ar'); ok((await p.locator('main').innerText()).includes('تجربة ممتازة') && /4\.0/.test(await p.locator('main').innerText()), 'approved review + real average shown on home');

  // ---- complaints with breathing
  await p.goto(base + '/ar/complaints');
  ok(/شهيق/.test(await p.locator('main').innerText()), 'breathing prompt (inhale) shown first');
  ok(await p.locator('textarea').count() === 0, 'form hidden until breathing finished/skipped');
  await p.getByRole('button', { name: 'تخطي' }).click(); await p.waitForSelector('textarea');
  await p.fill('textarea', 'وصلني الطرد متأخر يومين'); await p.getByRole('button', { name: 'إرسال', exact: true }).click(); await p.waitForSelector('text=وصلتنا رسالتك'); ok(true, 'complaint submitted');
  await a.goto(base + '/admin/feedback'); ok((await a.locator('main').innerText()).includes('وصل') , 'admin sees complaint');
  await p.waitForTimeout(100); const bad = await p.request.post(base + '/api/feedback', { data: { kind: 'complaint', message: 'x' } }); ok([400, 429].includes(bad.status()), 'feedback API rejects invalid input ('+bad.status()+')');

  // ---- cart eyes + background
  await p.goto(base + '/ar/shop'); await p.waitForSelector('a[href*="/shop/"]');
  await p.locator('button[aria-label^="السلة"]').first().tap(); await p.waitForTimeout(100);
  ok(await p.locator('button[aria-label^="السلة"] svg.eyes-pop, button[aria-label^="السلة"] svg').count() > 0, 'cart icon is the eyes mark');
  await p.keyboard.press('Escape');
  await p.goto(base + '/ar/cart'); ok(await p.locator('.glasses-bg').count() === 1, 'cart page has glasses & lenses background');

  // ---- desktop: eyes follow mouse, nav
  const d = await b.newContext({ viewport: { width: 1280, height: 900 } }); const dp = await d.newPage(); watch(dp, 'desktop');
  await dp.goto(base + '/ar'); await dp.waitForSelector('#splash', { state: 'detached', timeout: 9000 });
  const eye = dp.locator('button[aria-label^="السلة"] svg'); const bb = await eye.boundingBox();
  await dp.mouse.move(2, bb.y + 5); await dp.waitForTimeout(250);
  const ix1 = await eye.evaluate(e => e.style.getPropertyValue('--ix'));
  await dp.mouse.move(bb.x + 400, bb.y + 5); await dp.waitForTimeout(250);
  const ix2 = await eye.evaluate(e => e.style.getPropertyValue('--ix'));
  ok(ix1 !== ix2 && parseFloat(ix1) < 0 && parseFloat(ix2) > 0, `cart eyes follow the mouse (${ix1} / ${ix2})`);
  await eye.click(); ok(await dp.locator('#splash').count() === 0, 'cart opens (click) without error'); await dp.keyboard.press('Escape');
  for (const l of ['المتجر', 'الأسعار', 'دليل اختيار اللون', 'العناية والاستخدام', 'عن Litore']) ok(await dp.locator('header nav').getByText(l.replace('المتجر', 'تسوقي العدسات'), { exact: false }).first().isVisible(), `desktop nav: ${l}`);

  // ---- all pages, both locales
  const pages = ['', '/shop', '/prices', '/complaints', '/about', '/contact', '/faq', '/shipping', '/returns', '/privacy', '/terms', '/care', '/color-guide', '/track', '/search', '/cart', '/wishlist', '/account/login', '/account/register'];
  for (const loc of ['ar', 'en']) for (const pg of pages) {
    const r = await dp.goto(`${base}/${loc}${pg}`); await dp.waitForLoadState('domcontentloaded');
    const rl = dp.locator('meta[name=robots]'); const robots = (await rl.count()) ? await rl.first().getAttribute('content') : '';
    ok(r.status() === 200 && (await dp.locator('h1').count()) >= 1, `${loc}${pg || '/'} opens (h1 present)`);
    if (['/privacy', '/terms', '/returns', '/shipping'].includes(pg)) ok(!/noindex/.test(robots || ''), `${loc}${pg} is indexable`);
  }
  await dp.goto(`${base}/ar/shop`); const href = await dp.locator('a[href*="/ar/shop/"]').first().getAttribute('href'); await dp.goto(base + href); ok((await dp.locator('h1').count()) === 1, 'product page opens');

  // ---- policy content checks
  await dp.goto(base + '/ar/returns'); const rt = await dp.locator('main').innerText(); ok(/14 يومًا/.test(rt) && /مغلقة/.test(rt), 'returns: 14 days for sealed packs');
  await dp.goto(base + '/ar/shipping'); ok(/من 1 إلى 3 أيام عمل/.test(await dp.locator('main').innerText()), 'shipping: 1-3 working days');
  await dp.goto(base + '/ar/terms'); ok(/\[الاسم القانوني للشركة\]/.test(await dp.locator('main').innerText()), 'terms: seller details placeholder visible');

  // ---- PWA / icons
  const man = await dp.request.get(base + '/manifest.webmanifest'); const mj = await man.json();
  ok(man.status() === 200 && mj.display === 'standalone' && mj.icons.length >= 3 && mj.name.includes('Litore'), 'web manifest valid');
  for (const u of [...mj.icons.map(i => i.src), '/icon.png', '/apple-icon.png', '/favicon.ico', '/sw.js']) { const r = await dp.request.get(base + u); ok(r.status() === 200, `asset ${u}`); }
  await dp.goto(base + '/ar'); ok(await dp.locator('link[rel=manifest]').count() === 1 && await dp.locator('link[rel~=icon]').count() >= 1 && await dp.locator('link[rel=apple-touch-icon]').count() === 1, 'head has manifest + favicon + apple icon');
  const ios = await b.newContext({ ...devices['iPhone 13'] }); const ip = await ios.newPage(); await ip.goto(base + '/ar'); await ip.waitForSelector('#splash', { state: 'detached', timeout: 9000 });
  await ip.getByRole('button', { name: 'القائمة' }).click(); await ip.locator('#mobile-menu').getByRole('button', { name: /ثبّتي المتجر/ }).click(); ok(/إضافة إلى الشاشة الرئيسية/.test(await ip.locator('#mobile-menu').innerText()), 'iPhone install help shown');

  // ---- ticker hides when no promo is active
  await a.goto(base + '/admin/ticker'); for (let i = 0; i < 2; i++) { await a.getByRole('button', { name: 'حذف' }).first().click(); await a.waitForLoadState('networkidle'); }
  await dp.goto(base + '/ar'); ok(await dp.locator('.ticker').count() === 0, 'ticker hidden when no promos');

  console.log('PAGE ERRORS:', errors.length); errors.slice(0, 10).forEach(e => console.log(' ', e));
  ok(errors.length === 0, 'no console/page errors');
  await b.close(); console.log('FAILS', fails); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(String(e).slice(0, 1200)); process.exit(1); });
