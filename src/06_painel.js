/* ============================================================
   DASHBOARD e ANÁLISE DE REINCIDÊNCIAS
   ============================================================ */
const Painel = (() => {

  function totalReincidencias() {
    try { return Q.reincidencias(DB.get().ordens).length; } catch (e) { return 0; }
  }

  /** Situações que merecem atenção da gestão no período filtrado. */
  function alertas(os, todas) {
    const cfg = DB.cfg(), out = [];
    const porVeic = {};
    os.forEach(o => (porVeic[o.veiculoId] = porVeic[o.veiculoId] || []).push(o));

    Object.entries(porVeic).forEach(([vid, lista]) => {
      const v = DB.veiculo(vid); if (!v) return;
      const gasto = lista.reduce((s, o) => s + o.total, 0);
      // mesmo sistema repetido 3+ vezes na janela
      const cont = {};
      lista.forEach(o => Rec.gruposDaOS(o).filter(g => !Rec.ehRotina(g)).forEach(g => (cont[g] = (cont[g] || 0) + 1)));
      Object.entries(cont).filter(([, n]) => n >= 3).forEach(([g, n]) =>
        out.push({ nivel: 'alto', vid, txt: `<strong>${Fmt.esc(v.nome)} (${Fmt.esc(v.placa)})</strong> apresentou ${n} ocorrências em <strong>${Rec.nomeGrupo(g)}</strong> no período.` }));
      if (lista.length >= cfg.alertaOSmes + 2)
        out.push({ nivel: 'medio', vid, txt: `<strong>${Fmt.esc(v.nome)} (${Fmt.esc(v.placa)})</strong> teve ${lista.length} ordens de serviço no período — verificar disponibilidade e causa raiz.` });
      if (gasto >= 3000)
        out.push({ nivel: 'medio', vid, txt: `<strong>${Fmt.esc(v.nome)} (${Fmt.esc(v.placa)})</strong> acumulou ${Fmt.money(gasto)} em manutenção no período.` });
    });

    // retorno rápido: mesmo sistema em menos de 15 dias
    Q.reincidencias(os, todas).filter(r => r.anterior.dias <= 15).forEach(r => {
      const v = DB.veiculo(r.os.veiculoId); if (!v) return;
      out.push({
        nivel: 'alto', vid: r.os.veiculoId,
        txt: `<strong>${Fmt.esc(v.nome)} (${Fmt.esc(v.placa)})</strong> voltou em ${r.anterior.dias} dias por <strong>${r.anterior.grupos.map(Rec.nomeGrupo).join(', ')}</strong> — OS ${r.anterior.os.numero} → OS ${r.os.numero}.`
      });
    });

    // um alerta por veículo — o mais grave — para a lista não virar ruído
    const porVeiculo = new Map();
    out.sort((a, b) => (a.nivel === 'alto' ? -1 : 1) - (b.nivel === 'alto' ? -1 : 1))
      .forEach(a => { if (!porVeiculo.has(a.vid)) porVeiculo.set(a.vid, a); });
    return [...porVeiculo.values()].slice(0, 6);
  }

  function pagina() {
    App.aoRenderizar = ligar;
    App.acoesTopo(Perm.pode('os.criar') ? `<button class="btn sm" data-ir="nova-os">+ Nova OS</button>` : '');
    return `<div class="stack">
      ${Filtros.barra(['periodo', 'local', 'veiculo', 'frota', 'mecanico', 'grupo'])}
      <div id="painel"></div></div>`;
  }

  function conteudo() {
    const b = DB.get();
    const os = Q.filtrar(Estado.filtros);
    const total = Q.soma(os);
    const veic = new Set(os.map(o => o.veiculoId));
    const rec = Q.reincidencias(os, b.ordens);
    const itens = Q.qtdItens(os);
    const alrt = alertas(os, b.ordens);

    const porVeic = Q.porChave(os, o => o.veiculoId);
    const recPorVeic = {};
    rec.forEach(r => recPorVeic[r.os.veiculoId] = (recPorVeic[r.os.veiculoId] || 0) + 1);
    const grupos = Q.porGrupoServico(os);
    const semanas = Q.porSemana(os);
    const porMec = Q.porChave(os, o => o.mecanico);

    const kpis = `<div class="grid kpis">
      ${UI.kpi('OS realizadas', Fmt.num(os.length), Filtros.resumo())}
      ${UI.kpi('Veículos atendidos', Fmt.num(veic.size), veic.size ? 'de ' + Fmt.num(b.veiculos.length) + ' na frota' : '')}
      ${UI.kpi('Valor total dos serviços', Fmt.money0(total))}
      ${UI.kpi('Serviços realizados', Fmt.num(itens), 'itens lançados nas OS')}
      ${UI.kpi('Custo médio por OS', Fmt.money0(os.length ? total / os.length : 0))}
      ${UI.kpi('Reincidências', Fmt.num(rec.length), rec.length ? 'veículos que voltaram pelo mesmo sistema' : 'nenhuma no período', rec.length > 0)}
    </div>`;

    const boxAlertas = alrt.length ? `<section class="card"><div class="card-h"><h2>⚠️ Atenção</h2>
      <div class="spacer"></div><span class="dim">${alrt.length} ${alrt.length === 1 ? 'situação' : 'situações'}</span></div>
      <div class="card-b"><div class="stack" style="gap:9px">${alrt.map(a =>
      `<div class="row" style="gap:10px;align-items:flex-start">
          <span class="badge ${a.nivel === 'alto' ? 'b-amber' : 'b-gray'}">${a.nivel === 'alto' ? 'Prioridade' : 'Observar'}</span>
          <span style="flex:1;min-width:0">${a.txt}</span>
          <button class="btn ghost sm" data-veic="${Fmt.esc(a.vid)}">Ver veículo</button></div>`).join('')}
      </div></div></section>` : '';

    const gEvolucao = UI.card('Serviços por período', semanas.length
      ? Chart.area(semanas.map(s => ({
        rotulo: Fmt.dateShort(s.chave), valor: s.valor,
        tip: `<strong>Semana de ${Fmt.date(s.chave)}</strong><br>${Fmt.money(s.valor)}<br>${s.qtd} ordens de serviço`
      })), { aria: 'Valor de serviços por semana' })
      : UI.vazio('Sem movimento', 'Nenhuma OS com data no período filtrado.'));

    const gVeiculos = UI.card('Gastos por veículo', Chart.barsH(porVeic.slice(0, 10).map(e => {
      const v = DB.veiculo(e.chave) || {};
      return {
        rotulo: (v.nome || '—') + (v.placa && v.placa !== '—' ? ' ' + v.placa : ''), valor: e.valor,
        destaque: !!recPorVeic[e.chave],
        tip: `<strong>${Fmt.esc(v.nome)}</strong> · ${Fmt.esc(v.placa)}<br>${Fmt.money(e.valor)} em ${e.qtd} OS` +
          (recPorVeic[e.chave] ? `<br>⚠️ ${recPorVeic[e.chave]} reincidência(s)` : '')
      };
    }), { aria: 'Gastos por veículo' }) + '<div class="legend"><span><i style="background:#C2721A"></i>com reincidência</span><span><i style="background:#3157CE"></i>sem reincidência</span></div>');

    const gServicos = UI.card('Gastos por tipo de serviço', Chart.barsH(grupos.slice(0, 10).map(g => ({
      rotulo: g.nome, valor: g.valor,
      tip: `<strong>${Fmt.esc(g.nome)}</strong><br>${Fmt.money(g.valor)}<br>${g.qtd} serviços executados`
    })), { aria: 'Gastos por tipo de serviço' }));

    const gMecanicos = UI.card('Serviços por mecânico', Chart.barsV(porMec.map(m => ({
      rotulo: m.chave, valor: m.qtd,
      tip: `<strong>${Fmt.esc(m.chave)}</strong><br>${m.qtd} OS · ${Fmt.money(m.valor)}<br>${m.veic.size} veículos atendidos`
    })), { fmt: Fmt.num, aria: 'Ordens de serviço por mecânico' }));

    const rankCusto = UI.card('Veículos com maior custo', UI.tabela(
      [{ t: '#', k: 'p' }, { t: 'Veículo', k: 'v' }, { t: 'Frota', k: 'f' }, { t: 'Placa', k: 'pl' },
      { t: 'OS', k: 'n', cls: 'ta-r' }, { t: 'Total gasto', k: 't', cls: 'ta-r' }, { t: 'Reincid.', k: 'r', cls: 'ta-c' }],
      porVeic.slice(0, 10).map((e, i) => {
        const v = DB.veiculo(e.chave) || {};
        return {
          _cls: 'clickable', _attr: ` data-veic="${Fmt.esc(e.chave)}"`,
          p: `<span class="dim">${i + 1}</span>`, v: `<span class="strong">${Fmt.esc(v.nome)}</span>`,
          f: `<span class="mono">${Fmt.esc(v.frota)}</span>`, pl: `<span class="mono">${Fmt.esc(v.placa)}</span>`,
          n: Fmt.num(e.qtd), t: `<span class="strong">${Fmt.money(e.valor)}</span>`,
          r: recPorVeic[e.chave] ? `<span class="badge b-amber">${recPorVeic[e.chave]}</span>` : '<span class="dim">—</span>'
        };
      }), { vazioT: 'Sem dados', vazioM: 'Nenhuma OS no período.' }), '', true);

    const rankRec = UI.card('Veículos com mais reincidências', UI.tabela(
      [{ t: '#', k: 'p' }, { t: 'Veículo', k: 'v' }, { t: 'Placa', k: 'pl' }, { t: 'Sistemas recorrentes', k: 'g' },
      { t: 'Ocorrências', k: 'n', cls: 'ta-r' }, { t: 'Custo somado', k: 't', cls: 'ta-r' }],
      Object.entries(recPorVeic).sort((a, c) => c[1] - a[1]).slice(0, 10).map(([vid, n], i) => {
        const v = DB.veiculo(vid) || {};
        const gs = [...new Set(rec.filter(r => r.os.veiculoId === vid).flatMap(r => r.anterior.grupos))];
        const custo = rec.filter(r => r.os.veiculoId === vid).reduce((s, r) => s + r.os.total, 0);
        return {
          _cls: 'clickable', _attr: ` data-veic="${Fmt.esc(vid)}"`,
          p: `<span class="dim">${i + 1}</span>`, v: `<span class="strong">${Fmt.esc(v.nome)}</span>`,
          pl: `<span class="mono">${Fmt.esc(v.placa)}</span>`,
          g: gs.map(g => `<span class="badge b-amber">${Fmt.esc(Rec.nomeGrupo(g))}</span>`).join(' '),
          n: `<strong>${n}</strong>`, t: Fmt.money(custo)
        };
      }), { vazioT: 'Nenhuma reincidência', vazioM: 'Nenhum veículo voltou pelo mesmo sistema no período — bom sinal.' }), '', true);

    return kpis + boxAlertas + `<div class="grid g2" style="margin-top:var(--s4)">${gEvolucao}${gServicos}</div>` +
      `<div class="grid g2" style="margin-top:var(--s4)">${gVeiculos}${gMecanicos}</div>` +
      `<div class="stack" style="margin-top:var(--s4)">${rankCusto}${rankRec}</div>`;
  }

  function ligar() {
    const pintar = () => {
      const el = document.getElementById('painel');
      el.innerHTML = conteudo();
      Chart.ligarTooltips(el);
      el.querySelectorAll('[data-veic]').forEach(x => x.addEventListener('click', () => App.irPara('veiculo/' + x.dataset.veic)));
    };
    Filtros.ligar(pintar); pintar();
    document.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => App.irPara(b.dataset.ir)));
  }

  return { pagina, totalReincidencias, alertas };
})();

