// E2E v27: bell opens a small dropdown, closes on second tap, shakes while unread, tapping an item marks it read.
// Review has no "تم التعامل" button; complaints keep "تمت المعالجة".
const { chromium, devices } = require('./_pw.cjs');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' });
  const a = await ctx.newPage(); await a.goto(base + '/admin/login');
  await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  await a.request.post(base + '/api/feedback', { data: { kind: 'review', rating: 4, message: 'تقييم إشعار', name: 'منى', tags: [] }, headers: { origin: base } });
  await a.request.post(base + '/api/feedback', { data: { kind: 'complaint', message: 'شكوى اختبار', name: 'نور' }, headers: { origin: base } });
  await a.goto(base + '/admin/feedback');
  ok(await a.getByRole('button', { name: 'تم التعامل' }).count() === 0, 'no "تم التعامل" button anywhere');
  ok(await a.getByRole('button', { name: 'تمت المعالجة' }).count() >= 1, 'complaints keep a clear "handled" button');
  const rev = a.locator('li', { hasText: 'تقييم إشعار' }); ok(await rev.getByRole('button', { name: 'نشر', exact: true }).count() === 1 && await rev.getByRole('button', { name: 'تمت المعالجة' }).count() === 0, 'review only has publish/hide');
  await a.goto(base + '/admin');
  const bell = a.locator('button[aria-haspopup=dialog]'); ok(await a.locator('.bell-shake').count() === 1, 'bell shakes while there are unread notifications');
  const unread0 = parseInt((await bell.getAttribute('aria-label')).match(/\((\d+)/)[1]);
  await bell.tap(); const dlg = a.getByRole('dialog', { name: 'الإشعارات' }); await dlg.waitFor();
  const box = await dlg.boundingBox(); const vp = a.viewportSize(); ok(box.width < vp.width * 0.95 && box.height < vp.height * 0.7, `dropdown is small (${Math.round(box.width)}x${Math.round(box.height)})`);
  await bell.tap(); await a.waitForTimeout(300); ok(await dlg.count() === 0, 'second tap on the bell closes it');
  await bell.tap(); await dlg.waitFor(); await a.waitForTimeout(500);
  await dlg.locator('li button', { hasText: 'منى' }).first().tap().catch(async () => { await dlg.locator('li button').first().tap(); });
  await a.waitForLoadState('networkidle'); await a.waitForTimeout(800);
  const unread1 = parseInt(((await bell.getAttribute('aria-label')).match(/\((\d+)/) || [0, 0])[1]);
  ok(unread1 === unread0 - 1, `opening one notification marks it read (${unread0} -> ${unread1})`);
  ok(await a.getByRole('dialog', { name: 'الإشعارات' }).count() === 0, 'dropdown closed after choosing one');
  await bell.tap(); await dlg.waitFor(); await dlg.getByRole('button', { name: 'تحديد الكل كمقروء' }).tap(); await a.waitForTimeout(800);
  ok(await a.locator('.bell-shake').count() === 0 && (await bell.getAttribute('aria-label')) === 'الإشعارات', 'bell stops shaking when everything is read');
  console.log(fails ? `FAILS ${fails}` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
