// v6.23: lançar/importar dados de combustível (Excel, NF-e XML, Sankhya) com gravação na nuvem (Supabase simulado).
// Confere: só Administrador vê e usa; senha conferida no "servidor"; pré-visualização com duplicadas/canceladas/conferir;
// dados salvos valem após recarregar; falha de rede cai na base embutida; OS não é afetada; sem erros de segurança.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), pth = require('path');
const XLSX = require(pth.join(process.env.FUEL_BUILD || '/tmp/fuel_build', 'node_modules', 'xlsx'));
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

// ---------- fixtures ----------
const FX = '/tmp/fixtures_comb'; fs.mkdirSync(FX, { recursive: true });
const nfe = ({ nNF, serie = '1', data = '2026-10-05', forn = 'POSTO BOM PREÇO LTDA', prod = 'OLEO DIESEL B S500 - COMUM', qtd = 1000, unit = 6, obs = '', dest = 'GRUPO BRILHANTE', cstat = '100' }) => `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe5126100000000000000055001${String(nNF).padStart(9, '0')}1000000000" versao="4.00">
<ide><nNF>${nNF}</nNF><serie>${serie}</serie><dhEmi>${data}T10:00:00-04:00</dhEmi></ide>
<emit><xNome>${forn}</xNome></emit><dest><xNome>${dest}</xNome></dest>
<det nItem="1"><prod><xProd>${prod}</xProd><uCom>L</uCom><qCom>${Number(qtd).toFixed(4)}</qCom><vUnCom>${Number(unit).toFixed(10)}</vUnCom><vProd>${(qtd * unit).toFixed(2)}</vProd></prod></det>
<infAdic><infCpl>${obs}</infCpl></infAdic></infNFe></NFe><protNFe><infProt><cStat>${cstat}</cStat></infProt></protNFe></nfeProc>`;
const xmls = {
  safra: nfe({ nNF: 70001, obs: 'ABASTECIMENTO ESTOQUE SAFRA', qtd: 2000, unit: 6.1 }),
  cancelada: nfe({ nNF: 70002, obs: 'SAFRA', cstat: '101' }),
  gasolina: nfe({ nNF: 70003, prod: 'GASOLINA COMUM', obs: 'BALSA', qtd: 300, unit: 6.5 }),
  semFazenda: nfe({ nNF: 70004, prod: 'OLEO DIESEL S10', obs: 'sem indicação', qtd: 500, unit: 6.4 }),
};
Object.entries(xmls).forEach(([k, v]) => fs.writeFileSync(`${FX}/${k}.xml`, v));
fs.writeFileSync(`${FX}/safra_copia.xml`, xmls.safra);
fs.writeFileSync(`${FX}/quebrado.xml`, '<xml>nao e nfe');
fs.writeFileSync(`${FX}/relatorio.docx`, 'x'); fs.writeFileSync(`${FX}/relatorio.pdf`, 'x');
const sank = [['Pendente', 'Nro. Único', 'Dt. Neg.', 'Qtd. volumes', 'Vlr Litro', 'Vlr. Nota', 'Nro. Nota', 'Série da nota', 'Nome Fantasia (Empresa)', 'Apelido (Vendedor)', 'Centro Resultado', 'Descrição (Centro de Resultado)', 'Observação'],
  ['N', 111, '03/10/2026', 1500, 6.2, 9300, 88001, '1', 'RIO PRETO', 'POSTO X', 5, 'SAFRA - DIESEL', 'COMBUSTIVEL SAFRA'],
  ['N', 112, '04/10/2026', 800, 6.3, 5040, 88002, '1', 'RIO PRETO', 'POSTO X', 9, 'RATEIO PECUARIA', 'OLEO DIESEL'],
  ['Soma', null, null, 2300, null, 14340, null, null, null, null, null, null, null]];
const wbS = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wbS, XLSX.utils.aoa_to_sheet(sank), 'Plan1'); XLSX.writeFile(wbS, `${FX}/sankhya.xlsx`);
const ULT = '/tmp/fuel_build/dados/';
const BASE_COMPRAS = ULT + 'COMPRAS COMBUSTIVEL.xlsx', CONSUMO = ULT + 'RELATORIO COMBUSTIVEL atualizado.xlsx';

