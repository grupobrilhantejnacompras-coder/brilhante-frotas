// Cobertura completa do bug "Acesso restrito": simula, para TODOS os
// usuários de fábrica (não só o Allan), o mesmo tipo de corrupção que a
// nuvem antiga causava (permissoes virando []) e confere que:
//   1) a correção roda sozinha ao carregar a página (sem ação manual);
//   2) as permissões voltas são as corretas do perfil de cada um;
//   3) o login funciona e cada um cai numa tela de verdade, nunca em
//      "#/sem-acesso".
// Cada usuário roda num contexto de navegador isolado (localStorage próprio),
// pra corrupção de um não vazar pro teste do outro.
const { chromium } = require('playwright');
const path = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
const erros = [];
let falhas = 0;

// login, senha, hash esperado ao entrar (primeira página que o perfil enxerga).
const USUARIOS = [
  { usuario: 'Kamau', senha: '159753', perfil: 'Administrador', hash: '#/dashboard' },
  { usuario: 'Taini', senha: '0000', perfil: 'Administrador', hash: '#/dashboard' },
  { usuario: 'Clayton', senha: '1234', perfil: 'Gestor', hash: '#/dashboard' },
  { usuario: 'Guilherme', senha: '0000', perfil: 'Diretoria', hash: '#/dashboard' },
  { usuario: 'Jeferson', senha: '1111', perfil: 'Mecânico', hash: '#/nova-os' },
  { usuario: 'Allan', senha: '2222', perfil: 'Mecânico', hash: '#/nova-os' },
  { usuario: 'Gemerson', senha: '3333', perfil: 'Mecânico', hash: '#/nova-os' },
  { usuario: 'Vandame', senha: '4444', perfil: 'Mecânico', hash: '#/nova-os' },
];

const ok = (t, c) => { console.log((c ? '  ok  ' : ' FALHA ') + t); if (!c) falhas++; };

async function testarUsuario(browser, u) {
  console.log(`\n--- ${u.usuario} (${u.perfil}) ---`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // 1. abre uma vez só pra criar a base local (semente) no localStorage.
  const p1 = await ctx.newPage();
  await p1.goto(path);
  await p1.waitForSelector('#form-login');
  await p1.close();

  // 2. reabre uma página nova e, ANTES do app rodar, corrompe o registro
  //    deste usuário exatamente como a nuvem antiga fazia: permissoes vira [].
  const p2 = await ctx.newPage();
  p2.on('console', m => { if (m.type() === 'error') erros.push(`CONSOLE[${u.usuario}]: ` + m.text()); });
  p2.on('pageerror', e => erros.push(`PAGEERROR[${u.usuario}]: ` + e.message));
  await p2.addInitScript((login) => {
    const raw = localStorage.getItem('brilhante_os_v1');
    if (!raw) return;
    const d = JSON.parse(raw);
    const alvo = d.usuarios.find(x => x.usuario === login);
    if (alvo) alvo.permissoes = [];
    localStorage.setItem('brilhante_os_v1', JSON.stringify(d));
  }, u.usuario);
  await p2.goto(path);
  await p2.waitForSelector('#form-login');

  // 3. confere que a correção já rodou sozinha, só de carregar a página.
  const permissoesDepois = await p2.evaluate((login) =>
    DB.usuarios().find(x => x.usuario === login).permissoes, u.usuario);
  console.log(`   permissões após carregar: ${JSON.stringify(permissoesDepois)}`);
  ok('permissões restauradas sozinhas (sem ficar [])', Array.isArray(permissoesDepois) && permissoesDepois.length > 0);

  const permissoesEsperadas = await p2.evaluate((perfil) => Perm.doPerfil(perfil), u.perfil);
  ok('lista restaurada bate com o padrão do perfil ' + u.perfil,
    JSON.stringify((permissoesDepois || []).slice().sort()) === JSON.stringify(permissoesEsperadas.slice().sort()));

  // 4. login de verdade e confere que cai na tela certa, nunca em "sem acesso".
  await p2.fill('#u', u.usuario); await p2.fill('#s', u.senha); await p2.click('button[type=submit]');
  await p2.waitForSelector('#app .nav', { timeout: 8000 });
  await p2.waitForTimeout(400);
  const hash = await p2.evaluate(() => location.hash);
  console.log(`   hash após login: ${hash}`);
  ok(`${u.usuario} não cai em #/sem-acesso`, hash !== '#/sem-acesso');
  ok(`${u.usuario} cai na tela esperada (${u.hash})`, hash === u.hash);

  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const u of USUARIOS) {
    await testarUsuario(browser, u);
  }
  await browser.close();

  console.log('\nErros de console/página: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTODOS OS USUÁRIOS OK');
  process.exit(falhas ? 1 : 0);
})();
