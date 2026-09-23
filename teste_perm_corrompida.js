// Reproduz o cenário real do Allan: um usuário "Mecânico" salvo no
// localStorage com permissoes: [] (exatamente o que a nuvem antiga devolvia
// pros 8 usuários de fábrica) e confere que, ao recarregar a página, o
// sistema já entra corrigindo isso sozinho, sem precisar de nenhuma ação
// manual no aparelho da pessoa.
const { chromium } = require('playwright');
const path = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
const erros = [];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));

  const ok = (t, c) => console.log((c ? '  ok  ' : ' FALHA ') + t);

  // 1. abre uma vez só pra criar a base local (semente) no localStorage.
  await p.goto(path);
  await p.waitForSelector('#form-login');
  await p.close();

  // 2. reabre uma página nova e, ANTES do app rodar, corrompe o registro do
  //    Allan exatamente como a nuvem antiga fazia: permissoes vira [].
  const p2 = await ctx.newPage();
  p2.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE2: ' + m.text()); });
  p2.on('pageerror', e => erros.push('PAGEERROR2: ' + e.message));
  await p2.addInitScript(() => {
    const raw = localStorage.getItem('brilhante_os_v1');
    if (!raw) return;
    const d = JSON.parse(raw);
    const allan = d.usuarios.find(u => u.usuario === 'Allan');
    if (allan) allan.permissoes = [];
    localStorage.setItem('brilhante_os_v1', JSON.stringify(d));
  });
  await p2.goto(path);
  await p2.waitForSelector('#form-login');

  // 3. confere que a correção já rodou sozinha, só de carregar a página —
  //    sem precisar logar como ninguém.
  const permissoesDepois = await p2.evaluate(() => DB.usuarios().find(u => u.usuario === 'Allan').permissoes);
  console.log('   permissões do Allan após carregar:', JSON.stringify(permissoesDepois));
  ok('permissões do Allan foram restauradas sozinhas (sem ficar [])', Array.isArray(permissoesDepois) && permissoesDepois.length > 0);
  ok('inclui os.criar (pra não cair em "sem acesso")', permissoesDepois.includes('os.criar'));

  // 4. login de verdade como Allan e confere que ele cai na tela certa, não
  //    em "Acesso restrito".
  await p2.fill('#u', 'Allan'); await p2.fill('#s', '2222'); await p2.click('button[type=submit]');
  await p2.waitForSelector('#app .nav', { timeout: 8000 });
  await p2.waitForTimeout(400);
  const hash = await p2.evaluate(() => location.hash);
  console.log('   hash após login:', hash);
  ok('Allan não cai em #/sem-acesso', hash !== '#/sem-acesso');
  ok('Allan consegue ver o formulário de Nova OS', await p2.isVisible('#form-os'));

  console.log('\nErros: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  await browser.close();
})();
