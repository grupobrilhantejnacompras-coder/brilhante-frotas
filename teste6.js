const { chromium } = require('playwright');
const erros = [];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
  const ok = (t, c) => console.log((c ? '  ok  ' : ' FALHA ') + t);
  const url = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
  const entrar = async (pg, u, s) => {
    await pg.goto(url); await pg.waitForTimeout(300);
    if (await pg.isVisible('#form-login')) { await pg.fill('#u', u); await pg.fill('#s', s); await pg.click('button[type=submit]'); }
    await pg.waitForTimeout(700);
  };

  /* ============ EDIÇÃO DE VEÍCULOS ============ */
  console.log('\n— Edição de veículos —');
  await entrar(p, 'Kamau', '159753');
  await p.evaluate(() => location.hash = '#/veiculos');
  await p.waitForTimeout(600);
  console.log('   ' + (await p.textContent('#v-cont')).trim());
  ok('coluna Cadastro com pendências', (await p.$$('td .badge.b-amber')).length > 0);
  ok('botão Editar em cada linha', (await p.$$('[data-edit-v]')).length > 5);

  // filtro de incompletos
  const totalAntes = (await p.$$('tbody tr')).length;
  console.log('   ' + (await p.$$eval('[data-pend]', e => e.map(x => x.textContent.trim().replace(/\s+/g, ' ')))).join(' | '));
  await p.click('[data-pend=frota]');
  await p.waitForTimeout(500);
  const totalDepois = (await p.$$('tbody tr')).length;
  ok(`filtrar por "sem Nº da frota" (${totalAntes} → ${totalDepois})`, totalDepois > 0 && totalDepois <= totalAntes);
  await p.screenshot({ path: 'shot-veic-incompletos.png' });

  // editar direto da lista: preencher a frota que faltava
  const alvo = await p.evaluate(() => {
    const v = DB.get().veiculos.find(x => x.frota === '—' && x.placa !== '—');
    return v ? { id: v.id, nome: v.nome, placa: v.placa } : null;
  });
  console.log('   editando:', JSON.stringify(alvo));
  await p.click(`[data-edit-v="${alvo.id}"]`);
  await p.waitForSelector('#modal');
  await p.waitForTimeout(250);
  ok('modal avisa o que falta', (await p.textContent('#modal')).includes('Faltam'));
  ok('campos vazios destacados', (await p.$$('#modal .input.pendente')).length > 0);
  await p.fill('#e-fr', '10310.05');
  await p.fill('#e-ma', 'Toyota'); await p.fill('#e-an', '2021');
  await p.screenshot({ path: 'shot-veic-completar.png' });
  await p.click('#e-salvar');
  await p.waitForTimeout(700);
  const gravou = await p.evaluate(id => { const v = DB.veiculo(id); return { frota: v.frota, marca: v.marca, ano: v.ano }; }, alvo.id);
  console.log('   gravado:', JSON.stringify(gravou));
  ok('frota preenchida e gravada', gravou.frota === '10310.05' && gravou.ano === '2021');
  ok('persistiu após recarregar', await (async () => {
    await p.reload(); await p.waitForTimeout(700);
    return await p.evaluate(id => DB.veiculo(id).frota === '10310.05', alvo.id);
  })());

  // editar pela página do veículo
  await p.evaluate(id => location.hash = '#/veiculo/' + id, alvo.id);
  await p.waitForTimeout(600);
  const rotulo = await p.textContent('[data-acao=editar]');
  ok('botão da página do veículo mostra pendências (' + rotulo.trim() + ')', /Completar|Editar/.test(rotulo));

  /* ============ USUÁRIOS ============ */
  console.log('\n— Gerenciamento de usuários —');
  await p.evaluate(() => location.hash = '#/usuarios');
  await p.waitForTimeout(600);
  ok('página de usuários abre', (await p.$$('tbody tr')).length >= 1);
  ok('lista os perfis disponíveis', (await p.textContent('#pagina')).includes('Somente leitura'));
  await p.screenshot({ path: 'shot-usuarios.png', fullPage: true });

  // cadastrar mecânico
  await p.click('#novo-usuario');
  await p.waitForSelector('#modal');
  await p.waitForTimeout(250);
  await p.fill('#uu-nome', 'Jeferson Silva');
  await p.fill('#uu-user', 'jeferson.silva');
  await p.fill('#uu-senha', 'meca2026');
  await p.fill('#uu-setor', 'Oficina');
  await p.selectOption('#uu-perfil', 'Mecânico');
  await p.waitForTimeout(300);
  const marcadas = await p.$$eval('#uu-perms [data-perm]:checked', e => e.map(x => x.dataset.perm));
  console.log('   permissões do perfil Mecânico:', marcadas.join(', '));
  ok('perfil preenche permissões padrão', marcadas.includes('os.criar') && !marcadas.includes('relatorios.ver'));
  await p.screenshot({ path: 'shot-usuario-novo.png' });
  await p.click('#uu-salvar');
  await p.waitForTimeout(700);
  ok('mecânico cadastrado', await p.evaluate(() => !!DB.usuarioPorLogin('jeferson.silva')));

  // cadastrar diretoria (somente leitura)
  await p.click('#novo-usuario');
  await p.waitForSelector('#modal'); await p.waitForTimeout(250);
  await p.fill('#uu-nome', 'Diretoria Brilhante');
  await p.fill('#uu-user', 'diretoria.geral');
  await p.fill('#uu-senha', 'dir2026');
  await p.selectOption('#uu-perfil', 'Diretoria');
  await p.waitForTimeout(250);
  await p.click('#uu-salvar');
  await p.waitForTimeout(600);
  ok('diretoria cadastrada', await p.evaluate(() => !!DB.usuarioPorLogin('diretoria.geral')));

  // login duplicado bloqueado
  await p.click('#novo-usuario');
  await p.waitForSelector('#modal'); await p.waitForTimeout(200);
  await p.fill('#uu-nome', 'Outro'); await p.fill('#uu-user', 'jeferson.silva'); await p.fill('#uu-senha', '1234');
  await p.click('#uu-salvar');
  await p.waitForTimeout(400);
  ok('login duplicado é bloqueado', (await p.textContent('#toasts')).includes('Já existe'));
  await p.click('[data-fechar]');
  await p.waitForTimeout(200);

  /* ============ ACESSO DO MECÂNICO ============ */
  console.log('\n— Sessão do mecânico —');
  const m = await ctx.newPage();
  m.on('pageerror', e => erros.push('MECANICO: ' + e.message));
  m.on('console', x => { if (x.type() === 'error') erros.push('MECANICO CONSOLE: ' + x.text()); });
  await entrar(m, 'jeferson.silva', 'meca2026');
  const menuMec = await m.$$eval('.nav-item', e => e.map(x => x.textContent.trim().replace(/\s+/g, ' ')));
  console.log('   menu:', menuMec.join(' | '));
  ok('menu sem Dashboard/Relatórios/Usuários',
    !menuMec.some(x => /Dashboard|Relatórios|Usuários|Configurações|Reincidências/.test(x)));
  ok('menu com Nova OS e Ordens', menuMec.some(x => /Nova Ordem/.test(x)) && menuMec.some(x => /Ordens de Serviço/.test(x)));
  ok('abre direto na Nova OS', (await m.textContent('.topbar h1')).includes('Nova ordem'));
  await m.screenshot({ path: 'shot-mecanico.png' });

  // rota bloqueada mesmo digitando na URL
  await m.evaluate(() => location.hash = '#/relatorios');
  await m.waitForTimeout(600);
  ok('rota digitada é bloqueada', (await m.textContent('#pagina')).includes('não tem acesso'));
  await m.screenshot({ path: 'shot-sem-acesso.png' });

  // mecânico registra OS normalmente
  await m.evaluate(() => location.hash = '#/nova-os');
  await m.waitForTimeout(500);
  await m.fill('#f-veic', 'QMS4G35'); await m.dispatchEvent('#f-veic', 'change');
  await m.fill('#f-mec', 'Jeferson'); await m.fill('#f-local', 'Oficina');
  const sv = await m.evaluate(() => DB.get().servicos.find(s => /pastilha/i.test(s.descricao)));
  await m.fill('.itens-tbl tr[data-i="0"] input[data-c=descricao]', sv.descricao);
  await m.waitForTimeout(400);
  await m.click('button[type=submit]');
  await m.waitForTimeout(700);
  ok('mecânico consegue salvar OS', (await m.content()).includes('Serviços executados'));
  ok('mecânico não vê botão Excluir OS', !(await m.$('[data-acao=excluir]')));

  /* ============ ACESSO DA DIRETORIA ============ */
  console.log('\n— Sessão da diretoria —');
  const d = await ctx.newPage();
  d.on('pageerror', e => erros.push('DIRETORIA: ' + e.message));
  await entrar(d, 'diretoria.geral', 'dir2026');
  const menuDir = await d.$$eval('.nav-item', e => e.map(x => x.textContent.trim().replace(/\s+/g, ' ')));
  console.log('   menu:', menuDir.join(' | '));
  ok('diretoria vê Dashboard e Relatórios', menuDir.some(x => /Dashboard/.test(x)) && menuDir.some(x => /Relatórios/.test(x)));
  ok('diretoria sem Nova OS', !menuDir.some(x => /Nova Ordem/.test(x)));
  ok('sem botão + Nova OS no dashboard', !(await d.$('[data-ir=nova-os]')));
  await d.evaluate(() => location.hash = '#/veiculos');
  await d.waitForTimeout(500);
  ok('diretoria não edita veículos', !(await d.$('[data-edit-v]')) && !(await d.$('#novo-veiculo')));
  await d.evaluate(() => location.hash = '#/relatorios');
  await d.waitForTimeout(600);
  await d.click('[data-aba=diretoria]');
  await d.waitForTimeout(700);
  ok('diretoria consegue exportar o painel', !!(await d.$('#exp-baixar')));
  await d.screenshot({ path: 'shot-diretoria.png' });

  /* ============ MINHA CONTA ============ */
  console.log('\n— Minha conta —');
  await m.evaluate(() => location.hash = '#/minha-conta');
  await m.waitForTimeout(500);
  ok('página minha conta abre', await m.isVisible('#mc-atual'));
  await m.fill('#mc-atual', 'errada'); await m.fill('#mc-nova', 'novaSenha'); await m.fill('#mc-conf', 'novaSenha');
  await m.click('#mc-trocar'); await m.waitForTimeout(300);
  ok('senha atual errada é recusada', (await m.textContent('#toasts')).includes('não confere'));
  await m.fill('#mc-atual', 'meca2026'); await m.fill('#mc-nova', 'nova1234'); await m.fill('#mc-conf', 'nova1234');
  await m.click('#mc-trocar'); await m.waitForTimeout(500);
  ok('senha alterada', await m.evaluate(() => DB.usuarioPorLogin('jeferson.silva').senha === 'nova1234'));

  // login com usuário inativo
  await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => {
    const u = DB.usuarioPorLogin('diretoria.geral'); u.status = 'Inativo'; DB.salvarUsuario(u);
  });
  const i = await ctx.newPage();
  await i.goto(url); await i.waitForTimeout(400);
  await i.fill('#u', 'diretoria.geral'); await i.fill('#s', 'dir2026'); await i.click('button[type=submit]');
  await i.waitForTimeout(400);
  ok('usuário inativo não entra', (await i.textContent('.login-err')).includes('inativo'));

  console.log('\nErros: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  await b.close();
})();
