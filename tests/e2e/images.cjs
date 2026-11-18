// Photo delivery on the TEST server: big originals (as the owner uploads them) must reach the phone resized, never at full size.
// Run: DB_PATH=/path/to/l.db BASE=http://localhost:3100 node tests/e2e/images.cjs   (the server's UPLOAD_DIR must be <dir of DB_PATH>/up)
const { chromium } = require('./_pw.cjs');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const Database = require('better-sqlite3'); const sharp = require('sharp');
const base = process.env.BASE || 'http://localhost:3100';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const up = path.join(path.dirname(process.env.DB_PATH), 'up'); fs.mkdirSync(up, { recursive: true });
  // photos like the real ones: 1350x2400, a few hundred KB each (noise so they do not compress to nothing)
  const make = async (w, h) => { const name = crypto.randomUUID() + '.webp'; const raw = crypto.randomBytes(Math.ceil(w / 8) * Math.ceil(h / 8) * 3);
    await sharp(raw, { raw: { width: Math.ceil(w / 8), height: Math.ceil(h / 8), channels: 3 } }).resize(w, h, { kernel: 'cubic' }).webp({ quality: 82 }).toFile(path.join(up, name)); return name; };
  const db = new Database(process.env.DB_PATH);
  const prods = db.prepare("SELECT id FROM products WHERE status = 'active' AND price_minor > 0 LIMIT 4").all();
  let originals = 0; const files = [];
  for (const p of prods) { db.prepare('DELETE FROM product_images WHERE product_id = ?').run(p.id);
    for (let k = 0; k < 4; k++) { const f = await make(1350, 2400); files.push(f); originals += fs.statSync(path.join(up, f)).size; db.prepare('INSERT INTO product_images(id,product_id,file,sort) VALUES (?,?,?,?)').run(crypto.randomUUID().replace(/-/g, ''), p.id, f, k); }
    db.prepare('UPDATE products SET image = ? WHERE id = ?').run(files[files.length - 4], p.id); }
  const hero = await make(900, 1600); originals += fs.statSync(path.join(up, hero)).size;
  for (const [k, v] of [['hero_bg', hero], ['hero_bg_side', 'end'], ['hero_bg_opacity', '40']]) db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
  db.close();
  const one = fs.statSync(path.join(up, files[0])).size;

  // the resizer itself
  let r = await fetch(`${base}/_next/image?url=${encodeURIComponent('/uploads/' + files[0])}&w=640&q=75`, { headers: { accept: 'image/webp,*/*' } });
  const buf = Buffer.from(await r.arrayBuffer()); const meta = r.ok ? await sharp(buf).metadata() : {};
  ok(r.status === 200 && /image\/webp/.test(r.headers.get('content-type') || '') && meta.width === 640, `a 1350px photo is served 640px wide as WebP (${Math.round(buf.length / 1024)}KB instead of ${Math.round(one / 1024)}KB)`);
  ok(buf.length < one / 2, 'the resized photo is less than half the original file');
  ok(/max-age=\d{5,}/.test(r.headers.get('cache-control') || ''), 'the browser may keep the resized photo (long cache)');
  r = await fetch(`${base}/_next/image?url=${encodeURIComponent('https://example.com/a.png')}&w=640&q=75`); ok(r.status === 400, 'the resizer refuses photos from other sites');
  r = await fetch(`${base}/_next/image?url=${encodeURIComponent('/api/health')}&w=640&q=75`); ok(r.status === 400, 'the resizer refuses addresses that are not photos of the store');
  r = await fetch(`${base}/_next/image?url=${encodeURIComponent('/uploads/' + files[0])}&w=641&q=75`); ok(r.status === 400, 'the resizer refuses made-up sizes (it can not be used to fill the disk)');

  // what a phone really downloads on the home page and on a product page
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  // the test photos are random noise (the worst case for compression), so the bar is relative: well under half of the originals
  for (const [label, url] of [['home page', '/ar'], ['shop page', '/ar/shop']]) {
    const ctx = await b.newContext({ locale: 'ar-AE', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true });
    const p = await ctx.newPage(); let bytes = 0; const raw = [];
    p.on('response', async (res) => { const u = new URL(res.url()); const t = res.headers()['content-type'] || ''; if (!/^image\//.test(t)) return; if (u.pathname.startsWith('/uploads/')) raw.push(u.pathname); try { bytes += (await res.body()).length; } catch {} });
    await p.goto(base + url, { waitUntil: 'networkidle' }); await p.waitForTimeout(6500); // let the card slides start
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((z) => setTimeout(z, 150)); } }); await p.waitForTimeout(1500);
    ok(raw.length === 0, `${label}: no full-size original is downloaded (${raw.length} found)`);
    ok(bytes < originals * 0.4, `${label}: all photos together weigh ${Math.round(bytes / 1024)}KB on a phone (originals on that page: ${Math.round(originals / 1024)}KB)`);
    const broken = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).length);
    ok(broken === 0, `${label}: no broken photo`);
    await ctx.close();
  }
  await b.close(); console.log('FAILS', fails); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed', e && e.message); process.exit(1); });
