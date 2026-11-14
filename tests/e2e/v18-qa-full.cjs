// Full QA: every public page x ar/en x 4 widths (status, overflow, console errors, images, links, labels),
// language switch, password eye, Enter key on all forms, copy/paste, mobile navigation. Fresh DB + SEED_SAMPLE=true.
const { chromium, devices } = require('./_pw.cjs');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const log = [];
const ok = (c, m) => { if (!c) { fails++; log.push('FAIL ' + m); console.log('FAIL', m); } else if (process.env.V) console.log('PASS', m); };
const WIDTHS = [[360, 740], [390, 844], [768, 1024], [1280, 800]];
const PAGES = ['', '/shop', '/search?q=rose', '/cart', '/checkout', '/track', '/account', '/account/login', '/account/register', '/wishlist', '/offers', '/prices', '/color-guide', '/care', '/about', '/contact', '/faq', '/shipping', '/returns', '/privacy', '/terms', '/complaints', '/affiliate'];
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const mk = async (w, h, locale, mobile) => { const c = await b.newContext({ viewport: { width: w, height: h }, locale: locale === 'ar' ? 'ar-AE' : 'en-AE', hasTouch: mobile, isMobile: mobile, acceptDownloads: true }); await c.addInitScript(() => { try { sessionStorage.setItem('litore_splash', '1'); localStorage.setItem('litore.cookies.v1', 'essential'); } catch {} }); return c; };

  // find a product page
  const probe = await (await mk(1280, 800, 'ar')).newPage(); await probe.goto(base + '/ar/shop');
  const productHref = (await probe.locator('a[href*="/shop/"]').first().getAttribute('href')).replace(/^\/(ar|en)/, '');
  await probe.context().close();
  const all = [...PAGES, productHref];
  const links = new Set();

  for (const locale of ['ar', 'en']) for (const [w, h] of WIDTHS) {
    const ctx = await mk(w, h, locale, w < 800); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push('pageerror ' + String(e).slice(0, 150)));
    p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|net::ERR/.test(m.text())) errs.push('console ' + m.text().slice(0, 150)); });
    for (const path of all) {
      const url = `${base}/${locale}${path}`; errs.length = 0;
      const r = await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.waitForLoadState('load').catch(()=>{}); await p.waitForTimeout(500);
      const tag = `${locale} ${w}px ${path || '/'}`;
      ok(r.status() === 200, `${tag}: status ${r.status()}`);
      const m = await p.evaluate(() => {
        const bad = [];
        const sw = document.documentElement.scrollWidth, iw = innerWidth;
        // elements poking out of the viewport (ignore fixed/rail/offscreen decoration)
        document.querySelectorAll('body *').forEach((el) => {
          const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return;
          const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return;
          if ((r.right > iw + 1 || r.left < -1) && !el.closest('[aria-hidden="true"],.ticker,[class*="overflow"],svg,nav ul')) bad.push(el.tagName + '.' + String(el.className).slice(0, 40));
        });
        const imgs = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src).map((i) => i.src.slice(-50));
        const noAlt = [...document.images].filter((i) => !i.hasAttribute('alt')).length;
        const btnNoName = [...document.querySelectorAll('button,a[href]')].filter((e) => !(e.getAttribute('aria-label') || e.textContent.trim() || e.querySelector('img[alt]:not([alt=""])') || e.getAttribute('title'))).map((e) => e.outerHTML.slice(0, 80));
        const inputsNoLabel = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select')].filter((i) => !(i.labels && i.labels.length) && !i.getAttribute('aria-label') && !i.getAttribute('placeholder')).map((i) => i.outerHTML.slice(0, 80));
        const smallInput = [...document.querySelectorAll('input,select,textarea')].filter((i) => parseFloat(getComputedStyle(i).fontSize) < 16 && i.type !== 'hidden' && i.type !== 'checkbox' && i.type !== 'radio').length;
        document.querySelectorAll('a[href^="/"]').forEach((a) => window.__l = (window.__l || new Set()).add(a.getAttribute('href').split('#')[0]));
        return { over: sw > iw + 1 ? sw - iw : 0, bad: bad.slice(0, 3), imgs, noAlt, btnNoName: btnNoName.slice(0, 3), inputsNoLabel: inputsNoLabel.slice(0, 3), smallInput, links: [...(window.__l || [])], dir: document.documentElement.dir, lang: document.documentElement.lang, title: document.title };
      });
      ok(m.over === 0, `${tag}: horizontal overflow ${m.over}px`);
      ok(m.bad.length === 0, `${tag}: elements outside viewport ${m.bad.join(', ')}`);
      ok(m.imgs.length === 0, `${tag}: broken images ${m.imgs}`);
      ok(m.noAlt === 0, `${tag}: images without alt ${m.noAlt}`);
      ok(m.btnNoName.length === 0, `${tag}: links/buttons without a name ${m.btnNoName.join(' | ')}`);
      ok(m.inputsNoLabel.length === 0, `${tag}: inputs without a label ${m.inputsNoLabel.join(' | ')}`);
      ok(m.smallInput === 0, `${tag}: inputs under 16px (iOS zoom)`);
      ok(m.dir === (locale === 'ar' ? 'rtl' : 'ltr') && m.lang === locale, `${tag}: dir/lang ${m.dir}/${m.lang}`);
      ok(m.title && m.title.length > 3, `${tag}: has title`);
      ok(errs.length === 0, `${tag}: console errors ${errs.join(' | ')}`);
      if (w === 1280) m.links.forEach((l) => links.add(l));
    }
    await ctx.close();
  }

  // every internal link found must resolve
  const bad404 = [];
  for (const l of links) { if (/^\/(api|uploads|_next)/.test(l)) continue; const r = await fetch(base + l, { redirect: 'manual' }); if (r.status >= 400) bad404.push(`${l} -> ${r.status}`); }
  ok(bad404.length === 0, `internal links resolve (${links.size} checked): ${bad404.join(', ')}`);
  const nf = await fetch(base + '/ar/this-page-does-not-exist'); ok(nf.status === 404, '404 page returns 404');

  // language switch keeps the same page
  const lc = await mk(390, 844, 'ar', true); const lp = await lc.newPage();
  for (const path of ['/shop', productHref, '/faq', '/account/login', '/complaints']) {
    await lp.goto(`${base}/ar${path}`); await lp.waitForTimeout(300);
    await lp.locator('a[hreflang="en"], a:has-text("English")').first().click(); await lp.waitForURL(/\/en\//); 
    ok(lp.url() === `${base}/en${path}`, `language switch ar->en keeps page ${path} (got ${lp.url().replace(base, '')})`);
    await lp.locator('a[hreflang="ar"], a:has-text("العربية")').first().click(); await lp.waitForURL(/\/ar\//);
    ok(lp.url() === `${base}/ar${path}`, `language switch en->ar keeps page ${path}`);
  }
  await lc.close();

  // mobile navigation by tapping, checking layout after each client-side transition
  const nc = await mk(390, 844, 'en', true); const np = await nc.newPage(); await np.goto(base + '/en');
  const navHrefs = await np.evaluate(() => [...new Set([...document.querySelectorAll('header a[href^="/en"]')].map((a) => a.getAttribute('href')))]);
  for (const href of navHrefs) {
    await np.goto(base + '/en'); const lk = np.locator(`header a[href="${href}"]`).first(); if (!(await lk.isVisible())) continue; await lk.click(); await np.waitForURL(`**${href}`); await np.waitForTimeout(300);
    const over = await np.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(over <= 1, `after tapping header link ${href}: no horizontal overflow (${over})`);
    ok((await np.locator('h1').count()) >= 1, `after tapping ${href}: page has a heading`);
  }
  await nc.close();

  // password eye: sits at the typing end of the box, toggles, never covers text, Enter still submits
  for (const [locale, path, id] of [['ar', '/account/login', '#password'], ['en', '/account/login', '#password'], ['ar', '/account/register', '#password'], ['en', '/account/register', '#password']]) {
    const c = await mk(390, 844, locale, true); const p = await c.newPage(); await p.goto(base + '/' + locale + path); await p.waitForTimeout(300);
    const inp = p.locator(id); const eye = inp.locator('xpath=following-sibling::button');
    const ib = await inp.boundingBox(), eb = await eye.boundingBox();
    ok(eb.x >= ib.x && eb.x + eb.width <= ib.x + ib.width + 1 && eb.y >= ib.y && eb.y + eb.height <= ib.y + ib.height + 1, `${locale}${path}: eye is inside the password box`);
    ok(eb.x + eb.width / 2 > ib.x + ib.width / 2, `${locale}${path}: eye is on the right (text starts left)`);
    await inp.fill('Secret-123'); ok((await inp.getAttribute('type')) === 'password', 'password hidden by default');
    await eye.click(); ok((await inp.getAttribute('type')) === 'text', `${locale}${path}: eye shows the password`);
    await eye.click(); ok((await inp.getAttribute('type')) === 'password', `${locale}${path}: eye hides it again`);
    const pad = await inp.evaluate((e) => parseFloat(getComputedStyle(e).paddingRight)); ok(pad >= 40, `${locale}${path}: text never runs under the eye (padding ${pad})`);
    await c.close();
  }

  // Enter key submits every form (keyboard only)
  const ec = await mk(390, 844, 'en', true); const ep = await ec.newPage();
  // search
  await ep.goto(base + '/en/search'); await ep.locator('input[type=search], input[name=q]').first().fill('rose'); await ep.keyboard.press('Enter'); await ep.waitForURL(/q=rose/);
  ok(/q=rose/.test(ep.url()), 'Enter in search runs the search');
  // track order
  await ep.goto(base + '/en/track'); await ep.locator('input').first().fill('LT-NOTREAL1'); await ep.keyboard.press('Enter'); await ep.waitForTimeout(900);
  ok(/LT-NOTREAL1|not find|No order|found/i.test(await ep.locator('main').innerText()), 'Enter in track-order submits');
  // login: wrong password shows an error via Enter
  await ep.goto(base + '/en/account/login'); await ep.fill('#email', 'nobody@example.com'); await ep.fill('#password', 'WrongPass123'); await ep.keyboard.press('Enter'); await ep.waitForTimeout(1200);
  ok(/incorrect|Too many/i.test(await ep.locator('main').innerText()), 'Enter in login submits (shows result)');
  // register with empty fields: validation errors appear via Enter
  await ep.goto(base + '/en/account/register'); await ep.locator('#email').click(); await ep.keyboard.press('Enter'); await ep.waitForTimeout(500);
  ok((await ep.locator('[id$="-err"]').count()) >= 1, 'Enter in register shows validation errors');
  // forgot password
  await ep.goto(base + '/en/account/login'); const fg = ep.locator('button:has-text("Forgot"), a:has-text("Forgot")').first(); if (await fg.count()) { await fg.click(); await ep.waitForTimeout(300); const idf = ep.locator('input').first(); await idf.fill('someone@example.com'); await ep.keyboard.press('Enter'); await ep.waitForTimeout(1200); ok(/request|link|WhatsApp|Sent/i.test(await ep.locator('main').innerText()), 'Enter in forgot-password submits'); }
  // review (name field + stars): Enter in name input submits
  await ep.goto(base + '/en'); await ep.locator('button[role=radio]').nth(3).scrollIntoViewIfNeeded(); await ep.locator('button[role=radio]').nth(3).click();
  await ep.locator('input[placeholder^="Your name"]').fill('Mona'); await ep.keyboard.press('Enter'); await ep.waitForTimeout(1200);
  ok(/Thank you for your review/.test(await ep.locator('main').innerText()), 'Enter in review form submits');
  // complaints: contact input Enter
  await ep.goto(base + '/en/complaints'); await ep.waitForTimeout(300); const ready = ep.locator('button:has-text("ready"), button:has-text("Skip")').first(); if (await ready.count()) await ready.click();
  await ep.waitForTimeout(400); const ta = ep.locator('textarea').first(); if (await ta.count()) { await ta.fill('This is a test complaint message'); await ep.locator('input').last().click(); await ep.keyboard.press('Enter'); await ep.waitForTimeout(1200); ok(/received your message|thank you/i.test(await ep.locator('main').innerText()), 'Enter in complaints form submits'); }
  // affiliate
  await ep.goto(base + '/en/affiliate'); const ai = ep.locator('input'); await ai.nth(0).fill('Sara'); await ai.nth(1).fill('+971501234567'); await ep.keyboard.press('Enter'); await ep.waitForTimeout(1200);
  ok(/got your request|Too many|valid|required/i.test(await ep.locator('main').innerText()), 'Enter in affiliate form submits');
  // add to cart then coupon + checkout Enter
  await ep.goto(base + '/en' + productHref); await ep.waitForTimeout(500);
  const add = ep.locator('button:has-text("Add to cart")').first();
  if (await add.isEnabled()) { await add.click(); await ep.waitForTimeout(600); await ep.goto(base + '/en/checkout'); await ep.waitForTimeout(900);
    await ep.locator('#email').click(); await ep.keyboard.press('Enter'); await ep.waitForTimeout(500); ok((await ep.locator('[aria-invalid=true]').count()) >= 3, 'Enter in checkout validates all required fields');
    await ep.fill('#email', 'qa@example.com'); await ep.fill('#phone', '+971501234567'); await ep.fill('#name', 'QA Tester'); await ep.fill('#city', 'Dubai'); await ep.fill('#line1', 'Street 1 Building 2');
    await ep.locator('#line1').press('Enter'); await ep.waitForURL(/\/order\//, { timeout: 8000 }).catch(() => {});
    ok(/\/en\/order\/LT-/.test(ep.url()), 'Enter in checkout places the order (' + ep.url().replace(base, '') + ')');
  } else console.log('NOTE: sample product not purchasable, checkout Enter skipped');
  await ec.close();

  // copy & paste everywhere
  const cc = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-AE', permissions: ['clipboard-read', 'clipboard-write'] }); await cc.addInitScript(() => { try { sessionStorage.setItem('litore_splash', '1'); localStorage.setItem('litore.cookies.v1', 'essential'); } catch {} });
  const cp = await cc.newPage();
  for (const path of ['/en', '/en/shop', '/en' + productHref, '/en/faq', '/en/privacy', '/en/account/login', '/en/complaints']) {
    await cp.goto(base + path); await cp.waitForTimeout(300);
    const r = await cp.evaluate(() => {
      const sel = [...document.querySelectorAll('main p, main h1, main h2, main h3, main li, main span, main a, main dd, main dt')].filter((e) => e.textContent.trim().length > 3 && getComputedStyle(e).display !== 'none');
      const blocked = sel.filter((e) => getComputedStyle(e).userSelect === 'none').map((e) => e.tagName + ':' + e.textContent.trim().slice(0, 25));
      let prevented = false; const h = (ev) => { if (ev.defaultPrevented) prevented = true; }; 
      ['copy', 'cut', 'paste', 'contextmenu', 'selectstart'].forEach((t) => document.addEventListener(t, (ev) => setTimeout(() => { if (ev.defaultPrevented) prevented = true; }, 0)));
      const p = document.querySelector('main p, main h1'); const ev = new ClipboardEvent('copy', { cancelable: true, bubbles: true }); p && p.dispatchEvent(ev);
      return { blocked: blocked.slice(0, 5), copyPrevented: ev.defaultPrevented };
    });
    ok(r.blocked.length === 0, `${path}: text is selectable (${r.blocked.join(', ')})`);
    ok(!r.copyPrevented, `${path}: copy is not blocked`);
  }
  // real copy -> paste into inputs
  await cp.goto(base + '/en/faq'); await cp.locator('main h1').first().selectText(); await cp.keyboard.press('Control+C');
  const copied = await cp.evaluate(() => navigator.clipboard.readText()); ok(copied.trim().length > 3, 'Ctrl+C copies page text: ' + copied.trim().slice(0, 30));
  for (const [path, sel] of [['/en/search', 'input[name=q], input[type=search]'], ['/en/account/login', '#email'], ['/en/account/login', '#password'], ['/en/track', 'input'], ['/en/complaints', 'textarea']]) {
    await cp.goto(base + path); await cp.waitForTimeout(400);
    if (path === '/en/complaints') { const sk = cp.locator('button:has-text("ready"), button:has-text("Skip")').first(); if (await sk.count()) await sk.click(); await cp.waitForTimeout(300); }
    const f = cp.locator(sel).first(); await f.click(); await cp.keyboard.press('Control+V'); const v = await f.inputValue(); ok(v.trim().length > 3, `paste works in ${path} ${sel}`);
  }
  await cc.close(); await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); if (fails) console.log(log.slice(0, 80).join('\n')); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