/* ============================================================ REINCIDÊNCIAS */
const Reincidencias = (() => {
  function pagina() {
    App.aoRenderizar = ligar;
    App.acoesTopo('');
    return `<div class="stack">
      ${Filtros.barra(['periodo', 'local', 'veiculo', 'grupo'])}
      <div id="rec"></div></div>`;
  }
  function conteudo() {
    const b = DB.get();
    const os = Q.filtrar(Estado.filtros);
    const rec = Q.reincidencias(os, b.ordens);
    const janela = DB.cfg().janelaReincidencia;
    const porVeic = {};
    rec.forEach(r => (porVeic[r.os.veiculoId] = porVeic[r.os.veiculoId] || []).push(r));
    const porGrupo = {};
    rec.forEach(r => r.anterior.grupos.forEach(g => porGrupo[g] = (porGrupo[g] || 0) + 1));

    const linhas = rec.sort((a, c) => (c.os.data || '').localeCompare(a.os.data || '')).map(r => {
      const v = DB.veiculo(r.os.veiculoId) || {};
      const dkm = (r.os.kmH != null && r.anterior.os.kmH != null)
        ? Fmt.num(Math.max(0, r.os.kmH - r.anterior.os.kmH)) + (v.unidade === 'H' ? ' h' : ' km') : '—';
      return {
        _cls: 'clickable', _attr: ` data-os="${r.os.id}"`,
        v: `<div class="strong">${Fmt.esc(v.nome)}</div><div class="dim" style="font-size:11.5px">${Fmt.esc(v.placa)} · Frota ${Fmt.esc(v.frota)}</div>`,
        g: r.anterior.grupos.map(g => `<span class="badge b-amber">${Fmt.esc(Rec.nomeGrupo(g))}</span>`).join(' '),
        d1: `<span class="nowrap">${Fmt.date(r.anterior.os.data)}</span><div class="dim" style="font-size:11.5px">OS ${r.anterior.os.numero}</div>`,
        s1: `<span class="dim">${Fmt.esc(r.anterior.os.itens.map(i => i.descricao).join(' · '))}</span>`,
        d2: `<span class="nowrap">${Fmt.date(r.os.data)}</span><div class="dim" style="font-size:11.5px">OS ${r.os.numero}</div>`,
        s2: `<span class="dim">${Fmt.esc(r.os.itens.map(i => i.descricao).join(' · '))}</span>`,
        i: `<strong class="nowrap">${r.anterior.dias} dias</strong><div class="dim">${dkm}</div>`,
        t: `<span class="strong nowrap">${Fmt.money(r.os.total + r.anterior.os.total)}</span>`,
      };
    });

    return `<div class="grid kpis">
        ${UI.kpi('Reincidências no período', Fmt.num(rec.length), 'janela de ' + janela + ' dias', rec.length > 0)}
        ${UI.kpi('Veículos afetados', Fmt.num(Object.keys(porVeic).length))}
        ${UI.kpi('Custo envolvido', Fmt.money0(rec.reduce((s, r) => s + r.os.total + r.anterior.os.total, 0)))}
        ${UI.kpi('Intervalo médio', rec.length ? Fmt.num(rec.reduce((s, r) => s + r.anterior.dias, 0) / rec.length) + ' dias' : '—')}
      </div>
      <div class="grid g2" style="margin-top:var(--s4)">
        ${UI.card('Sistemas que mais reincidem', Chart.barsH(Object.entries(porGrupo).sort((a, c) => c[1] - a[1]).map(([g, n]) => ({
      rotulo: Rec.nomeGrupo(g), valor: n, destaque: true,
      tip: `<strong>${Fmt.esc(Rec.nomeGrupo(g))}</strong><br>${n} reincidência(s)`
    })), { fmt: Fmt.num, aria: 'Sistemas com mais reincidências' }))}
        ${UI.card('Veículos que mais voltaram', Chart.barsH(Object.entries(porVeic).sort((a, c) => c[1].length - a[1].length).slice(0, 8).map(([vid, l]) => {
      const v = DB.veiculo(vid) || {};
      return { rotulo: v.nome + ' ' + v.placa, valor: l.length, destaque: true, tip: `<strong>${Fmt.esc(v.nome)}</strong><br>${l.length} reincidência(s)` };
    }), { fmt: Fmt.num, aria: 'Veículos com mais reincidências' }))}
      </div>
      <div style="margin-top:var(--s4)">${UI.card('', UI.tabela(
      [{ t: 'Veículo', k: 'v' }, { t: 'Sistema', k: 'g' }, { t: 'Ocorrência anterior', k: 'd1' }, { t: 'Serviço anterior', k: 's1' },
      { t: 'Ocorrência atual', k: 'd2' }, { t: 'Serviço atual', k: 's2' }, { t: 'Intervalo', k: 'i', cls: 'ta-r' }, { t: 'Valor gasto', k: 't', cls: 'ta-r' }],
      linhas, { vazioT: 'Nenhuma reincidência no período', vazioM: 'Nenhum veículo retornou pelo mesmo sistema dentro da janela de ' + janela + ' dias.' }), '', true)}</div>`;
  }
  function ligar() {
    const pintar = () => {
      const el = document.getElementById('rec');
      el.innerHTML = conteudo(); Chart.ligarTooltips(el);
      el.querySelectorAll('[data-os]').forEach(x => x.addEventListener('click', () => App.irPara('ordens/' + x.dataset.os)));
    };
    Filtros.ligar(pintar); pintar();
  }
  return { pagina };
})();
