const { chromium } = require('playwright');
const erros = [];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
  const ok = (t, c) => console.log((c ? '  ok  ' : ' FALHA ') + t);
  const L1 = '.itens-tbl tr[data-i="0"]', L2 = '.itens-tbl tr[data-i="1"]';

  await p.goto('file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html'));
  await p.fill('#u', 'Kamau'); await p.fill('#s', '159753'); await p.click('button[type=submit]');
  await p.waitForTimeout(700);
  await p.evaluate(() => location.hash = '#/nova-os');
  await p.waitForSelector('#form-os');

  const nServicosAntes = await p.evaluate(() => DB.get().servicos.length);

  // veículo
  await p.fill('#f-veic', 'QMS4G35'); await p.dispatchEvent('#f-veic', 'change');
  await p.fill('#f-mec', 'Jeferson'); await p.fill('#f-local', 'Oficina');
  await p.waitForTimeout(250);

  // 1. digitar a descrição exata do catálogo puxa o valor
  const cat = await p.evaluate(() => DB.get().servicos.find(s => /pastilha/i.test(s.descricao)));
  await p.fill(L1 + ' input[data-c=descricao]', cat.descricao);
  await p.waitForTimeout(300);
  ok('serviço digitado do catálogo puxa o valor (' + cat.valor + ')',
    (await p.inputValue(L1 + ' input[data-c=valorUnit]')) === String(cat.valor));
  ok('marca como serviço do catálogo', (await p.textContent(L1 + ' .serv-ajuda')).includes('Catálogo'));

  // 2. datalist disponível com o catálogo inteiro
  const nOpts = await p.evaluate(() => document.querySelectorAll('#dl-servicos option').length);
  console.log('   opções no datalist:', nOpts);
  ok('lista de sugestões carregada', nOpts > 60);

  // 3. serviço fora do catálogo oferece cadastro
  await p.click('#add-item'); await p.waitForTimeout(200);
  await p.fill(L2 + ' input[data-c=descricao]', 'Troca do sensor de rotação');
  await p.waitForTimeout(300);
  ok('serviço desconhecido oferece cadastro', await p.isVisible(L2 + ' [data-cad]'));
  await p.fill(L2 + ' input[data-c=valorUnit]', '190');
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'shot-serv-campo.png', fullPage: true });

  // 4. cadastro pré-preenchido
  await p.click(L2 + ' [data-cad]');
  await p.waitForSelector('#modal');
  await p.waitForTimeout(200);
  const d = await p.inputValue('#m-d'), v = await p.inputValue('#m-v');
  console.log('   pré-preenchido:', JSON.stringify({ descricao: d, valor: v }));
  ok('descrição herdada do que foi digitado', d === 'Troca do sensor de rotação');
  ok('valor herdado da linha', +v === 190);
  await p.fill('#m-c', 'Mecânica');
  await p.screenshot({ path: 'shot-serv-cadastro.png' });
  await p.click('#m-salvar');
  await p.waitForTimeout(500);

  ok('serviço gravado no catálogo',
    (await p.evaluate(() => DB.get().servicos.length)) === nServicosAntes + 1);
  ok('linha passa a mostrar Catálogo', (await p.textContent(L2 + ' .serv-ajuda')).includes('Catálogo'));
  ok('entrou na lista de sugestões',
    await p.evaluate(() => [...document.querySelectorAll('#dl-servicos option')].some(o => /sensor de rota/i.test(o.value))));

  // 5. cálculo continua correto
  await p.fill(L1 + ' input[data-c=qtd]', '2');
  await p.waitForTimeout(250);
  const total = await p.textContent('.total-bar .val');
  const esperado = cat.valor * 2 + 190;
  ok('total da OS = ' + total + ' (esperado ' + esperado + ')', total.replace(/\D/g, '') === String(Math.round(esperado * 100)));

  // 6. salvar e reabrir
  await p.click('button[type=submit]');
  await p.waitForTimeout(600);
  ok('OS salva com serviço novo', (await p.content()).includes('sensor de rota'));

  // 7. o serviço novo já aparece na tela de Serviços
  await p.evaluate(() => location.hash = '#/servicos');
  await p.waitForTimeout(400);
  await p.fill('#s-busca', 'sensor');
  await p.waitForTimeout(300);
  ok('serviço listado no catálogo', (await p.$$('tbody tr')).length === 1);

  // 8. celular
  const m = await ctx.newPage();
  m.on('pageerror', e => erros.push('MOBILE: ' + e.message));
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto('file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html'));
  await m.waitForTimeout(500);
  if (await m.isVisible('#form-login')) { await m.fill('#u', 'Kamau'); await m.fill('#s', '159753'); await m.click('button[type=submit]'); }
  await m.waitForTimeout(500);
  await m.evaluate(() => location.hash = '#/nova-os');
  await m.waitForTimeout(500);
  await m.fill(L1 + ' input[data-c=descricao]', 'Serviço fora da tabela');
  await m.waitForTimeout(300);
  ok('atalho de cadastro visível no celular', await m.isVisible(L1 + ' [data-cad]'));
  await m.screenshot({ path: 'shot-mobile-serv.png', fullPage: true });

  console.log('\nErros: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  await b.close();
})();
