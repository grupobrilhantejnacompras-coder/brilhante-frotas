/* Auditoria (criado/alterado por) + mecânicos responsáveis múltiplos. */
const { chromium } = require('playwright');
const path = require('path');
const erros = [];
(async () => {
  const b = await chromium.launch();
  const ok = (t, c) => console.log((c ? '  ok  ' : ' FALHA ') + t);
  const url = 'file://' + path.resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
  await p.goto(url); await p.waitForTimeout(400);
  await p.fill('#u', 'Kamau'); await p.fill('#s', '159753'); await p.click('button[type=submit]');
  await p.waitForTimeout(800);
  await p.evaluate(() => location.hash = '#/nova-os'); await p.waitForTimeout(700);

  // cabeçalho
  await p.fill('#f-local', 'Oficina Central');
  await p.fill('#f-veic', 'QMS4G35'); await p.dispatchEvent('#f-veic', 'change'); await p.waitForTimeout(400);

  console.log('— Mecânicos responsáveis —');
  const nomes = await p.$$eval('#mec-resp [data-mec]', e => e.map(x => x.value));
  console.log('   opções:', nomes.join(', '));
  ok('cinco nomes exatos', JSON.stringify(nomes) === JSON.stringify(['Jefesson', 'Allan', 'Gemerson', 'Vandame', 'Tião']));

  // não salva sem responsável
  const sv = await p.evaluate(() => DB.get().servicos.find(s => /pastilha/i.test(s.descricao)));
  await p.fill('.itens-tbl tr[data-i="0"] input[data-c=descricao]', sv.descricao); await p.waitForTimeout(300);
  await p.click('button[type=submit]'); await p.waitForTimeout(400);
  ok('bloqueia sem responsável', (await p.textContent('#toasts')).includes('mecânico responsável'));

  // marca dois
  await p.check('#mec-resp input[value="Jefesson"]');
  await p.check('#mec-resp input[value="Tião"]');
  await p.waitForTimeout(200);
  await p.click('button[type=submit]'); await p.waitForTimeout(900);
  const o = await p.evaluate(() => { const b = DB.get().ordens; return b[b.length - 1]; });
  console.log('   gravado:', JSON.stringify({ resp: o.responsaveis, mec: o.mecanico, por: o.criadoPor, data: o.criadoData, hora: o.criadoHora }));
  ok('dois responsáveis gravados', Array.isArray(o.responsaveis) && o.responsaveis.length === 2 && o.responsaveis.includes('Tião'));
  ok('mecanico texto = junção (compat. relatórios)', o.mecanico === 'Jefesson, Tião');

  console.log('— Auditoria de criação —');
  ok('registrado por Kamau', o.criadoPor === 'Kamau');
  ok('data de criação preenchida', /^\d{4}-\d{2}-\d{2}$/.test(o.criadoData));
  ok('hora de criação HH:MM', /^\d{2}:\d{2}$/.test(o.criadoHora));
  ok('sem carimbo de alteração ainda', !o.alteradoPor);
  ok('detalhe mostra "Registrado por"', (await p.content()).includes('Registrado por'));
  await p.screenshot({ path: 'shot-os-detalhe-audit.png', fullPage: true });

  console.log('— Alteração por outro usuário —');
  // troca de usuário (simula segundo login) e edita
  await p.evaluate(() => { Auth.sair(); });
  await p.waitForTimeout(300);
  await p.fill('#u', 'Clayton'); await p.fill('#s', '1234'); await p.click('button[type=submit]'); await p.waitForTimeout(700);
  await p.evaluate(id => location.hash = '#/nova-os/' + id, o.id); await p.waitForTimeout(700);
  ok('responsáveis vêm marcados ao editar', (await p.$$eval('#mec-resp [data-mec]:checked', e => e.length)) === 2);
  await p.fill('#f-obs', 'Ajuste feito pelo gestor.');
  await p.click('button[type=submit]'); await p.waitForTimeout(900);
  const o2 = await p.evaluate(id => DB.get().ordens.find(x => x.id === id), o.id);
  console.log('   após alteração:', JSON.stringify({ criadoPor: o2.criadoPor, alteradoPor: o2.alteradoPor, alteradoData: o2.alteradoData }));
  ok('criação original preservada (Kamau)', o2.criadoPor === 'Kamau' && o2.criadoData === o.criadoData);
  ok('alteração registra Clayton', o2.alteradoPor === 'Clayton' && /^\d{4}-\d{2}-\d{2}$/.test(o2.alteradoData) && /^\d{2}:\d{2}$/.test(o2.alteradoHora));
  ok('detalhe mostra "Última alteração"', (await p.content()).includes('Última alteração'));

  console.log('— Base original intacta —');
  ok('247 OS da planilha preservadas', await p.evaluate(() => DB.get().ordens.filter(o => String(o.id).startsWith('P')).length === 247));
  ok('OS antigas sem carimbo mostram "importado"', await p.evaluate(() => {
    const antiga = DB.get().ordens.find(o => String(o.id).startsWith('P'));
    return !antiga.criadoData;   // detalhe exibirá "Registro importado da planilha"
  }));

  console.log('\nErros: ' + (erros.length ? '\n - ' + erros.join('\n - ') : 'nenhum'));
  await b.close();
})();
