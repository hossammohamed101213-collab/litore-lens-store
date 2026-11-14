// Settings split into cards: hub -> section -> item. Needs fresh DB + SEED_SAMPLE.
const { chromium, devices } = require('./_pw.cjs');
const base = process.env.BASE || 'http://localhost:3100'; let fails = 0;
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['mobile', devices['iPhone 13']]]) {
    const c = await b.newContext({ ...opts, locale: 'ar-AE' }); const a = await c.newPage();
    await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.keyboard.press('Enter'); await a.waitForURL(/\/admin$/);
    await a.goto(base + '/admin/settings');
    const titles = await a.locator('main a').allInnerTexts();
    for (const t of ['الشحن', 'الربط', 'الضريبة والقانونية', 'خلفية الصفحة الرئيسية', 'السوشيال ميديا']) ok(titles.some((x) => x.includes(t)), `${name}: hub has its own card "${t}"`);
    ok((await a.locator('main form, main input').count()) === 0, `${name}: hub is cards only, no forms or long lists`);
    const over = async (m) => ok((await a.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, `${name}: no overflow ${m}`);
    await over('hub');
    // shipping -> country card -> form
    await a.locator('main a', { hasText: 'الشحن' }).first().click(); await a.waitForURL(/\/admin\/shipping$/);
    ok((await a.locator('main a').count()) >= 7, `${name}: shipping shows country cards + auto card`);
    ok(!(await a.locator('main').innerText()).match(/Aramex Password|Username/), `${name}: shipping page has no carrier-key fields`);
    await a.locator('main a', { hasText: 'الإمارات' }).first().click(); await a.waitForURL(/shipping\/AE/);
    await a.check('[name=active]'); await a.fill('#price', '18'); await a.fill('#free', '300'); await a.fill('#min', '2'); await a.fill('#max', '4'); await a.fill('#price', '18'); await a.keyboard.press('Enter'); await a.waitForURL(/shipping\/AE\?saved=1/);
    ok(/تم الحفظ/.test(await a.locator('main').innerText()), `${name}: zone saved with Enter`);
    await a.goto(base + '/admin/shipping/AE'); await a.fill('#min', '9'); await a.fill('#max', '3'); await a.locator('main form button').click(); await a.waitForSelector('p[role=alert]'); ok(true, `${name}: min>max rejected`);
    await over('zone');
    await a.goto(base + '/admin/shipping'); ok(/18/.test(await a.locator('main a', { hasText: 'الإمارات' }).first().innerText()), `${name}: card shows saved price`);
    // integrations
    await a.goto(base + '/admin/integrations'); const il = await a.locator('main a').allInnerTexts();
    for (const t of ['Telr', 'Aramex', 'Quiqup', 'EMX', 'بيانات المرسل']) ok(il.some((x) => x.includes(t)), `${name}: integrations card ${t}`);
    await a.goto(base + '/admin/integrations/aramex'); ok((await a.locator('main input[type=password]').count()) === 2, `${name}: aramex page has its two secret fields`); 
    await a.fill('#car_aramex_user', 'u@x.com'); await a.fill('#car_aramex_pass', 'pw'); await a.fill('#car_aramex_pin', '1234'); await a.check('[name=car_aramex_enabled]'); await a.locator('main form button:not([type=button])').click(); await a.waitForURL(/saved=1/);
    await a.goto(base + '/admin/integrations/sender'); await a.fill('#ship_line1', 'Store 1, Dubai'); await a.fill('#ship_phone', '+971501234567'); await a.locator('main form button:not([type=button])').click(); await a.waitForURL(/saved=1/);
    await a.goto(base + '/admin/integrations/aramex'); ok((await a.inputValue('#car_aramex_user')) === 'u@x.com' && /محفوظ/.test(await a.locator('main').innerText()), `${name}: saving sender did not wipe Aramex data`);
    await a.goto(base + '/admin/integrations/quiqup'); await a.check('[name=enabled]'); await a.fill('#track', 'https://t.example/{n}'); await a.keyboard.press('Enter'); await a.waitForURL(/saved=1/);
    await a.goto(base + '/admin/integrations/telr'); await a.fill('#store', '999'); await a.locator('main form').first().locator('button:not([type=button])').click(); await a.waitForURL(/saved=1/);
    await a.goto(base + '/admin/integrations'); ok(/مفعّل/.test(await a.locator('main a', { hasText: 'Quiqup' }).innerText()), `${name}: Quiqup card shows enabled`);
    await over('integrations');
    // tax + legal
    await a.goto(base + '/admin/tax'); ok((await a.locator('main a').count()) === 2, `${name}: tax section has 2 cards`);
    await a.goto(base + '/admin/tax/rate'); await a.fill('#tax_rate', '5'); await a.keyboard.press('Enter'); await a.waitForURL(/tax\/rate\?saved=1/);
    await a.fill('#tax_rate', '99'); await a.keyboard.press('Enter'); await a.waitForSelector('p[role=alert]'); ok(true, `${name}: tax 99% rejected`);
    await a.goto(base + '/admin/tax/legal'); ok((await a.locator('main a[target=_blank]').count()) === 10, `${name}: 5 legal pages x ar/en`);
    // social: each platform alone
    await a.goto(base + '/admin/social'); ok((await a.locator('main a').count()) === 3, `${name}: 3 social cards`);
    await a.goto(base + '/admin/social/instagram'); await a.fill('#url', 'instagram.com/litore.store'); await a.keyboard.press('Enter'); await a.waitForURL(/saved=1/);
    await a.goto(base + '/admin/social/tiktok'); await a.fill('#url', 'javascript:alert(1)'); await a.keyboard.press('Enter'); await a.waitForSelector('p[role=alert]'); ok(true, `${name}: bad social link rejected`);
    await a.goto(base + '/admin/social'); ok(/الرابط مضاف/.test(await a.locator('main a', { hasText: 'إنستجرام' }).innerText()), `${name}: instagram card shows saved`);
    // background alone
    await a.goto(base + '/admin/background'); ok((await a.locator('#hero_photo').count()) === 1 && !(await a.locator('main').innerText()).includes('الضريبة'), `${name}: background page only has the photo form`);
    await over('background');
    // old addresses still work
    await a.goto(base + '/admin/payments'); ok(/integrations\/telr/.test(a.url()), `${name}: old payments link goes to Telr`);
    // back button goes one level up
    await a.goto(base + '/admin/tax/rate'); await a.locator('a', { hasText: 'مركز التحكم' }).click(); await a.waitForURL(/\/admin$/);
    ok(/الإعدادات/.test(await a.locator('main').innerText()), `${name}: control center still has the الإعدادات card`);
    await c.close();
  }
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