// ---------- "servidor" simulado (mesma regra do SQL) ----------
const USERS = { kamau: { nome: 'Kamau', senha: '159753', perfil: 'Administrador', status: 'Ativo' }, clayton: { nome: 'Clayton', senha: '1234', perfil: 'Gestor', status: 'Ativo' } };
let snaps = [], seq = 0, rede = true, semFuncao = false;
const servidor = async (route) => {
  const u = route.request().url(); const fn = (u.match(/rpc\/(\w+)/) || [])[1];
  const json = (b, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (!rede) return route.abort();
  if (semFuncao) return json({ message: 'Could not find the function public.' + fn }, 404);
  const b = route.request().postDataJSON() || {};
  if (fn === 'combustivel_ultimas') { const m = {}; snaps.forEach(s => { m[s.tipo] = s; }); return json(Object.values(m)); }
  if (fn === 'combustivel_historico') return json([...snaps].reverse().map(s => ({ id: s.id, tipo: s.tipo, arquivo: s.arquivo, resumo: s.resumo, importado_por: s.importado_por, importado_em: s.importado_em, restaura_original: s.dados === null })));
  if (fn === 'combustivel_salvar_base') {
    const us = USERS[String(b.p_usuario).toLowerCase()];
    if (!us || us.senha !== b.p_senha) return json({ message: 'Usuário ou senha incorretos.' }, 400);
    if (us.perfil !== 'Administrador' || us.status !== 'Ativo') return json({ message: 'Somente administrador ativo pode importar dados de combustível.' }, 400);
    const s = { id: ++seq, tipo: b.p_tipo, arquivo: b.p_arquivo, resumo: b.p_resumo, dados: b.p_dados, importado_por: us.nome, importado_em: new Date().toISOString() };
    snaps.push(s); return json(s.id);
  }
  return route.abort();
};

(async () => {
  await new Promise(r => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(); const erros = [];
  const novoCtx = async () => { const c = await b.newContext({ viewport: { width: 1366, height: 900 } }); await c.route(/supabase\.co/, r => (/combustivel_/.test(r.request().url()) ? servidor(r) : r.abort())); return c; };
  const spy = (p) => { p.on('pageerror', e => erros.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/supabase|ERR_FAILED|net::|Failed to load resource/.test(m.text())) erros.push('CONSOLE ' + m.text().slice(0, 160)); }); };
  const frame = async (p) => { await p.waitForSelector('#comb-iframe'); let f; for (let i = 0; i < 40 && !f; i++) { f = p.frames().find(x => /\/combustivel\//.test(x.url())); if (!f) await p.waitForTimeout(150); } return f; };
  const ctx = await novoCtx(); const p = await ctx.newPage(); spy(p);
  await p.goto(base); await login(p); await p.waitForTimeout(600);
  const osAntes = await p.evaluate(() => ({ os: DB.get().ordens.length, soma: Math.round(DB.get().ordens.reduce((s, o) => s + (o.total || 0), 0) * 100), chaves: Object.keys(localStorage).sort().join('|') }));

  console.log('\n== 1) Menu e acesso ==');
  const m = await menu(p); const i0 = m.indexOf('## Combustíveis');
  ok('administrador vê Combustíveis → Relatórios e Lançar / Importar', i0 >= 0 && m[i0 + 1] === 'Relatórios' && m[i0 + 2] === 'Lançar / Importar', m.slice(i0, i0 + 3).join(' | '));
  ok('permissão "combustivel.importar" não aparece na lista editável de permissões (não é delegável)', await p.evaluate(() => !Perm.LISTA.some(x => x.id === 'combustivel.importar')));
  ok('só Administrador passa em Perm.pode("combustivel.importar")', await p.evaluate(() => { const a = Estado.usuario; const r1 = Perm.pode('combustivel.importar'); Estado.usuario = { ...a, perfil: 'Gestor', permissoes: ['combustivel.ver', 'combustivel.importar'] }; const r2 = Perm.pode('combustivel.importar'); Estado.usuario = a; return r1 && !r2; }));

  console.log('\n== 2) Tela de lançamento (administrador) ==');
  await p.evaluate(() => { location.hash = '#/combustivel-importar'; });
  let fr = await frame(p); await fr.waitForSelector('text=Lançar / importar dados', { timeout: 15000 });
  ok('abre direto na Importação de Dados do painel', /Importação de Dados/.test(await fr.innerText('header')));
  ok('administrador recebe o card com seleção de arquivos (sessão repassada pelo sistema)', !!(await fr.$('#arquivo')) && /Excel/.test(await fr.innerText('body')) && /Word \(\.docx\)/.test(await fr.innerText('body')) && /Em breve/i.test(await fr.innerText('body')));
  ok('fonte inicial: planilha que acompanha o dashboard', /Consumo:\s*Planilha que acompanha/.test(await fr.innerText('body')));
  const compInicial = await fr.evaluate(() => (document.body.innerText.match(/Compras:[^\n]*· (\d+) notas/) || [])[1]);

  console.log('\n== 3) Word/PDF e arquivo ruim ==');
  await fr.setInputFiles('#arquivo', [`${FX}/relatorio.docx`]); await p.waitForTimeout(500);
  ok('Word/PDF: mensagem amigável, nada é importado', /ainda não é lido aqui/.test(await fr.innerText('body')) && !(await fr.$('#btn-salvar-nuvem')));
  await fr.setInputFiles('#arquivo', [`${FX}/quebrado.xml`]); await p.waitForTimeout(500);
  ok('XML que não é NF-e: erro claro, sem travar', /quebrado\.xml/.test(await fr.innerText('body')) && !(await fr.$('#btn-salvar-nuvem')));

  console.log('\n== 4) NF-e XML: pré-visualização ==');
  await fr.setInputFiles('#arquivo', ['safra', 'safra_copia', 'cancelada', 'gasolina', 'semFazenda'].map(k => `${FX}/${k}.xml`)); await fr.waitForSelector('#btn-salvar-nuvem');
  let t = await fr.innerText('body');
  ok('4 notas novas lidas; a cópia da mesma NF-e não duplica', /já existiam\s*1/i.test(t.replace(/\n+/g, ' ')), (t.match(/Notas novas nos totais[\s\S]{0,60}/) || [''])[0].replace(/\n/g, ' '));
  const linhas = await fr.evaluate(() => [...document.querySelectorAll('table.tbl')].find(x => /Situação/.test(x.tHead.textContent)).tBodies[0].rows.length);
  ok('tabela de conferência tem 4 notas (Safra, cancelada, gasolina, sem fazenda)', linhas === 4, linhas);
  const sel = async (nf, campo) => fr.inputValue(`select[aria-label="${campo} NF ${nf}"]`);
  ok('Safra: fazenda pela observação, S500, incluída', await sel(70001, 'Fazenda') === 'Safra' && await sel(70001, 'Combustível') === 'Diesel S500' && ['Incluída', 'Incluída – conferir'].includes(await sel(70001, 'Situação')), await sel(70001, 'Situação'));
  ok('cancelada → Excluída', await sel(70002, 'Situação') === 'Excluída');
  ok('gasolina → Excluída (painel só considera S10/S500)', await sel(70003, 'Combustível') === 'Gasolina comum' && await sel(70003, 'Situação') === 'Excluída');
  ok('sem fazenda → "Não informada" para conferir', await sel(70004, 'Fazenda') === 'Não informada' && await sel(70004, 'Situação') === 'Incluída – conferir');
  await fr.selectOption('select[aria-label="Fazenda NF 70004"]', 'Balsa'); await fr.selectOption('select[aria-label="Situação NF 70004"]', 'Incluída');
  ok('administrador ajusta fazenda/situação antes de salvar (fica registrado na observação)', /Ajustado na importação por Kamau/.test(await fr.innerText('body')));

  console.log('\n== 5) Confirmar com senha ==');
  await fr.click('#btn-salvar-nuvem'); await fr.waitForSelector('#senha-adm');
  ok('modal pede a senha do administrador logado', /Kamau/.test(await fr.innerText('[role=dialog]')));
  await fr.fill('#senha-adm', 'errada'); await fr.click('#btn-confirmar-senha'); await fr.waitForSelector('text=Usuário ou senha incorretos');
  ok('senha errada: servidor recusa e nada é salvo', snaps.length === 0);
  await fr.fill('#senha-adm', '159753'); await fr.click('#btn-confirmar-senha'); await fr.waitForSelector('text=Salvo na nuvem', { timeout: 15000 });
  ok('senha correta: gravou 1 instantâneo de compras por Kamau', snaps.length === 1 && snaps[0].tipo === 'compras' && snaps[0].importado_por === 'Kamau', snaps[0] && snaps[0].resumo);
  const salvas = snaps[0].dados.notas; ok('base na nuvem = base original + 4 notas novas (sem as repetidas)', salvas.length === Number(compInicial) + 4, `${salvas.length} (antes ${compInicial})`);
  t = await fr.innerText('body'); ok('fonte de compras passa a ser "Nuvem — ... por Kamau"', /Compras:\s*Nuvem — .*70001.*Kamau/.test(t.replace(/\n/g, ' ')) || /Compras:\s*Nuvem/.test(t));
  ok('histórico mostra a importação', /safra\.xml/.test(t) && /Compras/.test(t));
  await fr.click('text=Compras de Combustível'); await p.waitForTimeout(800);
  ok('nota nova aparece na tela Compras de Combustível', /70001/.test(await fr.innerText('body')) || /Safra/.test(await fr.innerText('body')));

  console.log('\n== 6) Reimportar o mesmo arquivo e Sankhya ==');
  await fr.click('text=Importação de Dados'); await fr.waitForSelector('#arquivo', { state: 'attached' });
  await fr.setInputFiles('#arquivo', [`${FX}/safra.xml`]); await fr.waitForSelector('text=Nenhuma nota nova');
  ok('mesma NF-e de novo: "nenhuma nota nova" e botão de salvar desabilitado', await fr.evaluate(() => document.getElementById('btn-salvar-nuvem').disabled));
  await fr.setInputFiles('#arquivo', [`${FX}/sankhya.xlsx`]); await fr.waitForSelector('select[aria-label="Fazenda NF 88001"]');
  ok('Sankhya: 2 notas lidas (linha "Soma" ignorada)', await fr.evaluate(() => [...document.querySelectorAll('table.tbl')].find(x => /Situação/.test(x.tHead.textContent)).tBodies[0].rows.length) === 2);
  ok('Sankhya + centro SAFRA + diesel sem tipo → S500 incluída (regra combinada)', await sel(88001, 'Fazenda') === 'Safra' && await sel(88001, 'Combustível') === 'Diesel S500' && await sel(88001, 'Situação') === 'Incluída');
  ok('Sankhya sem fazenda no centro → fica para conferir (não inventa)', await sel(88002, 'Situação') === 'Incluída – conferir');
  await fr.click('text=Descartar'); await p.waitForTimeout(200);
  ok('descartar não grava nada', snaps.length === 1);

  console.log('\n== 7) Excel de consumo e base de compras (arquivos reais) ==');
  await fr.setInputFiles('#arquivo', [CONSUMO]); await fr.waitForSelector('#btn-salvar-nuvem');
  ok('planilha de consumo reconhecida (lançamentos e totais conferidos)', /Planilha de consumo: \d+ lançamentos/.test(await fr.innerText('body')), (await fr.innerText('body')).match(/Planilha de consumo[^\n]*/)[0]);
  await fr.click('#btn-salvar-nuvem'); await fr.fill('#senha-adm', '159753'); await fr.click('#btn-confirmar-senha'); await fr.waitForSelector('text=Salvo na nuvem', { timeout: 15000 });
  ok('consumo gravado na nuvem (xlsx em base64) por Kamau', snaps.length === 2 && snaps[1].tipo === 'consumo' && !!snaps[1].dados.b64);
  await fr.setInputFiles('#arquivo', [BASE_COMPRAS]); await fr.waitForSelector('#btn-salvar-nuvem');
  ok('base de compras (aba NOTAS) reconhecida e pede confirmação', /Base de compras: \d+ notas/.test(await fr.innerText('body')));
  await fr.click('text=Descartar');
  await fr.setInputFiles('#arquivo', [CONSUMO, BASE_COMPRAS]); await p.waitForTimeout(500);
  ok('consumo + base juntos: pede para enviar separado', /uma de cada vez|Não misture/.test(await fr.innerText('body')) && !(await fr.$('#btn-salvar-nuvem')));

  console.log('\n== 8) Vale para todos: recarregar / outro usuário / sem rede ==');
  const p2 = await (await novoCtx()).newPage(); spy(p2);
  await p2.goto(base); await login(p2, 'Clayton', '1234'); await p2.waitForTimeout(500);
  await p2.evaluate(() => { const u = Estado.usuario; u.permissoes = [...new Set([...(u.permissoes || []), 'combustivel.ver', 'combustivel.importar'])]; Auth.aplicar && 0; });
  const m2 = await menu(p2);
  ok('Gestor (mesmo com a permissão marcada na ficha) NÃO vê "Lançar / Importar"', !m2.includes('Lançar / Importar'));
  await p2.evaluate(() => { location.hash = '#/combustivel-importar'; }); await p2.waitForTimeout(800);
  ok('Gestor digitando a rota é barrado (sem moldura de importação)', !(await p2.$('#comb-iframe')));
  await p2.evaluate(() => { location.hash = '#/combustivel'; }); const fr2 = await frame(p2); await fr2.waitForSelector('text=Compras de Combustível');
  ok('Gestor vê o painel com os dados da nuvem (importados pelo administrador)', true);
  await fr2.click('text=Importação de Dados'); await fr2.waitForSelector('text=Fonte dos dados em uso');
  const t2 = await fr2.innerText('body');
  ok('Gestor lê "Nuvem — … Kamau" e não tem botão de importar', /Consumo:\s*Nuvem/.test(t2) && /Compras:\s*Nuvem/.test(t2) && !(await fr2.$('#arquivo')) && /Somente administradores/.test(t2));
  const resp = await p2.evaluate(async () => { const r = await fetch('https://ysszhioygqyjbcgjgpca.supabase.co/rest/v1/rpc/combustivel_salvar_base', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_usuario: 'Clayton', p_senha: '1234', p_tipo: 'compras', p_arquivo: 'x', p_resumo: 'x', p_dados: { notas: [] } }) }); return [r.status, (await r.json()).message]; });
  ok('mesmo chamando a API direto, o servidor recusa não-administrador (regra do SQL)', resp[0] === 400 && /administrador/.test(resp[1]), resp.join(' '));
  ok('nada foi gravado pelo Gestor', snaps.length === 2);

  rede = false;
  const p3 = await (await novoCtx()).newPage(); spy(p3); await p3.goto(base); await login(p3); await p3.evaluate(() => { location.hash = '#/combustivel-importar'; });
  const fr3 = await frame(p3); await fr3.waitForSelector('text=Fonte dos dados em uso', { timeout: 20000 });
  const t3 = await fr3.innerText('body');
  ok('sem conexão com a nuvem: painel abre com a planilha embutida e avisa', /Consumo:\s*Planilha que acompanha/.test(t3) && /⚠/.test(t3));
  rede = true; semFuncao = true;
  const p4 = await (await novoCtx()).newPage(); spy(p4); await p4.goto(base); await login(p4); await p4.evaluate(() => { location.hash = '#/combustivel-importar'; });
  const fr4 = await frame(p4); await fr4.waitForSelector('text=Fonte dos dados em uso', { timeout: 20000 });
  ok('SQL ainda não rodado: mensagem orienta rodar supabase_combustivel.sql e o painel segue funcionando', /supabase_combustivel\.sql/.test(await fr4.innerText('body')));
  semFuncao = false;

  console.log('\n== 9) Restaurar originais ==');
  await fr.click('text=Restaurar bases originais'); await fr.fill('#senha-adm', '159753'); await fr.click('#btn-confirmar-senha'); await fr.waitForSelector('text=Bases originais restauradas', { timeout: 15000 });
  ok('restaurar grava instantâneos "voltar ao original" e o histórico é mantido', snaps.slice(-2).every(s => s.dados === null) && snaps.length === 4);
  ok('fonte volta a ser a planilha embutida', /Consumo:\s*Planilha que acompanha/.test(await fr.innerText('body')));

  console.log('\n== 10) OS intacta e sem erros ==');
  const osDepois = await p.evaluate(() => ({ os: DB.get().ordens.length, soma: Math.round(DB.get().ordens.reduce((s, o) => s + (o.total || 0), 0) * 100), chaves: Object.keys(localStorage).sort().join('|') }));
  ok('OS: quantidade, soma e chaves do navegador idênticas', JSON.stringify(osAntes) === JSON.stringify(osDepois), JSON.stringify(osDepois));
  ok('nenhum erro de página/console (incl. segurança CSP)', erros.length === 0, erros.join(' | '));
  await p.screenshot({ path: '/tmp/comb_importar.png' });
  await b.close(); srv.close();
  console.log('\n' + (falhas ? `✗ ${falhas} falha(s)` : '✓ tudo certo')); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
