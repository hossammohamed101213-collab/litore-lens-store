// E2E: home-page background (lenses removed, owner photo with fade) + admin controls.
const { chromium, devices } = require('./_pw.cjs');
const base = process.env.BASE; let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] }); const errs = [];
  const mk = async (opts, loc) => { const x = await b.newContext({ ...opts, locale: loc === 'ar' ? 'ar-AE' : 'en' }); await x.addInitScript(() => sessionStorage.setItem('litore_splash', '1')); const p = await x.newPage(); p.on('pageerror', e => errs.push(String(e))); return p; };
  const d = await mk({ viewport: { width: 1280, height: 800 } }, 'ar');
  await d.goto(base + '/ar'); await d.waitForTimeout(500);
  ok(await d.locator('section .lens-float').count() === 0, 'floating lens/eye decorations removed from the hero');
  ok(await d.locator('section img[src^="/uploads/"]').count() === 0, 'no background photo until one is uploaded (plain soft background)');
  const a = await mk({ viewport: { width: 1280, height: 900 } }, 'ar'); await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  await a.goto(base + '/admin/settings'); await a.waitForLoadState('networkidle');
  await a.setInputFiles('#hero_photo', '/tmp/w/owner-test.jpg'); await a.waitForSelector('[aria-label=معاينة]');
  ok(true, 'admin sees a preview before saving');
  await a.locator('#op').fill('45'); await a.selectOption('#sd', 'end'); await a.locator('#ps').fill('25');
  await a.getByRole('button', { name: 'حفظ الخلفية' }).click(); await a.waitForURL(/saved=1/);
  ok(await a.locator('[aria-label=معاينة] img').count() === 1, 'saved photo shows in admin after reload');
  for (const [name, opts, loc] of [['desktop-ar', { viewport: { width: 1280, height: 800 } }, 'ar'], ['desktop-en', { viewport: { width: 1280, height: 800 } }, 'en'], ['mobile-ar', devices['iPhone 13'], 'ar'], ['tablet-ar', devices['iPad (gen 7)'], 'ar']]) {
    const p = await mk(opts, loc); await p.goto(base + '/' + loc); await p.waitForTimeout(700);
    const info = await p.evaluate(() => { const i = document.querySelector('section img[src^="/uploads/"]'); const h = document.querySelector('h1'); if (!i) return null; const r = i.getBoundingClientRect(); return { op: getComputedStyle(i).opacity, w: Math.round(r.width), over: document.documentElement.scrollWidth > innerWidth + 1, mask: getComputedStyle(i).maskImage || getComputedStyle(i).webkitMaskImage, h1: h && getComputedStyle(h).color }; });
    ok(info && Number(info.op) === 0.45 && !info.over && /gradient/.test(info.mask || ''), `${name}: photo at 45% with fade mask, no overflow`);
    await p.screenshot({ path: `/tmp/w/hero-${name}.png` });
  }
  await a.goto(base + '/admin/settings'); await a.getByRole('button', { name: /حذف الصورة/ }).click(); await a.waitForURL(/saved=1/);
  await d.goto(base + '/ar'); ok(await d.locator('section img[src^="/uploads/"]').count() === 0, 'removing the photo returns to the plain background');
  const bad = await a.evaluate(async () => 0); void bad;
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
