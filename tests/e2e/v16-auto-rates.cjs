const { chromium } = require('./_pw.cjs'); const http = require('http');
const base = process.env.BASE || 'http://localhost:3100'; let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
let mode = 'ok', calls = 0;
const fake = http.createServer((req, res) => { calls++; res.setHeader('content-type', 'application/json'); res.end(mode === 'ok' ? JSON.stringify({ HasErrors: false, TotalAmount: { CurrencyCode: 'AED', Value: 17.3 } }) : '{"HasErrors":true}'); }).listen(4020);
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] }); const a = await (await b.newContext({ locale: 'ar-AE' })).newPage();
  await a.goto(base + '/admin/login'); await a.fill('#email', 'owner@example.com'); await a.fill('#password', 'Str0ng-Passw0rd!'); await a.locator('main button:not([type=button])').click(); await a.waitForURL(/\/admin$/);
  await a.goto(base + '/admin/integrations/aramex');
  for (const [id, v] of [['car_aramex_user', 'u@x.com'], ['car_aramex_pass', 'pw'], ['car_aramex_acct', '1'], ['car_aramex_pin', '2'], ['car_aramex_entity', 'DXB']]) await a.fill('#' + id, v);
  await a.check('input[name=car_aramex_enabled]'); await a.getByRole('button', { name: 'حفظ' }).click(); await a.waitForURL(/saved=1/);
  await a.goto(base + '/admin/shipping/auto'); await a.fill('#car_rate_markup', '10'); await a.check('input[name=car_auto_rates]'); await a.getByRole('button', { name: 'حفظ' }).click(); await a.waitForURL(/saved=1/);
  const q = async (c) => (await (await fetch(base + '/api/shipping/rates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ country: c, city: 'Dubai', subtotal: 100 }) })).json());
  let j = await q('AE'); console.log(JSON.stringify(j).slice(0, 200));
  const amt = (j.rates || j)[0]?.amount; ok(amt === 20, 'auto price = Aramex 17.3 + 10% rounded up = 20 (got ' + amt + ')');
  mode = 'err'; j = await q('SA'); const amt2 = (j.rates || j)[0]?.amount; ok(amt2 !== undefined && amt2 !== 20, 'falls back to the saved zone price when Aramex fails (' + amt2 + ')');
  await b.close(); fake.close(); process.exit(fails ? 1 : 0);
})();
