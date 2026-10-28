// v6.21: visualizar, imprimir e baixar PDF da ordem de serviço (modelo A4).
// Confere o que aparece na visualização, o que vai para a impressora (PDF do navegador em modo "print") e o PDF gerado pelo sistema.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), pth = require('path');
const arq = 'file://' + pth.resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
let falhas = 0; const erros = [];
const ok = (t, c, x) => { console.log((c ? '  ok  ' : ' FALHA ') + t + (x !== undefined ? '  → ' + x : '')); if (!c) falhas++; };
const tmp = fs.mkdtempSync(pth.join(os.tmpdir(), 'osimp-'));
const login = async (p, u = 'Kamau', s = '159753') => { await p.waitForSelector('#form-login, .nav'); if (await p.$('#form-login')) { await p.fill('#u', u); await p.fill('#s', s); await p.click('button[type=submit]'); } await p.waitForSelector('.nav'); };
const texto = f => execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' });
const paginasPDF = f => +(execFileSync('pdfinfo', [f], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/) || [])[1];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
  await ctx.route(/supabase\.co/, r => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message));
  await p.goto(arq); await login(p); await p.waitForTimeout(800);

  // OS real, com vários itens
  const alvo = await p.evaluate(() => { const o = DB.get().ordens.filter(x => x.itens.length >= 3 && x.placa).sort((a, c) => c.itens.length - a.itens.length)[0]; return { id: o.id, n: o.numero, placa: o.placa, total: o.total, itens: o.itens.length, desc: o.itens[0].descricao }; });
  console.log('\n== A) OS real nº ' + alvo.n + ' (' + alvo.itens + ' itens) ==');
  await p.evaluate(i => { location.hash = '#/ordens/' + i; }, alvo.id); await p.waitForSelector('[data-acao="previa"]');
  ok('detalhe da OS oferece Visualizar impressão, Baixar PDF e Imprimir', !!(await p.$('[data-acao="previa"]')) && !!(await p.$('[data-acao="pdf"]')) && !!(await p.$('[data-acao="imprimir"]')));
  await p.click('[data-acao="previa"]'); await p.waitForSelector('.os-folha'); await p.waitForTimeout(300);
  const prev = await p.evaluate(() => ({ paginas: document.querySelectorAll('#modal .os-folha').length, txt: document.querySelector('#modal .osp-area').innerText, larg: document.querySelector('#modal .osp-pg').getBoundingClientRect().width, area: document.querySelector('#osp-area').clientWidth }));
  ok('visualização mostra a folha A4 com número, placa e total', prev.txt.includes('Nº ' + alvo.n) && prev.txt.includes(alvo.placa) && prev.txt.replace(/\s/g, ' ').includes(String(alvo.total.toFixed(2)).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')), prev.paginas + ' página(s)');
  ok('folha cabe na janela (sem rolagem lateral)', prev.larg <= prev.area, Math.round(prev.larg) + ' de ' + prev.area + ' px');
  ok('há as assinaturas e as seções do modelo', ['Ordem de serviço', 'Serviços executados', 'Mecânico responsável', 'Gestor', 'VALOR TOTAL DA ORDEM DE SERVIÇO'].every(t => prev.txt.includes(t)));
  ok('a logo aparece na folha', await p.evaluate(() => !!document.querySelector('#modal .os-folha .osf-logo svg path')));
  await p.locator('#modal .osp-area').screenshot({ path: pth.join(tmp, 'previa.png') });
  fs.copyFileSync(pth.join(tmp, 'previa.png'), '/tmp/os_previa.png');

  // PDF baixado
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click('#osp-pdf')]);
  const pdfArq = pth.join(tmp, 'baixado.pdf'); await dl.saveAs(pdfArq);
  ok('arquivo baixado tem nome com número e placa', /^OS_\d+_.+\.pdf$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const bin = fs.readFileSync(pdfArq);
  ok('arquivo é um PDF válido (%PDF…%%EOF)', bin.slice(0, 5).toString() === '%PDF-' && /%%EOF\s*$/.test(bin.toString('latin1')));
  let t = ''; try { t = texto(pdfArq); } catch (e) { t = ''; ok('pdftotext leu o PDF', false, e.message.slice(0, 80)); }
  ok('PDF tem as mesmas informações (número, placa, 1º serviço, TOTAL, assinaturas)', t.includes('Nº ' + alvo.n) && t.includes(alvo.placa) && t.includes(alvo.desc.slice(0, 18)) && t.includes('VALOR TOTAL DA ORDEM DE SERVIÇO') && t.includes('Gestor'), 'páginas ' + paginasPDF(pdfArq));
  ok('acentos corretos no PDF', /Mecânico responsável/.test(t) && /Serviços executados/.test(t) && /DESCRIÇÃO/.test(t) && /SITUAÇÃO/.test(t));
  ok('PDF tem o mesmo nº de páginas da visualização', paginasPDF(pdfArq) === prev.paginas);
  execFileSync('pdftoppm', ['-png', '-r', '70', pdfArq, pth.join(tmp, 'pdf')]);
  const pngs = fs.readdirSync(tmp).filter(f => /^pdf-.*\.png$/.test(f)); fs.copyFileSync(pth.join(tmp, pngs[0]), '/tmp/os_pdf_p1.png');
  ok('PDF renderizado como imagem', pngs.length === prev.paginas && fs.statSync(pth.join(tmp, pngs[0])).size > 8000);

  // Impressão do navegador (modo print): só a folha, sem menu, sem página em branco
  await p.evaluate(() => { window.__imp = 0; window.print = () => { window.__imp++; }; });
  await p.click('#osp-print'); await p.waitForTimeout(400);
  ok('Imprimir aciona a impressão do navegador', await p.evaluate(() => window.__imp) === 1);
  await p.emulateMedia({ media: 'print' });
  const vis = await p.evaluate(() => ({ app: document.getElementById('app').getClientRects().length ? 'visivel' : 'none', modal: document.getElementById('modal') && document.getElementById('modal').getClientRects().length ? 'visivel' : 'none', raiz: getComputedStyle(document.getElementById('os-print-root')).display }));
  ok('em modo impressão só a folha aparece (sistema e janela ocultos)', vis.app === 'none' && vis.modal === 'none' && vis.raiz === 'block', JSON.stringify(vis));
  const impArq = pth.join(tmp, 'impressao.pdf');
  fs.writeFileSync(impArq, await p.pdf({ preferCSSPageSize: true, printBackground: true }));
  const ti = texto(impArq);
  ok('PDF do navegador tem o mesmo nº de páginas (sem página em branco)', paginasPDF(impArq) === prev.paginas, paginasPDF(impArq));
  ok('impressão traz a OS e não traz o menu do sistema', ti.includes('Nº ' + alvo.n) && !/Painel executivo|Nova OS/.test(ti));
  const pdfInfo = execFileSync('pdfinfo', [impArq], { encoding: 'utf8' }); ok('impressão em A4 (595 × 842 pt)', /59[45]\.\d+ x 84[12]\.\d+/.test(pdfInfo), (pdfInfo.match(/Page size:\s+(.*)/) || [])[1]);
  execFileSync('pdftoppm', ['-png', '-r', '70', '-f', '1', '-l', '1', impArq, pth.join(tmp, 'imp')]); fs.copyFileSync(pth.join(tmp, fs.readdirSync(tmp).find(f => /^imp-.*\.png$/.test(f))), '/tmp/os_impressao_p1.png');
  await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(100);
  ok('depois da impressão a folha de impressão é removida', await p.evaluate(() => !document.getElementById('os-print-root') && !document.body.classList.contains('imprimindo-os')));
  await p.keyboard.press('Escape');

  // Ctrl+P / menu Imprimir do navegador com a OS aberta: sai o modelo A4, não a tela
  await p.evaluate(i => { location.hash = '#/ordens/' + i; }, alvo.id); await p.waitForSelector('[data-acao="previa"]'); await p.waitForTimeout(200);
  await p.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  ok('Ctrl+P na OS aberta prepara o modelo de impressão', await p.evaluate(() => !!document.getElementById('os-print-root') && document.body.classList.contains('imprimindo-os')));
  await p.emulateMedia({ media: 'print' });
  const cpArq = pth.join(tmp, 'ctrlp.pdf'); fs.writeFileSync(cpArq, await p.pdf({ preferCSSPageSize: true, printBackground: true }));
  const tc = texto(cpArq);
  ok('Ctrl+P: sai a folha com 2 assinaturas e sem a tela do sistema', paginasPDF(cpArq) === prev.paginas && tc.includes('Mecânico responsável') && tc.includes('Gestor') && !tc.includes('Ver histórico') && !tc.includes('Duplicar') && (tc.match(/Data: _/g) || []).length === 2, 'páginas ' + paginasPDF(cpArq));
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(100);
  await p.evaluate(() => { location.hash = '#/ordens'; }); await p.waitForTimeout(400);
  await p.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  ok('Ctrl+P em outra página não monta a folha da OS', await p.evaluate(() => !document.getElementById('os-print-root')));

  console.log('\n== B) OS longa: 38 serviços, descrições compridas, observação de 30 linhas, nomes longos ==');
  const longa = await p.evaluate(() => {
    const v = DB.get().veiculos[0];
    const itens = Array.from({ length: 38 }, (_, i) => ({ qtd: i % 5 === 0 ? 2.5 : (i % 4) + 1, servicoCod: '', descricao: 'Serviço ' + (i + 1) + ' — ' + 'revisão completa do sistema hidráulico com troca de mangueiras, conexões, vedações e fluido ' .repeat(i % 3 === 0 ? 2 : 1), valorUnit: 123.45 + i, total: (123.45 + i) * ((i % 4) + 1) }));
    const o = { id: 'OSLONGA', numero: 99999, data: '2026-10-20', local: 'Fazenda Santa Maria do Norte — Setor de Máquinas e Implementos Agrícolas, Juína - MT', condutor: 'Condutor com nome muito comprido para testar a quebra de linha e o corte com reticências na caixa',
      veiculoId: v.id, placa: 'ABC1D23', frota: '17', kmH: 123456, unidade: 'H', mecanico: 'Jeferson, Allan, Gemerson, Vandame, Tião, Oficina Safra e mais um nome bem longo aqui', setor: 'Mecânica',
      itens, obs: Array.from({ length: 30 }, (_, i) => 'Observação linha ' + (i + 1) + ': verificar vazamentos e reapertar abraçadeiras após 50 horas de uso.').join('\n'), status: 'Em andamento', total: itens.reduce((s, x) => s + x.total, 0), criadoPor: 'Kamau', criadoData: '2026-10-20', criadoHora: '10:15' };
    o.itens.forEach(x => { x.total = Math.round(x.total * 100) / 100; }); o.total = Math.round(o.itens.reduce((s, x) => s + x.total, 0) * 100) / 100;
    DB.get().ordens.push(o); DB.save(); return { n: o.numero, total: o.total };
  });
  await p.evaluate(() => { location.hash = '#/ordens/OSLONGA'; }); await p.waitForSelector('[data-acao="previa"]');
  await p.click('[data-acao="previa"]'); await p.waitForSelector('.os-folha'); await p.waitForTimeout(300);
  const np = await p.evaluate(() => document.querySelectorAll('#modal .os-folha').length);
  ok('OS longa ocupa mais de uma página', np >= 2, np + ' páginas');
  const info = await p.evaluate(() => [...document.querySelectorAll('#modal .os-folha')].map(f => ({ txt: f.innerText, foraDaFolha: [...f.children].some(c => { const r = c.getBoundingClientRect(), q = f.getBoundingClientRect(); return r.bottom > q.bottom + 1 || r.right > q.right + 1; }) })));
  ok('nada ultrapassa a folha (nem em baixo nem à direita)', info.every(i => !i.foraDaFolha));
  ok('páginas seguintes têm cabeçalho de continuação e "Página n de N"', info.slice(1).every(i => i.txt.includes('continuação')) && info.every((i, k) => i.txt.includes('Página ' + (k + 1) + ' de ' + np)));
  ok('o total e as assinaturas aparecem uma única vez, no fim', info.filter(i => i.txt.includes('VALOR TOTAL DA ORDEM')).length === 1 && info.filter(i => i.txt.includes('Gestor')).length === 1);
  ok('todas as 30 linhas de observação foram impressas', info.map(i => i.txt).join('\n').includes('Observação linha 30'));
  ok('os 38 serviços aparecem', info.map(i => i.txt).join('\n').includes('Serviço 38'));
  const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click('#osp-pdf')]);
  const longaArq = pth.join(tmp, 'longa.pdf'); await dl2.saveAs(longaArq);
  const tl = texto(longaArq);
  ok('PDF da OS longa tem o mesmo nº de páginas e todo o conteúdo', paginasPDF(longaArq) === np && tl.includes('Serviço 38') && tl.includes('Observação linha 30') && tl.includes('Página ' + np + ' de ' + np), 'páginas ' + paginasPDF(longaArq));
  execFileSync('pdftoppm', ['-png', '-r', '60', longaArq, pth.join(tmp, 'longa')]);
  fs.readdirSync(tmp).filter(f => /^longa-.*\.png$/.test(f)).forEach((f, i) => fs.copyFileSync(pth.join(tmp, f), '/tmp/os_longa_p' + (i + 1) + '.png'));
  await p.locator('#modal .osp-area').screenshot({ path: '/tmp/os_longa_previa.png' });
  await p.keyboard.press('Escape');

  console.log('\n== C) OS sem itens / sem observação / sem campos ==');
  await p.evaluate(() => { const o = { id: 'OSVAZIA', numero: 99998, data: '2026-10-21', veiculoId: '', placa: '', frota: '', kmH: null, unidade: 'KM', mecanico: '', setor: 'Mecânica', itens: [], obs: '', status: 'Aberta', total: 0, local: '', condutor: '' }; DB.get().ordens.push(o); DB.save(); });
  await p.evaluate(() => { location.hash = '#/ordens/OSVAZIA'; }); await p.waitForSelector('[data-acao="previa"]');
  await p.click('[data-acao="previa"]'); await p.waitForSelector('.os-folha');
  const vz = await p.evaluate(() => document.querySelector('#modal .osp-area').innerText);
  ok('OS vazia gera 1 página com aviso e traços nos campos', vz.includes('Nenhum serviço lançado') && vz.includes('—') && vz.includes('Página 1 de 1'));
  const [dl3] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click('#osp-pdf')]);
  await dl3.saveAs(pth.join(tmp, 'vazia.pdf')); ok('PDF da OS vazia é gerado (1 página)', paginasPDF(pth.join(tmp, 'vazia.pdf')) === 1, dl3.suggestedFilename());

  console.log('\n== D) tablet e celular: janela de visualização ==');
  for (const [nome, vw] of [['tablet', { width: 820, height: 1180 }], ['celular', { width: 390, height: 800 }]]) {
    await p.setViewportSize(vw); await p.evaluate(() => { location.hash = '#/ordens/OSLONGA'; }); await p.waitForTimeout(300);
    await p.keyboard.press('Escape');
    await p.evaluate(() => ImpressaoOS.visualizar(DB.get().ordens.find(o => o.id === 'OSLONGA'))); await p.waitForSelector('.os-folha'); await p.waitForTimeout(250);
    const r = await p.evaluate(() => { const a = document.querySelector('#osp-area'), pg = document.querySelector('.osp-pg').getBoundingClientRect(); return { cabe: pg.width <= a.clientWidth, scrollX: document.documentElement.scrollWidth > innerWidth + 1, btn: !!document.getElementById('osp-pdf') && !!document.getElementById('osp-print') }; });
    ok(nome + ': folha reduzida cabe na janela, sem rolagem lateral e com os botões', r.cabe && !r.scrollX && r.btn, JSON.stringify(r));
    await p.screenshot({ path: '/tmp/os_' + nome + '.png' });
    await p.keyboard.press('Escape');
  }

  ok('sem erros de JavaScript', erros.filter(e => !/supabase|ERR_/i.test(e)).length === 0, erros.join(' | '));
  await b.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
})();
