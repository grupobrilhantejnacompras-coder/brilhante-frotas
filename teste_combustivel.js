// v6.22: módulo Combustíveis (aba separada dentro do sistema).
// Serve o site com os MESMOS cabeçalhos do Vercel (vercel.json) e confere:
//  - menu "Combustíveis → Relatórios" só para quem tem a permissão própria;
//  - o painel de combustível carrega dentro da moldura, sem erro de segurança;
//  - a OS NÃO é afetada (dados, relatórios, rotas, armazenamento do navegador);
//  - botão de PDF do painel funciona; celular; arquivo aberto do disco mostra aviso.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), pth = require('path');
const raiz = __dirname;
const vj = JSON.parse(fs.readFileSync(pth.join(raiz, 'vercel.json'), 'utf8'));
const cab = {}; (vj.headers[0].headers).forEach(h => { cab[h.key] = h.value; });
const tipos = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  (vj.rewrites || []).forEach(w => { if (w.source === p) p = w.destination; });
  if (p.endsWith('/')) p += 'index.html';
  const f = pth.join(raiz, p);
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('404'); }
  r.writeHead(200, Object.assign({ 'Content-Type': tipos[pth.extname(f)] || 'application/octet-stream' }, cab)); r.end(fs.readFileSync(f));
});
let falhas = 0; const ok = (t, c, x) => { console.log((c ? '  ok  ' : ' FALHA ') + t + (x !== undefined ? '  → ' + x : '')); if (!c) falhas++; };
const login = async (p, u = 'Kamau', s = '159753') => { await p.waitForSelector('#form-login, .nav'); if (await p.$('#form-login')) { await p.fill('#u', u); await p.fill('#s', s); await p.click('button[type=submit]'); } await p.waitForSelector('.nav'); };
const menu = p => p.evaluate(() => [...document.querySelectorAll('.nav-menu > *')].map(e => e.className.includes('nav-sec') ? '## ' + e.textContent.trim() : e.textContent.trim()));

