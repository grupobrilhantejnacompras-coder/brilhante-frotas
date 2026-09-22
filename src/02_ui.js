/* ============================================================
   COMPONENTES — gráficos SVG, tabelas, modais e avisos
   ============================================================ */

/* ---------- Chart: gráficos SVG sem dependências ---------- */
const Chart = (() => {
  // Série única = magnitude → uma cor só (a cor segue a entidade, nunca o ranking).
  const AZUL = '#3157CE', AMBAR = '#C2721A', TRILHO = '#EEF2FF', CIANO = '#00D9FF';
  const CAT = ['#3157CE', '#0D9488', '#C2721A', '#8B5CF6', '#0891B2', '#BE123C'];
  // Família azul/ciano "command center" — para telas que pedem um visual monocromático com brilho
  // (ex.: dashboard), em vez do arco-íris categórico do CAT acima.
  const TONS_CIANO = ['#1677FF', '#00D9FF', '#5AA0FF', '#0B50BE', '#7DEEFF', '#0E63E6'];
  function corCiano(chave) {
    const s = String(chave || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return TONS_CIANO[h % TONS_CIANO.length];
  }
  let tip;
  function tooltip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.style.cssText = 'position:fixed;z-index:300;background:#0F172A;color:#fff;padding:7px 11px;' +
        'border-radius:7px;font-size:12px;pointer-events:none;opacity:0;transition:opacity .1s;' +
        'box-shadow:0 4px 12px rgba(15,23,42,.25);max-width:230px;font-variant-numeric:tabular-nums';
      document.body.appendChild(tip);
    }
    return tip;
  }
  function ligarTooltips(root) {
    root.querySelectorAll('[data-tip]').forEach(el => {
      el.addEventListener('mousemove', e => {
        const t = tooltip(); t.textContent = el.getAttribute('data-tip'); t.style.opacity = '1';
        const r = t.getBoundingClientRect();
        t.style.left = Math.min(e.clientX + 14, innerWidth - r.width - 10) + 'px';
        t.style.top = Math.max(e.clientY - r.height - 12, 8) + 'px';
      });
      el.addEventListener('mouseleave', () => { tooltip().style.opacity = '0'; });
    });
    animarConteudo(root);
  }

  /** Entrada suave do bloco recém-inserido (troca de tela ou reaplicação de filtros)
   *  e animação de "desenho" dos gráficos SVG que acabaram de entrar no DOM. */
  function animarConteudo(root) {
    if (!root) return;
    if (root.classList && root.id !== 'modal') {
      root.classList.remove('fx-in');
      void root.offsetWidth;               // força reflow para reiniciar a animação a cada chamada
      root.classList.add('fx-in');
    }
    const barras = root.querySelectorAll('.bar.fx-h, .bar.fx-v');
    if (barras.length) requestAnimationFrame(() => requestAnimationFrame(() => {
      barras.forEach(b => { b.style.transform = ''; });
    }));
    root.querySelectorAll('path.linha-fx').forEach(path => {
      try {
        const len = path.getTotalLength();
        path.style.transition = 'none';
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        path.getBoundingClientRect();       // força reflow antes de religar a transição
        path.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)';
        path.style.strokeDashoffset = '0';
      } catch (e) { /* SVG ainda não está no layout (ex.: aba oculta) — ignora */ }
    });
    // rosca (donut): cada fatia "cresce" a partir do zero, em sequência
    root.querySelectorAll('circle.donut-fx').forEach((c, i) => {
      const len = parseFloat(c.dataset.len || '0');
      c.style.transition = 'none';
      c.style.strokeDashoffset = String(len);
      c.getBoundingClientRect();
      c.style.transition = `stroke-dashoffset .8s cubic-bezier(.16,1,.3,1) ${(i * 0.09).toFixed(2)}s`;
      c.style.strokeDashoffset = '0';
    });
  }

  /** Cor estável por categoria (mesmo texto → sempre a mesma cor da paleta institucional,
   *  em qualquer gráfico do sistema). Uso opcional via item.cor. */
  function corCategoria(chave) {
    const s = String(chave || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return CAT[h % CAT.length];
  }

  /** Barras horizontais ranqueadas. items: [{rotulo, valor, sub, tip, destaque, cor}] */
  function barsH(items, o = {}) {
    const fmt = o.fmt || Fmt.money0, lw = o.labelW || 150, bh = 26, gap = 10, pr = 76;
    if (!items.length) return vazio(o.vazio);
    const max = Math.max(...items.map(i => i.valor), 1);
    const h = items.length * (bh + gap);
    const w = 640, bw = w - lw - pr;
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${Fmt.esc(o.aria || 'Gráfico de barras')}">`;
    items.forEach((it, i) => {
      const y = i * (bh + gap), L = Math.max(3, (it.valor / max) * bw);
      const cor = it.cor || (it.destaque ? AMBAR : (o.cor || AZUL));
      s += `<text x="0" y="${y + bh / 2 + 4}" style="font-size:11.5px;fill:var(--ink-2)">${Fmt.esc(corta(it.rotulo, 24))}</text>`;
      s += `<rect x="${lw}" y="${y + 4}" width="${bw}" height="${bh - 8}" rx="5" fill="${TRILHO}"/>`;
      const df = it.filtro != null ? ` data-f="${Fmt.esc(it.filtro)}"` : '';
      const estilo = `transform:scaleX(0);color:${cor}` + (it.filtro != null ? ';cursor:pointer' : '');
      s += `<rect class="bar fx-h" x="${lw}" y="${y + 4}" width="${L}" height="${bh - 8}" rx="5" fill="${cor}" style="${estilo}"${df}` +
        ` data-tip="${Fmt.esc(it.tip || (it.rotulo + ': ' + fmt(it.valor)))}"><title>${Fmt.esc(it.rotulo)}</title></rect>`;
      s += `<text x="${w}" y="${y + bh / 2 + 4}" text-anchor="end" class="lbl-v" style="font-size:11.5px">${fmt(it.valor)}</text>`;
    });
    return s + '</svg>';
  }

  /** Colunas verticais. items: [{rotulo, valor, tip, cor}] */
  function barsV(items, o = {}) {
    const fmt = o.fmt || Fmt.num;
    if (!items.length) return vazio(o.vazio);
    const w = 640, h = 230, pb = 40, pt = 24, pl = 8;
    const max = Math.max(...items.map(i => i.valor), 1);
    const cw = (w - pl * 2) / items.length, bw = Math.min(46, cw - 10);
    let s = `<svg class="chart chart-v" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${Fmt.esc(o.aria || 'Gráfico de colunas')}">`;
    for (let g = 0; g <= 3; g++) { const y = pt + (h - pt - pb) * g / 3; s += `<line class="gl" x1="0" x2="${w}" y1="${y}" y2="${y}"/>`; }
    items.forEach((it, i) => {
      const H = Math.max(2, (it.valor / max) * (h - pt - pb));
      const x = pl + i * cw + (cw - bw) / 2, y = h - pb - H;
      const cor = it.cor || o.cor || AZUL;
      const df = it.filtro != null ? ` data-f="${Fmt.esc(it.filtro)}"` : '';
      const estilo = `transform:scaleY(0);color:${cor}` + (it.filtro != null ? ';cursor:pointer' : '');
      s += `<rect class="bar fx-v" x="${x}" y="${y}" width="${bw}" height="${H}" rx="5" fill="${cor}" style="${estilo}"${df}` +
        ` data-tip="${Fmt.esc(it.tip || (it.rotulo + ': ' + fmt(it.valor)))}"/>`;
      s += `<text x="${x + bw / 2}" y="${y - 7}" text-anchor="middle" class="lbl-v" style="font-size:11px">${fmt(it.valor)}</text>`;
      s += `<text x="${x + bw / 2}" y="${h - pb + 17}" text-anchor="middle" style="font-size:11px">${Fmt.esc(corta(it.rotulo, 12))}</text>`;
    });
    return s + '</svg>';
  }

  let areaSeq = 0;
  /** Área + linha para evolução no tempo. pts: [{rotulo, valor, tip}]. o.cor troca a cor da série. */
  function area(pts, o = {}) {
    const fmt = o.fmt || Fmt.money0, cor = o.cor || AZUL;
    if (pts.length < 2) return pts.length ? barsV(pts, o) : vazio(o.vazio);
    const w = 640, h = 240, pl = 8, pr = 8, pt = 22, pb = 36;
    const max = Math.max(...pts.map(p => p.valor), 1);
    const X = i => pl + (w - pl - pr) * (i / (pts.length - 1));
    const Y = v => h - pb - (v / max) * (h - pt - pb);
    const linha = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.valor).toFixed(1)}`).join('');
    const gid = 'gArea' + (++areaSeq);
    let s = `<svg class="chart chart-v" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${Fmt.esc(o.aria || 'Evolução no período')}" style="color:${cor}">`;
    s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="${cor}" stop-opacity=".28"/><stop offset="100%" stop-color="${cor}" stop-opacity="0"/></linearGradient></defs>`;
    for (let g = 0; g <= 3; g++) { const y = pt + (h - pt - pb) * g / 3; s += `<line class="gl" x1="0" x2="${w}" y1="${y}" y2="${y}"/>`; }
    s += `<path class="area-fx" d="${linha}L${X(pts.length - 1)},${h - pb}L${X(0)},${h - pb}Z" fill="url(#${gid})"/>`;
    s += `<path class="linha-fx" d="${linha}" fill="none" stroke="${cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const passo = Math.ceil(pts.length / 8);
    pts.forEach((p, i) => {
      const atraso = (0.5 + Math.min(i, 24) * 0.025).toFixed(3);
      s += `<circle class="dot-fx" style="animation-delay:${atraso}s" cx="${X(i)}" cy="${Y(p.valor)}" r="4" fill="#fff" stroke="${cor}" stroke-width="2"/>`;
      s += `<rect x="${X(i) - (w / pts.length) / 2}" y="${pt}" width="${w / pts.length}" height="${h - pt - pb}" fill="transparent"` +
        ` data-tip="${Fmt.esc(p.tip || (p.rotulo + ': ' + fmt(p.valor)))}"/>`;
      if (i % passo === 0 || i === pts.length - 1)
        s += `<text x="${X(i)}" y="${h - pb + 17}" text-anchor="middle" style="font-size:10.5px">${Fmt.esc(p.rotulo)}</text>`;
    });
    return s + '</svg>';
  }

  let eqSeq = 0;
  /** Colunas finas e brilhantes, estilo "equalizador" — para séries longas ao longo do tempo
   *  (mesma leitura de um gráfico de evolução, com visual mais tecnológico). pts: [{rotulo, valor, tip}]. */
  function equalizador(pts, o = {}) {
    const fmt = o.fmt || Fmt.money0, cor = o.cor || CIANO;
    if (!pts.length) return vazio(o.vazio);
    const w = 640, h = 240, pl = 6, pr = 6, pt = 20, pb = 34;
    const max = Math.max(...pts.map(p => p.valor), 1);
    const n = pts.length;
    const cw = (w - pl - pr) / n;
    const bw = Math.max(2, Math.min(14, cw - 2));
    const gid = 'eqGrad' + (++eqSeq);
    let s = `<svg class="chart chart-v" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${Fmt.esc(o.aria || 'Evolução no período')}" style="color:${cor}">`;
    s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#8FF2FF"/><stop offset="55%" stop-color="${cor}"/><stop offset="100%" stop-color="#0B50BE"/></linearGradient></defs>`;
    for (let g = 0; g <= 2; g++) { const y = pt + (h - pt - pb) * g / 2; s += `<line class="gl" x1="0" x2="${w}" y1="${y}" y2="${y}"/>`; }
    s += `<line class="gl" x1="0" x2="${w}" y1="${h - pb}" y2="${h - pb}" style="opacity:.6"/>`;
    const passo = Math.max(1, Math.ceil(n / 9));
    pts.forEach((p, i) => {
      const H = Math.max(2, (p.valor / max) * (h - pt - pb));
      const x = pl + i * cw + (cw - bw) / 2, y = h - pb - H;
      const r = Math.min(bw / 2, 4);
      s += `<rect class="bar eq-bar fx-v" x="${x}" y="${y}" width="${bw}" height="${H}" rx="${r}" fill="url(#${gid})" style="transform:scaleY(0)"` +
        ` data-tip="${Fmt.esc(p.tip || (p.rotulo + ': ' + fmt(p.valor)))}"/>`;
      if (i % passo === 0 || i === n - 1)
        s += `<text x="${x + bw / 2}" y="${h - pb + 16}" text-anchor="middle" style="font-size:10px">${Fmt.esc(corta(p.rotulo, 8))}</text>`;
    });
    // marcador pulsante no período mais recente — sensação de "monitoramento ao vivo"
    const last = pts[n - 1];
    const Hl = Math.max(2, (last.valor / max) * (h - pt - pb));
    const xl = pl + (n - 1) * cw + cw / 2, yl = h - pb - Hl;
    s += `<circle class="eq-live" cx="${xl}" cy="${(yl - 9).toFixed(1)}" r="3" fill="${cor}"><title>Período mais recente</title></circle>`;
    return s + '</svg>';
  }

  /** Rosca (donut) de composição — mostra como um total se divide entre categorias.
   *  items: [{rotulo, valor, tip, cor}]. Agrupa o excedente em "Outros" além de o.max (padrão 6). */
  function donut(items, o = {}) {
    items = (items || []).filter(i => i.valor > 0);
    if (!items.length) return vazio(o.vazio);
    const total = items.reduce((s, i) => s + i.valor, 0);
    if (!total) return vazio(o.vazio);
    const fmt = o.fmt || Fmt.money0;
    const MAXN = o.max || 6;
    let itens = items;
    if (items.length > MAXN) {
      const top = items.slice(0, MAXN - 1);
      const outros = items.slice(MAXN - 1).reduce((s, i) => s + i.valor, 0);
      itens = [...top, { rotulo: 'Outros', valor: outros }];
    }
    // cor estável por categoria — "Freios" tem sempre a mesma cor, na rosca e nas barras;
    // "Outros" fica sempre em cinza neutro (não é uma categoria real).
    const corDe = it => it.cor || (it.rotulo === 'Outros' ? '#94A3B8' : corCategoria(it.rotulo));
    const R = 70, CX = 90, CY = 90, SW = 26, C = 2 * Math.PI * R;
    let acc = 0;
    let s = `<svg class="chart donut" viewBox="0 0 180 180" role="img" aria-label="${Fmt.esc(o.aria || 'Gráfico de composição')}">`;
    s += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${TRILHO}" stroke-width="${SW}"/>`;
    itens.forEach(it => {
      const frac = it.valor / total, len = frac * C, cor = corDe(it);
      const rot = -90 + acc * 360;
      s += `<circle class="donut-fx" cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${cor}" stroke-width="${SW}" stroke-linecap="butt"` +
        ` stroke-dasharray="${len.toFixed(2)} ${Math.max(0, C - len).toFixed(2)}" data-len="${len.toFixed(2)}"` +
        ` style="transform:rotate(${rot.toFixed(2)}deg); transform-origin:${CX}px ${CY}px"` +
        ` data-tip="${Fmt.esc(it.tip || (it.rotulo + ': ' + fmt(it.valor) + ' (' + Math.round(frac * 100) + '%)'))}"><title>${Fmt.esc(it.rotulo)}</title></circle>`;
      acc += frac;
    });
    s += `<text x="${CX}" y="${CY - 2}" text-anchor="middle" class="lbl-v" style="font-size:19px;font-weight:800">${fmt(total)}</text>`;
    s += `<text x="${CX}" y="${CY + 16}" text-anchor="middle" style="font-size:10px">${Fmt.esc(o.centro || 'total')}</text>`;
    s += '</svg>';
    const legenda = `<div class="legend">${itens.map(it =>
      `<span><i style="background:${corDe(it)}"></i>${Fmt.esc(corta(it.rotulo, 22))} — ${fmt(it.valor)}</span>`).join('')}</div>`;
    return `<div class="donut-wrap">${s}${legenda}</div>`;
  }

  const corta = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const vazio = m => `<div class="empty"><div class="d"></div><h3>Sem dados no período</h3><p class="dim">${Fmt.esc(m || 'Ajuste os filtros ou registre novas ordens de serviço.')}</p></div>`;
  return { barsH, barsV, area, equalizador, donut, ligarTooltips, corCategoria, corCiano, CAT, AZUL, AMBAR, CIANO };
})();

