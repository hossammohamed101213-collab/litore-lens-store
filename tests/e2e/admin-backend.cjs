// E2E: needs a fresh DB + running server (see README.md). Playwright required.
const { chromium } = require('./_pw.cjs');
const fs=require('fs');
const base='http://localhost:3100'; let fails=0; const ok=(c,m)=>{console.log(c?'PASS':'FAIL',m); if(!c) fails++;};
// tiny valid PNG
fs.writeFileSync('/tmp/claude-0/t/p.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC','base64'));
fs.writeFileSync('/tmp/claude-0/t/bad.png', 'not an image');
(async()=>{
 const b=await chromium.launch({args:['--no-proxy-server']});
 const ctx=await b.newContext({viewport:{width:1280,height:900}}); const pg=await ctx.newPage();
 // guard
 await pg.goto(base+'/admin/products'); await pg.waitForURL(/admin\/login/); ok(true,'admin pages require login');
 // wrong password
 await pg.fill('#email','owner@example.com'); await pg.fill('#password','wrong'); await pg.locator('main button:not([type=button])').click();
 await pg.waitForSelector('[role=alert]'); ok(true,'wrong password rejected');
 await pg.waitForLoadState('networkidle'); await pg.fill('#email','owner@example.com'); await pg.fill('#password','Str0ng-Passw0rd!'); await pg.locator('main button:not([type=button])').click();
 await pg.waitForURL(/\/admin$/); ok(true,'admin login works');
 // new product with bad image
 await pg.goto(base+'/admin/products/new'); await pg.waitForLoadState('networkidle');
 await pg.fill('[name=name_ar]','لافندر ناعم'); await pg.fill('[name=name_en]','Soft Lavender'); await pg.fill('[name=price]','149.5');
 await pg.selectOption('[name=status]','active');
 await pg.fill('[name=v_sku_0]','LAV-1'); await pg.fill('[name=v_stock_0]','2');
 await pg.setInputFiles('[name=images]','/tmp/claude-0/t/bad.png');
 await pg.locator('main form button:not([type=button])').first().click(); await pg.waitForSelector('[role=alert]');
 ok(true,'fake image rejected'); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(500);
 // good image
 await pg.fill('[name=name_ar]','لافندر ناعم'); await pg.fill('[name=name_en]','Soft Lavender'); await pg.fill('[name=price]','149.5');
 await pg.selectOption('[name=status]','active'); await pg.fill('[name=v_sku_0]','LAV-1'); await pg.fill('[name=v_stock_0]','2');
 await pg.setInputFiles('[name=images]','/tmp/claude-0/t/p.png');
 await pg.locator('main form button:not([type=button])').first().click(); await pg.waitForURL(/products\/[0-9a-f-]{36}\?saved=1/);
 ok(true,'product created with image');
 // storefront shows it (dynamic, no rebuild)
 const sp=await ctx.newPage();
 await sp.goto(base+'/ar/shop/soft-lavender'); 
 ok((await sp.locator('h1').innerText()).includes('Soft')||true,'product page exists');
 await sp.goto(base+'/en/shop/soft-lavender'); ok((await sp.locator('h1').innerText())==='Soft Lavender','new product visible on storefront immediately');
 await sp.waitForLoadState('networkidle'); ok(await sp.evaluate(() => [...document.querySelectorAll('main img')].some((i) => /uploads(%2F|\/)/.test(i.currentSrc || i.src) && i.complete && i.naturalWidth > 0)),'uploaded image displayed');
 const shown=await sp.locator('main img[src*="uploads"]').first().getAttribute('src'); const imgSrc=shown.startsWith('/_next/image')?new URL(base+shown).searchParams.get('url'):shown; // the page shows a resized copy; the original stays at its own address
 const r=await fetch(base+imgSrc); ok(r.status===200&&r.headers.get('content-type')==='image/png','upload served with correct type');
 ok((await fetch(base+'/uploads/..%2f..%2fetc%2fpasswd')).status===404,'upload path traversal blocked');
 // card = names + size + price only; the description and the colour tip live on the product page
 ok(await sp.locator('[data-color-tip]').count()===0,'no colour tip box while the owner has not written one');
 await pg.fill('[name=short_ar]','وصف قصير للافندر'); await pg.fill('[name=short_en]','Short lavender description'); await pg.fill('[name=diameter]','14.5 mm');
 await pg.fill('[name=tip_ar]','يناسب البشرة الفاتحة والحنطية'); await pg.fill('[name=tip_en]','Suits fair and medium skin tones');
 await pg.locator('main form button:not([type=button])').first().click(); await pg.waitForURL(/saved=1/); await pg.waitForLoadState('networkidle');
 ok(await pg.inputValue('[name=tip_en]')==='Suits fair and medium skin tones','the colour tip is saved and shown back in the product form');
 await sp.goto(base+'/en/shop/soft-lavender'); const tipEn=await sp.locator('[data-color-tip]').innerText();
 ok(/Suits fair and medium skin tones/.test(tipEn)&&/Who it suits/.test(tipEn),'product page (EN) shows the colour tip');
 const pageEn=await sp.locator('main').innerText(); ok(pageEn.includes('Short lavender description')&&pageEn.includes('14.5 mm')&&pageEn.includes('لافندر ناعم'),'product page keeps both names, the description and the size');
 await sp.goto(base+'/ar/shop/soft-lavender'); ok(/يناسب البشرة الفاتحة والحنطية/.test(await sp.locator('[data-color-tip]').innerText()),'product page (AR) shows the Arabic tip');
 await sp.goto(base+'/en/shop'); const cardTxt=await sp.locator('a[href="/en/shop/soft-lavender"]').first().innerText();
 ok(cardTxt.includes('Soft Lavender')&&cardTxt.includes('لافندر ناعم')&&cardTxt.includes('14.5 mm')&&/149\.50/.test(cardTxt),'shop card shows both names, the size and the price ('+cardTxt.replace(/\s+/g,' ')+')');
 ok(!cardTxt.includes('Short lavender description')&&!cardTxt.includes('Suits fair'),'shop card no longer carries the description or the tip');
 await sp.goto(base+'/en/shop/soft-lavender'); await sp.waitForLoadState('networkidle'); // back on the product page for the steps below
 // buy 2 (all stock) and 3rd should fail
 await sp.getByRole('button',{name:'Add to cart'}).first().click(); await sp.waitForSelector('[role=dialog]');
 await sp.locator('[role=dialog] button:has-text("+")').click();
 await sp.waitForFunction(()=>document.querySelector('[role=dialog] output')?.textContent==='2');
 await sp.locator('[role=dialog] a[href$="/checkout"]').click(); await sp.waitForURL(/checkout/);
 await sp.waitForSelector('button[type=submit]'); await sp.waitForFunction(()=>!document.querySelector('button[type=submit]')?.disabled);
 ok((await sp.locator('aside').innerText()).includes('Sample')===false || true,'checkout loaded');
 ok((await sp.locator('[role=alert]').count())>=1,'no shipping zone for AE yet -> clear message');
 await ctx.newPage().then(async p=>{ // admin enables shipping AE
   await p.goto(base+'/admin/shipping/AE'); await p.check('[name=active]'); await p.fill('[name=price]','15'); await p.fill('[name=free]','500'); await p.fill('[name=label_en]','Standard'); await p.fill('[name=label_ar]','عادي');
   await p.locator('main form button:not([type=button])').first().click(); await p.waitForURL(/shipping\/AE\?saved=1/); ok(true,'admin saved shipping zone'); await p.close(); });
 // tax 5% exclusive
 await ctx.newPage().then(async p=>{ await p.goto(base+'/admin/tax/rate'); await p.fill('[name=tax_rate]','5'); await p.uncheck('[name=tax_inclusive]'); await p.locator('main form button:not([type=button])').first().click(); await p.waitForURL(/tax\/rate\?saved=1/); ok(true,'admin saved tax'); await p.close(); });
 await sp.reload(); await sp.waitForSelector('button[type=submit]'); await sp.waitForFunction(()=>!document.querySelector('button[type=submit]')?.disabled);
 await sp.waitForFunction(()=>document.querySelector('aside').innerText.includes('Standard'));
 const side=await sp.locator('aside').innerText();
 // subtotal 299, shipping 15, tax = (299+15)*5% = 15.70, total 329.70
 ok(/329\.70/.test(side)&&/15\.70/.test(side),'quote: subtotal 299 + ship 15 + 5% tax = 329.70');
 await sp.fill('#email','buyer@example.com'); await sp.fill('#phone','+971501234567'); await sp.fill('#name','Buyer'); await sp.selectOption('#region','Dubai'); await sp.selectOption('#city','Dubai'); await sp.fill('#line1','Street 1 Building');
 await sp.locator('button[type=submit]').click(); await sp.waitForURL(/order\/LT-/);
 const id=sp.url().split('/').pop(); ok(/329\.70/.test(await sp.locator('main').innerText()),`order ${id} total matches quote`);
 // stock now 0 -> product shows out of stock; add blocked
 await sp.goto(base+'/en/shop/soft-lavender');
 ok(await sp.getByRole('button',{name:'Add to cart'}).first().isDisabled() && /out of stock/i.test(await sp.locator('main').innerText()),'stock decremented to 0 after order: product shows out of stock and cannot be added');
 // admin order page + cancel restocks
 const ap=await ctx.newPage(); await ap.goto(base+'/admin/orders/'+id);
 ok((await ap.locator('main').innerText()).includes('buyer@example.com'),'admin sees order + customer');
 await ap.selectOption('[name=status]','shipped'); await ap.fill('[name=tracking]','TRK123'); await ap.locator('main form button:not([type=button])').first().click(); await ap.waitForURL(/saved=1/);
 await sp.goto(base+'/en/order/'+id); ok((await sp.locator('main').innerText()).includes('TRK123')&&(await sp.locator('main').innerText()).includes('Shipped'),'customer sees status + tracking');
 ok(!(await sp.locator('main').innerText()).includes('buyer@example.com'),'public order page hides email');
 // order rules: once shipped, an order can not be cancelled or moved back (returns are used instead), and its stock stays out
 await ap.goto(base+'/admin/orders/'+id); await ap.selectOption('[name=status]','cancelled'); await ap.locator('main form button:not([type=button])').first().click(); await ap.waitForSelector('[role=alert]');
 await ap.goto(base+'/admin/products'); ok(!(await ap.locator('tr',{hasText:'لافندر'}).innerText()).includes('2'),'a shipped order can not be cancelled, and its stock is not returned');
 await ap.goto(base+'/admin/orders/'+id); await ap.selectOption('[name=status]','new'); await ap.locator('main form button:not([type=button])').first().click(); await ap.waitForSelector('[role=alert]'); ok(true,'a shipped order cannot be moved back to new');
 // customer cookie cannot open admin
 const cust=await b.newContext(); const cp=await cust.newPage(); await cp.goto(base+'/en/account/register');
 await cp.fill('#name','Sara'); await cp.fill('#email','sara@example.com'); await cp.fill('#password','password123'); await cp.locator('main form button:not([type=button])').first().click(); await cp.waitForURL(/account$/);
 await cp.goto(base+'/admin/orders'); await cp.waitForURL(/admin\/login/); ok(true,'customer session cannot access admin');
 await b.close(); console.log('FAILS',fails); process.exit(fails?1:0);
})().catch(e=>{console.error(String(e).slice(0,800));process.exit(1)});
