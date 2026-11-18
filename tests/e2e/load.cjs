// Concurrency + load on the TEST server (fresh DB, SEED_SAMPLE=true, PAYMENT_MODE=mock). Nothing here may run against the live store.
//  1) 300 customers order at the same moment with 20 pieces in stock  -> exactly 20 orders, stock 0, never negative
//  2) 60 customers use a coupon limited to 5 uses at the same moment  -> exactly 5 discounted orders
//  3) reading pages with 50 / 150 / 300 visitors at once               -> no errors; response times reported
// Run: DB_PATH=/path/to/l.db BASE=http://localhost:3100 node tests/e2e/load.cjs
const Database = require('better-sqlite3');
const { execSync } = require('child_process');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const w = (sql, ...a) => { const d = new Database(process.env.DB_PATH); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
const q1 = (sql, ...a) => { const d = new Database(process.env.DB_PATH, { readonly: true }); try { return d.prepare(sql).get(...a); } finally { d.close(); } };
const rss = () => { try { const pid = execSync("pgrep -f 'next-server' | head -1").toString().trim(); return Math.round(Number(execSync(`ps -o rss= -p ${pid}`).toString().trim()) / 1024); } catch { return null; } };
const order = (vid, i, extra = {}) => fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.${Math.floor(i / 250)}.${i % 250}.7` }, body: JSON.stringify({
  lines: [{ variantId: vid, quantity: 1 }], contact: { email: `load${i}@example.com`, phone: '+971501234567' },
  address: { name: 'Load Test', phone: '+971501234567', line1: 'Street 1 Building 2', city: 'Dubai', country: 'AE' },
  shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: `load-key-${String(i).padStart(6, '0')}`, locale: 'en', ...extra }) }).then(async (r) => ({ s: r.status, e: (await r.json().catch(() => ({}))).error || '' })).catch(() => ({ s: 0, e: 'network' }));

(async () => {
  const vs = new Database(process.env.DB_PATH, { readonly: true }).prepare("SELECT v.id vid, p.slug, p.price_minor pm FROM variants v JOIN products p ON p.id = v.product_id WHERE p.status = 'active' AND p.price_minor > 0 LIMIT 2").all();
  const [a, c] = vs; const mem0 = rss();

  // 1) 300 buyers, 20 pieces
  w('UPDATE variants SET stock = 20 WHERE id = ?', a.vid);
  let res = await Promise.all(Array.from({ length: 300 }, (_, i) => order(a.vid, i)));
  const won = res.filter((r) => r.s === 200).length; const refused = res.filter((r) => r.s === 409).length; const broke = res.filter((r) => r.s >= 500 || r.s === 0).length;
  const stock = q1('SELECT stock FROM variants WHERE id = ?', a.vid).stock; const sold = q1('SELECT COALESCE(SUM(quantity),0) n FROM order_lines WHERE variant_id = ?', a.vid).n;
  ok(won === 20 && refused === 280 && broke === 0, `300 buyers at once, 20 pieces: ${won} orders, ${refused} refused, ${broke} server errors`);
  ok(stock === 0 && sold === 20 && q1('SELECT MIN(stock) m FROM variants').m >= 0, `stock ends at ${stock} (sold ${sold}); no stock is negative anywhere`);

  // 2) 60 buyers, coupon with 5 uses
  w('UPDATE variants SET stock = 200 WHERE id = ?', c.vid);
  w("INSERT OR REPLACE INTO coupons (code, kind, value, max_uses, used_count, active) VALUES ('LOAD5', 'percent', 10, 5, 0, 1)");
  res = await Promise.all(Array.from({ length: 60 }, (_, i) => order(c.vid, 1000 + i, { couponCode: 'LOAD5' })));
  const used = q1("SELECT used_count u FROM coupons WHERE code = 'LOAD5'").u; const disc = q1("SELECT COUNT(*) n FROM orders WHERE coupon_code = 'LOAD5' AND discount_minor > 0").n;
  const full = q1("SELECT COUNT(*) n FROM orders WHERE email LIKE 'load10__@%' AND discount_minor = 0").n;
  ok(res.filter((r) => r.s === 200).length === 5 && used === 5 && disc === 5 && res.every((r) => r.s === 200 || r.s === 409), `60 buyers at once, coupon limited to 5: ${disc} discounted orders, coupon counted ${used} times`);
  ok(full === 0, 'nobody who asked for the coupon was charged the full price in silence');

  // 3) page load with many visitors
  const paths = ['/ar', '/en/shop', `/ar/shop/${a.slug}`, '/api/products', '/en/search?q=rose', '/ar/cart', '/api/health', '/sitemap.xml'];
  for (const conc of [50, 150, 300]) {
    const t = []; let errs = 0; let n = 0; const end = Date.now() + 8000;
    await Promise.all(Array.from({ length: conc }, async (_, wkr) => { while (Date.now() < end) { const p = paths[(n++) % paths.length]; const s = Date.now(); try { const r = await fetch(base + p, { headers: { 'x-forwarded-for': `10.9.${wkr % 250}.9` } }); await r.arrayBuffer(); if (r.status >= 500) errs++; } catch { errs++; } t.push(Date.now() - s); } }));
    t.sort((x, y) => x - y); const pc = (q) => t[Math.min(t.length - 1, Math.floor(t.length * q))];
    console.log('LOAD', JSON.stringify({ visitors: conc, requests: t.length, perSecond: Math.round(t.length / 8), p50ms: pc(0.5), p95ms: pc(0.95), p99ms: pc(0.99), errors: errs }));
    ok(errs === 0, `${conc} visitors at once for 8 seconds: ${t.length} pages served, no errors (half under ${pc(0.5)} ms, 95% under ${pc(0.95)} ms)`);
  }
  const mem1 = rss(); console.log('MEM', JSON.stringify({ beforeMB: mem0, afterMB: mem1 }));
  ok(mem0 === null || mem1 === null || mem1 - mem0 < 400, `server memory after the load: ${mem0} MB -> ${mem1} MB`);
  ok(q1("PRAGMA integrity_check").integrity_check === 'ok', 'database is intact after the load');
  r = await fetch(base + '/api/health'); ok(r.status === 200, 'the store still answers after the load');
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
let r;
