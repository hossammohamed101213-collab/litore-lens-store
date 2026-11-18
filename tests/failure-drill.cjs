// Failure drill on a THROW-AWAY store (own folders, own port, mock payment). Never point this at the live store.
//  1. the disk is almost full            -> the owner gets a low-space alert
//  2. the disk is completely full        -> a new order is refused cleanly: no half order, stock untouched, database not damaged
//  3. space is freed                     -> orders work again without a restart
//  4. the database is locked by another program for a few seconds -> the order waits or is refused cleanly, nothing is half-written
//  5. the database file is unreadable    -> the health check says "down" (503) instead of pretending, the process does not crash
//  6. the good database is put back      -> the store works and every earlier order is still there
// Run (as root, after `npm run build`):  node tests/failure-drill.cjs
const { spawn, execSync } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const Database = require('better-sqlite3');
const REPO = path.resolve(__dirname, '..'); const PORT = Number(process.env.DRILL_PORT || 3220); const base = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-fail-')); const DISK = path.join(T, 'disk'); fs.mkdirSync(DISK);
let proc = null;
async function start(dbPath) {
  proc = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], { cwd: REPO, detached: true, stdio: ['ignore', fs.openSync(path.join(T, 'server.log'), 'a'), fs.openSync(path.join(T, 'server.log'), 'a')],
    env: { ...process.env, DATABASE_PATH: dbPath, UPLOAD_DIR: path.join(T, 'up'), NODE_ENV: 'production', PORT: String(PORT), NEXT_PUBLIC_SITE_URL: base, SEED_SAMPLE: 'true', PAYMENT_MODE: 'mock', PAYMENT_WATCH_MS: '1000' } });
  for (let i = 0; i < 80; i++) { try { await fetch(base + '/api/health'); return; } catch { await sleep(250); } }
  throw new Error('server did not start');
}
async function stop() { if (!proc) return; try { process.kill(-proc.pid); } catch {} proc = null; for (let i = 0; i < 40; i++) { try { await fetch(base + '/api/health'); await sleep(200); } catch { return; } } }
const health = () => fetch(base + '/api/health').then((r) => r.status).catch(() => 0);
let n = 0;
const order = (vid) => fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.${n % 250}.7` }, body: JSON.stringify({
  lines: [{ variantId: vid, quantity: 1 }], contact: { email: `drill${++n}@example.com`, phone: '+971501234567' }, address: { name: 'Drill', phone: '+971501234567', line1: 'Street 1 Building 2', city: 'Dubai', country: 'AE' },
  shippingRateId: 'zone-AE', paymentMethod: 'mock-paid', idempotencyKey: `drill-key-${String(n).padStart(6, '0')}`, locale: 'en' }) }).then((r) => r.status).catch(() => 0);
const state = (dbPath, vid) => { const d = new Database(dbPath, { readonly: true }); try { return { orders: d.prepare('SELECT COUNT(*) n FROM orders').get().n, lines: d.prepare('SELECT COUNT(*) n FROM order_lines').get().n, stock: d.prepare('SELECT stock FROM variants WHERE id = ?').get(vid).stock, integrity: d.pragma('integrity_check', { simple: true }) }; } finally { d.close(); } };
const freePct = () => { const s = fs.statfsSync(DISK); return Math.round((Number(s.bavail) / Number(s.blocks)) * 100); };

(async () => {
  let mounted = false;
  try {
    try { execSync(`mount -t tmpfs -o size=12m tmpfs ${DISK}`); mounted = true; } catch { console.log('SKIP disk-full steps: a small test disk can not be created here (needs root)'); }
    const dbPath = path.join(DISK, 'l.db');
    await start(dbPath);
    const vid = new Database(dbPath, { readonly: true }).prepare("SELECT v.id vid FROM variants v JOIN products p ON p.id = v.product_id WHERE p.status = 'active' AND p.price_minor > 0 LIMIT 1").get().vid;
    { const d = new Database(dbPath); d.prepare('UPDATE variants SET stock = 500 WHERE id = ?').run(vid); d.close(); }
    ok(await order(vid) === 200, 'baseline: an order goes through');
    let s0 = state(dbPath, vid);

    if (mounted) {
      // 1. almost full: leave ~6% free
      const st = fs.statfsSync(DISK); const leave = Math.floor(Number(st.blocks) * 0.06); const fillBlocks = Number(st.bavail) - leave;
      execSync(`dd if=/dev/zero of=${DISK}/filler1 bs=${st.bsize} count=${fillBlocks} 2>/dev/null`);
      let alerted = false;
      for (let i = 0; i < 20 && !alerted; i++) { await sleep(500); const d = new Database(dbPath, { readonly: true }); alerted = !!d.prepare("SELECT 1 FROM notifications WHERE kind = 'system' AND title LIKE 'مساحة التخزين%'").get(); d.close(); }
      ok(alerted, `disk almost full (${freePct()}% free): the owner gets a low-space alert`);
      // 2. completely full
      try { execSync(`dd if=/dev/zero of=${DISK}/filler2 bs=4096 2>/dev/null`); } catch { /* dd stops when the disk is full: expected */ }
      s0 = state(dbPath, vid);
      const codes = []; for (let i = 0; i < 4; i++) codes.push(await order(vid));
      const s1 = state(dbPath, vid);
      ok(codes.every((c) => c !== 200), `disk full (${freePct()}% free): new orders are refused (answers ${codes.join(',')})`);
      ok(s1.orders === s0.orders && s1.lines === s0.lines && s1.stock === s0.stock, 'disk full: no half order was written and stock did not move');
      ok(s1.integrity === 'ok', 'disk full: the database is not damaged');
      ok((await fetch(base + '/ar').then((r) => r.status).catch(() => 0)) === 200, 'disk full: visitors can still browse the store');
      // 3. space is freed
      fs.rmSync(path.join(DISK, 'filler1')); fs.rmSync(path.join(DISK, 'filler2'), { force: true });
      let back = 0; for (let i = 0; i < 6 && back !== 200; i++) { back = await order(vid); if (back !== 200) await sleep(500); }
      const s2 = state(dbPath, vid);
      ok(back === 200 && s2.orders === s1.orders + 1 && s2.stock === s1.stock - 1, 'space freed: orders work again without a restart, and stock moves by exactly one');
    }

    // 4. database locked by another program for 3 seconds
    const before = state(dbPath, vid);
    const locker = spawn('node', ['-e', `const D=require('better-sqlite3');const d=new D(${JSON.stringify(dbPath)});d.exec('BEGIN EXCLUSIVE');setTimeout(()=>{d.exec('COMMIT');d.close()},3000)`], { cwd: REPO, stdio: 'ignore' });
    const lockerDone = new Promise((r) => locker.on('exit', r));
    await sleep(600);
    const t0 = Date.now(); const during = await order(vid); const took = Date.now() - t0;
    await lockerDone;
    const after = state(dbPath, vid);
    const whole = (during === 200 && after.orders === before.orders + 1 && after.stock === before.stock - 1) || (during !== 200 && after.orders === before.orders && after.stock === before.stock);
    ok(whole, `database locked for 3s: the order ${during === 200 ? `waited ${took}ms and went through` : `was refused cleanly (${during})`}; nothing half-written`);
    ok(after.integrity === 'ok' && await order(vid) === 200, 'after the lock: database intact and orders work');
    const good = state(dbPath, vid);

    // 5. unreadable database file
    await stop();
    const bad = path.join(T, 'bad.db'); fs.writeFileSync(bad, Buffer.alloc(8192, 7));
    await start(bad);
    ok(await health() === 503, 'unreadable database: the health check answers 503 (down), not 200');
    const page = await fetch(base + '/ar').then((r) => r.status).catch(() => 0);
    ok(page >= 500, `unreadable database: pages answer with an error (${page}) instead of wrong data`);
    await sleep(500);
    ok(await health() === 503 && proc && proc.exitCode === null, 'unreadable database: the server process stays up (it recovers as soon as the database is back)');

    // 6. good database back
    await stop(); await start(dbPath);
    const end = state(dbPath, vid);
    ok(await health() === 200 && end.orders === good.orders && end.integrity === 'ok', `good database back: store answers and all ${end.orders} orders are still there`);
  } catch (e) { console.log('FAIL drill crashed:', e && e.message); fail++; }
  finally { await stop(); try { execSync(`umount ${DISK} 2>/dev/null`); } catch {} try { fs.rmSync(T, { recursive: true, force: true }); } catch {} }
  console.log(`FAILURE DRILL: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
