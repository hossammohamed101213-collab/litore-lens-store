// E2E v10: anonymous analytics (consent-gated), cockpit dashboard, on-site search log, returns, social icons.
const { chromium, devices } = require('./_pw.cjs');
const Database = require('better-sqlite3');
const base = process.env.BASE || 'http://localhost:3300';
const dbPath = process.env.DB_PATH;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const errors = [];
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const watch = (p, tag) => { p.on('pageerror', e => errors.push(tag + ' pageerror ' + String(e).slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(tag + ' console ' + m.text().slice(0, 200)); }); };
  const visitor = async (opts, choice, paths, referer) => {
    const x = await b.newContext({ ...opts, locale: 'ar-AE' });
    await x.addInitScript((c) => { sessionStorage.setItem('litore_splash', '1'); localStorage.setItem('litore.cookies.v1', c); }, choice);
    const p = await x.newPage(); watch(p, 'visitor');
    for (const [i, path] of paths.entries()) { await p.goto(base + path, i === 0 && referer ? { referer } : {}); await p.waitForTimeout(700); }
    return { x, p };
  };
  const q = () => new Database(dbPath, { readonly: true });

  // ---------- anonymous analytics ----------
  await visitor(devices['iPhone 13'], 'all', ['/ar', '/ar/shop'], 'https://www.google.com/');
  await visitor(devices['iPad (gen 7)'], 'all', ['/ar/about'], 'https://www.instagram.com/');
  await visitor({ viewport: { width: 1280, height: 800 } }, 'all', ['/en', '/en/shop'], null);
  await visitor(devices['iPhone 13'], 'essential', ['/ar/contact'], null);
  await visitor({ viewport: { width: 1280, height: 800 } }, 'all', ['/ar/search?q=وردي', '/ar/search?q=zzzzqq'], null);
  let db = q(); const rows = db.prepare('SELECT * FROM page_views').all();
  ok(rows.length >= 7, `page views recorded (${rows.length})`);
  ok(rows.some(r => r.device === 'mobile') && rows.some(r => r.device === 'tablet') && rows.some(r => r.device === 'desktop'), 'device classes: mobile, tablet and desktop all detected');
  ok(rows.some(r => r.source === 'search' && /google/.test(r.referrer)), 'google referrer classified as search');
  ok(rows.some(r => r.source === 'social' && /instagram/.test(r.referrer)), 'instagram referrer classified as social');
  ok(!rows.some(r => r.path === '/ar/contact'), 'visitor who chose "essential only" is NOT tracked');
  ok(!rows.some(r => r.path.startsWith('/admin')), 'admin pages are never tracked');
  ok(rows.every(r => r.visit.length > 0 && !('ip' in r)), 'no IP stored, only random per-tab id');
  const s = db.prepare('SELECT q, results FROM site_searches').all();
  ok(s.some(x => x.q === 'وردي') && s.some(x => x.q === 'zzzzqq' && x.results === 0), 'on-site searches logged with result counts');
  db.close();
  const raw = await fetch(base + '/api/track', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify({ path: '/x', visit: 'a' }) });
  ok(raw.status === 403, 'tracking endpoint rejects foreign origins');

  // ---------- cockpit ----------
  const anon = await fetch(base + '/api/admin/analytics'); ok(anon.status === 401, 'analytics API is admin-only');
  const actx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const a = await actx.newPage(); watch(a, 'admin');
  await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  await a.goto(base + '/admin'); await a.waitForSelector('h1:has-text("مركز التحكم")'); await a.waitForTimeout(1500);
  const t = await a.locator('main').innerText();
  ok(/رادار الزوار الآن/.test(t) && /الزيارات والتحليلات/.test(t) && /إدارة المتجر/.test(t), 'control center = analytics + radar + management cards on the home page');
  const live = await a.locator('svg[aria-label^="زوار الآن"]').getAttribute('aria-label'); ok(/[1-9]/.test(live), 'live visitors > 0 (' + live + ')');
  ok(await a.locator('svg[aria-label^="زوار الآن"] g[role=img]').count() >= 1, 'radar draws a dot per real live visitor');
  ok(/\/ar\//.test(await a.locator('main').innerText()), 'live list shows the real pages visitors are on');
  await a.getByRole('button', { name: '24 ساعة' }).click(); await a.waitForTimeout(800); ok(await a.getByRole('button', { name: '24 ساعة' }).getAttribute('aria-pressed') === 'true', 'range switch works');
  await visitor({ viewport: { width: 1280, height: 800 } }, 'all', ['/ar/faq'], null);
  await a.waitForTimeout(9500); ok((await a.locator('main').innerText()).includes('/ar/faq'), 'dashboard live-refreshes with the newest visit');
  const cardLinks = [...new Set(await a.locator('main a[href^="/admin/"]').evaluateAll(as => as.map(x => x.getAttribute('href'))))];
  ok(cardLinks.length >= 10, `hub has ${cardLinks.length} clickable cards`);
  for (const h of cardLinks) {
    await a.goto(base + '/admin'); await a.locator(`main a[href="${h}"]`).click(); await a.waitForURL(base + h, { timeout: 15000 }); await a.waitForSelector('main h1', { timeout: 15000 });
    ok(await a.getByRole('button', { name: /رجوع/ }).isVisible() && (await a.locator('main h1').count()) > 0, `card ${h} opens its page with a back button`);
  }
  await a.goto(base + '/admin/analytics/devices'); await a.waitForTimeout(500); const dt = await a.locator('main').innerText(); ok(/جوال: \d+/.test(dt) && /تابلت: \d+/.test(dt) && /كمبيوتر: \d+/.test(dt), 'devices detail lists mobile/tablet/desktop');
  await a.goto(base + '/admin/analytics/searches'); await a.waitForTimeout(500); const st = await a.locator('main').innerText(); ok(/zzzzqq/.test(st) && /وردي/.test(st), 'searches detail lists on-site searches');
  await a.goto(base + '/admin/analytics/traffic'); ok(await a.locator('svg[aria-label="الزيارات عبر الوقت"]').isVisible(), 'traffic detail chart');
  const box = await a.locator('svg[aria-label="الزيارات عبر الوقت"]').boundingBox(); await a.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await a.waitForTimeout(200);
  ok(await a.locator('text=مشاهدات:').count() > 0, 'chart tooltip appears on hover');
  await a.goto(base + '/admin/analytics/visits'); await a.waitForTimeout(500); ok(await a.locator('tbody tr').count() >= 5, 'visits detail lists each visit');
  await a.getByRole('button', { name: /رجوع/ }).click(); await a.waitForTimeout(800);
  await a.goto(base + '/admin'); await a.waitForTimeout(800);
  await a.setViewportSize({ width: 390, height: 844 }); await a.waitForTimeout(300);
  ok(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'control center has no horizontal overflow on a phone');
  await a.screenshot({ path: '/tmp/w/hub-mobile.png', fullPage: true }); await a.setViewportSize({ width: 1280, height: 900 }); await a.waitForTimeout(300);
  await a.screenshot({ path: '/tmp/w/hub-desktop.png', fullPage: true });
  await a.screenshot({ path: '/tmp/w/cockpit-desktop.png', fullPage: true });

  // ---------- returns ----------
  const cx = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' }); const c = await cx.newPage(); watch(c, 'cust');
  await c.addInitScript(() => { sessionStorage.setItem('litore_splash', '1'); });
  await c.goto(base + '/ar/account/register'); await c.fill('#name', 'منى'); await c.fill('#email', 'mona@example.com'); await c.fill('#password', 'Passw0rd-123'); await c.locator('form').getByRole('button', { name: 'إنشاء حساب' }).click(); await c.waitForURL(/\/ar\/account$/);
  const w = new Database(dbPath); const cid = w.prepare("SELECT id FROM customers WHERE email='mona@example.com'").get().id;
  const mk = (id, st) => w.prepare("INSERT INTO orders (id,customer_id,email,phone,status,subtotal_minor,total_minor,currency,shipping_label_ar,shipping_label_en,address_json,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(id, cid, 'mona@example.com', '0500000000', st, 10000, 10000, 'AED', 'x', 'x', '{}', 'k-' + id);
  mk('LT-RET-1', 'delivered'); mk('LT-RET-2', 'new'); w.close();
  await c.goto(base + '/ar/account/orders'); await c.waitForSelector('text=LT-RET-1');
  ok(await c.getByRole('button', { name: 'طلب مرتجع' }).count() === 1, 'return button only on the delivered order');
  await c.getByRole('button', { name: 'طلب مرتجع' }).click(); await c.selectOption('select', 'damaged'); await c.fill('textarea', 'العدسة مكسورة'); await c.getByRole('button', { name: 'إرسال الطلب' }).click();
  await c.waitForSelector('text=تم استلام طلب المرتجع'); ok(true, 'customer sees confirmation');
  await c.reload(); await c.waitForSelector('text=تم استلام طلب المرتجع'); ok(true, 'confirmation persists after reload');
  const api = (body) => c.evaluate(async (b) => (await fetch('/api/account/returns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).status, body);
  ok(await api({ orderId: 'LT-RET-1', reason: 'damaged' }) === 409, 'second open return for the same order refused');
  ok(await api({ orderId: 'LT-RET-2', reason: 'damaged' }) === 409, 'return on a not-yet-delivered order refused');
  ok(await api({ orderId: 'LT-RET-1', reason: 'bogus' }) === 400, 'invalid reason refused');
  const other = await b.newContext(); const o = await other.newPage(); await o.goto(base + '/ar');
  ok(await o.evaluate(async () => (await fetch('/api/account/returns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status) === 401, 'guest cannot request a return');
  await a.goto(base + '/admin/returns'); const rt = await a.locator('main').innerText(); ok(/LT-RET-1/.test(rt) && /العدسة مكسورة/.test(rt) && /المنتج تالف/.test(rt), 'admin sees the return with reason and details');
  await a.goto(base + '/admin/notifications'); ok(/طلب مرتجع جديد/.test(await a.locator('main').innerText()), 'admin notified of the return');
  await a.goto(base + '/admin/returns'); await a.locator('select[name=status]').first().selectOption('refunded'); await a.locator('input[name=note]').first().fill('تم'); await a.locator('form:has(select[name=status]) button').first().click(); await a.waitForURL(/saved=1/);
  db = q(); ok(db.prepare("SELECT payment_status p FROM orders WHERE id='LT-RET-1'").get().p === 'refunded', 'refunded return marks the order as refunded'); db.close();
  await a.goto(base + '/admin/activity'); ok(/تحديث حالة مرتجع/.test(await a.locator('main').innerText()), 'activity log records return update');

  // ---------- social icons ----------
  const sp = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' }); const f = await sp.newPage(); watch(f, 'foot'); await f.addInitScript(() => { sessionStorage.setItem('litore_splash', '1'); });
  await f.goto(base + '/ar'); const names = await f.locator('footer ul[aria-label=Social] [aria-label]').evaluateAll(n => n.map(x => x.getAttribute('aria-label')));
  ok(names.length === 3 && /WhatsApp/.test(names[0]) && /TikTok/.test(names[1]) && /Instagram/.test(names[2]), 'footer shows WhatsApp, TikTok, Instagram icons only: ' + names.join(','));
  { const h0 = await f.locator('footer ul[aria-label=Social] a').evaluateAll(n => n.map(x => x.getAttribute('href'))); ok(h0.length === 3 && h0.some(h => h === 'https://www.instagram.com/litoreae') && h0.some(h => h === 'https://www.tiktok.com/@litoreae'), 'official Instagram + TikTok links are set by default'); }
  const sizes = await f.locator('footer ul[aria-label=Social] svg').evaluateAll(n => n.map(x => Math.round(x.getBoundingClientRect().width))); ok(sizes.every(x => x === 20), 'icons are small and uniform');
  await a.goto(base + '/admin/social/instagram'); await a.fill('#url', 'instagram.com/litore.store'); await a.getByRole('button', { name: 'حفظ' }).click(); await a.waitForURL(/saved=1/); await a.goto(base + '/admin/social/tiktok'); await a.fill('#url', 'javascript:alert(1)'); await a.getByRole('button', { name: 'حفظ' }).click(); await a.waitForSelector('[role=alert]'); await a.waitForLoadState('networkidle'); await a.waitForTimeout(800);
  ok(true, 'bad link rejected');
  await a.goto(base + '/admin/social/instagram'); await a.fill('#url', 'instagram.com/litore.store'); await a.getByRole('button', { name: 'حفظ' }).click(); await a.waitForURL(/saved=1/); await a.goto(base + '/admin/social/tiktok'); await a.fill('#url', 'https://www.tiktok.com/@litore'); await a.getByRole('button', { name: 'حفظ' }).click(); await a.waitForURL(/saved=1/);
  await f.goto(base + '/ar'); const hrefs = await f.locator('footer ul[aria-label=Social] a').evaluateAll(n => n.map(x => x.getAttribute('href')));
  ok(hrefs.some(h => h === 'https://instagram.com/litore.store') && hrefs.some(h => h === 'https://www.tiktok.com/@litore') && hrefs.length === 3, 'saved links turn the icons clickable: ' + hrefs.length);
  ok(await f.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'footer fits phone width');
  await f.locator('footer ul[aria-label=Social]').scrollIntoViewIfNeeded(); await f.screenshot({ path: '/tmp/w/footer-social.png' });


  // ---------- big phone photos get shrunk in the browser and upload fine ----------
  await a.goto(base + '/admin/products/new'); await a.waitForLoadState('networkidle');
  await a.fill('[name=name_ar]', 'صور كبيرة'); await a.fill('[name=name_en]', 'Big Photos'); await a.fill('[name=price]', '50'); await a.selectOption('[name=status]', 'active');
  await a.fill('[name=v_sku_0]', 'BIG-1'); await a.fill('[name=v_stock_0]', '3');
  await a.setInputFiles('#images', [0, 1, 2].map(i => '/tmp/w/big' + i + '.jpg')); await a.waitForSelector('text=صور جديدة'); await a.waitForTimeout(2500);
  await a.setInputFiles('#images', ['/tmp/w/big3.jpg']); await a.waitForTimeout(2500);
  ok(await a.locator('main ul li img').count() === 4, 'picking photos twice accumulates (4 photos)');
  await a.locator('main form button:not([type=button])').first().click(); await a.waitForURL(/saved=1/, { timeout: 60000 });
  ok(await a.locator('input[name^=img_sort_]').count() === 4, 'four ~4MB phone photos saved in one go');
  const fs = require('fs'); const up = process.env.UPLOAD_DIR || dbPath.replace('/l.db', '/up'); if (up) { const sizes = fs.readdirSync(up).map(n => fs.statSync(up + '/' + n).size); ok(sizes.length > 0 && Math.max(...sizes) < 1_500_000, 'stored photos were shrunk (max ' + Math.round(Math.max(...sizes) / 1024) + 'KB)'); }

  ok(errors.length === 0, 'no console/page errors ' + (errors.length ? '\n' + errors.join('\n') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
