const { chromium, devices } = require('./_pw.cjs');
const base = process.env.BASE; let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] }); const errs = [];
  for (const [name, opts, loc] of [['mobile-ar', devices['iPhone 13'], 'ar'], ['desktop-ar', { viewport: { width: 1280, height: 800 } }, 'ar'], ['desktop-en', { viewport: { width: 1280, height: 800 } }, 'en']]) {
    const x = await b.newContext({ ...opts, locale: loc === 'ar' ? 'ar-AE' : 'en' }); await x.addInitScript(() => sessionStorage.setItem('litore_splash', '1')); const p = await x.newPage(); p.on('pageerror', e => errs.push(String(e)));
    await p.goto(base + '/' + loc); await p.waitForTimeout(500);
    ok(await p.locator('header svg.cart3d').count() === 1 && await p.locator('header svg[class*=eye], header [data-eyes]').count() === 0, `${name}: header cart is the 3D cart (no eyes/lens icon)`);
    ok(await p.locator('.lens-float, section .glass-lens').count() === 0, `${name}: no floating lenses anywhere on home`);
    const bgs = await p.evaluate(() => [...document.querySelectorAll('*')].filter(e => /data:image\/svg/.test(getComputedStyle(e).backgroundImage)).length); ok(bgs === 0, `${name}: no picture backgrounds (${bgs})`);
    const anim = await p.evaluate(() => getComputedStyle(document.querySelector('.cart3d-body')).animationName); ok(/cart3d-float/.test(anim), `${name}: cart has idle motion`);
    await p.goto(base + '/' + loc + '/cart'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => ![...document.querySelectorAll('*')].some(e => /data:image\/svg/.test(getComputedStyle(e).backgroundImage))), `${name}: cart page background is plain glass`);
    if (name === 'mobile-ar') { await p.goto(base + '/ar/shop/sample-rose-quartz'); await p.getByRole('button', { name: 'أضيفي للسلة' }).first().click().catch(async () => { await p.locator('button:has-text("السلة")').first().click(); }); await p.waitForSelector('[role=dialog]'); await p.waitForTimeout(500); await p.screenshot({ path: '/tmp/w/cart-drawer.png' }); }
    await p.goto(base + '/' + loc); await p.waitForTimeout(500); await p.screenshot({ path: `/tmp/w/glass-${name}.png` });
    const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); ok(!over, `${name}: no overflow`);
  }
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
