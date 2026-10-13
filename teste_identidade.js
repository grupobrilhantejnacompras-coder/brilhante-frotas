// v6.15 — identidade visual (verde-escuro / preto / branco / dourado, Montserrat) sem perder funcionalidade.
const { chromium } = require('playwright');
const url = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
let falhas = 0; const erros = [];
const ok = (t, c) => { console.log((c ? '  ok  ' : ' FALHA ') + t); if (!c) falhas++; };
const ROTAS = ['dashboard', 'nova-os', 'ordens', 'veiculos', 'servicos', 'relatorios', 'reincidencias', 'usuarios', 'config', 'minha-conta'];
(async () => {
  const b = await chromium.launch();
  for (const [nome, [w, h]] of Object.entries({ desktop: [1440, 900], tablet: [820, 1000], celular: [390, 844] })) {
    console.log('\n--- ' + nome + ' ---');
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => erros.push(nome + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) erros.push(nome + ': ' + m.text()); });
    await p.goto(url); await p.waitForSelector('#form-login');
    ok('login: faixa verde com logo', await p.evaluate(() => getComputedStyle(document.querySelector('.login-brand')).backgroundColor === 'rgb(11, 50, 38)'));
    await p.fill('#u', 'Kamau'); await p.fill('#s', '159753'); await p.click('button[type=submit]');
    await p.waitForSelector('#painel h2', { timeout: 8000 }); await p.waitForTimeout(3300);
    ok('Montserrat carregada e aplicada', await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 14px Montserrat') && /Montserrat/.test(getComputedStyle(document.body).fontFamily); }));
    ok('fundo do menu lateral verde-escuro', await p.evaluate(() => getComputedStyle(document.querySelector('.nav')).backgroundColor === 'rgb(8, 36, 27)'));
    ok('item do menu selecionado destacado', await p.evaluate(() => !!document.querySelector('.nav-item.on') && getComputedStyle(document.querySelector('.nav-item.on'), '::before').backgroundColor === 'rgb(184, 146, 74)'));
    ok('7 KPIs com ícone', await p.evaluate(() => document.querySelectorAll('#painel .kpi .k-ic svg').length === 7));
    const titulos = await p.$$eval('#painel h2', hs => hs.map(h => h.textContent.trim()));
    ok('ordem: Atenção entre "Gastos por veículo" e "Veículos com maior custo"', titulos.indexOf('Atenção') > titulos.indexOf('Gastos por veículo') && titulos.indexOf('Atenção') < titulos.indexOf('Veículos com maior custo'));
    ok('blocos "Manutenções pendentes" e "Atividades recentes"', titulos.includes('Manutenções pendentes') && titulos.includes('Atividades recentes'));
    ok('pendentes: estado de sucesso quando não há OS abertas', await p.evaluate(() => !!document.querySelector('#painel .empty.ok')));
    ok('sem azul/ciano da identidade antiga nas barras', await p.evaluate(() => ![...document.querySelectorAll('#painel svg [fill]')].some(e => /#(3157CE|1677FF|00D9FF)/i.test(e.getAttribute('fill')))));
    for (const r of ROTAS) {
      await p.evaluate(r => location.hash = '#/' + r, r); await p.waitForTimeout(350);
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(`#/${r}: sem rolagem horizontal da página`, sobra <= 1);
    }
    if (nome !== 'desktop') {
      await p.evaluate(() => location.hash = '#/dashboard'); await p.waitForTimeout(400);
      await p.click('#btn-menu'); await p.waitForTimeout(350);
      ok('menu lateral abre em tela pequena', await p.evaluate(() => document.getElementById('nav').classList.contains('open')));
      await p.click('.nav-item[data-rota="ordens"]'); await p.waitForTimeout(500);
      ok('navegar pelo menu fecha a gaveta e abre a tela', await p.evaluate(() => !document.getElementById('nav').classList.contains('open') && location.hash === '#/ordens'));
    }
    if (nome === 'desktop') {
      // pendências reais: marca uma OS como "Em andamento" e confere que aparece (e some quando volta a concluída)
      await p.evaluate(() => { location.hash = '#/dashboard'; });
      await p.waitForTimeout(400);
      await p.evaluate(() => { const o = DB.get().ordens[5]; o.status = 'Em andamento'; DB.save(); App.render(); });
      await p.waitForSelector('#painel .lista-os'); await p.waitForTimeout(300);
      ok('OS "Em andamento" aparece em Manutenções pendentes', await p.evaluate(() => document.querySelectorAll('#painel .lista-os .li').length >= 1 && /OS pendentes/i.test(document.querySelector('#painel').innerText)));
      ok('KPI "OS pendentes" = 1', await p.evaluate(() => [...document.querySelectorAll('#painel .kpi')].find(k => /OS pendentes/i.test(k.innerText)).querySelector('.k-val').innerText.trim() === '1'));
      await p.click('#painel .lista-os .li');
      await p.waitForTimeout(400);
      ok('clicar na OS abre o detalhe', await p.evaluate(() => /^#\/ordens\/.+/.test(location.hash)));
    }
    await p.close();
  }
  await b.close();
  console.log('\nErros de página/console: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nIDENTIDADE OK');
  process.exit(falhas || erros.length ? 1 : 0);
})();
