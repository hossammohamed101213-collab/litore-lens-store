// E2E: admin backup download (valid zip, scrubbed sessions, admin-only, reminder, activity log).
const { chromium } = require('./_pw.cjs');
const Database = require('better-sqlite3'); const { execSync } = require('child_process'); const fs = require('fs');
const base = process.env.BASE; const dbPath = process.env.DB_PATH;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  ok((await fetch(base + '/api/admin/backup')).status === 401, 'guest cannot download a backup');
  const x = await b.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } }); const a = await x.newPage(); const errs = []; a.on('pageerror', e => errs.push(String(e)));
  await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  await a.waitForTimeout(800); ok(/حمّلي نسخة الآن/.test(await a.locator('main').innerText()), 'dashboard card reminds when no backup exists');
  await a.goto(base + '/admin/backup'); ok(/لم تُحمَّل أي نسخة بعد/.test(await a.locator('main').innerText()), 'backup page says no backup yet');
  const w = new Database(dbPath); w.prepare("INSERT INTO orders (id,email,phone,status,subtotal_minor,total_minor,currency,shipping_label_ar,shipping_label_en,address_json,idempotency_key) VALUES ('LT-BK-1','x@y.co','050','new',1,1,'AED','x','x','{}','k-bk')").run(); w.close();
  const up = dbPath.replace('/l.db', '/up'); fs.mkdirSync(up, { recursive: true }); fs.writeFileSync(up + '/photo1.webp', Buffer.from('RIFF1234WEBPdata')); fs.writeFileSync(up + '/photo2.png', Buffer.alloc(300000, 7));
  const [dl] = await Promise.all([a.waitForEvent('download'), a.getByRole('link', { name: /تحميل نسخة احتياطية الآن/ }).click()]);
  const file = '/tmp/w/backup-test.zip'; await dl.saveAs(file);
  ok(/^litore-backup-.*\.zip$/.test(dl.suggestedFilename()), 'downloads as litore-backup-DATE.zip');
  let t = ''; try { t = execSync(`unzip -t ${file}`).toString(); } catch (e) { t = String(e.stdout || e); }
  ok(/No errors detected/.test(t), 'zip passes integrity test');
  const names = execSync(`unzip -Z1 ${file}`).toString().split('\n').filter(Boolean);
  ok(names.includes('litore.db') && names.includes('README.txt'), 'contains database and README');
  ok(names.filter(n => n.startsWith('uploads/')).length === 2, 'contains product photos (' + names.filter(n => n.startsWith('uploads/')).length + ')');
  fs.rmSync('/tmp/w/bk', { recursive: true, force: true }); execSync(`mkdir -p /tmp/w/bk && cd /tmp/w/bk && unzip -q ${file}`);
  const c = new Database('/tmp/w/bk/litore.db', { readonly: true });
  ok(fs.statSync('/tmp/w/bk/uploads/photo2.png').size === 300000, 'photos restored byte-for-byte');
  ok(c.prepare("SELECT COUNT(*) n FROM orders WHERE id='LT-BK-1'").get().n === 1, 'backup includes the newest order');
  ok(c.prepare('SELECT COUNT(*) n FROM sessions').get().n === 0, 'login sessions are NOT in the backup');
  ok(c.prepare('SELECT COUNT(*) n FROM products').get().n > 0 && c.prepare('PRAGMA integrity_check').get().integrity_check === 'ok', 'restored copy opens and passes integrity check'); c.close();
  await a.goto(base + '/admin/backup'); ok(/قبل 0 يوم/.test(await a.locator('main').innerText()), 'page shows today as last backup');
  await a.goto(base + '/admin'); await a.waitForTimeout(800); ok(!/حمّلي نسخة الآن/.test(await a.locator('main').innerText()), 'dashboard reminder disappears');
  await a.goto(base + '/admin/activity'); ok(/تحميل نسخة احتياطية/.test(await a.locator('main').innerText()), 'download recorded in activity log');
  await a.goto(base + '/admin/backup'); ok(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'backup page fits phone width');
  await a.screenshot({ path: '/tmp/w/backup-page.png' });
  ok(errs.length === 0, 'no page errors');
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
