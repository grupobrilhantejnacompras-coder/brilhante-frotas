/* ============================================================
   FILTROS — barra reutilizável (dashboard, OS, relatórios)
   ============================================================ */
const Filtros = (() => {
  function barra(campos, extra) {
    const f = Estado.filtros, b = DB.get();
    const bloco = (id, html) => campos.includes(id) ? html : '';
    return `<section class="card no-print"><div class="card-b"><div class="row" id="barra-filtros">
      ${bloco('periodo', `<select class="input" id="f-periodo" style="max-width:158px" aria-label="Período">
        ${UI.opcoes(Periodo.opcoes.map(o => ({ v: o.id, t: o.nome })), f.periodo)}</select>
        <span id="wrap-custom" class="row ${f.periodo === 'custom' ? '' : 'hide'}" style="gap:6px">
          <input class="input" type="date" id="f-de" value="${f.de}" style="max-width:160px" aria-label="Data inicial">
          <span class="dim">até</span>
          <input class="input" type="date" id="f-ate" value="${f.ate}" style="max-width:160px" aria-label="Data final"></span>`)}
      ${bloco('local', `<select class="input" id="f-local" style="max-width:150px" aria-label="Local">${UI.opcoes(b.locais, f.local, 'Todos os locais')}</select>`)}
      ${bloco('veiculo', `<select class="input" id="f-veiculo" style="max-width:186px" aria-label="Veículo"><option value="">Todos os veículos</option>${optsVeiculos(f.veiculo)}</select>`)}
      ${bloco('frota', `<select class="input" id="f-frota" style="max-width:140px" aria-label="Frota">${UI.opcoes([...new Set(b.veiculos.map(v => v.frota).filter(x => x && x !== '—'))].sort(), f.frota, 'Todas as frotas')}</select>`)}
      ${bloco('mecanico', `<select class="input" id="f-mecanico" style="max-width:158px" aria-label="Mecânico">${UI.opcoes(b.mecanicos, f.mecanico, 'Todos os mecânicos')}</select>`)}
      ${bloco('grupo', `<select class="input" id="f-grupo" style="max-width:170px" aria-label="Tipo de serviço">${UI.opcoes(Rec.GRUPOS.map(g => ({ v: g.id, t: g.nome })), f.grupo, 'Todos os serviços')}</select>`)}
      ${bloco('status', `<select class="input" id="f-status" style="max-width:150px" aria-label="Situação">${UI.opcoes(['Concluída', 'Aberta', 'Em andamento', 'Cancelada'], f.status, 'Todas as situações')}</select>`)}
      ${bloco('busca', `<input class="input" id="f-busca" placeholder="Buscar…" style="max-width:200px" value="${Fmt.esc(f.busca)}" aria-label="Buscar">`)}
      <div class="spacer"></div>
      <button class="btn ghost sm" id="f-limpar">Limpar filtros</button>
      ${extra || ''}
    </div></div></section>`;
  }

  function ligar(aoMudar) {
    const f = Estado.filtros;
    const liga = (id, chave, ev) => {
      const el = document.getElementById('f-' + id); if (!el) return;
      el.addEventListener(ev || 'change', e => {
        f[chave] = e.target.value;
        if (chave === 'periodo') {
          const w = document.getElementById('wrap-custom');
          if (w) w.classList.toggle('hide', e.target.value !== 'custom');
          if (e.target.value === 'custom' && !f.de) {
            f.de = Dt.add(Dt.today(), -30); f.ate = Dt.today();
            document.getElementById('f-de').value = f.de; document.getElementById('f-ate').value = f.ate;
          }
        }
        aoMudar();
      });
    };
    liga('periodo', 'periodo'); liga('de', 'de'); liga('ate', 'ate');
    liga('local', 'local'); liga('veiculo', 'veiculo'); liga('frota', 'frota');
    liga('mecanico', 'mecanico'); liga('grupo', 'grupo'); liga('status', 'status');
    liga('busca', 'busca', 'input');
    const l = document.getElementById('f-limpar');
    if (l) l.addEventListener('click', () => {
      Object.assign(f, { periodo: 'tudo', de: '', ate: '', local: '', veiculo: '', frota: '', mecanico: '', grupo: '', status: '', busca: '' });
      App.render();
    });
  }

  function resumo() {
    const f = Estado.filtros;
    const p = Periodo.opcoes.find(o => o.id === f.periodo);
    const partes = [p ? p.nome : ''];
    if (f.periodo === 'custom') partes[0] = Fmt.date(f.de) + ' a ' + Fmt.date(f.ate);
    if (f.local) partes.push(f.local);
    if (f.veiculo) partes.push(DB.nomeVeiculo(f.veiculo));
    if (f.mecanico) partes.push(f.mecanico);
    if (f.grupo) partes.push(Rec.nomeGrupo(f.grupo));
    return partes.filter(Boolean).join(' · ');
  }
  return { barra, ligar, resumo };
})();
