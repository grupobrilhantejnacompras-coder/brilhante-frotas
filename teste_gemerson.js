// v6.16: "Equipe Ar Condicionado" e Gemerson são a mesma pessoa — todas as O.S. passam para o Gemerson
// (semente, base local, nuvem e backups). Testa a migração local e o ciclo com a nuvem (Supabase simulado).
const { chromium } = require('playwright');
const fs = require('fs');
const path = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
const OLD = 'Equipe Ar Condicionado';
let falhas = 0; const erros = [];
const ok = (t, c) => { console.log((c ? '  ok  ' : ' FALHA ') + t); if (!c) falhas++; };
const login = async p => { await p.waitForSelector('#form-login, #painel h2'); if (await p.$('#form-login')) { await p.fill('#u', 'Kamau'); await p.fill('#s', '159753'); await p.click('button[type=submit]'); } await p.waitForSelector('#painel h2'); };
(async () => {
  const seed = JSON.parse(fs.readFileSync('dados_brilhante.json', 'utf8'));
  ok('semente (JSON): nenhuma O.S. na "Equipe Ar Condicionado"', !seed.ordens.some(o => o.mecanico === OLD) && !seed.mecanicos.includes(OLD));
  const b = await chromium.launch();

  /* 1) base local antiga, offline */
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/supabase\.co/, r => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message));
  await p.goto(path); await login(p);
  const total = await p.evaluate(() => DB.get().ordens.length);
  const gemAntes = await p.evaluate(() => DB.get().ordens.filter(o => o.mecanico === 'Gemerson').length);
  ok('base nova: 45 O.S. do ar-condicionado já nascem no Gemerson', gemAntes === 45);
  // simula uma base gravada antes desta versão
  await p.evaluate(OLD => {
    const k = 'brilhante_os_v1', d = JSON.parse(localStorage.getItem(k));
    d.ordens.filter(o => o.mecanico === 'Gemerson').slice(0, 10).forEach(o => { o.mecanico = OLD; });
    d.ordens.filter(o => o.mecanico === 'Gemerson').slice(0, 2).forEach(o => { o.mecanico = 'Jeferson, ' + OLD.toUpperCase(); });
    d.ordens.find(o => o.mecanico === 'Jeferson').mecanico = 'Equipe Ar Condicionado ';
    d.mecanicos = ['Gemerson', 'Jeferson', OLD, 'Vandame'];
    localStorage.setItem(k, JSON.stringify(d));
  }, OLD);
  await p.reload(); await login(p);
  const r = await p.evaluate(OLD => {
    const d = DB.get();
    return { velhos: d.ordens.filter(o => /equipe ar/i.test(o.mecanico || '')).length, total: d.ordens.length,
      gem: d.ordens.filter(o => o.mecanico === 'Gemerson').length, lista: d.mecanicos, dupla: d.ordens.filter(o => o.mecanico === 'Jeferson, Gemerson').length,
      ocorrenciasVelhasNaLista: d.mecanicos.filter(m => m === OLD).length };
  }, OLD);
  ok('migração local: nenhuma O.S. restou na Equipe Ar Condicionado', r.velhos === 0);
  ok('migração local: total de O.S. preservado (' + total + ')', r.total === total);
  ok('migração local: Gemerson ficou com as 45 (+1 que era "Equipe… " com espaço)', r.gem >= 43 && r.gem <= 46);
  ok('lista de mecânicos sem a Equipe e sem duplicar o Gemerson', r.ocorrenciasVelhasNaLista === 0 && r.lista.filter(m => m === 'Gemerson').length === 1);
  ok('OS com vários responsáveis: "Jeferson, Gemerson" (sem repetir)', r.dupla === 2);
  const painel = await p.$$eval('#painel h2', hs => hs.map(h => h.textContent.trim()));
  ok('painel abre sem erros', painel.length > 3);

  /* 2) nuvem (simulada): vem com o nome antigo e o app regrava com Gemerson */
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  // a nuvem guarda TODAS as O.S. (como em produção), as 45 do ar-condicionado ainda com o nome antigo
  const remotas = seed.ordens.map((o, i) => ({ id: 'P' + (i + 1), numero: o.numero, data: o.data, veiculo_id: o.veiculoId, placa: o.placa, frota: o.frota, local: o.local, condutor: o.condutor, mecanico: o.mecanico === 'Gemerson' ? OLD : o.mecanico, km_h: o.kmH, tipo_medidor: null, obs: o.obs || null, itens: o.itens, total: o.total, criado_por: null, criado_data: null, criado_hora: null, alterado_por: null, alterado_data: null, alterado_hora: null }));
  const posts = [];
  await ctx2.route(/supabase\.co\/rest\/v1\/ordens/, async rt => {
    const q = rt.request();
    if (q.method() === 'GET') return rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(remotas) });
    if (q.method() === 'POST') { posts.push(JSON.parse(q.postData())); return rt.fulfill({ status: 201, body: '' }); }
    return rt.fulfill({ status: 200, body: '[]' });
  });
  await ctx2.route(/supabase\.co\/(?!rest\/v1\/ordens)/, r => r.abort());
  const p2 = await ctx2.newPage(); p2.on('pageerror', e => erros.push(e.message));
  await p2.goto(path); await login(p2); await p2.waitForTimeout(1500);
  const cloud = await p2.evaluate(() => DB.get().ordens.map(o => ({ id: o.id, m: o.mecanico })));
  ok('nuvem → app: as 45 viraram Gemerson localmente e nenhuma ficou na Equipe', cloud.filter(o => o.m === 'Gemerson').length === 45 && !cloud.some(o => /equipe ar/i.test(o.m || '')));
  const enviadas = posts.flat();
  ok('app → nuvem: reenviou exatamente as 45 O.S. alteradas, já como Gemerson', enviadas.length === 45 && enviadas.every(l => l.mecanico === 'Gemerson'));
  ok('app → nuvem: não reenviou as que não mudaram', enviadas.length === 45 && !enviadas.some(l => l.mecanico !== 'Gemerson'));

  /* 3) importar backup antigo (mesclar) já normaliza */
  const aviso = await p2.evaluate(OLD => {
    const bk = JSON.parse(JSON.stringify(DB.get()));
    const o = JSON.parse(JSON.stringify(bk.ordens[0])); o.id = 'ZZ1'; o.numero = 99999; o.data = '2026-01-02'; o.mecanico = OLD; o.total = 7.77;
    bk.ordens = [o]; bk.mecanicos = [OLD];
    const r = DB.importarBackup(bk, 'mesclar');
    const c = DB.get().ordens.find(x => x.total === 7.77);
    return { r, mec: c && c.mecanico, lista: DB.get().mecanicos };
  }, OLD);
  ok('backup antigo mesclado entra como Gemerson', aviso.mec === 'Gemerson' && !aviso.lista.includes(OLD));
  ok('sem erros de página', erros.length === 0);
  if (erros.length) console.log(erros);
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
