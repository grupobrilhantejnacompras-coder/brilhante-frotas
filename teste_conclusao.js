// Edição e conclusão de O.S. pela tela real (situação Em andamento → Concluída), persistência e filtro por situação.
const { chromium } = require('playwright');
const path = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
let falhas = 0; const ok = (t, c, x) => { console.log((c ? '  ok  ' : ' FALHA ') + t + (x !== undefined ? '  → ' + x : '')); if (!c) falhas++; };
const login = async p => { await p.waitForSelector('#form-login, .nav'); if (await p.$('#form-login')) { await p.fill('#u', 'Kamau'); await p.fill('#s', '159753'); await p.click('button[type=submit]'); } await p.waitForSelector('.nav'); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await ctx.route(/supabase\.co/, r => r.abort());
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto(path); await login(p); await p.waitForTimeout(1300);
  const os = await p.evaluate(() => { const o = DB.get().ordens.find(x => x.placa && x.itens && x.itens.length && x.mecanico); return { id: o.id, num: o.numero, st: o.status, total: o.total }; });
  ok('O.S. de partida encontrada, situação atual', !!os.id, os.st);
  const salvar = async st => {
    await p.evaluate(id => { location.hash = '#/nova-os/' + id; }, os.id);
    await p.waitForSelector('#f-status'); await p.waitForTimeout(150);
    await p.selectOption('#f-status', st); await p.click('button[type=submit]'); await p.waitForTimeout(700);
    return p.evaluate(id => { const o = DB.get().ordens.find(x => x.id === id); return { st: o.status, total: o.total, alt: o.alteradoPor || o.alterado_por || null }; }, os.id);
  };
  let r = await salvar('Em andamento');
  ok('edição: situação gravada como "Em andamento"', r.st === 'Em andamento', JSON.stringify(r));
  ok('edição: total preservado', Math.abs(r.total - os.total) < 0.01);
  ok('edição: carimbo "alterado por" registrado', !!r.alt, r.alt);
  await p.reload(); await login(p); await p.waitForTimeout(1300);
  ok('persistência: continua "Em andamento" após recarregar', await p.evaluate(id => DB.get().ordens.find(x => x.id === id).status, os.id) === 'Em andamento');
  await p.evaluate(() => { location.hash = '#/ordens'; }); await p.waitForTimeout(500);
  const temBadge = await p.evaluate(n => [...document.querySelectorAll('tr, .os-row, [data-id]')].some(e => e.textContent.includes(String(n)) && /andamento/i.test(e.textContent)), os.num);
  ok('consulta: a lista de ordens mostra a O.S. como "Em andamento"', temBadge);
  r = await salvar('Concluída');
  ok('conclusão: situação gravada como "Concluída"', r.st === 'Concluída', JSON.stringify(r));
  await p.reload(); await login(p); await p.waitForTimeout(1300);
  ok('persistência: continua "Concluída" após recarregar', await p.evaluate(id => DB.get().ordens.find(x => x.id === id).status, os.id) === 'Concluída');
  await p.evaluate(id => { location.hash = '#/ordens/' + id; }, os.id); await p.waitForTimeout(400);
  ok('sem erros de JavaScript', erros.length === 0, erros.join('|'));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
