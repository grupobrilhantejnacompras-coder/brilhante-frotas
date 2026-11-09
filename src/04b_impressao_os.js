/* ============================================================
   IMPRESSÃO DA ORDEM DE SERVIÇO — modelo A4 (retrato)
   O layout é montado UMA vez, como uma lista de elementos (retângulos, linhas, textos e a logo)
   com posições em milímetros. A mesma lista alimenta:
     • a visualização na tela e a impressão do navegador (HTML);
     • o arquivo PDF para baixar (gerado aqui mesmo, sem biblioteca externa e sem internet).
   Assim, o que se vê na visualização é o que sai no papel e no PDF.
   Fonte: Helvetica/Arial (mesmas medidas), identidade: azul royal, cinza e branco.
   ============================================================ */
const ImpressaoOS = (() => {
  const W = 210, H = 297, M = 14;                 // folha A4 e margem (mm)
  const LARG = W - 2 * M;                         // largura útil: 182 mm
  const Y_MAX = 275;                              // limite do conteúdo (acima do rodapé)
  const PT = 25.4 / 72;                           // 1 pt em mm
  const COR = { azul: '#3D459F', azulEsc: '#2B3278', cinza: '#6B7280', cinzaCl: '#F3F4F6', zebra: '#F9FAFB', linha: '#D1D5DB', texto: '#111827', branco: '#FFFFFF' };
  const FONTE = 'Helvetica, Arial, "Liberation Sans", sans-serif';

  /* ---------- medida de texto (Arial/Helvetica têm a mesma métrica) ---------- */
  let _cx = null;
  function larg(s, pt, neg) {
    s = String(s);
    if (_cx === null) { try { _cx = document.createElement('canvas').getContext('2d'); } catch (e) { _cx = false; } }
    if (!_cx) return s.length * pt * PT * (neg ? 0.56 : 0.52);
    _cx.font = (neg ? 'bold ' : '') + '100px ' + FONTE;
    return _cx.measureText(s).width / 100 * pt * PT;
  }
  function cortar(s, pt, neg, max) {                       // uma linha só, com reticências
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (larg(s, pt, neg) <= max) return s;
    while (s.length > 1 && larg(s + '…', pt, neg) > max) s = s.slice(0, -1);
    return s.trimEnd() + '…';
  }
  function quebrar(txt, pt, neg, max) {                    // quebra por palavras (e por letras se a palavra não cabe)
    const out = [];
    String(txt == null ? '' : txt).split(/\r?\n/).forEach(par => {
      let linha = '';
      par.split(/\s+/).filter(Boolean).forEach(pal => {
        const t = linha ? linha + ' ' + pal : pal;
        if (larg(t, pt, neg) <= max) { linha = t; return; }
        if (linha) { out.push(linha); linha = ''; }
        while (larg(pal, pt, neg) > max && pal.length > 1) {
          let n = pal.length - 1; while (n > 1 && larg(pal.slice(0, n), pt, neg) > max) n--;
          out.push(pal.slice(0, n)); pal = pal.slice(n);
        }
        linha = pal;
      });
      out.push(linha);
    });
    return out.length ? out : [''];
  }

  /* ---------- montagem do layout (mesmo desenho da tela da OS: cartões arredondados, etiquetas em cinza) ---------- */
  function montar(o) {
    const v = DB.veiculo(o.veiculoId) || {};
    const ag = Dt.agora();
    const quem = (typeof Estado !== 'undefined' && Estado.usuario) ? (Estado.usuario.nome || Estado.usuario.usuario || '') : '';
    let ant = [];
    try { ant = Rec.anteriores(o, DB.get().ordens, DB.cfg().janelaReincidencia) || []; } catch (e) { ant = []; }
    const paginas = [];
    let P = null, y = 0, cartaoY = null;
    const rect = (x, yy, w, h, o2) => P.push(Object.assign({ t: 'rect', x, y: yy, w, h }, o2));
    const rr = (x, yy, w, h, r, o2) => rect(x, yy, w, h, Object.assign({ r }, o2));
    const txt = (x, yy, s, o2) => { if (s !== '' && s != null) P.push(Object.assign({ t: 'txt', x, y: yy, s: String(s), pt: 9, neg: false, cor: COR.texto, al: 'l' }, o2)); };
    const logo = (x, yy, w, cor) => P.push({ t: 'logo', x, y: yy, w, h: w * 1068 / 1473, cor });
    const rot = (x, yy, s) => txt(x, yy, String(s).toUpperCase(), { pt: 6.8, neg: true, cor: COR.cinza });
    const IN = 5;                                              // recuo interno dos cartões

    function cabecalho(cont) {
      if (!cont) {
        logo(M, M, 21, COR.azul);
        txt(M + 25, M + 10.8, 'Grupo Brilhante', { pt: 19, neg: true, cor: COR.azul });
        txt(M, M + 30, 'Ordem de serviço', { pt: 26, neg: true });
        y = M + 37;
      } else {
        logo(M, M, 11, COR.azul);
        txt(M + 14, M + 6.5, 'Grupo Brilhante', { pt: 11, neg: true, cor: COR.azul });
        txt(W - M, M + 6.5, 'Ordem de serviço Nº ' + o.numero + ' · continuação', { pt: 9, neg: true, cor: COR.cinza, al: 'r' });
        rect(M, M + 10, LARG, 0.4, { fill: COR.azul });
        y = M + 15;
      }
    }
    const novaPagina = cont => { P = []; paginas.push(P); cabecalho(cont); };
    const abrirCartao = () => { cartaoY = y; };
    const fecharCartao = () => { if (cartaoY != null && y > cartaoY) rr(M, cartaoY, LARG, y - cartaoY, 2.2, { stroke: COR.linha, sw: 0.3 }); cartaoY = null; };
    const tituloCartao = (t) => { txt(M + IN, y + 8.6, t, { pt: 12.5, neg: true }); rect(M, y + 13, LARG, 0.25, { fill: COR.linha }); y += 13.25; };
    novaPagina(false);

    /* ---- cartão: dados da OS ---- */
    abrirCartao();
    tituloCartao('Ordem de serviço Nº ' + o.numero);
    const cx = [M + IN, M + LARG / 2 + 2], cw = LARG / 2 - IN - 2;
    const linhas = [
      [['Data', Fmt.date(o.data)], ['Local do serviço', o.local]],
      [['Condutor', o.condutor], ['Veículo', v.nome]],
      [['Placa', o.placa], ['Frota', o.frota || v.frota]],
      [[o.unidade === 'H' ? 'Horímetro' : 'Quilometragem', Fmt.kmh(o.kmH, o.unidade)], ['Mecânicos responsáveis', o.mecanico]],
      [['Situação', null], ['Setor', o.setor]]
    ];
    y += 3;
    linhas.forEach(par => {
      const ls = par.map(([, val]) => val === null ? [''] : quebrar(val || '—', 10.5, true, cw).slice(0, 2));
      const h = 12.4 + (Math.max(...ls.map(l => l.length)) - 1) * 4.7;
      par.forEach(([r0, val], k) => {
        rot(cx[k], y + 4, r0);
        if (val === null) {
          const st = o.status || 'Concluída', pw = larg(st, 8.5, false) + 7;
          rr(cx[k], y + 6.2, pw, 6.2, 3.1, { stroke: COR.linha, sw: 0.3, fill: COR.branco });
          txt(cx[k] + 3.5, y + 10.4, st, { pt: 8.5 });
        } else ls[k].forEach((l, i) => txt(cx[k], y + 9.6 + i * 4.7, l, { pt: 10.5, neg: true }));
      });
      y += h;
    });
    for (let xx = M + IN; xx < M + LARG - IN; xx += 2.4) rect(xx, y, 1.2, 0.2, { fill: COR.linha });     // linha tracejada
    y += 3;
    const aud = [['Registrado por ', 0], [o.criadoPor || '—', 1], [' em ' + Fmt.date(o.criadoData) + ' às ' + (o.criadoHora || ''), 0]];
    if (o.criadoData) {
      let ax = M + IN; aud.forEach(([s, n]) => { txt(ax, y + 4, s, { pt: 8.5, neg: !!n }); ax += larg(s, 8.5, !!n); });
    } else txt(M + IN, y + 4, 'Registro importado da planilha', { pt: 8.5 });
    y += 6;
    if (o.alteradoData) {
      let ax = M + IN; [['Última alteração por ', 0], [o.alteradoPor || '—', 1], [' em ' + Fmt.date(o.alteradoData) + (o.alteradoHora ? ' às ' + o.alteradoHora : ''), 0]]
        .forEach(([s, n]) => { txt(ax, y + 3.4, s, { pt: 8.5, neg: !!n }); ax += larg(s, 8.5, !!n); });
      y += 5.4;
    }
    y += 2;
    fecharCartao();
    y += 4;

    /* ---- aviso de reincidência ---- */
    if (ant.length) {
      const a0 = ant[0];
      const corpo = quebrar('Última ocorrência do mesmo sistema em ' + Fmt.date(a0.os.data) + ' — há ' + a0.dias + ' dias (' + a0.grupos.map(Rec.nomeGrupo).join(', ') + '), no valor de ' + Fmt.money(a0.os.total) + '.', 9.5, false, LARG - IN - 14);
      const h = 11 + corpo.length * 4.4;
      if (y + h > Y_MAX) novaPagina(true);
      rr(M, y, LARG, h, 2.2, { fill: '#FEF6D8', stroke: '#EBD27A', sw: 0.3 });
      P.push({ t: 'poly', pts: [[M + IN + 2.3, y + 4.2], [M + IN + 4.6, y + 8.4], [M + IN, y + 8.4]], stroke: '#9A6A00', sw: 0.35 });
      txt(M + IN + 2.3, y + 7.9, '!', { pt: 6, neg: true, cor: '#9A6A00', al: 'c' });
      txt(M + IN + 9, y + 7.6, 'Reincidência identificada', { pt: 10.5, neg: true, cor: '#5C4400' });
      corpo.forEach((l, i) => txt(M + IN + 9, y + 12.4 + i * 4.4, l, { pt: 9.5, cor: '#5C4400' }));
      y += h + 4;
    }

    /* ---- cartão: serviços executados ---- */
    const CT = { q: M + IN, d: M + IN + 11, s: M + 88, vu: M + LARG - IN - 27, vt: M + LARG - IN };
    const DESC_W = CT.s - CT.d - 4;
    const cabTabela = () => {
      txt(CT.q, y + 5.6, 'QTD', { pt: 6.8, neg: true, cor: COR.cinza });
      txt(CT.d, y + 5.6, 'DESCRIÇÃO', { pt: 6.8, neg: true, cor: COR.cinza });
      txt(CT.s, y + 5.6, 'SISTEMA', { pt: 6.8, neg: true, cor: COR.cinza });
      txt(CT.vu, y + 5.6, 'VALOR UNITÁRIO', { pt: 6.8, neg: true, cor: COR.cinza, al: 'r' });
      txt(CT.vt, y + 5.6, 'VALOR TOTAL', { pt: 6.8, neg: true, cor: COR.cinza, al: 'r' });
      rect(M, y + 8, LARG, 0.25, { fill: COR.linha });
      y += 8.25;
    };
    if (y + 40 > Y_MAX) novaPagina(true);
    abrirCartao();
    tituloCartao('Serviços executados');
    cabTabela();
    if (!o.itens.length) { txt(CT.q, y + 7, 'Nenhum serviço lançado nesta ordem.', { pt: 9, cor: COR.cinza }); y += 11; }
    o.itens.forEach((it) => {
      const ls = quebrar(it.descricao || '—', 9, false, DESC_W);
      const h = Math.max(8.8, ls.length * 4.2 + 4.6);
      if (y + h + 11 > Y_MAX) { fecharCartao(); novaPagina(true); abrirCartao(); y += 1; cabTabela(); }
      const q = Number(it.qtd) || 0, base = y + 6;
      txt(CT.q + 1, base - 0.2, Number.isInteger(q) ? Fmt.num(q) : Fmt.num1(q), { pt: 9 });
      ls.forEach((l, i) => txt(CT.d, base + i * 4.2, l, { pt: 9 }));
      let g = ''; try { g = Rec.grupoDe(it.descricao).nome || ''; } catch (e) { }
      if (g) {
        const gt = cortar(g, 8, false, 31), pw = larg(gt, 8, false) + 6;
        rr(CT.s, y + 1.9, pw, 5.6, 2.8, { stroke: COR.linha, sw: 0.3, fill: COR.branco });
        txt(CT.s + 3, base - 0.1, gt, { pt: 8 });
      }
      txt(CT.vu, base, Fmt.money(it.valorUnit), { pt: 9, al: 'r' });
      txt(CT.vt, base, Fmt.money(it.total), { pt: 9, neg: true, al: 'r' });
      rect(M, y + h - 0.12, LARG, 0.15, { fill: '#E5E7EB' });
      y += h;
    });
    rect(M, y, LARG, 0.5, { fill: '#9CA3AF' });
    txt(CT.d, y + 6, 'TOTAL DA ORDEM DE SERVIÇO', { pt: 8.5, neg: true });
    txt(CT.vt, y + 6, Fmt.money(o.total), { pt: 9, neg: true, al: 'r' });
    y += 9.5;
    fecharCartao();
    y += 4;

    /* ---- valor total em destaque ---- */
    if (y + 24 > Y_MAX) novaPagina(true);
    rr(M, y, LARG, 20, 2.2, { fill: COR.zebra, stroke: COR.linha, sw: 0.3 });
    txt(M + IN + 1, y + 6.8, 'VALOR TOTAL DA ORDEM DE SERVIÇO', { pt: 7.5, neg: true, cor: COR.cinza });
    txt(M + IN + 1, y + 16.2, Fmt.money(o.total), { pt: 24, neg: true });
    txt(W - M - IN, y + 15.4, o.itens.length + (o.itens.length === 1 ? ' serviço' : ' serviços') + (o.setor ? ' · ' + o.setor : ''), { pt: 9, cor: COR.cinza, al: 'r' });
    y += 23;

    /* ---- observações (podem continuar na página seguinte) ---- */
    if (o.obs && String(o.obs).trim()) {
      const ls = quebrar(o.obs, 9.5, false, LARG - 2 * IN);
      let i = 0;
      while (i < ls.length) {
        if (y + 13.25 + 4.5 * 2 + 6 > Y_MAX) novaPagina(true);
        const cab = i === 0;
        abrirCartao();
        if (cab) tituloCartao('Observações'); else y += 2;
        const cabem = Math.max(1, Math.floor((Y_MAX - y - 6) / 4.5));
        const parte = ls.slice(i, i + cabem);
        parte.forEach((l, k) => txt(M + IN, y + 6 + k * 4.5, l, { pt: 9.5 }));
        y += 4 + parte.length * 4.5 + 3;
        fecharCartao(); y += 4; i += parte.length;
      }
    }

    /* ---- assinaturas (dois campos) ---- */
    if (y + 13 + 9 > Y_MAX + 1) novaPagina(true);
    const ySig = Math.max(y + 13, Y_MAX - 9);
    const sw = (LARG - 24) / 2;
    [['Mecânico responsável', o.mecanico], ['Gestor', '']].forEach(([r0, nome], k) => {
      const x = M + k * (sw + 24);
      rect(x, ySig, sw, 0.3, { fill: COR.texto });
      txt(x + sw / 2, ySig + 4, r0, { pt: 8.5, neg: true, cor: COR.cinza, al: 'c' });
      if (nome) txt(x + sw / 2, ySig + 8.2, cortar(nome, 8.5, false, sw), { pt: 8.5, al: 'c' });
      txt(x + sw / 2, ySig - 8, 'Data: ____/____/________', { pt: 7.5, cor: COR.cinza, al: 'c' });
    });

    /* ---- rodapé em todas as páginas ---- */
    paginas.forEach((pg, i) => {
      P = pg;
      rect(M, 277.5, LARG, 0.25, { fill: COR.linha });
      txt(M, 281.6, cortar('Emitido em ' + Fmt.date(ag.data) + ' às ' + ag.hora + (quem ? ' por ' + quem : '') + ' · Sistema de OS — Grupo Brilhante', 7, false, 150), { pt: 7, cor: COR.cinza });
      txt(W - M, 281.6, 'Página ' + (i + 1) + ' de ' + paginas.length, { pt: 7.5, neg: true, cor: COR.azul, al: 'r' });
    });
    return paginas;
  }

  /* ---------- saída 1: HTML (visualização e impressão) ---------- */
  const mm = n => (Math.round(n * 100) / 100) + 'mm';
  function htmlPrim(p) {
    if (p.t === 'rect') {
      return `<i style="left:${mm(p.x)};top:${mm(p.y)};width:${mm(p.w)};height:${mm(p.h)};` +
        (p.r ? `border-radius:${mm(Math.min(p.r, p.w / 2, p.h / 2))};` : '') + (p.fill ? `background:${p.fill};` : '') + (p.stroke ? `border:${mm(p.sw || 0.25)} solid ${p.stroke};box-sizing:border-box;` : '') + '"></i>';
    }
    if (p.t === 'poly') {
      const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), w0 = Math.max(...xs) - x0, h0 = Math.max(...ys) - y0;
      return `<svg style="left:${mm(x0)};top:${mm(y0)};width:${mm(w0)};height:${mm(h0)};overflow:visible" viewBox="0 0 ${w0} ${h0}"><polygon points="${p.pts.map(q => (q[0] - x0) + ',' + (q[1] - y0)).join(' ')}" fill="${p.fill || 'none'}" stroke="${p.stroke || 'none'}" stroke-width="${p.sw || 0.3}" stroke-linejoin="round"/></svg>`;
    }
    if (p.t === 'logo') {
      return `<span class="osf-logo" style="left:${mm(p.x)};top:${mm(p.y)};width:${mm(p.w)};height:${mm(p.h)};color:${p.cor}">${window.LOGO_SVG}</span>`;
    }
    const top = p.y - 0.9465 * p.pt * PT;                    // linha de base → topo da caixa (altura de linha 1,2)
    const pos = p.al === 'r' ? `right:${mm(W - p.x)};text-align:right;` : p.al === 'c' ? `left:${mm(p.x)};transform:translateX(-50%);` : `left:${mm(p.x)};`;
    return `<span style="${pos}top:${mm(top)};font-size:${p.pt}pt;color:${p.cor};${p.neg ? 'font-weight:700;' : ''}">${Fmt.esc(p.s)}</span>`;
  }
  const folhaHTML = prims => `<div class="os-folha">${prims.map(htmlPrim).join('')}</div>`;

  /* ---------- saída 2: PDF ---------- */
  const CP1252 = { '—': 0x97, '–': 0x96, '•': 0x95, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '…': 0x85, '€': 0x80 };
  function pdfTxt(s) {
    let r = '';
    for (const ch of String(s)) {
      let c = CP1252[ch] || ch.codePointAt(0);
      if (c > 255) c = 63;
      if (c === 40 || c === 41 || c === 92) r += '\\' + String.fromCharCode(c);
      else if (c < 32 || c > 126) r += '\\' + c.toString(8).padStart(3, '0');
      else r += String.fromCharCode(c);
    }
    return r;
  }
  const rgb = h => [1, 3, 5].map(i => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
  const f2 = n => (Math.round(n * 1000) / 1000).toString();

  // converte o desenho da logo (SVG, comandos m M l c z) em operadores de PDF
  let _logoOps = null;
  function logoOps() {
    if (_logoOps !== null) return _logoOps;
    const ops = [];
    const ds = [...String(window.LOGO_SVG).matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
    ds.forEach(d => {
      const tk = d.match(/[MmLlHhVvCcZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
      let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0;
      const num = () => parseFloat(tk[i++]);
      while (i < tk.length) {
        if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
        const rel = cmd === cmd.toLowerCase();
        switch (cmd.toUpperCase()) {
          case 'M': { const a = num(), b = num(); cx = rel ? cx + a : a; cy = rel ? cy + b : b; sx = cx; sy = cy; ops.push(f2(cx) + ' ' + f2(cy) + ' m'); cmd = rel ? 'l' : 'L'; break; }
          case 'L': { const a = num(), b = num(); cx = rel ? cx + a : a; cy = rel ? cy + b : b; ops.push(f2(cx) + ' ' + f2(cy) + ' l'); break; }
          case 'H': { const a = num(); cx = rel ? cx + a : a; ops.push(f2(cx) + ' ' + f2(cy) + ' l'); break; }
          case 'V': { const a = num(); cy = rel ? cy + a : a; ops.push(f2(cx) + ' ' + f2(cy) + ' l'); break; }
          case 'C': {
            const p = [num(), num(), num(), num(), num(), num()];
            const q = rel ? [cx + p[0], cy + p[1], cx + p[2], cy + p[3], cx + p[4], cy + p[5]] : p;
            ops.push(q.map(f2).join(' ') + ' c'); cx = q[4]; cy = q[5]; break;
          }
          case 'Z': ops.push('h'); cx = sx; cy = sy; break;
          default: i++;
        }
      }
    });
    return (_logoOps = ops.join('\n'));
  }

  function conteudoPDF(prims) {
    const k = 72 / 25.4, out = [];
    prims.forEach(p => {
      if (p.t === 'poly') {
        const g = p.pts.map((q, i) => f2(q[0] * k) + ' ' + f2((H - q[1]) * k) + (i ? ' l' : ' m')).join(' ') + ' h';
        out.push(`${p.fill ? rgb(p.fill) + ' rg ' : ''}${p.stroke ? rgb(p.stroke) + ' RG ' : ''}${f2((p.sw || 0.3) * k)} w 1 j ${g} ${p.fill && p.stroke ? 'B' : p.fill ? 'f' : 'S'}`);
      } else if (p.t === 'rect') {
        let g = `${f2(p.x * k)} ${f2((H - p.y - p.h) * k)} ${f2(p.w * k)} ${f2(p.h * k)} re`;
        if (p.r) {
          const r = Math.min(p.r, p.w / 2, p.h / 2) * k, kk = 0.5523 * r, X = p.x * k, Y = (H - p.y - p.h) * k, Wd = p.w * k, Ht = p.h * k;
          g = [`${f2(X + r)} ${f2(Y)} m`, `${f2(X + Wd - r)} ${f2(Y)} l`, `${f2(X + Wd - r + kk)} ${f2(Y)} ${f2(X + Wd)} ${f2(Y + r - kk)} ${f2(X + Wd)} ${f2(Y + r)} c`,
            `${f2(X + Wd)} ${f2(Y + Ht - r)} l`, `${f2(X + Wd)} ${f2(Y + Ht - r + kk)} ${f2(X + Wd - r + kk)} ${f2(Y + Ht)} ${f2(X + Wd - r)} ${f2(Y + Ht)} c`,
            `${f2(X + r)} ${f2(Y + Ht)} l`, `${f2(X + r - kk)} ${f2(Y + Ht)} ${f2(X)} ${f2(Y + Ht - r + kk)} ${f2(X)} ${f2(Y + Ht - r)} c`,
            `${f2(X)} ${f2(Y + r)} l`, `${f2(X)} ${f2(Y + r - kk)} ${f2(X + r - kk)} ${f2(Y)} ${f2(X + r)} ${f2(Y)} c h`].join(' ');
        }
        if (p.fill && p.stroke) out.push(`${rgb(p.fill)} rg ${rgb(p.stroke)} RG ${f2((p.sw || 0.25) * k)} w ${g} B`);
        else if (p.fill) out.push(`${rgb(p.fill)} rg ${g} f`);
        else if (p.stroke) out.push(`${rgb(p.stroke)} RG ${f2((p.sw || 0.25) * k)} w ${g} S`);
      } else if (p.t === 'logo') {
        const s = k * p.w * 0.1 / 1473;
        out.push(`q ${rgb(p.cor)} rg ${s.toFixed(7)} 0 0 ${s.toFixed(7)} ${f2(p.x * k)} ${f2((H - p.y - p.h) * k)} cm\n${logoOps()}\nf\nQ`);
      } else {
        const w = larg(p.s, p.pt, p.neg);
        const x = p.al === 'r' ? p.x - w : p.al === 'c' ? p.x - w / 2 : p.x;
        out.push(`BT /${p.neg ? 'F2' : 'F1'} ${p.pt} Tf ${rgb(p.cor)} rg ${f2(x * k)} ${f2((H - p.y) * k)} Td (${pdfTxt(p.s)}) Tj ET`);
      }
    });
    return out.join('\n');
  }

  function gerarPDF(paginas, titulo) {
    const mw = f2(W * 72 / 25.4), mh = f2(H * 72 / 25.4);
    const objs = [];                                          // objs[n-1] = texto do objeto n
    const n = paginas.length;
    objs[0] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[1] = `<< /Type /Pages /Kids [${paginas.map((_, i) => (7 + 2 * i) + ' 0 R').join(' ')}] /Count ${n} >>`;
    objs[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    const d = new Date(), p2 = x => String(x).padStart(2, '0');
    objs[4] = `<< /Title (${pdfTxt(titulo)}) /Author (Grupo Brilhante) /Creator (Sistema de OS - Grupo Brilhante) /Producer (Sistema de OS - Grupo Brilhante) /CreationDate (D:${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}) >>`;
    paginas.forEach((pg, i) => {
      const c = conteudoPDF(pg);
      objs[5 + 2 * i] = `<< /Length ${c.length} >>\nstream\n${c}\nendstream`;
      objs[6 + 2 * i] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${mw} ${mh}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * i} 0 R >>`;
    });
    // numeração dos objetos: 1 catálogo, 2 páginas, 3-4 fontes, 5 info; página i: conteúdo = 6+2i, página = 7+2i
    let pdf = '%PDF-1.4\n'; const off = [];
    objs.forEach((o, i) => { off.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(x => String(x).padStart(10, '0') + ' 00000 n \n').join('');
    pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new Blob([pdf], { type: 'application/pdf' });
  }

  /* ---------- ações ---------- */
  const nomeArquivo = o => 'OS_' + o.numero + '_' + (String(o.placa || (DB.veiculo(o.veiculoId) || {}).nome || 'sem-placa').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'OS') + '.pdf';

  function baixarPDF(o) {
    const blob = gerarPDF(montar(o), 'Ordem de Serviço Nº ' + o.numero);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nomeArquivo(o);
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    UI.toast('PDF da OS Nº ' + o.numero + ' gerado.', 'ok');
  }

  function limparImpressao() {
    ['os-print-root', 'os-print-style'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
    document.body.classList.remove('imprimindo-os');
  }
  function prepararImpressao(o) {
    limparImpressao();
    const raiz = document.createElement('div'); raiz.id = 'os-print-root';
    raiz.innerHTML = montar(o).map(folhaHTML).join('');
    const st = document.createElement('style'); st.id = 'os-print-style'; st.textContent = '@page{size:A4 portrait;margin:0}';
    document.head.appendChild(st); document.body.appendChild(raiz); document.body.classList.add('imprimindo-os');
    const fim = () => { window.removeEventListener('afterprint', fim); limparImpressao(); };
    window.addEventListener('afterprint', fim);
    setTimeout(limparImpressao, 180000);                     // segurança: navegadores que não avisam o fim da impressão
  }
  function imprimir(o) {
    prepararImpressao(o);
    setTimeout(() => window.print(), 60);
  }

  /* Ctrl+P / menu Imprimir do navegador com a OS aberta: imprime o modelo A4 (com logo e assinaturas), não a tela */
  let osAtual = null;
  function definirAtual(o) { osAtual = o ? o.id : null; }
  window.addEventListener('beforeprint', () => {
    try {
      if (document.body.classList.contains('imprimindo-os') || !osAtual) return;
      if (!document.querySelector('[data-acao="pdf"]')) return;           // só quando a página da OS está na tela
      const o = DB.get().ordens.find(x => x.id === osAtual);
      if (o) prepararImpressao(o);
    } catch (e) { }
  });

  function visualizar(o) {
    const paginas = montar(o);
    const corpo = `<div class="osp-barra"><span class="dim">Modelo A4 retrato · ${paginas.length} ${paginas.length === 1 ? 'página' : 'páginas'}. É assim que a ordem sai no papel e no PDF.</span></div>
      <div class="osp-area" id="osp-area">${paginas.map(p => `<div class="osp-pg"><div class="osp-esc">${folhaHTML(p)}</div></div>`).join('')}</div>`;
    const bg = UI.modal('Visualizar impressão — OS Nº ' + o.numero, corpo,
      `<button type="button" class="btn ghost" data-fechar>Fechar</button><div class="spacer"></div>
       <button type="button" class="btn ghost" id="osp-pdf">Baixar PDF</button><button type="button" class="btn" id="osp-print">Imprimir</button>`, '980px');
    const area = bg.querySelector('#osp-area');
    const ajustar = () => {
      if (!area.isConnected) { window.removeEventListener('resize', ajustar); return; }
      const pxW = 210 * 96 / 25.4, pxH = 297 * 96 / 25.4;
      const s = Math.min(1, (area.clientWidth - 24) / pxW);
      area.querySelectorAll('.osp-pg').forEach(pg => {
        pg.style.width = pxW * s + 'px'; pg.style.height = pxH * s + 'px';
        pg.firstElementChild.style.transform = 'scale(' + s + ')';
      });
    };
    ajustar(); window.addEventListener('resize', ajustar); setTimeout(ajustar, 60);
    bg.querySelector('#osp-pdf').addEventListener('click', () => baixarPDF(o));
    bg.querySelector('#osp-print').addEventListener('click', () => imprimir(o));
  }

  return { definirAtual, montar, gerarPDF, baixarPDF, imprimir, visualizar, nomeArquivo };
})();
