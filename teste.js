const { chromium } = require('playwright');
const path = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
const erros = [];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));

  const ok = (t, c) => console.log((c ? '  ok  ' : ' FALHA ') + t);

  await p.goto(path);
  await p.waitForSelector('#form-login');

  // 1. login inválido
  await p.fill('#u', 'errado'); await p.fill('#s', '000'); await p.click('button[type=submit]');
  await p.waitForTimeout(700);
  ok('login inválido mostra erro', await p.isVisible('.login-err'));

  // 2. login válido
  await p.fill('#u', 'Kamau'); await p.fill('#s', '159753'); await p.click('button[type=submit]');
  await p.waitForSelector('#app .nav', { timeout: 8000 });
  ok('login válido entra no dashboard', (await p.textContent('.topbar h1')).includes('Dashboard'));

  // 3. KPIs do dashboard
  await p.waitForSelector('.kpi');
  const kpis = await p.$$eval('.kpi', els => els.map(e => e.querySelector('.k-lab').textContent + '=' + e.querySelector('.k-val').textContent));
  console.log('   KPIs:', kpis.join(' | '));
  ok('6 KPIs no dashboard', kpis.length === 6);
  ok('gráficos renderizados', (await p.$$('svg.chart')).length >= 3);
  await p.screenshot({ path: 'shot-dashboard.png', fullPage: false });

  // 4. filtro de período
  await p.selectOption('#f-periodo', 'mes');
  await p.waitForTimeout(300);
  const kpiMes = await p.textContent('.kpi .k-val');
  console.log('   OS no mês:', kpiMes);
  await p.selectOption('#f-periodo', 'tudo');
  await p.waitForTimeout(200);

  // 5. Nova OS
  await p.click('.nav-item:has-text("Nova Ordem")');
  await p.waitForSelector('#form-os');
  ok('data preenchida automaticamente', !!(await p.inputValue('#f-data')));

  // veículo com histórico de freios: procurar Hilux QMS4G35
  const idVeic = await p.evaluate(() => {
    const v = DB.get().veiculos.find(x => x.placa === 'QMS4G35');
    return v ? v.id : DB.get().veiculos[0].id;
  });
  await p.fill('#f-veic', await p.evaluate(id => Veic.rotuloDe(id), idVeic));
  await p.dispatchEvent('#f-veic', 'change');
  await p.waitForTimeout(300);
  ok('placa preenchida automaticamente', (await p.inputValue('#f-placa')).length > 1);
  ok('ajuda de KM mostra última leitura', (await p.textContent('#km-ajuda')).length > 5);

  await p.fill('#f-local', 'Oficina');
  await p.fill('#f-condutor', 'Sebastião');
  await p.check('#mec-resp input[value="Jefesson"]');
  await p.fill('#f-km', '190000');

  // item 1: serviço do catálogo (freio -> deve disparar reincidência)
  const servFreio = await p.evaluate(() => DB.get().servicos.find(s => /pastilha/i.test(s.descricao)));
  await p.fill('.itens-tbl tr[data-i="0"] input[data-c=descricao]', servFreio.descricao);
  await p.waitForTimeout(300);
  const unit1 = await p.inputValue('.itens-tbl tr[data-i="0"] input[data-c=valorUnit]');
  ok('valor unitário buscado do catálogo (' + unit1 + ')', +unit1 > 0);
  await p.fill('.itens-tbl tr[data-i="0"] input[data-c=qtd]', '2');
  await p.waitForTimeout(200);
  const tot1 = await p.textContent('.itens-tbl tr[data-i="0"] [data-tot]');
  ok('qtd × valor = total do item (' + tot1 + ')', tot1.replace(/\D/g, '') === String(Math.round(+unit1 * 2 * 100)));

  // item 2
  await p.click('#add-item');
  await p.waitForTimeout(150);
  await p.fill('.itens-tbl tr[data-i="1"] input[data-c=descricao]', 'Troca de filtro de ar (teste)');
  await p.fill('.itens-tbl tr[data-i="1"] input[data-c=valorUnit]', '150');
  await p.waitForTimeout(250);
  const totalOS = await p.textContent('.total-bar .val');
  const esperado = +unit1 * 2 + 150;
  ok('total da OS soma os itens (' + totalOS + ' esperado ' + esperado + ')', totalOS.replace(/\D/g, '') === String(Math.round(esperado * 100)));

  ok('alerta de reincidência exibido', await p.isVisible('#box-reinc .alert-box'));
  if (await p.isVisible('#box-reinc .alert-box')) {
    console.log('   ' + (await p.textContent('#box-reinc .alert-box p')).trim().slice(0, 110));
  }
  await p.fill('#f-obs', 'Teste automatizado — pastilhas gastando rápido, acompanhar.');
  await p.screenshot({ path: 'shot-nova-os.png', fullPage: true });

  await p.click('button[type=submit]');
  await p.waitForTimeout(500);
  ok('OS salva e aberta em detalhe', (await p.textContent('.topbar h1')).length > 0 && (await p.content()).includes('Serviços executados'));
  await p.screenshot({ path: 'shot-os-detalhe.png', fullPage: true });

  // 6. persistência
  await p.reload();
  await p.waitForTimeout(600);
  const persistiu = await p.evaluate(() => DB.get().ordens.some(o => o.obs && o.obs.includes('Teste automatizado')));
  ok('OS persistida após recarregar', persistiu);

  // 7. veículo → histórico
  await p.evaluate(id => location.hash = '#/veiculo/' + id, idVeic);
  await p.waitForTimeout(500);
  ok('timeline do veículo renderizada', (await p.$$('.tl-item')).length > 0);
  ok('KPIs do veículo', (await p.$$('.kpi')).length === 4);
  await p.screenshot({ path: 'shot-veiculo.png', fullPage: false });

  // 8. reincidências
  await p.evaluate(() => location.hash = '#/reincidencias');
  await p.waitForTimeout(600);
  const nRec = await p.evaluate(() => Q.reincidencias(DB.get().ordens).length);
  console.log('   reincidências na base:', nRec);
  ok('página de reincidências com tabela', (await p.$$('table')).length > 0);
  await p.screenshot({ path: 'shot-reincidencias.png', fullPage: false });

  // 9. relatório semanal
  await p.evaluate(() => location.hash = '#/relatorios');
  await p.waitForTimeout(500);
  await p.click('#ir-ultima');
  await p.waitForTimeout(500);
  const temRel = (await p.textContent('.report')).includes('Resumo do período');
  ok('relatório semanal gerado', temRel);
  console.log('   ' + (await p.textContent('.rep-head .pd')).trim());
  await p.screenshot({ path: 'shot-relatorio.png', fullPage: true });

  // 10. resumo executivo
  await p.click('[data-aba=executivo]');
  await p.waitForTimeout(500);
  ok('resumo executivo gerado', (await p.textContent('.report')).includes('Quanto gastamos'));
  await p.screenshot({ path: 'shot-executivo.png', fullPage: true });

  // 11. serviços e veículos
  await p.evaluate(() => location.hash = '#/servicos');
  await p.waitForTimeout(400);
  ok('base de serviços listada', (await p.$$('tbody tr')).length > 10);
  await p.evaluate(() => location.hash = '#/veiculos');
  await p.waitForTimeout(400);
  ok('veículos listados', (await p.$$('tbody tr')).length > 10);
  await p.screenshot({ path: 'shot-veiculos.png', fullPage: false });

  // 12. configurações
  await p.evaluate(() => location.hash = '#/config');
  await p.waitForTimeout(400);
  ok('configurações abertas', await p.isVisible('#c-janela'));
  await p.screenshot({ path: 'shot-config.png', fullPage: true });

  // 13. mobile
  const m = await ctx.newPage();
  m.on('pageerror', e => erros.push('MOBILE: ' + e.message));
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(path);
  await m.waitForTimeout(400);
  if (await m.isVisible('#form-login')) {
    await m.fill('#u', 'Kamau'); await m.fill('#s', '159753'); await m.click('button[type=submit]');
    await m.waitForSelector('#app .nav', { timeout: 8000 });
  }
  await m.evaluate(() => location.hash = '#/nova-os');
  await m.waitForTimeout(600);
  ok('nova OS abre no celular', await m.isVisible('#form-os'));
  await m.screenshot({ path: 'shot-mobile.png', fullPage: true });

  console.log('\nErros de console: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  await browser.close();
})();
