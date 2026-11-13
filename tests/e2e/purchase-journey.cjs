// E2E: needs a fresh DB + running server (see README.md). Playwright required.
const { chromium } = require('./_pw.cjs');
const base='http://localhost:3100';
const T={ar:{add:'أضيفي إلى السلة',checkout:'إتمام الطلب',place:'تأكيد الطلب',apply:'تطبيق'},en:{add:'Add to cart',checkout:'Checkout',place:'Place order',apply:'Apply'}};
let fails=0; const ok=(c,m)=>{console.log((c?'PASS':'FAIL'),m); if(!c) fails++;};
(async()=>{
  const b=await chromium.launch({args:['--no-proxy-server']});
  for (const loc of ['ar','en']) {
    const ctx=await b.newContext({viewport:{width:390,height:844}}); const pg=await ctx.newPage();
    await pg.goto(`${base}/${loc}/shop/sample-rose-quartz`);
    await pg.getByRole('button',{name:T[loc].add}).first().click();
    await pg.waitForSelector('[role=dialog]');
    await pg.waitForFunction(()=>document.querySelector('[role=dialog]')?.textContent.includes('100'));
    ok(true,`${loc}: added, mini cart open with price`);
    // bump qty to 2
    await pg.locator('[role=dialog] button:has-text("+")').click();
    await pg.waitForFunction(()=>document.querySelector('[role=dialog] output')?.textContent==='2');
    await pg.goto(`${base}/${loc}/cart`);
    await pg.waitForFunction(()=>document.body.textContent.includes('200'));
    ok(true,`${loc}: cart persisted after reload (qty 2 = 200)`);
    // language switch keeps cart
    await pg.locator('header a[hreflang]').click();
    await pg.waitForURL(new RegExp(`/${loc==='ar'?'en':'ar'}/cart`));
    await pg.waitForFunction(()=>document.body.textContent.includes('200'));
    ok(true,`${loc}: language switch kept page + cart`);
    await pg.goto(`${base}/${loc}/cart`);
    // coupon bad then good
    await pg.fill('#coupon','WRONG'); await pg.getByRole('button',{name:T[loc].apply}).click();
    await pg.waitForFunction(()=>document.querySelector('#coupon-msg')?.textContent.trim().length>0);
    ok(true,`${loc}: invalid coupon shows error`);
    await pg.fill('#coupon','SAMPLE10'); await pg.getByRole('button',{name:T[loc].apply}).click();
    await pg.waitForFunction(()=>document.body.textContent.includes('SAMPLE10'));
    ok(true,`${loc}: valid coupon applied`);
    await pg.getByRole('link',{name:T[loc].checkout}).last().click();
    await pg.waitForURL(/checkout/);
    // empty submit -> errors
    await pg.waitForFunction(()=>!document.querySelector('button[type=submit]').disabled);
    await pg.getByRole('button',{name:T[loc].place}).click();
    ok(await pg.locator('[aria-invalid=true]').count()>=4,`${loc}: required field errors shown beside fields`);
    await pg.fill('#email','a@b.com'); await pg.fill('#phone','+971501234567'); await pg.fill('#name','Test Name');
    await pg.fill('#city','Dubai'); await pg.fill('#line1','Street 1 Building 2');
    // failed payment first
    await pg.getByLabel(/فاشل|fails/).check();
    await pg.getByRole('button',{name:T[loc].place}).click();
    await pg.waitForURL(/checkout\/failed/);
    ok(true,`${loc}: failed payment -> failure page`);
    await pg.locator('main a').first().click(); await pg.waitForURL(/checkout$/);
    ok((await pg.evaluate(()=>document.body.textContent.includes('200')||document.body.textContent.includes('180'))),`${loc}: cart kept after failed payment`);
    await pg.fill('#email','a@b.com'); await pg.fill('#phone','+971501234567'); await pg.fill('#name','Test Name');
    await pg.fill('#city','Dubai'); await pg.fill('#line1','Street 1 Building 2');
    // double click success
    const btn=pg.getByRole('button',{name:T[loc].place});
    await Promise.all([btn.dblclick().catch(()=>{}), pg.waitForURL(/\/order\/LT-/)]);
    const id=pg.url().split('/').pop();
    ok(/^LT-/.test(id),`${loc}: order created ${id}`);
    const txt=await pg.locator('main').innerText();
    ok(txt.includes('180'),`${loc}: total reflects 10% coupon (180)`);
    // cart cleared
    await pg.goto(`${base}/${loc}/cart`);
    await pg.waitForTimeout(500);
    ok(!(await pg.locator('body').innerText()).includes('SAMPLE10'),`${loc}: cart cleared after order`);
    await ctx.close();
  }
  // server-side checks
  const r=await fetch(`${base}/api/checkout`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lines:[{variantId:'mock-1-v1',quantity:50}],contact:{email:'a@b.com',phone:'+971501234567'},address:{name:'Test',phone:'+971501234567',line1:'Street 1',city:'Dubai',country:'AE'},shippingRateId:'zone-AE',paymentMethod:'mock-paid',idempotencyKey:'abcdefgh-1234',locale:'en'})});
  ok(r.status===409,'API rejects quantity above stock (409)');
  const body={lines:[{variantId:'mock-1-v1',quantity:1}],contact:{email:'a@b.com',phone:'+971501234567'},address:{name:'Test',phone:'+971501234567',line1:'Street 1',city:'Dubai',country:'AE'},shippingRateId:'zone-AE',paymentMethod:'mock-paid',idempotencyKey:'idem-key-0001',locale:'en'};
  const a=await (await fetch(`${base}/api/checkout`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).json();
  const c=await (await fetch(`${base}/api/checkout`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).json();
  ok(a.orderId===c.orderId&&c.duplicate,'same idempotency key returns same order (no duplicate)');
  await b.close(); console.log('FAILS:',fails); process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
