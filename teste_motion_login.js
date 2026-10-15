// Revisão da animação de entrada (login → sistema): logo surgindo e piscando.
// Testa a tela real do sistema (arquivo construído), em computador e tablet, com e sem movimento reduzido.
const { chromium } = require('playwright');
const path = 'file://' + require('path').resolve(__dirname, 'Sistema_OS_Grupo_Brilhante.html');
let falhas = 0; const erros = [];
const ok = (t, c, extra) => { console.log((c ? '  ok  ' : ' FALHA ') + t + (extra !== undefined ? '  → ' + extra : '')); if (!c) falhas++; };

const amostra = p => p.evaluate(() => {
  const ov = document.getElementById('entrada-anim'); if (!ov) return null;
  const lg = ov.querySelector('.ea-logo'); const r = lg.getBoundingClientRect();
  return { op: +getComputedStyle(lg).opacity, esc: +(r.width / lg.offsetWidth).toFixed(2), w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), vw: innerWidth, vh: innerHeight, ov: +getComputedStyle(ov).opacity, fil: getComputedStyle(lg.querySelector('svg')).filter, pe: getComputedStyle(ov).pointerEvents };
});

async function ciclo(browser, nome, viewport, reduce) {
  console.log(`\n== ${nome} (${viewport.width}x${viewport.height}${reduce ? ', movimento reduzido' : ''}) ==`);
  const ctx = await browser.newContext({ viewport, reducedMotion: reduce ? 'reduce' : 'no-preference', hasTouch: viewport.width < 1100 });
  await ctx.route(/supabase\.co/, r => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', e => erros.push(nome + ': ' + e.message));
  await p.goto(path); await p.waitForSelector('#form-login');
  ok('tela de login aparece sem cortina', !(await p.$('#entrada-anim')));
  const mq = await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  ok('preferência de movimento reduzido detectada corretamente', mq === !!reduce, mq);

  // senha errada: não anima, não entra
  await p.fill('#u', 'Kamau'); await p.fill('#s', 'senha-errada'); await p.click('button[type=submit]');
  await p.waitForTimeout(500);
  ok('senha errada: sem cortina, continua no login, com mensagem', !(await p.$('#entrada-anim')) && !!(await p.$('#form-login')) && !!(await p.$('.login-err')));

  // senha certa (semente do próprio sistema)
  await p.fill('#u', 'Kamau'); await p.fill('#s', '159753');
  const t0 = Date.now(); await p.click('button[type=submit]');
  const amostras = []; let tirou = false;
  let sistemaPorBaixo = null, clicouDuranteCortina = false, clicaOk = false, tAppear = null;
  while (Date.now() - t0 < 4600) {
    const a = await amostra(p);
    const t = Date.now() - t0;
    if (a && !tirou && t > 1500 && viewport.width === 1366) { tirou = true; await p.screenshot({ path: `/tmp/motion_${nome}_meio.png` }); }
    if (a) { amostras.push({ t, ...a }); if (tAppear === null) tAppear = t; }
    if (a && t > 900 && !clicouDuranteCortina && !reduce) {
      // a cortina não pode bloquear: no computador clica num item do menu; no tablet abre o menu lateral pelo botão
      if (viewport.width > 1024) {
        const alvo = await p.evaluate(() => { const b = document.querySelector('.nav-item[data-rota]:not(.on)'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, rota: b.dataset.rota, topo: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.nav-item')?.dataset.rota }; });
        if (alvo) { sistemaPorBaixo = alvo; await p.mouse.click(alvo.x, alvo.y); await p.waitForTimeout(250); clicaOk = alvo.topo === alvo.rota && (await p.evaluate(() => location.hash)).includes(alvo.rota); }
      } else {
        const bt = await p.evaluate(() => { const b = document.getElementById('btn-menu'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, topo: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('#btn-menu') ? 'btn' : 'outro' }; });
        if (bt) { await p.touchscreen.tap(bt.x, bt.y); await p.waitForTimeout(250); clicaOk = bt.topo === 'btn' && await p.evaluate(() => document.getElementById('nav').classList.contains('open')); sistemaPorBaixo = { rota: 'menu lateral' }; }
      }
      clicouDuranteCortina = true;
    }
    await p.waitForTimeout(60);
  }
  ok('cortina com a logo apareceu depois do login válido', amostras.length > 0, tAppear + ' ms');
  const ops = amostras.map(a => a.op);
  ok('logo surge (opacidade chega a ≥ 0.95)', Math.max(...ops) >= 0.95, Math.max(...ops).toFixed(2));
  if (!reduce) {
    ok('logo parte de pequena e cresce (escala mínima < 0.8 e máxima > 1)', Math.min(...amostras.map(a => a.esc)) < 0.8 && Math.max(...amostras.map(a => a.esc)) > 1.0, Math.min(...amostras.map(a => a.esc)) + ' → ' + Math.max(...amostras.map(a => a.esc)));
    // "piscando": conta quantas vezes a opacidade da logo cruza 0.5 (uma subida e uma descida = 1 pulso)
    let cruz = 0; for (let i = 1; i < ops.length; i++) if ((ops[i - 1] - 0.5) * (ops[i] - 0.5) < 0) cruz++;
    ok('logo faz 1 pulso (sobe e some), sem tremer/piscar repetidamente', cruz <= 2, cruz + ' cruzamentos de 50%');
    ok('cortina bloqueia cliques? (pointer-events deve ser none)', amostras[0].pe === 'none', amostras[0].pe);
    ok('durante a cortina o sistema por baixo respondeu ao toque/clique (' + (sistemaPorBaixo ? sistemaPorBaixo.rota : 'sem alvo') + ')', clicaOk);
  } else {
    ok('movimento reduzido: logo sem escala animada (escala 1)', amostras.every(a => Math.abs(a.esc - 1) < 0.02), [...new Set(amostras.map(a => a.esc))].join(','));
    ok('movimento reduzido: sem partículas', await p.evaluate(() => true) && !(amostras.length && await p.$('.ea-part')));
  }
  const raio = f => Math.max(0, ...[...String(f).matchAll(/\) (-?\d+(?:\.\d+)?)px (-?\d+(?:\.\d+)?)px (\d+(?:\.\d+)?)px/g)].map(m => +m[3]));
  const comBrilho = amostras.filter(a => /drop-shadow/.test(a.fil) && raio(a.fil) > 8);
  ok('brilho no contorno da silhueta da logo (drop-shadow com halo > 8px)', comBrilho.length > 0, 'raio máx. ' + Math.max(...amostras.map(a => raio(a.fil))) + 'px');
  ok(reduce ? 'movimento reduzido: brilho fixo, sem pulsar' : 'brilho pulsa junto com a logo (raio varia)', reduce ? new Set(amostras.map(a => a.fil)).size === 1 : new Set(amostras.map(a => raio(a.fil))).size > 3);
  const ult = amostras[amostras.length - 1];
  ok('logo centralizada e dentro da tela', amostras.every(a => Math.abs(a.cx - a.vw / 2) <= 2 && Math.abs(a.cy - a.vh / 2) <= 2 && a.w <= a.vw && a.h <= a.vh), `${ult.w}x${ult.h} em ${ult.vw}x${ult.vh}`);
  const dur = amostras[amostras.length - 1].t - amostras[0].t;
  const sumiu = !(await p.$('#entrada-anim'));
  ok('cortina some sozinha e libera a tela', sumiu, 'visível por ~' + dur + ' ms');
  ok('sistema real renderizado após a entrada (menu + conteúdo)', !!(await p.$('.nav')) && !!(await p.$('#view, #painel, main, .content')));
  ok('nenhum elemento fixo cobrindo a tela depois da entrada', await p.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return !e.closest('#entrada-anim'); }));
  await p.screenshot({ path: `/tmp/motion_${nome}_pos.png` });
  await ctx.close();
}

(async () => {
  const b = await chromium.launch();
  await ciclo(b, 'desktop', { width: 1366, height: 768 }, false);
  await ciclo(b, 'tablet-retrato', { width: 820, height: 1180 }, false);
  await ciclo(b, 'tablet-paisagem', { width: 1024, height: 768 }, false);
  await ciclo(b, 'desktop-reduzido', { width: 1366, height: 768 }, true);
  await ciclo(b, 'tablet-reduzido', { width: 820, height: 1180 }, true);
  await b.close();
  const so = erros.filter(e => !/supabase|ERR_/i.test(e));
  ok('sem erros de JavaScript', so.length === 0, so.join(' | '));
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
  process.exit(falhas ? 1 : 0);
})();
