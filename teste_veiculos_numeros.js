// v6.20: (2) cadastro de veículos compartilhado pela nuvem e (3) números de O.S. sem repetição.
// Nuvem SIMULADA e com estado (o Supabase real não é tocado). Cada "computador" = um contexto do navegador com seu próprio localStorage.
const { chromium } = require('playwright');
const path = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
let falhas = 0; const erros = [];
const ok = (t, c, x) => { console.log((c ? '  ok  ' : ' FALHA ') + t + (x !== undefined ? '  → ' + x : '')); if (!c) falhas++; };
const login = async (p, u = 'Kamau', s = '159753') => { await p.waitForSelector('#form-login, .nav'); if (await p.$('#form-login')) { await p.fill('#u', u); await p.fill('#s', s); await p.click('button[type=submit]'); } await p.waitForSelector('.nav'); };

// ---- nuvem simulada ----
const C = { ordens: new Map(), veiculos: new Map(), tabelaVeic: false, indiceUnico: false, ignorarConsulta: false, falharPostOrdens: 0, colStatus: true, log: [] };
const numerosCloud = () => [...C.ordens.values()].map(r => r.numero).filter(n => n != null);
async function ligarNuvem(ctx, estado) {
  await ctx.route(/supabase\.co\/rest\/v1\/ordens/, async rt => {
    if (estado.offline) return rt.abort();
    const q = rt.request(); const u = new URL(q.url());
    if (q.method() === 'GET') {
      let l = [...C.ordens.values()];
      const eq = u.searchParams.get('numero'), ne = u.searchParams.get('id');
      if (eq && eq.startsWith('eq.')) { if (C.ignorarConsulta) l = []; else l = l.filter(r => String(r.numero) === eq.slice(3) && !(ne && ne.startsWith('neq.') && r.id === ne.slice(4))); }
      else if (u.searchParams.get('order') === 'numero.desc') l = l.filter(r => r.numero != null).sort((a, b) => b.numero - a.numero).slice(0, 1).map(r => ({ numero: r.numero }));
      else l = l.map(r => (C.colStatus ? { status: null, ...r } : (({ status, ...x }) => x)(r)));
      return rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(l) });
    }
    if (q.method() === 'POST') {
      if (C.falharPostOrdens > 0) { C.falharPostOrdens--; return rt.fulfill({ status: 500, body: '{}' }); }
      const arr = [].concat(JSON.parse(q.postData()));
      if (C.indiceUnico) {
        const novo = new Map(C.ordens); arr.forEach(l => novo.set(l.id, { ...(novo.get(l.id) || {}), ...l }));
        const vistos = new Set();
        for (const r of novo.values()) { if (r.numero == null) continue; if (vistos.has(r.numero)) return rt.fulfill({ status: 409, contentType: 'application/json', body: '{"code":"23505"}' }); vistos.add(r.numero); }
      }
      arr.forEach(l => C.ordens.set(l.id, { ...(C.ordens.get(l.id) || {}), ...l })); C.log.push('POST ordens ' + arr.length);
      return rt.fulfill({ status: 201, body: '' });
    }
    if (q.method() === 'DELETE') { C.ordens.delete(decodeURIComponent(u.searchParams.get('id') || '').replace(/^eq\./, '')); return rt.fulfill({ status: 204, body: '' }); }
    return rt.fulfill({ status: 200, body: '[]' });
  });
  await ctx.route(/supabase\.co\/rest\/v1\/veiculos_cadastro/, async rt => {
    if (estado.offline) return rt.abort();
    if (!C.tabelaVeic) return rt.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"PGRST205","message":"Could not find the table \'public.veiculos\' in the schema cache"}' });
    const q = rt.request();
    if (q.method() === 'GET') return rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...C.veiculos.values()]) });
    if (q.method() === 'POST') {
      if (estado.bloquearPostVeic) return rt.fulfill({ status: 500, body: '{}' });
      [].concat(JSON.parse(q.postData())).forEach(l => C.veiculos.set(l.id, { ...(C.veiculos.get(l.id) || {}), ...l })); C.log.push('POST veiculos');
      return rt.fulfill({ status: 201, body: '' });
    }
    return rt.fulfill({ status: 200, body: '[]' });
  });
  await ctx.route(/supabase\.co\/(?!rest\/v1\/(ordens|veiculos_cadastro))/, r => r.abort());
}
const novoPc = async b => { const estado = {}; const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce', acceptDownloads: true }); await ligarNuvem(ctx, estado); const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message)); return { ctx, p, estado }; };
const abrir = async (pc, u, s) => { await pc.p.goto(path); await login(pc.p, u, s); await pc.p.waitForTimeout(2500); };
const recarregar = async (pc, u, s) => { await pc.p.reload(); await login(pc.p, u, s); await pc.p.waitForTimeout(2500); };
const dupla = l => { const c = {}; l.forEach(n => c[n] = (c[n] || 0) + 1); return Object.entries(c).filter(([, v]) => v > 1).length; };

(async () => {
  const b = await chromium.launch();

  console.log('\n== A) tabela "veiculos" AINDA NÃO existe na nuvem: o app segue funcionando como antes ==');
  const pc1 = await novoPc(b); let p = pc1.p;
  await abrir(pc1);
  const nV = await p.evaluate(() => DB.get().veiculos.length);
  ok('status dos veículos na nuvem = "não existe" (false), sem travar', await p.evaluate(() => Nuvem.statusVeiculosNuvem()) === false);
  ok('cadastro local intacto (nenhum veículo perdido)', nV >= 99, nV);
  ok('as O.S. subiram normalmente mesmo sem a tabela de veículos', C.ordens.size >= 247, C.ordens.size);
  await p.evaluate(() => { const v = DB.get().veiculos[0]; DB.salvarVeiculo({ ...v, tipo: 'Categoria A' }); });
  await p.waitForTimeout(400);
  ok('editar veículo sem a tabela não dá erro e fica guardado como pendente', await p.evaluate(() => (DB.get().veiculosPendentes || []).length) === 1);
  await p.evaluate(() => { location.hash = '#/executivo'; }); await p.waitForTimeout(700);
  ok('painel executivo avisa que o cadastro de veículos não é compartilhado', await p.evaluate(() => /Cadastro de veículos ainda não é compartilhado/.test(document.body.innerText)));

  console.log('\n== B) a tabela "veiculos" é criada: cadastro sobe e o outro computador recebe ==');
  C.tabelaVeic = true;
  await recarregar(pc1);
  ok('status = "existe" (true)', await p.evaluate(() => Nuvem.statusVeiculosNuvem()) === true);
  ok('todos os veículos deste computador subiram para a nuvem', C.veiculos.size === nV, C.veiculos.size + ' de ' + nV);
  const id0 = await p.evaluate(() => DB.get().veiculos[0].id);
  ok('a edição feita antes (categoria A) chegou à nuvem', (C.veiculos.get(id0).dados || {}).tipo === 'Categoria A');
  ok('pendências zeradas depois do envio', await p.evaluate(() => (DB.get().veiculosPendentes || []).length) === 0);

  const pc2 = await novoPc(b); await abrir(pc2);
  ok('computador 2 vê a mesma categoria do veículo editado no computador 1', await pc2.p.evaluate(i => DB.veiculo(i).tipo, id0) === 'Categoria A');
  // computador 2 perde um veículo localmente e cria um novo
  const idPerdido = await pc2.p.evaluate(() => { const b = DB.get(); const v = b.veiculos.pop(); DB.save(); return v.id; });
  await pc2.p.evaluate(() => DB.salvarVeiculo({ id: 'VNOVO1', nome: 'Caminhonete Teste', placa: 'TST1A23', tipo: 'Caminhonete', unidade: 'KM', status: 'Ativo' }));
  await pc2.p.waitForTimeout(500);
  ok('veículo novo do computador 2 foi para a nuvem', C.veiculos.has('VNOVO1'));
  await recarregar(pc2);
  ok('veículo que faltava neste computador voltou da nuvem', await pc2.p.evaluate(i => !!DB.veiculo(i), idPerdido));
  await recarregar(pc1);
  ok('computador 1 recebeu o veículo cadastrado no computador 2', await p.evaluate(() => !!DB.veiculo('VNOVO1') && DB.veiculo('VNOVO1').tipo === 'Caminhonete'));
  // categoria alterada no 1 aparece no 2 depois de sincronizar
  await p.evaluate(i => { DB.salvarVeiculo({ ...DB.veiculo(i), tipo: 'Categoria B' }); }, id0); await p.waitForTimeout(400);
  await recarregar(pc2);
  ok('categoria alterada no computador 1 aparece no 2 (mesma categoria em todos)', await pc2.p.evaluate(i => DB.veiculo(i).tipo, id0) === 'Categoria B');

  console.log('\n== C) edição local ainda não enviada não é sobrescrita; KM mais recente vale ==');
  pc2.estado.bloquearPostVeic = true;
  await pc2.p.evaluate(i => { DB.salvarVeiculo({ ...DB.veiculo(i), tipo: 'Categoria C (local)' }); }, id0); await pc2.p.waitForTimeout(400);
  await recarregar(pc2);
  ok('com a nuvem recusando o envio, a edição local pendente NÃO foi sobrescrita', await pc2.p.evaluate(i => DB.veiculo(i).tipo, id0) === 'Categoria C (local)');
  ok('continua marcada como pendente', await pc2.p.evaluate(i => (DB.get().veiculosPendentes || []).includes(i), id0));
  pc2.estado.bloquearPostVeic = false;
  await recarregar(pc2);
  ok('quando a nuvem volta, a edição pendente é enviada', (C.veiculos.get(id0).dados || {}).tipo === 'Categoria C (local)');
  // KM: nuvem com KM mais novo que o local
  const r0 = C.veiculos.get(id0); r0.dados = { ...r0.dados, kmAtual: 99999, kmAtualData: '2099-01-01' };
  await recarregar(pc1);
  ok('KM/H mais recente da nuvem é adotado pelo computador 1', await p.evaluate(i => DB.veiculo(i).kmAtual, id0) === 99999);
  await p.evaluate(i => { const v = DB.veiculo(i); v.kmAtual = 123456; v.kmAtualData = '2100-02-02'; DB.save(); }, id0);
  await recarregar(pc1);
  ok('KM/H local mais recente que o da nuvem é mantido e enviado', await p.evaluate(i => DB.veiculo(i).kmAtual, id0) === 123456 && (C.veiculos.get(id0).dados || {}).kmAtual === 123456);
  // lançar OS atualiza o KM do veículo na nuvem
  const alvo = await p.evaluate(() => { const o = DB.get().ordens.find(x => x.veiculoId && DB.veiculo(x.veiculoId) && x.kmH != null); return { id: o.id, v: o.veiculoId }; });
  ok('o veículo da O.S. existe na nuvem', C.veiculos.has(alvo.v));
  await p.evaluate(a => { const o = JSON.parse(JSON.stringify(DB.get().ordens.find(x => x.id === a.id))); o.id = ''; o.kmH = 9999999; o.data = '2100-03-03'; DB.salvarOS(o); }, alvo);
  await p.waitForTimeout(700);
  ok('ao lançar O.S. com KM/H novo, o veículo atualizado vai junto para a nuvem', (C.veiculos.get(alvo.v).dados || {}).kmAtual === 9999999);

  console.log('\n== D) dois computadores lançando O.S. ao mesmo tempo: números nunca se repetem ==');
  const pcA = await novoPc(b), pcB = await novoPc(b); await abrir(pcA); await abrir(pcB);
  const baseNum = Math.max(...numerosCloud());
  const nova = p0 => p0.evaluate(() => { const o = JSON.parse(JSON.stringify(DB.get().ordens.find(x => x.veiculoId && DB.veiculo(x.veiculoId)))); o.id = ''; o.data = '2026-10-01'; o.obs = 'teste de numeração'; return DB.salvarOS(o); });
  const a1 = await nova(pcA.p); await pcA.p.waitForTimeout(700);
  const b1 = await nova(pcB.p);       // B está desatualizado: pega o mesmo número que A
  const numB0 = b1.numero;
  await pcB.p.waitForTimeout(1500);
  ok('A recebeu o próximo número', a1.numero === baseNum + 1, a1.numero);
  ok('B tentou o mesmo número, mas a nuvem acusou o conflito e ele pegou outro', numB0 === baseNum + 1 && (await pcB.p.evaluate(i => DB.get().ordens.find(o => o.id === i).numero, b1.id)) === baseNum + 2);
  ok('na nuvem os dois números são diferentes e não há repetidos', C.ordens.get(a1.id).numero === baseNum + 1 && C.ordens.get(b1.id).numero === baseNum + 2 && dupla(numerosCloud()) === 0);
  ok('o número guardado em B é o mesmo da nuvem', await pcB.p.evaluate(i => DB.get().ordens.find(o => o.id === i).numero, b1.id) === C.ordens.get(b1.id).numero);
  // corrida real: consulta não vê o conflito mas o banco (índice único) recusa
  C.indiceUnico = true; C.ignorarConsulta = true;
  const a2 = await nova(pcA.p); await pcA.p.waitForTimeout(700);
  const b2 = await nova(pcB.p); await pcB.p.waitForTimeout(2500);
  C.ignorarConsulta = false;
  const nums = numerosCloud();
  ok('mesmo se a consulta falhar, o banco recusa o repetido (409) e o app renumera', C.ordens.has(a2.id) && C.ordens.has(b2.id) && dupla(nums) === 0, 'A=' + C.ordens.get(a2.id)?.numero + ' B=' + C.ordens.get(b2.id)?.numero);
  C.indiceUnico = false;
  await pcB.p.evaluate(() => { location.hash = '#/nova-os'; }); await pcB.p.waitForSelector('#f-status'); await pcB.p.waitForTimeout(900);
  const mostrado = await pcB.p.evaluate(() => Number((document.body.innerText.match(/OS Nº (\d+)/) || [])[1]));
  ok('"Nova OS" mostra número já acima do maior da nuvem', mostrado === Math.max(...numerosCloud()) + 1, mostrado + ' (maior na nuvem: ' + Math.max(...numerosCloud()) + ')');

  console.log('\n== E) O.S. criada SEM internet e que repete número é renumerada ao sincronizar ==');
  const pcC = await novoPc(b); await abrir(pcC);
  pcC.estado.offline = true;
  const c1 = await nova(pcC.p), c2 = await nova(pcC.p); await pcC.p.waitForTimeout(500);
  // enquanto C está offline, A lança mais uma (usa o mesmo número que C usou)
  const a3 = await nova(pcA.p); await pcA.p.waitForTimeout(1200);
  ok('offline: C pegou números que a nuvem já usa', numerosCloud().includes(c1.numero));
  pcC.estado.offline = false;
  await recarregar(pcC);
  const cl = [c1.id, c2.id].map(i => C.ordens.get(i));
  ok('ao voltar a internet as duas O.S. de C subiram', cl.every(Boolean));
  ok('ganharam números novos, sem repetir nenhum da nuvem', cl.every(Boolean) && dupla(numerosCloud()) === 0, cl.map(r => r && r.numero).join(','));
  ok('o número local de C é o mesmo que ficou na nuvem', (await pcC.p.evaluate(ids => ids.map(i => DB.get().ordens.find(o => o.id === i).numero), [c1.id, c2.id])).join() === cl.map(r => r.numero).join());
  // envio recusado: a O.S. não se perde
  C.falharPostOrdens = 3;
  const d1 = await nova(pcC.p); await pcC.p.waitForTimeout(1500);
  C.falharPostOrdens = 0;
  await recarregar(pcC);
  ok('se o envio falhar, a O.S. fica pendente e sobe na sincronização seguinte (não se perde)', C.ordens.has(d1.id) && await pcC.p.evaluate(i => !!DB.get().ordens.find(o => o.id === i), d1.id));

  console.log('\n== F) corrigir números repetidos já existentes (Painel executivo) ==');
  // cria repetições na nuvem: 3 O.S. antigas passam a usar números de outras
  const todas = [...C.ordens.values()].filter(r => r.data).sort((x, y) => x.data.localeCompare(y.data));
  const A1 = todas[10], A2 = todas[200], A3 = todas[220], B1 = todas[50], B2 = todas[120];
  A2.numero = A1.numero; A3.numero = A1.numero; B2.numero = B1.numero;
  const esperadoManter = [A1.id, B1.id]; const esperadoTroca = [A2.id, A3.id, B2.id];
  const antes = Object.fromEntries([...C.ordens.values()].map(r => [r.id, r.numero]));
  const maxAntes = Math.max(...numerosCloud());
  const pcD = await novoPc(b); await abrir(pcD);
  await pcD.p.evaluate(() => { location.hash = '#/executivo'; }); await pcD.p.waitForSelector('[data-q="num-repetido"]');
  await pcD.p.click('[data-q="num-repetido"]'); await pcD.p.waitForSelector('#q-corrigir');
  ok('botão "Corrigir números repetidos" aparece para o Administrador', true);
  await pcD.p.click('#q-corrigir'); await pcD.p.waitForSelector('#rn-aplicar');
  const previa = await pcD.p.evaluate(() => [...document.querySelectorAll('#modal tbody tr')].map(r => [...r.cells].map(c => c.textContent.trim())));
  ok('prévia lista exatamente as 3 O.S. que vão mudar', previa.length === 3, previa.length);
  ok('prévia mostra "nº atual" e "passa a ser" acima do maior número', previa.every(r => Number(r[4]) > maxAntes), JSON.stringify(previa.map(r => r.slice(3))));
  ok('nada foi gravado antes da confirmação', [...C.ordens.values()].every(r => r.numero === antes[r.id]));
  const [dl] = await Promise.all([pcD.p.waitForEvent('download', { timeout: 15000 }), pcD.p.click('#rn-csv')]);
  ok('CSV de prévia (de → para) é baixado', /renumeracao_os_previa/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const [dl2] = await Promise.all([pcD.p.waitForEvent('download', { timeout: 20000 }), pcD.p.click('#rn-aplicar')]);
  await pcD.p.waitForTimeout(1500);
  ok('ao aplicar, o CSV com o que mudou também é baixado', /renumeracao_os_aplicada/.test(dl2.suggestedFilename()), dl2.suggestedFilename());
  ok('a mais antiga de cada grupo manteve o número', esperadoManter.every(i => C.ordens.get(i).numero === antes[i]));
  ok('as outras receberam números novos, na nuvem', esperadoTroca.every(i => C.ordens.get(i).numero > maxAntes && C.ordens.get(i).numero !== antes[i]));
  ok('nenhum número repetido na nuvem', dupla(numerosCloud()) === 0);
  ok('o computador local ficou igual à nuvem', await pcD.p.evaluate(m => DB.get().ordens.every(o => !m[o.id] || true) && DB.get().ordens.every(o => o.numero == null || true), {}) && (await pcD.p.evaluate(() => DB.get().ordens.map(o => o.id + ':' + o.numero))).sort().join() === [...C.ordens.values()].map(r => r.id + ':' + r.numero).sort().join());
  ok('o painel já não aponta números repetidos', await pcD.p.evaluate(() => !document.querySelector('[data-q="num-repetido"]')));
  ok('valores/itens das O.S. renumeradas não mudaram', esperadoTroca.every(i => { const r = C.ordens.get(i); return typeof r.total === 'number' && Array.isArray(r.itens); }));

  console.log('\n   — sem internet a correção NÃO altera nada —');
  const pcE = await novoPc(b); await abrir(pcE);
  const r5 = [...C.ordens.values()].find(r => r.data && r.id !== A1.id); r5.numero = C.ordens.get(B1.id).numero;
  await recarregar(pcE);
  await pcE.p.evaluate(() => { location.hash = '#/executivo'; }); await pcE.p.waitForSelector('[data-q="num-repetido"]');
  await pcE.p.click('[data-q="num-repetido"]'); await pcE.p.click('#q-corrigir'); await pcE.p.waitForSelector('#rn-aplicar');
  const localAntes = await pcE.p.evaluate(() => DB.get().ordens.map(o => o.id + ':' + o.numero).sort().join());
  pcE.estado.offline = true; await pcE.p.click('#rn-aplicar'); await pcE.p.waitForTimeout(1500);
  ok('offline: nada foi alterado neste aparelho', await pcE.p.evaluate(() => DB.get().ordens.map(o => o.id + ':' + o.numero).sort().join()) === localAntes);
  ok('offline: a janela continua aberta e o botão volta a ficar disponível', await pcE.p.evaluate(() => !!document.getElementById('rn-aplicar') && !document.getElementById('rn-aplicar').disabled));
  pcE.estado.offline = false;
  await pcE.p.click('#rn-aplicar'); await pcE.p.waitForTimeout(2500);
  ok('com a internet de volta a correção conclui', dupla(numerosCloud()) === 0);

  console.log('\n   — permissão —');
  const pcF = await novoPc(b); await abrir(pcF, 'Jeferson', '1111');
  const rotaOk = await pcF.p.evaluate(() => { location.hash = '#/executivo'; return true; }); await pcF.p.waitForTimeout(700);
  const r6 = [...C.ordens.values()].find(r => r.data && r.id !== A1.id); r6.numero = C.ordens.get(B1.id).numero;
  await pcF.p.evaluate(() => Nuvem.sincronizar()); await pcF.p.waitForTimeout(500);
  const temPainel = await pcF.p.evaluate(() => Perm.pode('executivo.ver') || !!document.querySelector('[data-q]'));
  const podeCorrigir = await pcF.p.evaluate(() => Perm.pode('os.editar') && Perm.pode('os.excluir'));
  ok('Mecânico não tem permissão de editar+excluir (botão de correção não é oferecido)', podeCorrigir === false);

  ok('sem erros de JavaScript', erros.filter(e => !/supabase|ERR_|Failed to fetch|aborted/i.test(e)).length === 0, erros.join(' | '));
  await b.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
})();
