/* ============================================================
   RELATÓRIOS — semanal de manutenção e resumo executivo
   ============================================================ */
const Relatorios = (() => {
  const st = {
    aba: 'semanal', de: Dt.weekStart(Dt.today()), ate: Dt.add(Dt.weekStart(Dt.today()), 6),
    fx: { local: '', grupo: '', mecanico: '', tipo: '' }
  };

  function pagina() {
    App.aoRenderizar = ligar;
    App.acoesTopo(`<button class="btn ghost sm" id="btn-print">${Ico.print} Imprimir / PDF</button>`);
    return `<div class="stack">
      <section class="card no-print"><div class="card-b"><div class="row">
        <button class="chip${st.aba === 'semanal' ? ' on' : ''}" data-aba="semanal">Relatório semanal</button>
        <button class="chip${st.aba === 'executivo' ? ' on' : ''}" data-aba="executivo">Resumo executivo</button>
        <button class="chip${st.aba === 'diretoria' ? ' on' : ''}" data-aba="diretoria">Painel da diretoria</button>
        <span style="width:12px"></span>
        <button class="btn ghost sm" id="sem-ant">‹ Anterior</button>
        <input class="input" type="date" id="r-de" value="${st.de}" style="max-width:158px" aria-label="Data inicial">
        <span class="dim">até</span>
        <input class="input" type="date" id="r-ate" value="${st.ate}" style="max-width:158px" aria-label="Data final">
        <button class="btn ghost sm" id="sem-prox">Próxima ›</button>
        <div class="spacer"></div>
        <button class="btn ghost sm" id="ir-ultima">Última semana com movimento</button>
      </div></div></section>
      <div id="relatorio"></div></div>`;
  }

  const noPeriodo = () => DB.get().ordens.filter(o => o.data && o.data >= st.de && o.data <= st.ate);
  const temFiltro = () => !!(st.fx.local || st.fx.grupo || st.fx.mecanico || st.fx.tipo);
  function filtradas() {
    return noPeriodo().filter(o => {
      const v = DB.veiculo(o.veiculoId) || {};
      if (st.fx.local && o.local !== st.fx.local) return false;
      if (st.fx.mecanico && o.mecanico !== st.fx.mecanico) return false;
      if (st.fx.tipo && v.tipo !== st.fx.tipo) return false;
      if (st.fx.grupo && !o.itens.some(i => Rec.grupoDe(i.descricao).nome === st.fx.grupo)) return false;
      return true;
    });
  }

  function cabecalho(titulo) {
    return `<div class="rep-head"><span class="logo">${LOGO_SVG}</span>
      <div><div class="co">Grupo Brilhante</div><h1>${Fmt.esc(titulo)}</h1>
      <div class="pd">Período: ${Fmt.date(st.de)} a ${Fmt.date(st.ate)} · Emitido em ${Fmt.date(Dt.today())} por ${Fmt.esc(Estado.usuario.nome)}</div></div></div>`;
  }

  function semanal() {
    const os = noPeriodo();
    const b = DB.get();
    const rec = Q.reincidencias(os, b.ordens);
    const total = Q.soma(os);
    const veic = Q.porChave(os, o => o.veiculoId);

    if (!os.length) return `<div class="report">${cabecalho('Relatório semanal de manutenção de frotas')}
      ${UI.vazio('Nenhuma OS no período', 'Não há ordens de serviço registradas entre ' + Fmt.date(st.de) + ' e ' + Fmt.date(st.ate) + '.')}</div>`;

    const servicos = [];
    os.sort((a, c) => (a.data || '').localeCompare(c.data || '')).forEach(o => {
      const v = DB.veiculo(o.veiculoId) || {};
      o.itens.forEach((i, k) => servicos.push({
        d: k === 0 ? Fmt.date(o.data) : '', v: k === 0 ? Fmt.esc(v.nome) : '',
        pl: k === 0 ? Fmt.esc(o.placa) : '', fr: k === 0 ? Fmt.esc(o.frota) : '',
        km: k === 0 ? Fmt.kmh(o.kmH, o.unidade) : '', me: k === 0 ? Fmt.esc(o.mecanico) : '',
        s: Fmt.esc(i.descricao), q: Fmt.num(i.qtd), val: Fmt.money(i.total),
      }));
    });

    return `<div class="report">
      ${cabecalho('Relatório semanal de manutenção de frotas')}
      <div class="rep-sec"><h2>Resumo do período</h2>
        <div class="rep-kpis">
          ${[['Ordens de serviço', Fmt.num(os.length)], ['Veículos atendidos', Fmt.num(veic.length)],
        ['Serviços executados', Fmt.num(Q.qtdItens(os))], ['Valor total', Fmt.money0(total)],
        ['Custo médio por OS', Fmt.money0(total / os.length)], ['Reincidências', Fmt.num(rec.length)]]
        .map(([l, v]) => `<div class="rep-kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}
        </div></div>

      <div class="rep-sec"><h2>Serviços realizados</h2>
        ${UI.tabela([{ t: 'Data', k: 'd' }, { t: 'Veículo', k: 'v' }, { t: 'Placa', k: 'pl' }, { t: 'Frota', k: 'fr' },
        { t: 'KM/H', k: 'km', cls: 'ta-r' }, { t: 'Mecânico', k: 'me' }, { t: 'Serviço', k: 's' },
        { t: 'Qtd', k: 'q', cls: 'ta-r' }, { t: 'Valor', k: 'val', cls: 'ta-r' }], servicos,
      { total: { s: 'TOTAL DO PERÍODO', val: Fmt.money(total) } })}</div>

      <div class="rep-sec"><h2>Veículos atendidos</h2>
        ${UI.tabela([{ t: 'Veículo', k: 'v' }, { t: 'Frota', k: 'f' }, { t: 'Placa', k: 'p' },
        { t: 'Atendimentos', k: 'n', cls: 'ta-r' }, { t: 'Serviços', k: 's', cls: 'ta-r' }, { t: 'Total gasto', k: 't', cls: 'ta-r' }],
      veic.map(e => {
        const v = DB.veiculo(e.chave) || {};
        const its = os.filter(o => o.veiculoId === e.chave).reduce((s, o) => s + o.itens.length, 0);
        return { v: Fmt.esc(v.nome), f: Fmt.esc(v.frota), p: Fmt.esc(v.placa), n: Fmt.num(e.qtd), s: Fmt.num(its), t: Fmt.money(e.valor) };
      }), { total: { v: 'TOTAL', n: Fmt.num(os.length), t: Fmt.money(total) } })}</div>

      <div class="rep-sec"><h2>Reincidências</h2>
        ${rec.length ? UI.tabela([{ t: 'Veículo', k: 'v' }, { t: 'Placa', k: 'p' }, { t: 'Frota', k: 'f' }, { t: 'Problema', k: 'g' },
        { t: 'Data anterior', k: 'd1' }, { t: 'Serviço anterior', k: 's1' }, { t: 'Data atual', k: 'd2' }, { t: 'Serviço atual', k: 's2' },
        { t: 'Intervalo', k: 'i', cls: 'ta-r' }, { t: 'Valor gasto', k: 't', cls: 'ta-r' }],
      rec.map(r => {
        const v = DB.veiculo(r.os.veiculoId) || {};
        return {
          v: Fmt.esc(v.nome), p: Fmt.esc(v.placa), f: Fmt.esc(v.frota),
          g: r.anterior.grupos.map(Rec.nomeGrupo).join(', '),
          d1: Fmt.date(r.anterior.os.data), s1: Fmt.esc(r.anterior.os.itens.map(i => i.descricao).join(' · ')),
          d2: Fmt.date(r.os.data), s2: Fmt.esc(r.os.itens.map(i => i.descricao).join(' · ')),
          i: r.anterior.dias + ' dias', t: Fmt.money(r.os.total + r.anterior.os.total)
        };
      }), {}) : '<p class="dim">Nenhum veículo retornou pelo mesmo sistema no período. </p>'}</div>

      <div class="rep-sec" style="border-top:1px solid var(--line);padding-top:var(--s4)">
        <p class="dim" style="font-size:11.5px;margin:0">Grupo Brilhante · Juína/MT · Relatório gerado pelo Sistema de Ordens de Serviço de Frotas.</p></div>
    </div>`;
  }

  function executivo() {
    const b = DB.get();
    const os = noPeriodo();
    const total = Q.soma(os);
    const dias = Math.max(1, Dt.diff(st.ate, st.de) + 1);
    const antDe = Dt.add(st.de, -dias), antAte = Dt.add(st.de, -1);
    const osAnt = b.ordens.filter(o => o.data && o.data >= antDe && o.data <= antAte);
    const totalAnt = Q.soma(osAnt);
    const varia = totalAnt ? ((total - totalAnt) / totalAnt) * 100 : null;
    const rec = Q.reincidencias(os, b.ordens);
    const porVeic = Q.porChave(os, o => o.veiculoId);
    const porLocal = Q.porChave(os, o => o.local);
    const grupos = Q.porGrupoServico(os);
    const alrt = Painel.alertas(os, b.ordens);
    const servMais = {};
    os.forEach(o => o.itens.forEach(i => { const g = Rec.grupoDe(i.descricao).nome; servMais[g] = (servMais[g] || 0) + (i.qtd || 1); }));

    if (!os.length) return `<div class="report">${cabecalho('Resumo executivo — manutenção de frotas')}
      ${UI.vazio('Nenhuma OS no período', 'Ajuste o período para gerar o resumo.')}</div>`;

    return `<div class="report">
      ${cabecalho('Resumo executivo — manutenção de frotas')}
      <div class="rep-sec"><h2>Quanto gastamos</h2>
        <div class="rep-kpis">
          <div class="rep-kpi"><div class="l">Valor total</div><div class="v">${Fmt.money0(total)}</div></div>
          <div class="rep-kpi"><div class="l">Período anterior</div><div class="v">${Fmt.money0(totalAnt)}</div></div>
          <div class="rep-kpi"><div class="l">Variação</div><div class="v" style="color:${varia == null ? 'inherit' : varia > 0 ? 'var(--red)' : 'var(--green)'}">${varia == null ? '—' : (varia > 0 ? '+' : '') + Fmt.num1(varia) + '%'}</div></div>
          <div class="rep-kpi"><div class="l">OS realizadas</div><div class="v">${Fmt.num(os.length)}</div></div>
          <div class="rep-kpi"><div class="l">Custo médio por OS</div><div class="v">${Fmt.money0(total / os.length)}</div></div>
          <div class="rep-kpi"><div class="l">Reincidências</div><div class="v">${Fmt.num(rec.length)}</div></div>
        </div></div>

      <div class="rep-sec"><h2>Onde gastamos</h2>
        <div class="grid g2">
          <div>${Chart.barsH(porLocal.slice(0, 8).map(e => ({ rotulo: e.chave, valor: e.valor, tip: `<strong>${Fmt.esc(e.chave)}</strong><br>${Fmt.money(e.valor)} · ${e.qtd} OS` })), { aria: 'Gastos por local' })}
            <p class="dim" style="font-size:11.5px;margin-top:8px">Por local / unidade</p></div>
          <div>${Chart.barsH(grupos.slice(0, 8).map(g => ({ rotulo: g.nome, valor: g.valor, tip: `<strong>${Fmt.esc(g.nome)}</strong><br>${Fmt.money(g.valor)} · ${g.qtd} serviços` })), { aria: 'Gastos por sistema' })}
            <p class="dim" style="font-size:11.5px;margin-top:8px">Por sistema do veículo</p></div>
        </div></div>

      <div class="rep-sec"><h2>Quais veículos mais consumiram recursos</h2>
        ${UI.tabela([{ t: '#', k: 'p' }, { t: 'Veículo', k: 'v' }, { t: 'Placa', k: 'pl' }, { t: 'Frota', k: 'f' },
      { t: 'OS', k: 'n', cls: 'ta-r' }, { t: 'Total gasto', k: 't', cls: 'ta-r' }, { t: '% do total', k: 'pc', cls: 'ta-r' }],
      porVeic.slice(0, 10).map((e, i) => {
        const v = DB.veiculo(e.chave) || {};
        return { p: i + 1, v: Fmt.esc(v.nome), pl: Fmt.esc(v.placa), f: Fmt.esc(v.frota), n: Fmt.num(e.qtd), t: Fmt.money(e.valor), pc: Fmt.num1(e.valor / total * 100) + '%' };
      }), {})}</div>

      <div class="rep-sec"><h2>Quais serviços foram mais realizados</h2>
        ${Chart.barsV(Object.entries(servMais).sort((a, c) => c[1] - a[1]).slice(0, 8).map(([g, n]) => ({ rotulo: g, valor: n, tip: `<strong>${Fmt.esc(g)}</strong><br>${n} serviços` })), { fmt: Fmt.num, aria: 'Serviços mais realizados' })}</div>

      <div class="rep-sec"><h2>Quais veículos precisam de atenção</h2>
        ${alrt.length ? `<div class="stack" style="gap:8px">${alrt.map(a =>
        `<div class="alert-box" style="padding:10px 14px"><span class="ic">⚠️</span><div>${a.txt}</div></div>`).join('')}</div>`
        : '<p class="dim">Nenhuma situação crítica identificada no período.</p>'}</div>
    </div>`;
  }

  /* ---------- painel interativo da diretoria ---------- */
  function diretoria() {
    const b = DB.get();
    const todas = noPeriodo(), os = filtradas();
    const total = Q.soma(os), filtrado = temFiltro();
    const veic = new Set(os.map(o => o.veiculoId));
    const rec = Q.reincidencias(os, b.ordens);
    const recPorPlaca = {};
    rec.forEach(r => recPorPlaca[r.os.veiculoId] = (recPorPlaca[r.os.veiculoId] || 0) + 1);
    const dias = Math.max(1, Dt.diff(st.ate, st.de) + 1);
    const antDe = Dt.add(st.de, -dias), antAte = Dt.add(st.de, -1);
    const totalAnt = Q.soma(b.ordens.filter(o => o.data && o.data >= antDe && o.data <= antAte));
    const varia = (!filtrado && totalAnt) ? ((total - totalAnt) / totalAnt) * 100 : null;

    if (!todas.length) return UI.card('', UI.vazio('Nenhuma OS no período',
      'Escolha outro período para montar o painel — ou use “Última semana com movimento”.'), '', true);

    const chips = [['local', st.fx.local], ['grupo', st.fx.grupo], ['mecanico', st.fx.mecanico], ['tipo', st.fx.tipo]]
      .filter(c => c[1]);
    const barraChips = `<div class="row no-print" style="margin-bottom:var(--s4)">
      ${chips.length ? chips.map(c => `<button class="chip on" data-limpa="${c[0]}">${Fmt.esc(c[1])} ✕</button>`).join('') +
        `<button class="chip" data-limpa="__todos">Limpar tudo</button>`
        : '<span class="dim" style="font-size:12.5px">Clique nas barras dos gráficos para filtrar o painel.</span>'}</div>`;

    const kpis = `<div class="grid kpis">
      ${UI.kpi('Valor total', Fmt.money0(total), filtrado ? 'no recorte filtrado' : 'no período')}
      ${UI.kpi('Ordens de serviço', Fmt.num(os.length))}
      ${UI.kpi('Veículos atendidos', Fmt.num(veic.size))}
      ${UI.kpi('Serviços executados', Fmt.num(Q.qtdItens(os)))}
      ${UI.kpi('Custo médio por OS', Fmt.money0(os.length ? total / os.length : 0))}
      ${varia == null
        ? UI.kpi('Reincidências', Fmt.num(rec.length), rec.length ? 'voltaram pelo mesmo sistema' : 'nenhuma', rec.length > 0)
        : UI.kpi('Variação', `<span style="color:${varia > 0 ? 'var(--red)' : 'var(--green)'}">${varia > 0 ? '+' : ''}${Fmt.num1(varia)}%</span>`,
          'vs. ' + Fmt.date(antDe) + ' a ' + Fmt.date(antAte))}
    </div>`;

    const semanas = Q.porSemana(os);
    const grupos = Q.porGrupoServico(os);
    const porLocal = Q.porChave(os, o => o.local);
    const porMec = Q.porChave(os, o => o.mecanico);
    const porVeic = Q.porChave(os, o => o.veiculoId);

    const graficos = `<div class="grid g2" style="margin-top:var(--s4)">
      ${UI.card('Evolução no período', Chart.area(semanas.map(s2 => ({
        rotulo: Fmt.dateShort(s2.chave), valor: s2.valor,
        tip: `<strong>Semana de ${Fmt.date(s2.chave)}</strong><br>${Fmt.money(s2.valor)}<br>${s2.qtd} ordens de serviço`
      })), { aria: 'Evolução dos gastos por semana' }))}
      ${UI.card('Gastos por tipo de serviço', Chart.barsH(grupos.slice(0, 10).map(g => ({
        rotulo: g.nome, valor: g.valor, filtro: 'grupo|' + g.nome,
        tip: `<strong>${Fmt.esc(g.nome)}</strong><br>${Fmt.money(g.valor)}<br>${g.qtd} serviços<br><em>clique para filtrar</em>`
      })), { aria: 'Gastos por tipo de serviço' }))}
    </div>
    <div class="grid g2" style="margin-top:var(--s4)">
      ${UI.card('Gastos por local', Chart.barsH(porLocal.slice(0, 10).map(e => ({
        rotulo: e.chave, valor: e.valor, filtro: 'local|' + e.chave,
        tip: `<strong>${Fmt.esc(e.chave)}</strong><br>${Fmt.money(e.valor)}<br>${e.qtd} OS · ${e.veic.size} veículos<br><em>clique para filtrar</em>`
      })), { aria: 'Gastos por local' }))}
      ${UI.card('Serviços por mecânico', Chart.barsV(porMec.map(e => ({
        rotulo: e.chave, valor: e.qtd, filtro: 'mecanico|' + e.chave,
        tip: `<strong>${Fmt.esc(e.chave)}</strong><br>${e.qtd} OS · ${Fmt.money(e.valor)}<br><em>clique para filtrar</em>`
      })), { fmt: Fmt.num, aria: 'Ordens de serviço por mecânico' }))}
    </div>
    <div style="margin-top:var(--s4)">
      ${UI.card('Veículos com maior custo', Chart.barsH(porVeic.slice(0, 10).map(e => {
        const v = DB.veiculo(e.chave) || {};
        return {
          rotulo: (v.nome || '—') + (v.placa && v.placa !== '—' ? ' ' + v.placa : ''), valor: e.valor,
          destaque: !!recPorPlaca[e.chave],
          tip: `<strong>${Fmt.esc(v.nome)}</strong> · ${Fmt.esc(v.placa)}<br>${Fmt.money(e.valor)} em ${e.qtd} OS` +
            (recPorPlaca[e.chave] ? `<br>⚠️ ${recPorPlaca[e.chave]} reincidência(s)` : '')
        };
      }), { aria: 'Veículos com maior custo' }) +
      '<div class="legend"><span><i style="background:#C2721A"></i>com reincidência</span><span><i style="background:#3157CE"></i>sem reincidência</span></div>')}
    </div>`;

    const tabVeic = UI.card('Veículos atendidos', UI.tabela(
      [{ t: 'Veículo', k: 'v' }, { t: 'Placa', k: 'p' }, { t: 'Frota', k: 'f' }, { t: 'Tipo', k: 'tp' },
      { t: 'OS', k: 'n', cls: 'ta-r' }, { t: 'Serviços', k: 's', cls: 'ta-r' },
      { t: 'Total gasto', k: 't', cls: 'ta-r' }, { t: 'Reincid.', k: 'r', cls: 'ta-c' }],
      porVeic.map(e => {
        const v = DB.veiculo(e.chave) || {};
        const its = os.filter(o => o.veiculoId === e.chave).reduce((s2, o) => s2 + o.itens.length, 0);
        return {
          _cls: 'clickable', _attr: ` data-veic="${Fmt.esc(e.chave)}"`,
          v: `<span class="strong">${Fmt.esc(v.nome)}</span>`, p: `<span class="mono">${Fmt.esc(v.placa)}</span>`,
          f: `<span class="mono">${Fmt.esc(v.frota)}</span>`, tp: Fmt.esc(v.tipo),
          n: Fmt.num(e.qtd), s: Fmt.num(its), t: `<span class="strong">${Fmt.money(e.valor)}</span>`,
          r: recPorPlaca[e.chave] ? `<span class="badge b-amber">${recPorPlaca[e.chave]}</span>` : '<span class="dim">—</span>'
        };
      }), { total: { v: 'TOTAL', n: Fmt.num(os.length), t: Fmt.money(total) } }), '', true);

    const alrt = filtrado ? [] : Painel.alertas(os, b.ordens);
    const boxAlertas = alrt.length ? `<section class="card" style="margin-top:var(--s4)"><div class="card-h"><h2>⚠️ Atenção</h2></div>
      <div class="card-b"><div class="stack" style="gap:9px">${alrt.map(a =>
        `<div class="row" style="gap:10px;align-items:flex-start">
          <span class="badge ${a.nivel === 'alto' ? 'b-amber' : 'b-gray'}">${a.nivel === 'alto' ? 'Prioridade' : 'Observar'}</span>
          <span style="flex:1;min-width:0">${a.txt}</span></div>`).join('')}</div></div></section>` : '';

    const tabRec = rec.length ? `<div style="margin-top:var(--s4)">${UI.card('Reincidências no período', UI.tabela(
      [{ t: 'Veículo', k: 'v' }, { t: 'Placa', k: 'p' }, { t: 'Sistema', k: 'g' },
      { t: 'Ocorrência anterior', k: 'a' }, { t: 'Ocorrência atual', k: 'b' },
      { t: 'Intervalo', k: 'i', cls: 'ta-r' }, { t: 'Valor da OS', k: 't', cls: 'ta-r' }],
      rec.map(r => {
        const v = DB.veiculo(r.os.veiculoId) || {};
        return {
          v: Fmt.esc(v.nome), p: `<span class="mono">${Fmt.esc(v.placa)}</span>`,
          g: r.anterior.grupos.map(g => `<span class="badge b-amber">${Fmt.esc(Rec.nomeGrupo(g))}</span>`).join(' '),
          a: Fmt.date(r.anterior.os.data) + ' — OS ' + r.anterior.os.numero,
          b: Fmt.date(r.os.data) + ' — OS ' + r.os.numero,
          i: `<strong>${r.anterior.dias} dias</strong>`, t: Fmt.money(r.os.total)
        };
      }), {}), '', true)}</div>` : '';

    const cabecalho = `<div class="card" style="padding:var(--s4) var(--s5);margin-bottom:var(--s4);display:flex;gap:var(--s4);align-items:center;flex-wrap:wrap">
      <span class="logo" style="width:52px;color:var(--royal);flex:none">${LOGO_SVG}</span>
      <div style="flex:1;min-width:200px"><div class="eyebrow" style="color:var(--royal)">Grupo Brilhante</div>
        <h2>Painel de manutenção de frotas</h2>
        <div class="dim" style="font-size:12.5px">Período: ${Fmt.date(st.de)} a ${Fmt.date(st.ate)} · ${todas.length} ordens de serviço</div></div>
      ${Perm.pode('exportar') ? `<div class="row no-print">
        <button class="btn" id="exp-baixar">${Ico.imp} Baixar painel (.html)</button>
        <button class="btn ghost" id="exp-compartilhar">Compartilhar</button>
        <button class="btn ghost" id="exp-copiar">Copiar resumo</button>
      </div>` : ''}</div>`;

    return cabecalho + barraChips + kpis + boxAlertas + graficos +
      `<div style="margin-top:var(--s4)">${tabVeic}</div>` + tabRec;
  }

  function ligar() {
    const pintar = () => {
      const el = document.getElementById('relatorio');
      el.innerHTML = st.aba === 'semanal' ? semanal() : st.aba === 'executivo' ? executivo() : diretoria();
      Chart.ligarTooltips(el);
      // filtros por clique nas barras
      el.querySelectorAll('[data-f]').forEach(r => r.addEventListener('click', () => {
        const [k, v] = r.dataset.f.split('|');
        st.fx[k] = st.fx[k] === v ? '' : v;
        pintar();
      }));
      el.querySelectorAll('[data-limpa]').forEach(bt => bt.addEventListener('click', () => {
        const k = bt.dataset.limpa;
        if (k === '__todos') st.fx = { local: '', grupo: '', mecanico: '', tipo: '' }; else st.fx[k] = '';
        pintar();
      }));
      el.querySelectorAll('[data-veic]').forEach(tr => tr.addEventListener('click', () => App.irPara('veiculo/' + tr.dataset.veic)));
      const bx = document.getElementById('exp-baixar');
      if (bx) bx.addEventListener('click', () => Exportar.baixar(st.de, st.ate));
      const bc = document.getElementById('exp-compartilhar');
      if (bc) bc.addEventListener('click', () => Exportar.compartilhar(st.de, st.ate));
      const bp = document.getElementById('exp-copiar');
      if (bp) bp.addEventListener('click', () => Exportar.copiarResumo(st.de, st.ate));
    };
    document.querySelectorAll('[data-aba]').forEach(b => b.addEventListener('click', () => {
      st.aba = b.dataset.aba;
      if (st.aba !== 'diretoria') st.fx = { local: '', grupo: '', mecanico: '', tipo: '' };
      document.querySelectorAll('[data-aba]').forEach(x => x.classList.toggle('on', x.dataset.aba === st.aba));
      pintar();
    }));
    const de = document.getElementById('r-de'), ate = document.getElementById('r-ate');
    de.addEventListener('change', e => { st.de = e.target.value; pintar(); });
    ate.addEventListener('change', e => { st.ate = e.target.value; pintar(); });
    const mover = n => { st.de = Dt.add(st.de, n * 7); st.ate = Dt.add(st.ate, n * 7); de.value = st.de; ate.value = st.ate; pintar(); };
    document.getElementById('sem-ant').addEventListener('click', () => mover(-1));
    document.getElementById('sem-prox').addEventListener('click', () => mover(1));
    document.getElementById('ir-ultima').addEventListener('click', () => {
      const hoje = Dt.today();
      const datas = DB.get().ordens.map(o => o.data).filter(d => d && d <= hoje).sort();
      if (!datas.length) return;
      st.de = Dt.weekStart(datas[datas.length - 1]); st.ate = Dt.add(st.de, 6);
      de.value = st.de; ate.value = st.ate; pintar();
    });
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    pintar();
  }
  return { pagina };
})();
