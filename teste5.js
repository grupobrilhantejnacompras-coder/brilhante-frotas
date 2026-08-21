const { chromium } = require('playwright');
const fs = require('fs');
const erros = [];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
  const ok = (t, c) => console.log((c ? '  ok  ' : ' FALHA ') + t);

  await p.goto('file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html'));
  await p.fill('#u', 'Kamau'); await p.fill('#s', '159753'); await p.click('button[type=submit]');
  await p.waitForTimeout(700);
  await p.evaluate(() => location.hash = '#/relatorios');
  await p.waitForTimeout(500);

  // período com bastante movimento
  await p.fill('#r-de', '2026-06-01'); await p.dispatchEvent('#r-de', 'change');
  await p.fill('#r-ate', '2026-07-31'); await p.dispatchEvent('#r-ate', 'change');
  await p.waitForTimeout(400);

  // 1. aba do painel
  await p.click('[data-aba=diretoria]');
  await p.waitForTimeout(700);
  ok('aba Painel da diretoria abre', (await p.textContent('#relatorio')).includes('Painel de manutenção de frotas'));
  const kpis = await p.$$eval('#relatorio .kpi', e => e.map(x => x.querySelector('.k-lab').textContent + '=' + x.querySelector('.k-val').textContent));
  console.log('   ' + kpis.join(' | '));
  ok('6 indicadores com variação vs período anterior', kpis.length === 6 && kpis.some(k => /varia/i.test(k)));
  ok('gráficos renderizados', (await p.$$('#relatorio svg.chart')).length >= 5);
  await p.screenshot({ path: 'shot-painel-diretoria.png', fullPage: true });

  // 2. clique numa barra filtra o painel
  const antes = await p.textContent('#relatorio .kpi .k-val');
  await p.click('#relatorio [data-f]');
  await p.waitForTimeout(500);
  const depois = await p.textContent('#relatorio .kpi .k-val');
  ok('clique na barra filtra (' + antes + ' → ' + depois + ')', antes !== depois);
  ok('chip do filtro aparece', await p.isVisible('#relatorio .chip.on'));
  await p.screenshot({ path: 'shot-painel-filtrado.png' });

  // 3. limpar
  await p.click('#relatorio [data-limpa="__todos"]');
  await p.waitForTimeout(400);
  ok('limpar filtros restaura', (await p.textContent('#relatorio .kpi .k-val')) === antes);

  // 4. baixar o painel
  const dl = p.waitForEvent('download');
  await p.click('#exp-baixar');
  const arquivo = await dl;
  const destino = '/home/claude/' + arquivo.suggestedFilename();
  await arquivo.saveAs(destino);
  const tam = fs.statSync(destino).size;
  console.log('   arquivo: ' + arquivo.suggestedFilename() + ' (' + Math.round(tam / 1024) + ' KB)');
  ok('painel baixado como .html', /\.html$/.test(arquivo.suggestedFilename()) && tam > 10000);

  // 5. copiar resumo
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await p.click('#exp-copiar');
  await p.waitForTimeout(400);
  const txt = await p.evaluate(() => navigator.clipboard.readText());
  console.log('   resumo:\n' + txt.split('\n').map(l => '     ' + l).join('\n'));
  ok('resumo copiado para a área de transferência', txt.includes('GRUPO BRILHANTE') && txt.includes('Valor total'));

  // ---------- o arquivo exportado, aberto sozinho ----------
  const e = await ctx.newPage();
  const errosExp = [];
  e.on('pageerror', x => errosExp.push('PAGEERROR: ' + x.message));
  e.on('console', m => { if (m.type() === 'error') errosExp.push('CONSOLE: ' + m.text()); });
  await e.goto('file://' + destino);
  await e.waitForTimeout(700);
  ok('painel exportado abre sem login', await e.isVisible('header.top'));
  const kpisE = await e.$$eval('.kpi', x => x.map(k => k.querySelector('.kl').textContent + '=' + k.querySelector('.kv').textContent));
  console.log('   exportado: ' + kpisE.join(' | '));
  ok('indicadores no exportado', kpisE.length === 6);
  ok('gráficos no exportado', (await e.$$('svg.chart')).length >= 5);
  ok('tabelas no exportado', (await e.$$('table')).length >= 2);
  await e.screenshot({ path: 'shot-exportado.png', fullPage: true });

  // interatividade do exportado: select
  const valAntes = await e.textContent('.kpi .kv');
  const locais = await e.$$eval('#fx-local option', o => o.map(x => x.value).filter(Boolean));
  await e.selectOption('#fx-local', locais[0]);
  await e.waitForTimeout(400);
  const valDepois = await e.textContent('.kpi .kv');
  ok('filtro por local funciona no exportado (' + valAntes + ' → ' + valDepois + ')', valAntes !== valDepois);
  ok('chip aparece no exportado', await e.isVisible('#chips .chip.on'));
  await e.click('#chips [data-limpa="__todos"]');
  await e.waitForTimeout(400);
  ok('limpar funciona no exportado', (await e.textContent('.kpi .kv')) === valAntes);

  // clique na barra do exportado
  await e.click('svg.chart [data-f]');
  await e.waitForTimeout(400);
  ok('clique na barra filtra no exportado', await e.isVisible('#chips .chip.on'));
  await e.screenshot({ path: 'shot-exportado-filtrado.png' });

  // celular
  await e.setViewportSize({ width: 390, height: 844 });
  await e.waitForTimeout(400);
  await e.screenshot({ path: 'shot-exportado-mobile.png', fullPage: true });

  console.log('\nErros no sistema: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  console.log('Erros no exportado: ' + (errosExp.length ? '\n - ' + errosExp.join('\n - ') : 'nenhum'));
  await b.close();
})();