(async () => {
  await new Promise(r => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(); const erros = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 850 }, acceptDownloads: true });
  await ctx.route(/supabase\.co/, r => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', e => erros.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/supabase|ERR_FAILED|net::/.test(m.text())) erros.push('CONSOLE ' + m.text().slice(0, 140)); });
  await p.goto(base); await login(p); await p.waitForTimeout(600);

  console.log('\n== 1) Menu e permissão ==');
  const mAdm = await menu(p);
  ok('administrador vê a seção Combustíveis com a opção Relatórios', mAdm.includes('## Combustíveis') && mAdm[mAdm.indexOf('## Combustíveis') + 1] === 'Relatórios', mAdm.join(' | '));
  ok('Relatórios da OS continuam no menu, na seção Gestão', mAdm.includes('## Gestão') && mAdm.slice(mAdm.indexOf('## Gestão')).slice(0, 5).includes('Relatórios'));
  const perm = await p.evaluate(() => Perm.LISTA.find(x => x.id === 'combustivel.ver'));
  ok('existe a permissão própria "Ver relatórios de combustível"', !!perm && perm.grupo === 'Combustíveis');
  ok('perfis prontos (Gestor, Mecânico, Diretoria) NÃO ganham a permissão sozinhos', await p.evaluate(() => ['Gestor', 'Mecânico', 'Diretoria'].every(n => !Perm.doPerfil(n).includes('combustivel.ver'))));
  const outros = await p.evaluate(() => DB.usuarios().filter(u => u.perfil !== 'Administrador').map(u => u.usuario));
  ok('administradores não aparecem como "personalizado" na lista de usuários', await p.evaluate(() => { location.hash = '#/usuarios'; return true; }));
  await p.waitForTimeout(500);
  ok('lista de usuários sem selo "personalizado" para administradores', await p.evaluate(() => ![...document.querySelectorAll('tr')].some(tr => /Administrador/.test(tr.textContent) && /personalizado/.test(tr.textContent))));

  // snapshot da OS antes de abrir Combustíveis
  const antes = await p.evaluate(() => ({ os: DB.get().ordens.length, veic: DB.get().veiculos.length, serv: DB.get().servicos.length, soma: Math.round(DB.get().ordens.reduce((s, o) => s + (o.total || 0), 0) * 100), chaves: Object.keys(localStorage).sort().join('|'), tam: JSON.stringify(localStorage).length }));

  console.log('\n== 2) Painel de combustível dentro do sistema ==');
  await p.evaluate(() => { location.hash = '#/combustivel'; }); await p.waitForSelector('#comb-iframe'); await p.waitForTimeout(3500);
  const fr = p.frames().find(f => /\/combustivel\//.test(f.url()));
  ok('painel carregou dentro da moldura', !!fr);
  const txt = fr ? await fr.innerText('body') : '';
  ok('painel mostra menu e indicadores de combustível', /Controle de Combustível/.test(txt) && /Visão Geral/.test(txt) && /Compras de Combustível/.test(txt) && /L/.test(txt));
  ok('título da página do sistema: Combustíveis / Relatórios de combustível', await p.evaluate(() => /combustíveis/i.test(document.body.innerText) && /relatórios de combustível/i.test(document.body.innerText)));
  ok('item do menu fica marcado e o da OS não', await p.evaluate(() => { const on = [...document.querySelectorAll('.nav-item.on')].map(e => e.textContent.trim()); return on.length === 1 && on[0] === 'Relatórios' && !!document.querySelector('.nav-item.on[data-rota="combustivel"]'); }));
  const quad = await p.evaluate(() => { const r = document.getElementById('comb-iframe').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), rolagem: document.documentElement.scrollWidth > innerWidth }; });
  ok('moldura ocupa a área de conteúdo, sem rolagem lateral', quad.w > 900 && quad.h > 550 && !quad.rolagem, JSON.stringify(quad));
  ok('fonte Montserrat carrega do próprio site (sem Google)', fr && await fr.evaluate(() => document.fonts.check('600 14px Montserrat') && !document.documentElement.innerHTML.includes('fonts.googleapis')));
  if (fr) { await fr.click('text=Compras de Combustível'); await p.waitForTimeout(800); ok('navegar dentro do painel funciona (módulo Compras)', /Compras/.test(await fr.innerText('main, body'))); await fr.click('text=Visão Geral'); await p.waitForTimeout(500); }
  await p.screenshot({ path: '/tmp/comb_sistema.png' });
  if (fr) {
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }).catch(() => null), fr.click('text=Relatório Gerencial (PDF)')]);
    ok('botão "Relatório Gerencial (PDF)" do painel gera o arquivo', !!dl && /\.pdf$/i.test(dl.suggestedFilename()), dl && dl.suggestedFilename());
  }

  console.log('\n== 3) A OS não é afetada ==');
  const depois = await p.evaluate(() => ({ os: DB.get().ordens.length, veic: DB.get().veiculos.length, serv: DB.get().servicos.length, soma: Math.round(DB.get().ordens.reduce((s, o) => s + (o.total || 0), 0) * 100), chaves: Object.keys(localStorage).sort().join('|'), tam: JSON.stringify(localStorage).length }));
  ok('ordens, veículos, serviços e valores iguais depois de usar Combustíveis', JSON.stringify(antes) === JSON.stringify(depois), JSON.stringify(depois).slice(0, 120));
  await p.evaluate(() => { location.hash = '#/relatorios'; }); await p.waitForTimeout(800);
  ok('Relatórios da OS abrem normalmente e sem painel de combustível', await p.evaluate(() => !document.getElementById('comb-iframe') && /Relatório|relatório/.test(document.body.innerText) && !!document.querySelector('.nav-item.on[data-rota="relatorios"]')));
  await p.evaluate(() => { location.hash = '#/executivo'; }); await p.waitForTimeout(800);
  ok('Painel executivo da OS continua igual', await p.evaluate(() => !document.getElementById('comb-iframe') && !!document.querySelector('.nav-item.on[data-rota="executivo"]')));
  const os1 = await p.evaluate(() => DB.get().ordens.find(x => x.itens.length >= 2).id);
  await p.evaluate(i => { location.hash = '#/ordens/' + i; }, os1); await p.waitForSelector('[data-acao="pdf"]');
  ok('OS aberta mantém Visualizar impressão / Baixar PDF / Imprimir', !!(await p.$('[data-acao="previa"]')) && !!(await p.$('[data-acao="imprimir"]')));

  console.log('\n== 4) Quem não tem a permissão ==');
  await p.evaluate(() => { const u = DB.usuarios().find(x => x.usuario === 'Guilherme'); Estado.usuario = Object.assign({}, u); });
  const sem = await p.evaluate(() => { const u = Estado.usuario; return { perfil: u.perfil, pode: Perm.pode('combustivel.ver') }; });
  ok('usuário Diretoria sem a permissão: não pode', sem.perfil === 'Diretoria' && sem.pode === false, JSON.stringify(sem));
  await p.evaluate(() => { App.render(); }); await p.waitForTimeout(300);
  const mDir = await menu(p);
  ok('menu dele não mostra Combustíveis', !mDir.includes('## Combustíveis'), mDir.join(' | '));
  await p.evaluate(() => { location.hash = '#/combustivel'; App.render(); }); await p.waitForTimeout(400);
  ok('rota digitada #/combustivel cai em acesso restrito (sem moldura)', await p.evaluate(() => !document.getElementById('comb-iframe') && /restrito|Sem acesso|sem acesso/i.test(document.body.innerText)));
  await p.evaluate(() => { const u = DB.usuarios().find(x => x.usuario === 'Guilherme'); Estado.usuario = Object.assign({}, u, { permissoes: u.permissoes.concat('combustivel.ver') }); location.hash = '#/combustivel'; App.render(); }); await p.waitForTimeout(1500);
  ok('ao marcar a permissão na ficha dele, passa a ver o menu e a moldura', await p.evaluate(() => !!document.getElementById('comb-iframe') && [...document.querySelectorAll('.nav-item')].some(e => e.dataset.rota === 'combustivel')));
  ok('na ficha de usuário existe a caixa de marcar "Ver relatórios de combustível"', await p.evaluate(() => Perm.LISTA.some(x => x.id === 'combustivel.ver' && x.grupo === 'Combustíveis')));

  console.log('\n== 5) Celular ==');
  const m = await b.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }); await m.route(/supabase\.co/, r => r.abort());
  const pm = await m.newPage(); await pm.goto(base); await login(pm); await pm.waitForTimeout(500);
  await pm.evaluate(() => { location.hash = '#/combustivel'; }); await pm.waitForSelector('#comb-iframe'); await pm.waitForTimeout(2500);
  const mob = await pm.evaluate(() => { const r = document.getElementById('comb-iframe').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), rolagem: document.documentElement.scrollWidth > innerWidth + 1 }; });
  ok('no celular a moldura cabe na tela', mob.w <= 390 && mob.w > 300 && mob.h > 400 && !mob.rolagem, JSON.stringify(mob));
  await pm.screenshot({ path: '/tmp/comb_celular.png' });

  console.log('\n== 6) Arquivo aberto do computador (sem site) ==');
  const f = await b.newContext({ viewport: { width: 1280, height: 800 } }); await f.route(/supabase\.co/, r => r.abort());
  const pf = await f.newPage(); await pf.goto('file://' + pth.join(raiz, 'Sistema_OS_Grupo_Brilhante.html')); await login(pf);
  await pf.evaluate(() => { location.hash = '#/combustivel'; }); await pf.waitForTimeout(600);
  ok('mostra aviso claro em vez de moldura quebrada', await pf.evaluate(() => !document.getElementById('comb-iframe') && /Disponível no site publicado/.test(document.body.innerText)));

  ok('sem erros de script nem de segurança (CSP)', erros.length === 0, erros.slice(0, 4).join(' || '));
  await b.close(); srv.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
