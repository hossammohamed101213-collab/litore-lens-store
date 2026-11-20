// Store label (invoice in waybill style, 100 x 150 mm): print button on every order, bulk printing of paid orders,
// "ready to print" cards with counts, and the QR receipt page that never shows private details.
const { chromium } = require('./_pw.cjs');
const Database = require('better-sqlite3');
const QRCode = require('qrcode');
const base = process.env.BASE || 'http://localhost:3100';
const engine = process.env.E2E_BROWSER || 'chromium'; const canPdf = engine === 'chromium' || engine === 'msedge'; // only Chromium can save a print job as a file
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const w = (sql, ...a) => { const d = new Database(process.env.DB_PATH); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
const q1 = (sql, ...a) => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare(sql).get(...a); } finally { d.close(); } };
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const shop = await (await b.newContext({ locale: 'en-AE' })).newPage(); await shop.goto(base + '/en');
  const v = q1("SELECT v.id vid FROM variants v JOIN products p ON p.id = v.product_id WHERE p.status = 'active' AND v.stock > 5 LIMIT 1");
  const buy = (key, name) => shop.evaluate(async ([vid, k, n]) => (await (await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ variantId: vid, quantity: 2 }], contact: { email: 'label-test@example.com', phone: '+971501234567' }, address: { name: n, phone: '+971501234567', line1: 'Villa 12 Street 8 Al Barsha', city: 'Dubai', country: 'AE' }, shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: k, locale: 'en' }) })).json()).orderId, [v.vid, key, name]);
  const o1 = await buy('label-key-00001', 'Sara Ahmed'); const o2 = await buy('label-key-00002', 'منى الكعبي'); const o3 = await buy('label-key-00003', 'Noura Unpaid');
  ok(!!o1 && !!o2 && !!o3, 'three sample orders were placed');
  w("UPDATE orders SET created_at = datetime('now','-3 hours') WHERE id = ?", o1); w("UPDATE orders SET created_at = datetime('now','-2 hours') WHERE id = ?", o2);
  w("UPDATE orders SET payment_status = 'pending' WHERE id = ?", o3);
  ok(!!q1('SELECT paid_at p FROM orders WHERE id = ?', o1).p, 'the payment time is recorded when an order becomes paid');

  const guest = await fetch(`${base}/admin/orders/print?id=${o1}`, { redirect: 'manual' }); ok(guest.status >= 300 && guest.status < 400, 'the print page needs an admin session');

  const ctx = await b.newContext({ locale: 'ar-AE', viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
  const a = await ctx.newPage(); await a.goto(base + '/admin/login');
  await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);

  // ---- order page: the print button is at the top, on its own, whatever the order's state
  for (const [id, what] of [[o1, 'paid'], [o3, 'unpaid']]) {
    await a.goto(`${base}/admin/orders/${id}`);
    const btn = a.locator('[data-order-print] a', { hasText: 'طباعة ملصق الطلب' }); const refund = a.locator('section', { has: a.getByRole('heading', { name: 'الاسترداد' }) });
    const by = (await btn.boundingBox()).y; const ry = (await refund.boundingBox()).y;
    ok(await btn.count() === 1 && by < ry, `${what} order: "print label" button sits at the top of the order, above the refund section`);
    ok(!/طباعة|الفاتورة/.test(await refund.innerText()), `${what} order: the refund section no longer carries any print link`);
  }
  ok(await a.locator('[data-order-print] a', { hasText: 'A4' }).count() === 1, 'the plain A4 invoice is still one tap away');

  // ---- one label
  await a.goto(`${base}/admin/orders/${o1}`); await a.locator('[data-order-print] a').first().click(); await a.waitForURL(/\/admin\/orders\/print\?id=/);
  const L = a.locator('.lt-label'); ok(await L.count() === 1, 'the order page button opens exactly this order\'s label');
  const txt = await L.innerText();
  ok(txt.includes(o1) && txt.includes('Sara Ahmed') && txt.includes('+971501234567') && txt.includes('Villa 12 Street 8 Al Barsha') && /DUBAI/i.test(txt), 'label: order number, name, phone and address for the courier');
  ok(await L.locator('[data-state]').getAttribute('data-state') === 'PAID' && txt.includes('مدفوع') && txt.includes('LITORE COSMETICS') && txt.includes('فاتورة المتجر'), 'label: PAID box, legal name and the store\'s own "store invoice" mark');
  ok(!/Al Falah|Blue Number/i.test(txt) && txt.includes('Abu Dhabi, UAE'), 'label: sender is the city only, never the owner\'s street address');
  const row = q1('SELECT total_minor t, subtotal_minor s, shipping_minor sh, receipt_token k FROM orders WHERE id = ?', o1);
  ok(txt.includes((row.t / 100).toFixed(2)) && txt.includes((row.s / 100).toFixed(2)) && txt.includes((row.sh / 100).toFixed(2)), 'label: subtotal, shipping and total match the order');
  ok(await L.locator('.bar svg').getAttribute('aria-label') === o1 && await L.locator('.bar svg rect').count() > 40, 'label: barcode carries the order number');
  ok(/^[A-Za-z0-9_-]{20}$/.test(row.k || ''), 'a secret 20-character receipt code was made for the order');
  // the QR must be exactly "<site address>/r/<secret code>" (the site address is whatever the store was built/run with)
  const dOf = (s) => (s.match(/ d="([^"]+)"/g) || []).join('|'); const gotQr = dOf(await L.locator('.qr').innerHTML()); let qrSite = '';
  for (const site of [base, 'https://litore.store']) if (gotQr.length > 100 && gotQr === dOf(await QRCode.toString(`${site}/r/${row.k}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }))) qrSite = site;
  ok(!!qrSite, `label: QR code is exactly the secret receipt link of this order (${qrSite}/r/…)`);
  const geo = await L.evaluate((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, over: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1, cells: [...el.querySelectorAll('.cell')].filter((c) => c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1).length }; });
  ok(Math.abs(geo.w / geo.h - 100 / 150) < 0.01 && Math.abs(geo.w - 377.95) < 2, `label is 100 x 150 mm (${Math.round(geo.w)} x ${Math.round(geo.h)} px)`);
  ok(!geo.over && geo.cells === 0, 'nothing on the label spills out of its box');
  if (process.env.SHOT) { const hi = await (await b.newContext({ storageState: await ctx.storageState(), deviceScaleFactor: 4, viewport: { width: 1280, height: 900 } })).newPage(); await hi.goto(a.url()); await hi.evaluate(() => document.fonts.ready); await hi.locator('.lt-label').screenshot({ path: process.env.SHOT }); await hi.close(); }
  await a.goto(`${base}/admin/orders/print?id=${o2}`); const t2 = await a.locator('.lt-label').innerText();
  const g2 = await a.locator('.lt-label').evaluate((el) => [...el.querySelectorAll('.cell')].filter((c) => c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1).length);
  ok(t2.includes('منى الكعبي') && g2 === 0, 'an Arabic customer name prints correctly and fits');
  await a.goto(`${base}/admin/orders/print?id=${o3}`);
  ok(await a.locator('.lt-label [data-state]').getAttribute('data-state') === 'UNPAID' && (await a.locator('.lt-label').innerText()).includes('غير مدفوع'), 'an unpaid order can be printed alone and says UNPAID in the box');

  // ---- the plain A4 invoice still prints, on this engine
  await a.goto(`${base}/admin/orders/${o1}/invoice`); await a.locator('.invoice [data-print]').click();
  ok(await a.evaluate(() => window.__prints) === 1, `[${engine}] the A4 invoice print button asks the browser to print`);
  await a.emulateMedia({ media: 'print' });
  const inv = await a.evaluate(() => { const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    const i = document.querySelector('.invoice'); const r = i.getBoundingClientRect();
    return { top: Math.round(r.top + scrollY), own: vis(i.querySelector('header')) && vis(i.querySelector('table')), frame: [...document.querySelectorAll('body header, body nav, .no-print')].filter((e) => !e.closest('.invoice') || e.classList.contains('no-print')).filter(vis).length, tall: i.scrollHeight <= Math.ceil(r.height) + 1 }; });
  ok(inv.top === 0 && inv.own && inv.frame === 0 && inv.tall, `[${engine}] A4 invoice prints from the top of the page, whole, without the panel frame (top ${inv.top}, frame parts ${inv.frame})`);
  await a.emulateMedia({ media: null });

  // ---- filter cards + selecting orders
  await a.goto(base + '/admin/orders');
  const card = async (k) => parseInt(await a.locator(`[data-card="/admin/orders${k}"] span`).first().innerText(), 10);
  ok(await card('?view=toprint') === 2 && await card('?view=unpaid') === 1 && await card('') === 3, `cards show the numbers: ready to print ${await card('?view=toprint')}, awaiting payment ${await card('?view=unpaid')}, all ${await card('')}`);
  const boxFor = (id) => a.locator(`input[name=id][value="${id}"]`);
  ok(await boxFor(o1).count() === 1 && await boxFor(o2).count() === 1 && await boxFor(o3).count() === 0, 'only paid orders can be ticked for batch printing');
  await a.locator('[data-card="/admin/orders?view=toprint"]').click(); await a.waitForURL(/view=toprint/);
  ok(await a.locator('tbody tr').count() === 2 && await a.locator('tbody tr', { hasText: o3 }).count() === 0, 'the "ready to print" card lists paid, not yet printed orders only');
  await a.locator('[data-select-all]').check(); ok(await boxFor(o1).isChecked() && await boxFor(o2).isChecked(), '"select all" ticks every order in the list');
  await a.locator('[data-select-all]').uncheck(); ok(!(await boxFor(o1).isChecked()), 'and clears them again');
  await boxFor(o2).check(); await a.getByRole('button', { name: /طباعة المحدد/ }).click(); await a.waitForURL(/\/admin\/orders\/print\?/);
  ok(await a.locator('.lt-label').count() === 1 && await a.locator(`.lt-label[data-label="${o2}"]`).count() === 1, 'ticking one order prints just that one');

  // ---- batch: oldest first, one page each, unpaid left out, remembered as printed
  await a.goto(`${base}/admin/orders/print?id=${o3}&id=${o2}&id=${o1}`);
  const order = await a.locator('.lt-label').evaluateAll((els) => els.map((e) => e.getAttribute('data-label')));
  ok(order.length === 2 && order[0] === o1 && order[1] === o2, 'a batch prints the paid orders only, oldest first');
  ok((await a.locator('[role=note]').innerText()).includes(o3), 'and says which order was left out');
  if (canPdf) {
    const pdf = await a.pdf({ preferCSSPageSize: true, printBackground: true });
    if (process.env.SHOT) require('fs').writeFileSync(process.env.SHOT.replace(/\.png$/, '.pdf'), pdf);
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(pages === 2, `the print job has one page per label (${pages} pages for 2 labels)`);
    const box = pdf.toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/); const mm = box ? [Number(box[1]) / 72 * 25.4, Number(box[2]) / 72 * 25.4] : [0, 0];
    ok(Math.abs(mm[0] - 100) < 1 && Math.abs(mm[1] - 150) < 1, `each printed page is 100 x 150 mm (${mm[0].toFixed(0)} x ${mm[1].toFixed(0)})`);
  }
  // what the printer gets, on this browser engine: only the labels, stacked from the top edge, each one ending its page
  await a.emulateMedia({ media: 'print' });
  const pr = await a.evaluate(() => { const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    const labels = [...document.querySelectorAll('.lt-label')]; const first = labels[0].getBoundingClientRect(); const second = labels[1].getBoundingClientRect();
    return { extra: [...document.querySelectorAll('.no-print, h1, [data-print], [role=note]')].filter(vis).length, labels: labels.filter(vis).length, top: Math.round(first.top + scrollY), left: Math.round(first.left), w: Math.round(first.width), h: Math.round(first.height), gap: Math.round(second.top - first.bottom),
      breaks: labels.map((l) => getComputedStyle(l).breakAfter || getComputedStyle(l).pageBreakAfter), bg: getComputedStyle(document.body).backgroundColor }; });
  ok(pr.labels === 2 && pr.extra === 0, `[${engine}] when printing, only the labels are on the paper (buttons, titles and notes are gone)`);
  ok(pr.top === 0 && pr.left === 0 && pr.gap === 0 && pr.w === 378 && pr.h >= 564 && pr.h <= 567, `[${engine}] labels start at the paper's corner at full size with no gaps (top ${pr.top}, left ${pr.left}, gap ${pr.gap}, ${pr.w}x${pr.h})`);
  ok(/page|always/.test(pr.breaks[0]) && !/page|always/.test(pr.breaks[1]), `[${engine}] every label ends its page and no blank page follows the last one`);
  await a.emulateMedia({ media: null });
  ok(!q1('SELECT printed_at p FROM orders WHERE id = ?', o1).p, 'opening the print page does not yet count as printed');
  await a.locator('[data-print-labels] button').click();
  ok(await a.evaluate(() => window.__prints) === 1, `[${engine}] one press asks the browser to print, at once and only once`);
  await a.waitForFunction((ids) => true, null).catch(() => {}); for (let i = 0; i < 40 && !q1('SELECT printed_at p FROM orders WHERE id = ?', o2).p; i++) await a.waitForTimeout(200);
  await a.locator('[data-print-hint]').waitFor({ timeout: 5000 }).catch(() => {});
  ok(await a.locator('[data-print-hint]').count() === 1, 'if the browser opens no print window, a short hint says how to print');
  ok(!!q1('SELECT printed_at p FROM orders WHERE id = ?', o1).p && !!q1('SELECT printed_at p FROM orders WHERE id = ?', o2).p && !q1('SELECT printed_at p FROM orders WHERE id = ?', o3).p, 'the printed orders are remembered');
  await a.goto(base + '/admin/orders');
  ok(await card('?view=toprint') === 0 && (await a.locator('tbody tr', { hasText: o1 }).innerText()).includes('✓'), 'they leave "ready to print" and carry a printed mark');
  ok(await boxFor(o1).count() === 1, 'a printed order can still be chosen and printed again');

  // ---- QR receipt: confirms order and payment, never the private details
  const pub = await (await b.newContext({ locale: 'ar-AE' })).newPage();
  let res = await pub.goto(`${base}/r/${row.k}`); const rt = await pub.locator('[data-receipt]').innerText();
  ok(res.status() === 200 && /\/ar\/r\//.test(pub.url()), 'scanning the QR opens the receipt page');
  ok(rt.includes(o1) && await pub.locator('[data-pay]').getAttribute('data-pay') === 'paid' && rt.includes('مدفوع'), 'receipt: order number and PAID');
  ok(rt.includes('Sara') && rt.includes('567') && rt.includes('Dubai'), 'receipt: first name, last 3 phone digits and city only');
  const html = await pub.content();
  ok(!html.includes('Ahmed') && !html.includes('971501234567') && !html.includes('501234') && !html.includes('Villa 12') && !html.includes('label-test@example.com'), 'receipt never contains the full name, phone, street address or e-mail');
  ok(/noindex/.test(html), 'receipt page is hidden from search engines');
  res = await pub.goto(`${base}/en/r/${row.k}`); ok(/Order receipt/.test(await pub.locator('[data-receipt]').innerText()), 'receipt is available in English too');
  w('UPDATE orders SET refund_minor = total_minor, payment_status = \'refunded\' WHERE id = ?', o1);
  await pub.goto(`${base}/ar/r/${row.k}`); ok(await pub.locator('[data-pay]').getAttribute('data-pay') === 'refunded' && (await pub.locator('[data-receipt]').innerText()).includes('المسترد'), 'receipt follows the order: a refund shows up on the next scan');
  for (const bad of [row.k.slice(0, 19) + (row.k.endsWith('A') ? 'B' : 'A'), o1, 'short', 'x'.repeat(20)]) { res = await pub.goto(`${base}/ar/r/${bad}`); if (res.status() !== 404) { ok(false, `a wrong receipt code must be 404 (${bad} -> ${res.status()})`); } }
  ok(true, 'wrong or guessed receipt codes (and the order number itself) open nothing');

  console.log(fails ? `FAILS ${fails}` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
