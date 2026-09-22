const { chromium } = require('playwright');
const erros = [];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
  const ok = (t, c) => console.log((c ? '  ok  ' : ' FALHA ') + t);

  await p.goto('file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html'));
  await p.fill('#u', 'Kamau'); await p.fill('#s', '159753'); await p.click('button[type=submit]');
  await p.waitForTimeout(700);
  await p.evaluate(() => location.hash = '#/nova-os');
  await p.waitForSelector('#form-os');

  // 1. digitar a placa resolve o veículo
  await p.fill('#f-veic', 'QMS4G35');
  await p.dispatchEvent('#f-veic', 'change');
  await p.waitForTimeout(300);
  ok('digitar a placa preenche placa/frota', (await p.inputValue('#f-placa')) === 'QMS4G35');
  console.log('   ajuda:', (await p.textContent('#veic-ajuda')).trim());

  // 2. digitar parte do nome
  await p.fill('#f-veic', 'trailblezer');
  await p.dispatchEvent('#f-veic', 'change');
  await p.waitForTimeout(300);
  ok('digitar parte do nome resolve', (await p.inputValue('#f-placa')).length > 3);

  // 3. digitar algo inexistente oferece cadastro
  await p.fill('#f-veic', 'Hilux Nova SPX1A11 frota 10500.10');
  await p.dispatchEvent('#f-veic', 'change');
  await p.waitForTimeout(300);
  ok('texto desconhecido oferece cadastrar', await p.isVisible('#cad-rapido'));
  await p.screenshot({ path: 'shot-veic-campo.png' });

  // 4. cadastro rápido pré-preenchido
  await p.click('#cad-rapido');
  await p.waitForSelector('#modal');
  await p.waitForTimeout(200);
  const nome = await p.inputValue('#e-n'), placa = await p.inputValue('#e-pl'), frota = await p.inputValue('#e-fr');
  console.log('   pré-preenchido:', JSON.stringify({ nome, placa, frota }));
  ok('placa extraída do texto digitado', placa === 'SPX1A11');
  ok('frota extraída do texto digitado', frota === '10500.10');
  ok('nome limpo', /hilux nova/i.test(nome));
  await p.selectOption('#e-tp', 'Camionete');
  await p.fill('#e-lo', 'Barroso'); await p.fill('#e-co', 'Teste Condutor'); await p.fill('#e-km', '1200');
  await p.screenshot({ path: 'shot-veic-cadastro.png' });
  await p.click('#e-salvar');
  await p.waitForTimeout(500);
  ok('veículo cadastrado e já selecionado', (await p.inputValue('#f-placa')) === 'SPX1A11');
  ok('local herdado do novo veículo', (await p.inputValue('#f-local')) === 'Barroso');
  ok('gravado na base', await p.evaluate(() => !!DB.get().veiculos.find(v => v.placa === 'SPX1A11')));

  // 5. salvar OS com o veículo novo
  await p.check('#mec-resp input[value="Jefesson"]'); await p.fill('#f-km', '1250');
  const sv = await p.evaluate(() => DB.get().servicos.find(s => /pastilha/i.test(s.descricao)));
  await p.fill('.itens-tbl tr[data-i="0"] input[data-c=descricao]', sv.descricao);
  await p.waitForTimeout(300);
  await p.click('button[type=submit]');
  await p.waitForTimeout(600);
  ok('OS salva com veículo recém-cadastrado', (await p.content()).includes('SPX1A11'));

  // 6. bloqueio ao salvar sem veículo
  await p.evaluate(() => location.hash = '#/nova-os');
  await p.waitForSelector('#form-os'); await p.waitForTimeout(200);
  await p.fill('#f-local', 'Oficina'); await p.check('#mec-resp input[value="Jefesson"]');
  await p.fill('.itens-tbl tr[data-i="0"] input[data-c=descricao]', sv.descricao);
  await p.waitForTimeout(200);
  await p.click('button[type=submit]');
  await p.waitForTimeout(300);
  ok('salvar sem veículo é bloqueado', (await p.$$('.toast')).length > 0 && !!(await p.isVisible('#form-os')));

  // 7. botão + Novo veículo na página de veículos
  await p.evaluate(() => location.hash = '#/veiculos');
  await p.waitForTimeout(400);
  ok('botão + Novo veículo presente', await p.isVisible('#novo-veiculo'));
  await p.click('#novo-veiculo');
  await p.waitForSelector('#modal');
  ok('modal de cadastro abre', (await p.textContent('.modal-h h2')).includes('Cadastrar'));
  await p.click('[data-fechar]');

  // 8. celular
  const m = await ctx.newPage();
  m.on('pageerror', e => erros.push('MOBILE: ' + e.message));
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto('file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html'));
  await m.waitForTimeout(500);
  if (await m.isVisible('#form-login')) {
    await m.fill('#u', 'Kamau'); await m.fill('#s', '159753'); await m.click('button[type=submit]');
    await m.waitForSelector('#app .nav', { timeout: 8000 });
  }
  await m.evaluate(() => location.hash = '#/nova-os');
  await m.waitForTimeout(500);
  ok('campo de veículo visível no celular', await m.isVisible('#f-veic'));
  await m.screenshot({ path: 'shot-mobile-veic.png' });

  console.log('\nErros: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  await b.close();
})();
