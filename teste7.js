const { chromium } = require('playwright');
const fs = require('fs');
const erros = [];
(async () => {
  const b = await chromium.launch();
  const ok = (t, c) => console.log((c ? '  ok  ' : ' FALHA ') + t);
  const url = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
  const novoCtx = async () => {
    const c = await b.newContext({ viewport: { width: 1440, height: 950 } });
    return c;
  };
  const abrir = async (ctx, u, s) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
    await p.goto(url); await p.waitForTimeout(400);
    if (u) {
      await p.fill('#u', u); await p.fill('#s', s);
      await p.click('button[type=submit]'); await p.waitForTimeout(700);
    }
    return p;
  };

  /* ============ 1. EQUIPE CADASTRADA DE FÁBRICA ============ */
  console.log('\n— Equipe cadastrada de fábrica —');
  const ctxA = await novoCtx();
  const p = await abrir(ctxA, 'Kamau', '159753');
  const lista = await p.evaluate(() => DB.usuarios().map(u => u.usuario + '/' + u.perfil + '/' + u.status));
  console.log('   ' + lista.join('\n   '));
  ok('8 usuários na base nova', lista.length === 8);

  const ESPERADO = [
    ['Kamau', '159753', 'Administrador'], ['Taini', '0000', 'Administrador'],
    ['Clayton', '1234', 'Gestor'], ['Guilherme', '0000', 'Diretoria'],
    ['Jeferson', '1111', 'Mecânico'], ['Allan', '2222', 'Mecânico'],
    ['Gemerson', '3333', 'Mecânico'], ['Vandame', '4444', 'Mecânico']];

  console.log('\n— Login de cada pessoa —');
  for (const [u, s, perfil] of ESPERADO) {
    const c = await novoCtx();
    const pg = await abrir(c, u, s);
    const entrou = !(await pg.isVisible('#form-login'));
    const menu = entrou ? (await pg.$$eval('.nav-item', e => e.map(x => x.textContent.trim().replace(/\s+/g, ' ')))) : [];
    const p1 = entrou ? (await pg.textContent('.topbar h1')).trim() : '—';
    ok(`${u} / ${s} → ${perfil} · abre em "${p1}" · ${menu.length} itens de menu`, entrou);
    if (u === 'Vandame') {
      ok('   mecânico sem Relatórios/Usuários', !menu.some(x => /Relatórios|Usuários|Configurações/.test(x)));
      await pg.screenshot({ path: 'shot-login-mecanico.png' });
    }
    if (u === 'Guilherme') {
      ok('   diretoria com Dashboard e Relatórios, sem Nova OS',
        menu.some(x => /Dashboard/.test(x)) && menu.some(x => /Relatórios/.test(x)) && !menu.some(x => /Nova Ordem/.test(x)));
      await pg.screenshot({ path: 'shot-login-diretoria.png' });
    }
    if (u === 'Clayton') {
      ok('   gestor sem Usuários, com Configurações', !menu.some(x => /Usuários/.test(x)));
    }
    if (u === 'Taini') {
      ok('   Taini com o mesmo acesso do Kamau (vê Usuários)', menu.some(x => /Usuários/.test(x)));
    }
    await c.close();
  }
  // senha errada
  const cX = await novoCtx(); const pX = await abrir(cX, 'Jeferson', '9999');
  ok('senha errada é recusada', (await pX.textContent('.login-err')).includes('incorret'));
  await cX.close();

  /* ============ 2. BASE ANTIGA GANHA A EQUIPE (migração) ============ */
  console.log('\n— Base antiga recebe a equipe —');
  const ctxV = await novoCtx();
  const pv = await ctxV.newPage();
  await pv.goto(url); await pv.waitForTimeout(400);
  await pv.evaluate(() => {                       // simula base gravada na versão anterior
    const d = DB.get();
    d.usuarios = [d.usuarios[0]]; delete d.equipeVersao; DB.save();
  });
  await pv.reload(); await pv.waitForTimeout(600);
  const depois = await pv.evaluate(() => DB.usuarios().map(u => u.usuario));
  ok('equipe entra numa base já existente (' + depois.length + ' usuários)', depois.length === 8);
  // e não volta se o admin excluir alguém
  await pv.evaluate(() => { const u = DB.usuarioPorLogin('Allan'); DB.excluirUsuario(u.id); });
  await pv.reload(); await pv.waitForTimeout(600);
  ok('usuário excluído não é ressuscitado', !(await pv.evaluate(() => !!DB.usuarioPorLogin('Allan'))));
  await ctxV.close();

  /* ============ 3. BACKUP: EXPORTAR → IMPORTAR ============ */
  console.log('\n— Backup entre navegadores —');
  // registra uma OS nova e um usuário novo no "computador da oficina"
  await p.evaluate(() => {
    const v = DB.get().veiculos[0];
    DB.salvarOS({ data: '2026-08-18', local: 'Oficina', condutor: 'Teste', veiculoId: v.id, kmH: 12345,
      tipoMedidor: 'km', mecanico: 'Jeferson', obs: 'lançamento feito no computador local',
      itens: [{ qtd: 1, descricao: 'TROCA DE ÓLEO TESTE BACKUP', valorUnit: 500, valorTotal: 500 }], total: 500 });
    const nu = { nome: 'Fulano Teste', usuario: 'fulano', senha: 'abc', perfil: 'Mecânico',
      permissoes: Perm.doPerfil('Mecânico'), status: 'Ativo', setor: 'Oficina' };
    DB.salvarUsuario(nu);
  });
  const dadosA = await p.evaluate(() => DB.exportarJSON());
  fs.writeFileSync('/home/claude/backup-teste.json', dadosA);
  const resumoA = await p.evaluate(() => ({ os: DB.get().ordens.length, us: DB.usuarios().length }));
  console.log('   computador da oficina:', JSON.stringify(resumoA));

  // "outro navegador" (escritório / site publicado): base zerada na semente
  const ctxB = await novoCtx();
  const q = await abrir(ctxB, 'Kamau', '159753');
  const antes = await q.evaluate(() => ({ os: DB.get().ordens.length, us: DB.usuarios().length }));
  console.log('   outro navegador antes:', JSON.stringify(antes));
  ok('outro navegador começa sem os lançamentos locais', antes.os < resumoA.os);

  await q.evaluate(() => location.hash = '#/config');
  await q.waitForTimeout(600);
  ok('card explicando onde os dados ficam', (await q.textContent('#pagina')).includes('cofres separados'));
  await q.click('#c-imp-backup');
  await q.waitForSelector('#modal');
  await q.setInputFiles('#bk-arq', '/home/claude/backup-teste.json');
  await q.waitForTimeout(700);
  ok('prévia aparece antes de gravar', (await q.textContent('#bk-previa')).includes('OS que ainda faltam aqui'));
  await q.screenshot({ path: 'shot-backup-previa.png' });
  await q.click('#bk-mesclar');
  await q.waitForTimeout(900);
  const dep = await q.evaluate(() => ({ os: DB.get().ordens.length, us: DB.usuarios().length,
    tem: DB.get().ordens.some(o => (o.itens || []).some(i => /TESTE BACKUP/.test(i.descricao))),
    fulano: !!DB.usuarioPorLogin('fulano') }));
  console.log('   depois de acrescentar:', JSON.stringify(dep));
  ok('OS do outro computador chegou', dep.tem);
  ok('usuário do outro computador chegou', dep.fulano);
  ok('sem duplicar as 247 originais', dep.os === resumoA.os);

  // reimportar o mesmo arquivo não duplica nada
  await q.click('#c-imp-backup');
  await q.waitForSelector('#modal');
  await q.setInputFiles('#bk-arq', '/home/claude/backup-teste.json');
  await q.waitForTimeout(700);
  await q.click('#bk-mesclar');
  await q.waitForTimeout(900);
  const dep2 = await q.evaluate(() => DB.get().ordens.length);
  ok('reimportar o mesmo backup não duplica (' + dep2 + ')', dep2 === dep.os);

  // substituir
  await q.click('#c-imp-backup');
  await q.waitForSelector('#modal');
  await q.setInputFiles('#bk-arq', '/home/claude/backup-teste.json');
  await q.waitForTimeout(700);
  await q.click('#bk-subst');
  await q.waitForTimeout(300);
  await q.click('#bk-ok');
  await q.waitForTimeout(900);
  const dep3 = await q.evaluate(() => ({ os: DB.get().ordens.length, us: DB.usuarios().length, logado: !!Estado.usuario }));
  console.log('   depois de substituir:', JSON.stringify(dep3));
  ok('substituir deixa a base igual à do arquivo', dep3.os === resumoA.os && dep3.us === resumoA.us);
  ok('continua logado depois de substituir', dep3.logado);
  ok('persiste após recarregar', await (async () => {
    await q.reload(); await q.waitForTimeout(800);
    return await q.evaluate(() => DB.get().ordens.length) === resumoA.os;
  })());

  // arquivo inválido
  fs.writeFileSync('/home/claude/backup-ruim.json', '{"foo":1}');
  await q.evaluate(() => location.hash = '#/config'); await q.waitForTimeout(500);
  await q.click('#c-imp-backup');
  await q.waitForSelector('#modal');
  await q.setInputFiles('#bk-arq', '/home/claude/backup-ruim.json');
  await q.waitForTimeout(600);
  ok('arquivo inválido é recusado', (await q.textContent('#bk-previa')).includes('estrutura'));
  ok('botões seguem bloqueados', await q.evaluate(() => document.getElementById('bk-subst').disabled));
  await q.click('[data-fechar]');

  /* ============ 3b. CARIMBO DE VERSÃO ============ */
  console.log('\n— Versão publicada —');
  const ctxV2 = await novoCtx(); const pv2 = await abrir(ctxV2, null, null);
  const rodape = await pv2.textContent('.login-foot');
  const esperada = require('fs').readFileSync(require('path').resolve(__dirname, 'VERSAO.txt'), 'utf8').trim();
  console.log('   rodapé do login:', rodape.replace(/\s+/g, ' ').trim());
  ok('login mostra a versão v' + esperada, rodape.includes('v' + esperada));
  await pv2.fill('#u', 'Kamau'); await pv2.fill('#s', '159753');
  await pv2.click('button[type=submit]'); await pv2.waitForTimeout(700);
  await pv2.evaluate(() => location.hash = '#/config'); await pv2.waitForTimeout(600);
  ok('Configurações mostra a versão', (await pv2.textContent('#pagina')).includes('versão ' + esperada));
  await ctxV2.close();

  /* ============ 4. MECÂNICO NÃO IMPORTA BACKUP ============ */
  const ctxM = await novoCtx();
  const pm = await abrir(ctxM, 'Jeferson', '1111');
  await pm.evaluate(() => location.hash = '#/config');
  await pm.waitForTimeout(600);
  ok('mecânico não acessa Configurações', (await pm.textContent('#pagina')).includes('não tem acesso'));
  await ctxM.close();

  console.log('\nErros: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  await b.close();
})();
