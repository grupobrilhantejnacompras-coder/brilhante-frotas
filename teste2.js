const { chromium } = require('playwright');
const erros = [];
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
  const ok = (t, c) => console.log((c ? '  ok  ' : ' FALHA ') + t);

  await p.goto('file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html'));
  await p.fill('#u', 'Kamau'); await p.fill('#s', '159753'); await p.click('button[type=submit]');
  await p.waitForTimeout(700);

  // 1. importar a mesma planilha -> deve detectar que já está tudo na base
  await p.evaluate(() => location.hash = '#/config');
  await p.waitForTimeout(400);
  let fc = p.waitForEvent('filechooser');
  await p.click('#c-importar');
  (await fc).setFiles('/home/claude/planilha.xlsx');
  await p.waitForSelector('#modal', { timeout: 20000 });
  await p.waitForTimeout(1200);
  const kpis1 = await p.$$eval('#modal .kpi', e => e.map(x => x.querySelector('.k-lab').textContent + '=' + x.querySelector('.k-val').textContent));
  console.log('   prévia (base cheia):', kpis1.join(' | '));
  ok('planilha .xlsx lida no navegador', kpis1.length === 4);
  ok('duplicidade evitada (0 OS novas)', kpis1[0].endsWith('=0'));
  await p.screenshot({ path: 'shot-import1.png' });
  await p.click('[data-fechar]');

  // 2. esvaziar a base e reimportar
  await p.evaluate(() => { const d = DB.get(); d.ordens = []; d.servicos = []; DB.save(); });
  await p.waitForTimeout(200);
  fc = p.waitForEvent('filechooser');
  await p.click('#c-importar');
  (await fc).setFiles('/home/claude/planilha.xlsx');
  await p.waitForSelector('#modal', { timeout: 20000 });
  await p.waitForTimeout(1500);
  const kpis2 = await p.$$eval('#modal .kpi', e => e.map(x => x.querySelector('.k-lab').textContent + '=' + x.querySelector('.k-val').textContent));
  console.log('   prévia (base vazia):', kpis2.join(' | '));
  ok('OS reconstruídas a partir da planilha', +kpis2[0].split('=')[1].replace(/\D/g, '') > 200);
  ok('catálogo de serviços reconstruído', +kpis2[1].split('=')[1].replace(/\D/g, '') > 60);
  await p.screenshot({ path: 'shot-import2.png' });

  await p.click('#imp-confirmar');
  await p.waitForTimeout(1500);
  const res = await p.evaluate(() => ({ os: DB.get().ordens.length, sv: DB.get().servicos.length, tot: DB.get().ordens.reduce((s, o) => s + o.total, 0) }));
  console.log('   após confirmar:', JSON.stringify(res));
  ok('importação gravada', res.os > 200 && res.sv > 60);
  ok('valor histórico coerente (R$ ' + res.tot.toLocaleString('pt-BR') + ')', res.tot > 100000 && res.tot < 130000);

  console.log('\nErros: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  await b.close();
})();
