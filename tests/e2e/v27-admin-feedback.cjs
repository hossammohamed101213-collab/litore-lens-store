// E2E v27: admin review approval is visibly confirmed; saving a product with a duplicate SKU shows a message (no crash);
// login forms offer to save credentials; admin "stay signed in" lasts 30 days. Server: PAYMENT_MODE=mock
const { chromium, devices } = require('./_pw.cjs');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' });
  const a = await ctx.newPage(); await a.goto(base + '/admin/login');
  ok(await a.locator('input[name=remember]').isChecked(), 'admin "stay signed in" is ticked by default');
  await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  const ck = (await ctx.cookies()).find((c) => /admin/i.test(c.name)); ok(!!ck && ck.expires - Date.now() / 1000 > 25 * 86400, 'admin session lasts about 30 days');
  // a review to approve
  const v = await a.request.post(base + '/api/feedback', { data: { kind: 'review', rating: 5, message: 'تقييم للموافقة', name: 'سارة', tags: [] }, headers: { origin: base } });
  ok(v.status() === 200, 'review submitted');
  await a.goto(base + '/admin/feedback'); await a.getByRole('button', { name: 'نشر', exact: true }).first().tap();
  await a.waitForSelector('text=تم نشر التقييم'); ok(true, 'approval shows a clear confirmation message');
  ok(await a.getByText('✓ منشور في المتجر').first().isVisible(), 'review shows the "published" badge');
  ok(await a.getByRole('button', { name: 'إخفاء من المتجر' }).first().isVisible(), 'a published review offers "hide from store"');
  ok((await a.request.get(base + '/ar')).status() === 200 && (await (await a.request.get(base + '/ar')).text()).includes('تقييم للموافقة'), 'approved review is public');
  // duplicate SKU does not crash
  await a.goto(base + '/admin/products'); const href = await a.locator('a[href^="/admin/products/"]:not([href$="/new"])').first().getAttribute('href');
  await a.goto(base + href);
  const sku0 = await a.locator('input[name=v_sku_0]').inputValue();
  await a.goto(base + '/admin/products/new'); await a.fill('[name=name_ar]', 'اختبار مكرر'); await a.fill('[name=name_en]', 'Dup Test'); await a.fill('[name=price]', '10'); await a.selectOption('[name=status]', 'draft');
  await a.locator('input[name=v_sku_0]').fill(sku0); await a.locator('form button:has-text("حفظ")').first().click();
  await a.waitForURL(/error=/); ok(/SKU|رمز/.test(decodeURIComponent(a.url())), 'duplicate SKU gives a readable message, not an error page');
  // customer login form uses a username field so the browser can save the login
  const m = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-AE' }); const p = await m.newPage(); await p.goto(base + '/ar/account/login');
  ok((await p.locator('#email').getAttribute('autocomplete')) === 'username' && (await p.locator('#password').getAttribute('autocomplete')) === 'current-password', 'customer login fields are marked for password saving');
  console.log(fails ? `FAILS ${fails}` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
