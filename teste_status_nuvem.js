// v6.18: a situação da O.S. (Em andamento / Concluída…) atravessa a nuvem — e continua funcionando
// enquanto a coluna "status" ainda NÃO existe no banco. Nuvem simulada e com estado (Supabase não é tocado).
const { chromium } = require('playwright');
const path = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
let falhas = 0; const erros = [];
const ok = (t, c, x) => { console.log((c ? '  ok  ' : ' FALHA ') + t + (x !== undefined ? '  → ' + x : '')); if (!c) falhas++; };
const login = async p => { await p.waitForSelector('#form-login, .nav'); if (await p.$('#form-login')) { await p.fill('#u', 'Kamau'); await p.fill('#s', '159753'); await p.click('button[type=submit]'); } await p.waitForSelector('.nav'); };

const nuvem = new Map(); let colunaExiste = false, rejeitados = 0, posts = 0;
const visao = r => { const c = { ...r }; if (!colunaExiste) delete c.status; else if (!('status' in c)) c.status = null; return c; };
async function ligarNuvem(ctx) {
  await ctx.route(/supabase\.co\/rest\/v1\/ordens/, async rt => {
    const q = rt.request();
    if (q.method() === 'GET') return rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...nuvem.values()].map(visao)) });
    if (q.method() === 'POST') {
      const lin = JSON.parse(q.postData()); const arr = Array.isArray(lin) ? lin : [lin]; posts++;
      if (!colunaExiste && arr.some(l => 'status' in l)) { rejeitados++; return rt.fulfill({ status: 400, contentType: 'application/json', body: '{"code":"PGRST204","message":"Could not find the \'status\' column of \'ordens\' in the schema cache"}' }); }
      arr.forEach(l => nuvem.set(l.id, { ...(nuvem.get(l.id) || {}), ...l }));
      return rt.fulfill({ status: 201, body: '' });
    }
    return rt.fulfill({ status: 200, body: '[]' });
  });
  await ctx.route(/supabase\.co\/(?!rest\/v1\/ordens)/, r => r.abort());
}
const novoPc = async b => { const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' }); await ligarNuvem(ctx); const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message)); return { ctx, p }; };
const situacoes = p => p.evaluate(() => { const c = {}; DB.get().ordens.forEach(o => { const s = o.status || '(vazio)'; c[s] = (c[s] || 0) + 1; }); return c; });
const editar = async (p, id, st) => {
  await p.evaluate(i => { location.hash = '#/nova-os/' + i; }, id); await p.waitForSelector('#f-status'); await p.waitForTimeout(150);
  await p.selectOption('#f-status', st); await p.click('button[type=submit]'); await p.waitForTimeout(900);
};

(async () => {
  const b = await chromium.launch();

  console.log('\n== A) banco SEM a coluna "status" (situação de hoje) ==');
  let pc1 = await novoPc(b); let p = pc1.p;
  await p.goto(path); await login(p); await p.waitForTimeout(2500);
  const total = await p.evaluate(() => DB.get().ordens.length);
  ok('primeira sincronização subiu todas as O.S. para a nuvem (mesmo sem a coluna)', nuvem.size === total && total >= 247, nuvem.size + ' de ' + total);
  ok('o banco recusou a coluna inexistente e o app reenviou sem ela', rejeitados >= 1 && ![...nuvem.values()].some(r => 'status' in r), 'recusas: ' + rejeitados);
  const id = await p.evaluate(() => DB.get().ordens.find(x => x.placa && x.itens && x.itens.length).id);
  await editar(p, id, 'Em andamento');
  ok('editar com a coluna ausente continua salvando (O.S. na nuvem foi atualizada)', !!nuvem.get(id).alterado_por, nuvem.get(id).alterado_por);
  await p.reload(); await login(p); await p.waitForTimeout(2500);
  ok('após sincronizar, a situação "Em andamento" NÃO se perdeu neste computador', await p.evaluate(i => DB.get().ordens.find(o => o.id === i).status, id) === 'Em andamento');
  let sit = await situacoes(p);
  ok('nenhuma O.S. ficou sem situação (etiqueta vazia)', !sit['(vazio)'], JSON.stringify(sit));
  await p.evaluate(() => { location.hash = '#/ordens'; }); await p.waitForTimeout(500);
  ok('lista: nenhuma etiqueta de situação vazia', await p.evaluate(() => ![...document.querySelectorAll('.badge')].some(e => !e.textContent.trim())));
  const pc2 = await novoPc(b);
  await pc2.p.goto(path); await login(pc2.p); await pc2.p.waitForTimeout(2500);
  sit = await situacoes(pc2.p);
  ok('outro computador (coluna ausente): todas aparecem com situação padrão "Concluída", sem vazias', !sit['(vazio)'] && sit['Concluída'] === total, JSON.stringify(sit));
  await pc2.ctx.close();

  console.log('\n== B) a coluna "status" é criada no banco ==');
  colunaExiste = true; posts = 0; rejeitados = 0;
  await p.reload(); await login(p); await p.waitForTimeout(3000);
  ok('o app reconheceu a coluna e gravou a situação de todas as O.S. (preenchimento único)', [...nuvem.values()].every(r => r.status), 'sem situação na nuvem: ' + [...nuvem.values()].filter(r => !r.status).length);
  ok('a situação "Em andamento" editada antes foi para a nuvem', nuvem.get(id).status === 'Em andamento');
  ok('as demais ficaram "Concluída"', [...nuvem.values()].filter(r => r.status === 'Concluída').length === total - 1);
  ok('sem recusas do banco', rejeitados === 0);
  const pc3 = await novoPc(b);
  await pc3.p.goto(path); await login(pc3.p); await pc3.p.waitForTimeout(2500);
  ok('OUTRO computador enxerga "Em andamento" (a situação atravessa a nuvem)', await pc3.p.evaluate(i => DB.get().ordens.find(o => o.id === i).status, id) === 'Em andamento');
  await editar(pc3.p, id, 'Concluída');
  ok('concluir no outro computador grava "Concluída" na nuvem', nuvem.get(id).status === 'Concluída');
  await p.reload(); await login(p); await p.waitForTimeout(2500);
  ok('no primeiro computador a O.S. aparece Concluída depois de sincronizar', await p.evaluate(i => DB.get().ordens.find(o => o.id === i).status, id) === 'Concluída');
  // nova OS pelo formulário com outra situação
  await p.evaluate(() => { location.hash = '#/nova-os'; }); await p.waitForSelector('#f-status');
  ok('formulário de nova O.S. oferece as 4 situações', await p.evaluate(() => [...document.querySelectorAll('#f-status option')].map(o => o.value).join(',')) === 'Concluída,Aberta,Em andamento,Cancelada');
  ok('sem erros de JavaScript', erros.filter(e => !/supabase|ERR_/i.test(e)).length === 0, erros.join('|'));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
