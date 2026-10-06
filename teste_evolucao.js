// Aba "Evolução mês a mês" (Relatórios): visão mensal, visão semanal, filtros e totais.
const { chromium } = require('playwright');
const path = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
const erros = []; let falhas = 0;
const ok = (t, c) => { console.log((c ? '  ok  ' : ' FALHA ') + t); if (!c) falhas++; };
(async () => {
  const browser = await chromium.launch();
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) erros.push('CONSOLE: ' + m.text()); });
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  await p.goto(path);
  await p.fill('#u', 'Kamau'); await p.fill('#s', '159753'); await p.click('button[type=submit]');
  await p.waitForSelector('#app .nav');
  await p.evaluate(() => location.hash = '#/relatorios');
  await p.waitForSelector('[data-aba="evolucao"]');

  // referência calculada direto da base (independente do código da tela)
  const ref = await p.evaluate(() => {
    const os = DB.get().ordens.filter(o => o.data);
    const meses = new Set(os.map(o => o.data.slice(0, 7)));
    return { total: os.reduce((s, o) => s + (o.total || 0), 0), n: os.length, nMeses: meses.size,
      oficina: os.filter(o => o.local === 'Oficina').reduce((s, o) => s + (o.total || 0), 0) };
  });
  const lerTotal = () => p.evaluate(() => {
    const k = [...document.querySelectorAll('.kpi')].find(x => x.querySelector('.k-lab').textContent === 'Valor total');
    return Number(k.querySelector('.k-val').textContent.replace(/[^\d,]/g, '').replace(',', '.'));
  });

  await p.click('[data-aba="evolucao"]');
  await p.waitForSelector('[data-ev-gran]');
  ok('navegação de datas some na aba Evolução', !(await p.isVisible('#r-de')));
  ok('visão mensal ativa por padrão', (await p.getAttribute('[data-ev-gran="mes"]', 'class')).includes('on'));
  const tr = () => p.locator('#relatorio tbody tr:not(.tot-row)').count();
  const colunas = () => p.locator('#relatorio .chart-v rect.bar').count();
  const primeiroMes = await p.evaluate(() => DB.get().ordens.filter(o => o.data).map(o => o.data.slice(0, 7)).sort()[0]);
  const hojeMes = await p.evaluate(() => Dt.today().slice(0, 7));
  const esperadoMeses = (() => { const [a, b] = primeiroMes.split('-').map(Number), [c, d] = hojeMes.split('-').map(Number); return Math.max((c - a) * 12 + d - b + 1, ref.nMeses); })();
  console.log('   meses na linha do tempo (esperado):', esperadoMeses, '| linhas da tabela:', await tr());
  ok('uma linha por mês, inclusive meses sem OS', (await tr()) >= ref.nMeses && (await tr()) === esperadoMeses);
  ok('2 gráficos de colunas com 1 coluna por mês', (await colunas()) === esperadoMeses * 2);
  ok('valor total (todo o período) = soma da base', Math.abs((await lerTotal()) - ref.total) < 1);
  const totalTabela = await p.evaluate(() => document.querySelector('#relatorio .tot-row td:nth-child(2)').textContent.trim());
  ok('total de OS da tabela = OS com data na base', Number(totalTabela.replace(/\D/g, '')) === ref.n);

  // semana a semana
  await p.click('[data-ev-gran="sem"]');
  await p.waitForTimeout(200);
  ok('visão semanal ativa', (await p.getAttribute('[data-ev-gran="sem"]', 'class')).includes('on'));
  ok('semanal: 12 semanas por padrão', (await tr()) === 12);
  ok('semanal: linhas rotuladas como semana', (await p.locator('#relatorio tbody tr td:first-child').first().textContent()).toLowerCase().includes('semana'));
  await p.selectOption('#ev-n', '0');
  await p.waitForTimeout(150);
  const nSem = await tr();
  ok('semanal "todo o período" > 12 semanas', nSem > 12);
  ok('semanal todo o período: total = soma da base', Math.abs((await lerTotal()) - ref.total) < 1);
  await p.screenshot({ path: '/tmp/evol-semanal.png', fullPage: true });

  // filtro de local + volta pro mensal
  await p.click('[data-ev-gran="mes"]');
  await p.selectOption('#ev-local', 'Oficina');
  await p.waitForTimeout(150);
  ok('filtro de local recalcula o total', Math.abs((await lerTotal()) - ref.oficina) < 1);
  await p.selectOption('#ev-local', '');
  await p.selectOption('#ev-n', '6');
  await p.waitForTimeout(150);
  ok('mensal: últimos 6 meses = 6 linhas', (await tr()) === 6);
  await p.selectOption('#ev-n', '0');
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/evol-mensal.png', fullPage: true });

  // outras abas continuam funcionando e a navegação de datas volta
  await p.click('[data-aba="semanal"]');
  ok('voltando pro semanal, navegação de datas reaparece', await p.isVisible('#r-de'));
  ok('relatório semanal ainda renderiza', (await p.locator('#relatorio').innerHTML()).length > 200);

  // celular
  await p.setViewportSize({ width: 390, height: 800 });
  await p.click('[data-aba="evolucao"]');
  await p.waitForSelector('[data-ev-gran]');
  const larg = await p.evaluate(() => document.documentElement.scrollWidth);
  ok('celular: sem rolagem horizontal da página (' + larg + 'px)', larg <= 392);

  console.log('\nErros: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  console.log(falhas || erros.length ? '\nFALHAS: ' + falhas : '\nEVOLUÇÃO OK');
  await browser.close();
  process.exit(falhas || erros.length ? 1 : 0);
})();
