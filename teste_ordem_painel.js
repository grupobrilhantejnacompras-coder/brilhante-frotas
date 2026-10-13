// v6.14: no Dashboard, o quadro "Atenção" fica entre "Gastos por veículo" e "Veículos com maior custo".
const { chromium } = require('playwright');
const path = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
let falhas = 0; const erros = [];
const ok = (t, c) => { console.log((c ? '  ok  ' : ' FALHA ') + t); if (!c) falhas++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('pageerror', e => erros.push(e.message));
  await p.goto(path); await p.waitForSelector('#form-login');
  await p.fill('#u', 'Kamau'); await p.fill('#s', '159753'); await p.click('button[type=submit]');
  await p.waitForSelector('#painel h2'); await p.waitForTimeout(400);
  const t = await p.$$eval('#painel h2', hs => hs.map(h => h.textContent.trim()));
  console.log(t);
  const i = n => t.findIndex(x => x.includes(n));
  ok('quadro Atenção existe', i('Atenção') >= 0);
  ok('Atenção depois de "Gastos por veículo"', i('Atenção') > i('Gastos por veículo'));
  ok('Atenção depois de "Serviços por mecânico"', i('Atenção') > i('Serviços por mecânico'));
  ok('Atenção antes de "Veículos com maior custo"', i('Atenção') < i('Veículos com maior custo'));
  ok('Atenção não está mais no topo', i('Atenção') > 2);
  const btn = await p.$('#painel [data-veic].btn');
  if (btn) { await btn.click(); await p.waitForTimeout(300); ok('"Ver veículo" abre o veículo', (await p.evaluate(() => location.hash)).startsWith('#/veiculo/')); }
  ok('sem erros de página', erros.length === 0);
  await p.screenshot({ path: '/tmp/painel_full.png', fullPage: true });
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
