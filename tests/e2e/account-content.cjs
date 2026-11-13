// E2E: needs a fresh DB + running server (see README.md). Playwright required.
const { chromium } = require('playwright');
const base='http://localhost:3100'; let fails=0; const ok=(c,m)=>{console.log(c?'PASS':'FAIL',m); if(!c) fails++;};
(async()=>{
 const b=await chromium.launch({args:['--no-proxy-server']});
 for (const loc of ['ar','en']) {
  const ctx=await b.newContext({viewport:{width:390,height:844}}); const pg=await ctx.newPage();
  // content pages
  for (const s of ['about','contact','faq','shipping','returns','privacy','terms','care','color-guide','track','wishlist']) {
    const r=await pg.goto(`${base}/${loc}/${s}`); if(r.status()!==200) ok(false,`${loc}/${s} ${r.status()}`);
  }
  ok(true,`${loc}: all content pages 200`);
  // guest -> account redirects to login
  await pg.goto(`${base}/${loc}/account`); await pg.waitForURL(/account\/login/); ok(true,`${loc}: guest redirected to login`);
  // register validation
  await pg.goto(`${base}/${loc}/account/register`);
  await pg.locator('main form button').last().click();
  ok(await pg.locator('[aria-invalid=true]').count()>=3,`${loc}: register shows field errors`);
  await pg.fill('#name','Sara'); await pg.fill('#email','sara-'+loc+'@example.com'); await pg.fill('#password','password123');
  await pg.locator('main form button').last().click(); await pg.waitForURL(/\/account$/);
  ok(true,`${loc}: registered and landed on account`);
  // address add
  await pg.goto(`${base}/${loc}/account/addresses`);
  await pg.fill('#label','Home'); await pg.fill('#name','Sara'); await pg.fill('#phone','+971501234567'); await pg.fill('#line1','Street 1'); await pg.fill('#city','Dubai');
  await pg.locator('main form button').last().click();
  await pg.waitForFunction(()=>document.querySelector('ul')?.textContent.includes('Home'));
  ok(true,`${loc}: address saved`);
  // wishlist toggle
  await pg.goto(`${base}/${loc}/shop/sample-soft-mauve`);
  await pg.locator('button[aria-pressed]').click();
  await pg.goto(`${base}/${loc}/wishlist`);
  await pg.waitForFunction(()=>document.querySelectorAll('main li').length===1);
  ok(true,`${loc}: wishlist shows saved product`);
  // order then orders list + track
  await pg.goto(`${base}/${loc}/shop/sample-rose-quartz`);
  await pg.locator('button:not([disabled])',{hasText:/أضيفي|Add to cart/}).first().click();
  await pg.waitForSelector('[role=dialog]'); await pg.locator('[role=dialog] a[href$="/checkout"]').click(); await pg.waitForURL(/checkout/);
  await pg.waitForFunction(()=>!document.querySelector('button[type=submit]').disabled);
  await pg.fill('#email','sara-'+loc+'@example.com'); await pg.fill('#phone','+971501234567'); await pg.fill('#name','Sara'); await pg.fill('#city','Dubai'); await pg.fill('#line1','Street 1 Building');
  await pg.locator('button[type=submit]').click(); await pg.waitForURL(/order\/LT-/);
  const id=pg.url().split('/').pop();
  await pg.goto(`${base}/${loc}/account/orders`); await pg.waitForFunction((i)=>document.body.textContent.includes(i),id);
  ok(true,`${loc}: order ${id} appears in account orders`);
  await pg.goto(`${base}/${loc}/track`); await pg.fill('#order',id.toLowerCase()); await pg.locator('main form button').click(); await pg.waitForURL(new RegExp(id));
  ok(true,`${loc}: tracking by order number works`);
  ok(!(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`${loc}: no horizontal scroll on order page`);
  // logout
  await pg.goto(`${base}/${loc}/account`); await pg.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('Sara'));
  await pg.locator('main button').first().click(); await pg.waitForURL(/login/); ok(true,`${loc}: logout works`);
  await ctx.close();
 }
 await b.close(); console.log('FAILS',fails); process.exit(fails?1:0);
})().catch(e=>{console.error(String(e).slice(0,600));process.exit(1)});
