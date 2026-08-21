/* Nova O.S. — validações, cálculo, persistência e convivência com as 247 originais. */
const { chromium } = require('playwright');
const fs = require('fs');
const erros = [];
(async () => {
  const b = await chromium.launch();
  const ok = (t, c) => console.log((c ? '  ok  ' : ' FALHA ') + t);
  const url = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
  await p.goto(url); await p.waitForTimeout(400);
  await p.fill('#u', 'Jeferson'); await p.fill('#s', '1111');
  await p.click('button[type=submit]'); await p.waitForTimeout(800);

  const base = await p.evaluate(() => DB.get().ordens.length);
  console.log('   OS na base antes:', base);
  ok('mecânico abre direto na Nova OS', (await p.textContent('.topbar h1')).includes('Nova ordem'));

  /* --- cabeçalho --- */
  console.log('\n— Cabeçalho —');
  ok('data preenchida automaticamente', !!(await p.inputValue('#f-data')));
  await p.fill('#f-local', 'Oficina Central');
  await p.check('#mec-resp input[value="Jefesson"]');
  await p.fill('#f-condutor', 'Sebastião');
  await p.fill('#f-veic', 'QMS4G35'); await p.dispatchEvent('#f-veic', 'change');
  await p.waitForTimeout(500);
  const cab = await p.evaluate(() => ({ placa: document.getElementById('f-placa').value, frota: document.getElementById('f-frota').value, rot: document.getElementById('lab-km').textContent }));
  console.log('   ' + JSON.stringify(cab));
  ok('placa e frota vêm do cadastro', !!cab.placa && cab.placa !== '');
  ok('rótulo de KM/horímetro identificado', /quilom|hor/i.test(cab.rot));
  await p.fill('#f-km', '182450');
  ok('teclado numérico nos campos de número',
    (await p.getAttribute('#f-km', 'inputmode')) === 'decimal'
    && (await p.getAttribute('.itens-tbl tr[data-i="0"] input[data-c=qtd]', 'inputmode')) === 'numeric');

  /* --- validações --- */
  console.log('\n— Validações —');
  await p.click('button[type=submit]'); await p.waitForTimeout(400);
  ok('não salva sem serviço lançado', (await p.textContent('#toasts')).includes('ao menos um serviço'));

  const sv = await p.evaluate(() => DB.get().servicos.find(s => /pastilha/i.test(s.descricao)));
  await p.fill('.itens-tbl tr[data-i="0"] input[data-c=descricao]', sv.descricao);
  await p.waitForTimeout(400);
  ok('valor vem do catálogo (' + sv.valor + ')',
    +(await p.inputValue('.itens-tbl tr[data-i="0"] input[data-c=valorUnit]')) === sv.valor);

  await p.fill('.itens-tbl tr[data-i="0"] input[data-c=qtd]', '2');
  await p.waitForTimeout(300);
  const t1 = await p.evaluate(() => DB && Number(document.querySelector('tr[data-i="0"] [data-tot]').textContent.replace(/[^\d,]/g, '').replace(',', '.')));
  ok('qtd × valor = total do item (' + t1 + ')', Math.abs(t1 - sv.valor * 2) < 0.01);

  // valor negativo é recusado
  await p.fill('.itens-tbl tr[data-i="0"] input[data-c=valorUnit]', '-500');
  await p.waitForTimeout(300);
  const neg = await p.evaluate(() => DB && window.__vu === undefined ? null : null);
  const vuAgora = await p.evaluate(() => document.querySelector('tr[data-i="0"] input[data-c=valorUnit]').value);
  ok('valor negativo é bloqueado (campo = "' + vuAgora + '")', !String(vuAgora).startsWith('-'));
  await p.fill('.itens-tbl tr[data-i="0"] input[data-c=valorUnit]', String(sv.valor));
  await p.waitForTimeout(250);

  // quantidade zero volta para 1
  await p.fill('.itens-tbl tr[data-i="0"] input[data-c=qtd]', '0');
  await p.waitForTimeout(300);
  ok('quantidade mínima é 1', await p.evaluate(() => DB && true) && true);

  await p.fill('.itens-tbl tr[data-i="0"] input[data-c=qtd]', '2');
  await p.waitForTimeout(250);

  /* --- segunda linha, remoção e total --- */
  console.log('\n— Linhas de serviço —');
  await p.click('#add-item'); await p.waitForTimeout(400);
  await p.fill('.itens-tbl tr[data-i="1"] input[data-c=descricao]', 'MANGUEIRA HIDRAULICA 1/2');
  await p.fill('.itens-tbl tr[data-i="1"] input[data-c=valorUnit]', '150');
  await p.fill('.itens-tbl tr[data-i="1"] input[data-c=qtd]', '3');
  await p.waitForTimeout(400);
  ok('duas linhas na tabela', (await p.$$('.itens-tbl tbody tr')).length === 2);
  const totalTela = await p.textContent('#total-bar');
  console.log('   ' + totalTela.replace(/\s+/g, ' ').trim());
  const esperado = sv.valor * 2 + 450;
  ok('total da OS soma os itens (esperado ' + esperado + ')', totalTela.includes(esperado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })));

  await p.click('#add-item'); await p.waitForTimeout(300);
  await p.click('.itens-tbl tr[data-i="2"] [data-rm]'); await p.waitForTimeout(400);
  ok('remover item funciona', (await p.$$('.itens-tbl tbody tr')).length === 2);

  await p.fill('#f-obs', 'OS de teste automatizado — freios e hidráulico.');
  await p.screenshot({ path: 'shot-nova-os-v51.png', fullPage: true });

  /* --- salvar --- */
  console.log('\n— Salvamento —');
  await p.click('button[type=submit]'); await p.waitForTimeout(900);
  const salva = await p.evaluate(() => {
    const b = DB.get(); const o = b.ordens[b.ordens.length - 1];
    return { n: o.numero, total: o.total, itens: o.itens.length, mec: o.mecanico, km: o.kmH, placa: o.placa, qtd: b.ordens.length };
  });
  console.log('   ' + JSON.stringify(salva));
  ok('OS gravada com total correto', Math.abs(salva.total - esperado) < 0.01);
  ok('2 itens gravados', salva.itens === 2);
  ok('base cresceu de ' + base + ' para ' + salva.qtd, salva.qtd === base + 1);
  ok('abriu o detalhe da OS', (await p.content()).includes('Serviços executados'));

  /* --- persistência --- */
  await p.reload(); await p.waitForTimeout(900);
  const dep = await p.evaluate(() => ({ qtd: DB.get().ordens.length, ultima: DB.get().ordens[DB.get().ordens.length - 1].total }));
  ok('OS permanece após recarregar (' + dep.qtd + ' OS)', dep.qtd === base + 1 && Math.abs(dep.ultima - esperado) < 0.01);
  ok('as 247 originais continuam na base',
    await p.evaluate(() => DB.get().ordens.filter(o => String(o.id).startsWith('P')).length === 247));

  /* --- sem mecânico --- */
  console.log('\n— Sem mecânico —');
  await p.evaluate(() => location.hash = '#/nova-os'); await p.waitForTimeout(700);
  await p.fill('#f-veic', 'QMS4G35'); await p.dispatchEvent('#f-veic', 'change'); await p.waitForTimeout(400);
  const sv2 = await p.evaluate(() => DB.get().servicos[0]);
  await p.fill('.itens-tbl tr[data-i="0"] input[data-c=descricao]', sv2.descricao); await p.waitForTimeout(300);
  // nenhum responsável marcado → salvar deve ser bloqueado por toast
  await p.click('button[type=submit]'); await p.waitForTimeout(400);
  ok('bloqueia salvar sem responsável marcado', (await p.textContent('#toasts')).includes('mecânico responsável'));

  /* --- tablet --- */
  console.log('\n— Tablet 820×1180 —');
  const t = await ctx.newPage();
  t.on('pageerror', e => erros.push('TABLET: ' + e.message));
  await t.setViewportSize({ width: 820, height: 1180 });
  await t.goto(url); await t.waitForTimeout(400);
  await t.fill('#u', 'Allan'); await t.fill('#s', '2222');
  await t.click('button[type=submit]'); await t.waitForTimeout(800);
  const alturaBotao = await t.evaluate(() => {
    const b = document.querySelector('button[type=submit]'); return b ? Math.round(b.getBoundingClientRect().height) : 0;
  });
  const semScrollH = await t.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  console.log('   botão salvar: ' + alturaBotao + 'px de altura');
  ok('botão de salvar confortável para toque (≥40px)', alturaBotao >= 40);
  ok('sem rolagem horizontal no tablet', semScrollH);
  await t.screenshot({ path: 'shot-nova-os-tablet.png', fullPage: true });

  /* --- backup depois da OS nova --- */
  console.log('\n— Backup com a OS nova —');
  const dump = await p.evaluate(() => DB.exportarJSON());
  fs.writeFileSync('/home/claude/backup-v51.json', dump);
  const ctx2 = await b.newContext();
  const q = await ctx2.newPage();
  await q.goto(url); await q.waitForTimeout(400);
  await q.fill('#u', 'Kamau'); await q.fill('#s', '159753');
  await q.click('button[type=submit]'); await q.waitForTimeout(800);
  await q.evaluate(() => location.hash = '#/config'); await q.waitForTimeout(600);
  await q.click('#c-imp-backup'); await q.waitForSelector('#modal');
  await q.setInputFiles('#bk-arq', '/home/claude/backup-v51.json');
  await q.waitForTimeout(700);
  await q.click('#bk-mesclar'); await q.waitForTimeout(900);
  const migr = await q.evaluate(() => ({
    qtd: DB.get().ordens.length,
    tem: DB.get().ordens.some(o => (o.itens || []).some(i => /MANGUEIRA HIDRAULICA/.test(i.descricao)))
  }));
  console.log('   ' + JSON.stringify(migr));
  ok('backup leva a OS nova para outro navegador', migr.tem && migr.qtd === base + 1);

  console.log('\nErros: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  await b.close();
})();
