// v6.19 — Painel executivo: números conferidos por um 2º método (Python, direto do JSON), filtros pela tela,
// "Cálculo e consulta", qualidade dos dados, permissões, tablet/computador, situação e atualização.
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
let falhas = 0; const erros = [];
const ok = (t, c, x) => { console.log((c ? '  ok  ' : ' FALHA ') + t + (x !== undefined ? '  → ' + x : '')); if (!c) falhas++; };
const money0 = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0).replace(/ /g, ' ');
const norm = s => String(s).replace(/ /g, ' ');
const igual = (a, b) => Math.abs(a - b) < 0.011;
const mapaIgual = (a, b) => { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); return [...ks].every(k => igual(a[k] || 0, b[k] || 0)); };

const login = async (p, u = 'Kamau', s = '159753') => { await p.waitForSelector('#form-login, .nav'); if (await p.$('#form-login')) { await p.fill('#u', u); await p.fill('#s', s); await p.click('button[type=submit]'); } await p.waitForSelector('.nav'); await p.waitForTimeout(1300); };
const abrir = async p => { await p.evaluate(() => { location.hash = '#/executivo'; }); await p.waitForSelector('#exec .kpi'); await p.waitForTimeout(250); };
const novo = async (b, vp, opc = {}) => { const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce', ...opc }); if (!opc.cloud) await ctx.route(/supabase\.co/, r => r.abort()); const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message)); return { ctx, p }; };
const kpi = (p, lab) => p.evaluate(l => { const k = [...document.querySelectorAll('#exec .kpi')].find(e => e.querySelector('.k-lab').textContent.trim() === l); return k ? { v: k.querySelector('.k-val').textContent.trim(), s: (k.querySelector('.k-sub') || {}).textContent || '' } : null; }, lab);

(async () => {
  const esperados = JSON.parse(execSync('python3 conferencia_executivo.py', { cwd: __dirname, maxBuffer: 1 << 26 }).toString());
  const b = await chromium.launch();
  const { ctx, p } = await novo(b, { width: 1366, height: 900 });
  await p.goto(path); await login(p); await abrir(p);

  console.log('\n== 1) Números da tela x 2º método (Python) ==');
  for (const c of esperados) {
    await p.click('#fx-limpar'); await p.waitForSelector('#exec .kpi'); await p.waitForTimeout(150);
    const f = c.filtro;
    if (f.de) await p.fill('#fx-de', f.de);
    if (f.ate) await p.fill('#fx-ate', f.ate);
    if (f.categoria) await p.selectOption('#fx-cat', f.categoria);
    if (f.placa) await p.fill('#fx-placa', f.placa);
    if (f.resp) await p.selectOption('#fx-resp', f.resp);
    if (f.veiculo) await p.selectOption('#fx-veiculo', f.veiculo);
    await p.waitForTimeout(200);
    const e = c.esperado;
    const got = await p.evaluate(() => {
      const x = Executivo.contexto();
      return { total: x.os.length, emAberto: x.emAberto.length, concl: x.concl.length, gasto: x.soma, veic: x.veicAtendidos.size,
        meses: Object.fromEntries(x.evolucao.map(m => [m.chave, m.valor])), cats: Object.fromEntries(x.categorias.map(m => [m.chave, m.valor])),
        topVeic: x.veiculos.slice(0, 5).map(v => [v.chave, v.valor]), topServ: x.servicos.slice(0, 5).map(s => [s.chave, s.os.size, s.valor]) };
    });
    const tk = await kpi(p, 'Total de OS'), gk = await kpi(p, 'Gasto total'), mk = await kpi(p, 'Custo médio por OS'), vk = await kpi(p, 'Veículos atendidos');
    const nome = '[' + c.nome + '] ';
    ok(nome + 'total de OS (cálculo e tela)', got.total === e.total && tk.v === String(e.total).replace(/\B(?=(\d{3})+(?!\d))/g, '.'), got.total + ' / ' + tk.v);
    ok(nome + 'em aberto / concluídas', got.emAberto === e.emAberto && got.concl === e.concluidas, got.emAberto + ' / ' + got.concl);
    ok(nome + 'gasto total', igual(got.gasto, e.gasto) && norm(gk.v) === norm(money0(e.gasto)), got.gasto + ' / ' + gk.v);
    ok(nome + 'custo médio', norm(mk.v) === norm(money0(e.medio)), mk.v);
    ok(nome + 'veículos atendidos', got.veic === e.veiculos && vk.v === String(e.veiculos), got.veic);
    ok(nome + 'evolução mensal', mapaIgual(got.meses, e.meses), Object.keys(got.meses).length + ' meses');
    ok(nome + 'custo por categoria', mapaIgual(got.cats, e.cats), Object.keys(got.cats).length + ' categorias');
    ok(nome + 'ranking de veículos (top 5)', JSON.stringify(got.topVeic.map(v => [v[0], Math.round(v[1] * 100)])) === JSON.stringify(e.topVeic.map(v => [v[0], Math.round(v[1] * 100)])));
    ok(nome + 'serviços mais recorrentes (top 5, empates na mesma ordem)', JSON.stringify(got.topServ.map(s => [s[0], s[1], Math.round(s[2] * 100)])) === JSON.stringify(e.topServ.map(s => [s[0], s[1], Math.round(s[2] * 100)])), got.topServ.map(s => s[1]).join(','));
    if (c.nome === 'sem OS no período') {
      ok(nome + 'estados vazios aparecem (sem quebrar)', await p.evaluate(() => document.querySelectorAll('#exec .empty').length >= 3));
    }
  }

  console.log('\n== 2) Qualidade dos dados x 2º método ==');
  await p.click('#fx-limpar'); await p.waitForSelector('#exec .kpi'); await p.waitForTimeout(150);
  const q0 = esperados[0].qualidade;
  const q = await p.evaluate(() => Object.fromEntries(Executivo.qualidade(Executivo.contexto()).map(i => [i.id, i.itens.length])));
  const n = k => q[k] || 0;
  ok('OS sem data (base inteira)', n('sem-data') === q0.semDataBase, n('sem-data'));
  ok('data suspeita ou no futuro', n('data-suspeita') === q0.dataSuspeitaOuFutura, n('data-suspeita'));
  ok('placa fora do padrão', n('placa-fora') === q0.placaFora);
  ok('veículo fora do cadastro', n('veic-sem-cadastro') === q0.semCadastro);
  ok('total diferente da soma dos itens', n('total-diverge') === q0.totalDiverge);
  ok('sem itens ou valor zero', n('sem-itens') === q0.semItensOuZero);
  ok('número de OS repetido', n('num-repetido') === q0.numRepetidosOS);
  ok('possível duplicidade forte', n('dup-forte') === q0.dupForteOS);
  ok('veículo sem placa cadastrada', n('sem-placa') === q0.semPlacaCadastro, n('sem-placa'));
  ok('veículo sem categoria', n('sem-categoria') === q0.semCategoria);
  ok('itens sem catálogo (OS afetadas)', n('sem-catalogo') === q0.itensSemCatalogoOS, n('sem-catalogo'));
  ok('tela lista os pontos e o botão "Ver N OS" confere', await p.evaluate(() => { const b = document.querySelector('[data-q="sem-data"]'); return !!b && /Ver 6 OS/.test(b.textContent); }));
  await p.click('[data-q="sem-data"]'); await p.waitForSelector('#modal');
  ok('janela da inconsistência lista as OS e abre a OS ao clicar', await p.evaluate(() => document.querySelectorAll('#modal tr[data-os]').length === 6));
  const idOS = await p.evaluate(() => document.querySelector('#modal tr[data-os]').dataset.os);
  await p.click('#modal tr[data-os]'); await p.waitForTimeout(400);
  ok('clique leva para a OS e fecha a janela', (await p.evaluate(() => location.hash)).includes('ordens/' + idOS) && !(await p.$('#modal')));

  console.log('\n== 3) "Cálculo e consulta" de cada indicador ==');
  await abrir(p);
  const ids = await p.evaluate(() => [...new Set([...document.querySelectorAll('#exec [data-ind]')].map(b => b.dataset.ind))]);
  ok('todos os indicadores têm "Cálculo e consulta"', ['total', 'emAberto', 'concluidas', 'atrasadas', 'gasto', 'pecasServicos', 'medio', 'veiculos', 'veicAbertos', 'disponibilidade', 'evolucao', 'categoria', 'veiculosCusto', 'servicos'].every(i => ids.includes(i)), ids.length + ' indicadores');
  for (const id of ids) {
    await p.click(`#exec [data-ind="${id}"]`); await p.waitForSelector('#modal');
    const r = await p.evaluate(() => { const m = document.getElementById('modal'); return { sql: !!m.querySelector('pre.sql'), txt: m.textContent, linhas: m.querySelectorAll('tr[data-os]').length, h: [...m.querySelectorAll('.ind-h')].map(h => h.textContent) }; });
    const nc = ['atrasadas', 'pecasServicos', 'disponibilidade'].includes(id);
    if (nc) ok(`[${id}] não calculável: explica o porquê e o que cadastrar, sem número inventado`, /Não calculável/.test(r.txt) && r.h.some(h => /O que precisa ser cadastrado/.test(h)) && !r.sql);
    else {
      const esperado = await p.evaluate(i => Executivo.indicadores(Executivo.contexto())[i].conjunto.length, id);
      ok(`[${id}] mostra como é calculado, a consulta e as OS usadas (${Math.min(esperado, 100)} de ${esperado})`, r.sql && r.h.some(h => /Como é calculado/.test(h)) && r.h.some(h => /Consulta equivalente/.test(h)) && r.linhas === Math.min(esperado, 100) && /SELECT/.test(r.txt));
    }
    await p.keyboard.press('Escape');
  }
  // a consulta acompanha os filtros
  await p.selectOption('#fx-cat', 'Caminhão'); await p.fill('#fx-de', '2026-06-01'); await p.waitForTimeout(200);
  await p.click('#exec [data-ind="gasto"]'); await p.waitForSelector('#modal');
  const sqlTxt = await p.evaluate(() => document.querySelector('#modal pre.sql').textContent);
  ok('consulta equivalente inclui os filtros escolhidos e exclui canceladas', /data >= '2026-06-01'/.test(sqlTxt) && /tipo = 'Caminhão'/.test(sqlTxt) && /Cancelada/.test(sqlTxt) && /sum\(total\)/.test(sqlTxt));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#ind-csv')]);
  const csv = require('fs').readFileSync(await dl.path(), 'utf8').split(/\r?\n/).filter(Boolean);
  const nEsp = await p.evaluate(() => Executivo.contexto().osC.length);
  ok('CSV baixado tem cabeçalho e uma linha por OS usada', csv.length === nEsp + 1 && /"Nº OS";"Data"/.test(csv[0]), (csv.length - 1) + ' linhas');
  await p.keyboard.press('Escape');

  console.log('\n== 4) Situação das OS (aberta / em andamento / concluída / cancelada) ==');
  await p.click('#fx-limpar'); await p.waitForSelector('#exec .kpi');
  const alvo = await p.evaluate(() => { const o = DB.get().ordens.filter(x => x.placa && x.itens.length)[0]; const o2 = DB.get().ordens.filter(x => x.id !== o.id && x.itens.length)[5]; return [o.id, o.total, o2.id, o2.total]; });
  const editar = async (id, st) => { await p.evaluate(i => { location.hash = '#/nova-os/' + i; }, id); await p.waitForSelector('#f-status'); await p.waitForTimeout(150); await p.selectOption('#f-status', st); await p.click('button[type=submit]'); await p.waitForTimeout(700); };
  await editar(alvo[0], 'Em andamento'); await editar(alvo[2], 'Cancelada');
  await abrir(p);
  ok('em aberto passa a 1 e concluídas cai para 245', (await kpi(p, 'OS em aberto')).v === '1' && (await kpi(p, 'OS concluídas')).v === '245');
  ok('veículos com OS em aberto = 1', (await kpi(p, 'Veículos com OS em aberto')).v === '1');
  ok('total de OS continua 247 e informa 1 cancelada', (await kpi(p, 'Total de OS')).v === '247' && /1 cancelada/.test((await kpi(p, 'Total de OS')).s));
  ok('gasto desconta a OS cancelada', norm((await kpi(p, 'Gasto total')).v) === norm(money0(esperados[0].esperado.gasto - alvo[3])), (await kpi(p, 'Gasto total')).v);
  await p.selectOption('#fx-status', 'Em andamento'); await p.waitForTimeout(200);
  ok('filtro por situação "Em andamento" mostra 1 OS', (await kpi(p, 'Total de OS')).v === '1');
  await p.selectOption('#fx-status', 'Cancelada'); await p.waitForTimeout(200);
  ok('filtro por situação "Cancelada" mostra 1 OS e gasto zero', (await kpi(p, 'Total de OS')).v === '1' && norm((await kpi(p, 'Gasto total')).v) === norm(money0(0)));
  ok('aviso de situação não compartilhada na nuvem aparece na janela do indicador', await (async () => { await p.click('#exec [data-ind="emAberto"]'); await p.waitForSelector('#modal'); const t = await p.evaluate(() => document.querySelector('#modal .ind-aviso') ? document.querySelector('#modal .ind-aviso').textContent : ''); await p.keyboard.press('Escape'); return /coluna "status"/.test(t); })());
  await p.click('#fx-limpar');

  console.log('\n== 5) Atalhos de período, limpar, "Atualizar agora" e carimbos de atualização ==');
  await abrir(p);
  await p.selectOption('#fx-atalho', 'mes-1'); await p.waitForTimeout(200);
  const de = await p.inputValue('#fx-de'), ate = await p.inputValue('#fx-ate');
  ok('atalho "Mês passado" preenche data inicial e final', /^\d{4}-\d{2}-01$/.test(de) && ate > de, de + ' a ' + ate);
  ok('chips de atualização presentes (tela montada, última sincronização, última OS, OS mais recente)', await p.evaluate(() => ['Tela montada em', 'Última sincronização com a nuvem', 'Última O.S. gravada ou alterada', 'O.S. mais recente (data)'].every(t => [...document.querySelectorAll('.ex-chip span')].some(s => s.textContent === t))));
  ok('sem nuvem: informa que não sincronizou neste aparelho', await p.evaluate(() => /ainda não sincronizado/.test(document.querySelector('.ex-chips').textContent)));
  await p.click('#ex-atualizar'); await p.waitForTimeout(1500);
  ok('"Atualizar agora" sem conexão avisa e não quebra', await p.evaluate(() => /Sem conexão/.test(document.getElementById('toasts').textContent)) && !!(await p.$('#exec .kpi')));
  await ctx.close();

  // com nuvem simulada
  const nuv = await novo(b, { width: 1366, height: 900 }, { cloud: true });
  await nuv.ctx.route(/supabase\.co\/rest\/v1\/ordens/, rt => rt.request().method() === 'GET' ? rt.fulfill({ status: 200, contentType: 'application/json', body: '[]' }) : rt.fulfill({ status: 201, body: '' }));
  await nuv.ctx.route(/supabase\.co\/(?!rest\/v1\/ordens)/, r => r.abort());
  await nuv.p.goto(path); await login(nuv.p); await abrir(nuv.p);
  await nuv.p.click('#ex-atualizar'); await nuv.p.waitForTimeout(1800);
  ok('com nuvem: "Atualizar agora" grava o horário da última sincronização', await nuv.p.evaluate(() => { const t = document.querySelector('.ex-chips').textContent; return !/ainda não sincronizado/.test(t) && /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(t); }));
  await nuv.ctx.close();

  console.log('\n== 6) Permissões ==');
  for (const [usr, senha, deve] of [['Guilherme', '0000', true], ['Jeferson', '1111', false], ['Clayton', '1234', true]]) {
    const c = await novo(b, { width: 1366, height: 900 }); await c.p.goto(path); await login(c.p, usr, senha);
    const menu = await c.p.evaluate(() => [...document.querySelectorAll('.nav-item')].some(e => e.dataset.rota === 'executivo'));
    await c.p.evaluate(() => { location.hash = '#/executivo'; }); await c.p.waitForTimeout(500);
    const abriu = await c.p.evaluate(() => !!document.querySelector('#exec .kpi'));
    ok(`${usr}: ${deve ? 'vê o menu e abre o painel executivo' : 'não vê o menu e a rota digitada é bloqueada'}`, menu === deve && abriu === deve, `menu=${menu} abriu=${abriu}`);
    await c.ctx.close();
  }

  console.log('\n== 7) Computador e tablet (sem rolagem lateral, leitura, toque) ==');
  for (const [nome, vp] of [['computador 1366', { width: 1366, height: 768 }], ['tablet paisagem 1024', { width: 1024, height: 768 }], ['tablet retrato 820', { width: 820, height: 1180 }]]) {
    const c = await novo(b, vp, { hasTouch: vp.width < 1100 }); await c.p.goto(path); await login(c.p); await abrir(c.p); await c.p.waitForTimeout(500);
    const r = await c.p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, kpis: document.querySelectorAll('#exec .kpi').length, graf: document.querySelectorAll('#exec svg.chart').length,
      filtros: [...document.querySelectorAll('#fx-bar input, #fx-bar select')].every(e => { const r = e.getBoundingClientRect(); return r.width > 90 && r.right <= innerWidth + 1; }),
      tabelaLarga: [...document.querySelectorAll('#exec .tw')].every(t => t.scrollWidth >= t.clientWidth) }));
    ok(`${nome}: sem rolagem lateral na página`, r.sw <= r.iw + 1, r.sw + ' ≤ ' + r.iw);
    ok(`${nome}: 10 indicadores, ${r.graf} gráficos e filtros todos visíveis`, r.kpis === 10 && r.graf >= 2 && r.filtros);
    await c.p.screenshot({ path: `/tmp/exec_${vp.width}.png`, fullPage: true });
    await c.p.fill('#fx-placa', 'QCX'); await c.p.waitForTimeout(200);
    ok(`${nome}: filtro por placa funciona (1 veículo)`, (await kpi(c.p, 'Veículos atendidos')).v === '1');
    await c.ctx.close();
  }

  ok('sem erros de JavaScript', erros.filter(e => !/supabase|ERR_/i.test(e)).length === 0, erros.join(' | '));
  await b.close(); console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
})();