/* ---------- UI: blocos reutilizáveis ---------- */
const UI = (() => {
  const kpi = (lab, val, sub, alerta) =>
    `<div class="card kpi${alerta ? ' alert' : ''}"><div class="k-lab">${Fmt.esc(lab)}</div>` +
    `<div class="k-val">${val}</div>${sub ? `<div class="k-sub">${sub}</div>` : ''}</div>`;

  const card = (titulo, corpo, acoes, semPad) =>
    `<section class="card">${titulo ? `<div class="card-h"><h2>${Fmt.esc(titulo)}</h2>${acoes || ''}</div>` : ''}` +
    `<div class="${semPad ? '' : 'card-b'}">${corpo}</div></section>`;

  const vazio = (t, m, acao) =>
    `<div class="empty"><div class="d"></div><h3>${Fmt.esc(t)}</h3><p>${Fmt.esc(m)}</p>${acao || ''}</div>`;

  const badgeStatus = s => {
    const m = { 'Concluída': 'b-green', 'Aberta': 'b-blue', 'Em andamento': 'b-amber', 'Cancelada': 'b-red' };
    return `<span class="badge ${m[s] || 'b-gray'}">${Fmt.esc(s)}</span>`;
  };

  function tabela(cols, linhas, o = {}) {
    if (!linhas.length) return vazio(o.vazioT || 'Nada por aqui', o.vazioM || 'Nenhum registro encontrado com os filtros atuais.');
    let s = '<div class="tw"><table><thead><tr>';
    cols.forEach(c => s += `<th class="${c.cls || ''}">${Fmt.esc(c.t)}</th>`);
    s += '</tr></thead><tbody>';
    linhas.forEach(l => {
      s += `<tr class="${l._cls || ''}"${l._attr || ''}>`;
      cols.forEach(c => s += `<td class="${c.cls || ''}">${l[c.k] == null ? '—' : l[c.k]}</td>`);
      s += '</tr>';
    });
    if (o.total) { s += '<tr class="tot-row">'; cols.forEach(c => s += `<td class="${c.cls || ''}">${o.total[c.k] || ''}</td>`); s += '</tr>'; }
    return s + '</tbody></table></div>';
  }

  function modal(titulo, corpo, rodape, largura) {
    fecharModal();
    const bg = document.createElement('div');
    bg.className = 'modal-bg'; bg.id = 'modal';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${Fmt.esc(titulo)}"${largura ? ` style="max-width:${largura}"` : ''}>
      <div class="modal-h"><h2>${Fmt.esc(titulo)}</h2><div class="spacer"></div>
        <button class="rm-btn" data-fechar aria-label="Fechar">✕</button></div>
      <div class="modal-b">${corpo}</div>
      ${rodape ? `<div class="modal-f">${rodape}</div>` : ''}</div>`;
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-fechar]')) fecharModal(); });
    document.body.appendChild(bg);
    Chart.ligarTooltips(bg);
    return bg;
  }
  const fecharModal = () => { const m = document.getElementById('modal'); if (m) m.remove(); };

  function toast(msg, tipo) {
    const c = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + (tipo || ''); t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; setTimeout(() => t.remove(), 260); }, 3200);
  }

  const opcoes = (lista, sel, vazio) =>
    (vazio ? `<option value="">${Fmt.esc(vazio)}</option>` : '') +
    lista.map(v => { const val = v.v !== undefined ? v.v : v, tx = v.t !== undefined ? v.t : v;
      return `<option value="${Fmt.esc(val)}"${String(val) === String(sel) ? ' selected' : ''}>${Fmt.esc(tx)}</option>`; }).join('');

  return { kpi, card, vazio, tabela, modal, fecharModal, toast, opcoes, badgeStatus };
})();

document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.fecharModal(); });
