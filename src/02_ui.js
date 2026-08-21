/* ============================================================
   COMPONENTES — gráficos SVG, tabelas, modais e avisos
   ============================================================ */

/* ---------- Chart: gráficos SVG sem dependências ---------- */
const Chart = (() => {
  // Série única = magnitude → uma cor só (a cor segue a entidade, nunca o ranking).
  const AZUL = '#3157CE', AMBAR = '#C2721A', TRILHO = '#EEF2FF';
  const CAT = ['#3157CE', '#0D9488', '#C2721A', '#8B5CF6', '#0891B2', '#BE123C'];
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
        const t = tooltip(); t.innerHTML = el.getAttribute('data-tip'); t.style.opacity = '1';
        const r = t.getBoundingClientRect();
        t.style.left = Math.min(e.clientX + 14, innerWidth - r.width - 10) + 'px';
        t.style.top = Math.max(e.clientY - r.height - 12, 8) + 'px';
      });
      el.addEventListener('mouseleave', () => { tooltip().style.opacity = '0'; });
    });
  }

  /** Barras horizontais ranqueadas. items: [{rotulo, valor, sub, tip, destaque}] */
  function barsH(items, o = {}) {
    const fmt = o.fmt || Fmt.money0, lw = o.labelW || 150, bh = 26, gap = 10, pr = 76;
    if (!items.length) return vazio(o.vazio);
    const max = Math.max(...items.map(i => i.valor), 1);
    const h = items.length * (bh + gap);
    const w = 640, bw = w - lw - pr;
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${Fmt.esc(o.aria || 'Gráfico de barras')}">`;
    items.forEach((it, i) => {
      const y = i * (bh + gap), L = Math.max(3, (it.valor / max) * bw);
      const cor = it.destaque ? AMBAR : (o.cor || AZUL);
      s += `<text x="0" y="${y + bh / 2 + 4}" style="font-size:11.5px;fill:var(--ink-2)">${Fmt.esc(corta(it.rotulo, 24))}</text>`;
      s += `<rect x="${lw}" y="${y + 4}" width="${bw}" height="${bh - 8}" rx="4" fill="${TRILHO}"/>`;
      const clic = it.filtro != null ? ` data-f="${Fmt.esc(it.filtro)}" style="cursor:pointer"` : '';
      s += `<rect class="bar" x="${lw}" y="${y + 4}" width="${L}" height="${bh - 8}" rx="4" fill="${cor}"${clic}` +
        ` data-tip="${Fmt.esc(it.tip || (it.rotulo + ': ' + fmt(it.valor)))}"><title>${Fmt.esc(it.rotulo)}</title></rect>`;
      s += `<text x="${w}" y="${y + bh / 2 + 4}" text-anchor="end" class="lbl-v" style="font-size:11.5px">${fmt(it.valor)}</text>`;
    });
    return s + '</svg>';
  }

  /** Colunas verticais. items: [{rotulo, valor, tip}] */
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
      const clic = it.filtro != null ? ` data-f="${Fmt.esc(it.filtro)}" style="cursor:pointer"` : '';
      s += `<rect class="bar" x="${x}" y="${y}" width="${bw}" height="${H}" rx="4" fill="${o.cor || AZUL}"${clic}` +
        ` data-tip="${Fmt.esc(it.tip || (it.rotulo + ': ' + fmt(it.valor)))}"/>`;
      s += `<text x="${x + bw / 2}" y="${y - 7}" text-anchor="middle" class="lbl-v" style="font-size:11px">${fmt(it.valor)}</text>`;
      s += `<text x="${x + bw / 2}" y="${h - pb + 17}" text-anchor="middle" style="font-size:11px">${Fmt.esc(corta(it.rotulo, 12))}</text>`;
    });
    return s + '</svg>';
  }

  /** Área + linha para evolução no tempo. pts: [{rotulo, valor, tip}] */
  function area(pts, o = {}) {
    const fmt = o.fmt || Fmt.money0;
    if (pts.length < 2) return pts.length ? barsV(pts, o) : vazio(o.vazio);
    const w = 640, h = 240, pl = 8, pr = 8, pt = 22, pb = 36;
    const max = Math.max(...pts.map(p => p.valor), 1);
    const X = i => pl + (w - pl - pr) * (i / (pts.length - 1));
    const Y = v => h - pb - (v / max) * (h - pt - pb);
    const linha = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.valor).toFixed(1)}`).join('');
    let s = `<svg class="chart chart-v" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${Fmt.esc(o.aria || 'Evolução no período')}">`;
    s += `<defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="${AZUL}" stop-opacity=".22"/><stop offset="100%" stop-color="${AZUL}" stop-opacity="0"/></linearGradient></defs>`;
    for (let g = 0; g <= 3; g++) { const y = pt + (h - pt - pb) * g / 3; s += `<line class="gl" x1="0" x2="${w}" y1="${y}" y2="${y}"/>`; }
    s += `<path d="${linha}L${X(pts.length - 1)},${h - pb}L${X(0)},${h - pb}Z" fill="url(#gArea)"/>`;
    s += `<path d="${linha}" fill="none" stroke="${AZUL}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const passo = Math.ceil(pts.length / 8);
    pts.forEach((p, i) => {
      s += `<circle cx="${X(i)}" cy="${Y(p.valor)}" r="4" fill="#fff" stroke="${AZUL}" stroke-width="2"/>`;
      s += `<rect x="${X(i) - (w / pts.length) / 2}" y="${pt}" width="${w / pts.length}" height="${h - pt - pb}" fill="transparent"` +
        ` data-tip="${Fmt.esc(p.tip || (p.rotulo + ': ' + fmt(p.valor)))}"/>`;
      if (i % passo === 0 || i === pts.length - 1)
        s += `<text x="${X(i)}" y="${h - pb + 17}" text-anchor="middle" style="font-size:10.5px">${Fmt.esc(p.rotulo)}</text>`;
    });
    return s + '</svg>';
  }

  const corta = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const vazio = m => `<div class="empty"><div class="d"></div><h3>Sem dados no período</h3><p class="dim">${Fmt.esc(m || 'Ajuste os filtros ou registre novas ordens de serviço.')}</p></div>`;
  return { barsH, barsV, area, ligarTooltips, CAT, AZUL, AMBAR };
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
