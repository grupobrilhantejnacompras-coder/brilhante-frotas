/* ============================================================
   PÁGINAS — Nova OS, consulta de OS, serviços e veículos
   ============================================================ */

/* ---------- helpers de formulário ---------- */
function optsVeiculos(sel) {
  const porTipo = {};
  DB.get().veiculos.forEach(v => (porTipo[v.tipo] = porTipo[v.tipo] || []).push(v));
  return Object.keys(porTipo).sort().map(t =>
    `<optgroup label="${Fmt.esc(t)}">` + porTipo[t].sort((a, b) => a.nome.localeCompare(b.nome)).map(v =>
      `<option value="${Fmt.esc(v.id)}"${v.id === sel ? ' selected' : ''}>${Fmt.esc(v.nome)}${v.placa !== '—' ? ' · ' + v.placa : ''}</option>`
    ).join('') + '</optgroup>').join('');
}
function datalist(id, itens) {
  return `<datalist id="${id}">${itens.map(i => `<option value="${Fmt.esc(i)}"></option>`).join('')}</datalist>`;
}

/* Rótulos únicos para o campo de veículo — permite digitar nome, placa ou frota. */
const Veic = (() => {
  const chave = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  function rotulo(v) {
    let r = v.nome;
    if (v.placa && v.placa !== '—') r += ' · ' + v.placa;
    if (v.frota && v.frota !== '—') r += ' · Frota ' + v.frota;
    return r;
  }
  /** [{id, rotulo}] com rótulos garantidamente únicos. */
  function lista() {
    const usados = new Map();
    return DB.get().veiculos
      .slice().sort((a, b) => a.nome.localeCompare(b.nome))
      .map(v => {
        let r = rotulo(v);
        const n = (usados.get(r) || 0) + 1;
        usados.set(r, n);
        if (n > 1) r += ' (' + n + ')';
        return { id: v.id, rotulo: r, v };
      });
  }
  /** Resolve o que foi digitado para um veículo: rótulo, placa, frota ou nome. */
  function resolver(texto) {
    const t = chave(texto);
    if (!t) return null;
    const L = lista();
    let m = L.find(x => chave(x.rotulo) === t);
    if (m) return m.v;
    m = L.find(x => chave(x.v.placa) === t && x.v.placa !== '—');
    if (m) return m.v;
    m = L.find(x => chave(x.v.frota) === t && x.v.frota !== '—');
    if (m) return m.v;
    const parciais = L.filter(x => chave(x.rotulo).includes(t));
    return parciais.length === 1 ? parciais[0].v : null;
  }
  const rotuloDe = id => { const m = lista().find(x => x.id === id); return m ? m.rotulo : ''; };
  const opcoes = () => `<datalist id="dl-veiculos">${lista().map(x =>
    `<option value="${Fmt.esc(x.rotulo)}"></option>`).join('')}</datalist>`;
  return { lista, resolver, rotulo, rotuloDe, opcoes };
})();
/* Catálogo de serviços para digitação livre no lançamento da OS. */
const Serv = (() => {
  const chave = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  const ativos = () => DB.get().servicos.filter(s => s.status !== 'Inativo');
  /** Só casa descrição exata (ou escolhida na lista) — não adivinha enquanto digita. */
  function resolver(texto) {
    const t = chave(texto);
    if (!t) return null;
    return ativos().find(s => chave(s.descricao) === t) || null;
  }
  const opcoes = () => `<datalist id="dl-servicos">` +
    ativos().slice().sort((a, b) => a.descricao.localeCompare(b.descricao)).map(s =>
      `<option value="${Fmt.esc(s.descricao)}" label="${Fmt.esc(Fmt.money0(s.valor) + ' · ' + s.categoria)}"></option>`).join('') +
    `</datalist>`;
  return { resolver, opcoes, ativos };
})();

/* ============================================================ NOVA OS */
const Nova = (() => {
  let os = null;

  function limpar(base) {
    os = base || {
      id: '', numero: DB.proximoNumero(), data: Dt.today(), local: '', condutor: '', veiculoId: '',
      placa: '', frota: '', kmH: null, unidade: 'KM', mecanico: '', setor: 'Mecânica',
      itens: [linhaVazia()], obs: '', status: 'Concluída', total: 0, origem: 'sistema'
    };
    if (!os.itens.length) os.itens.push(linhaVazia());
    return os;
  }
  const linhaVazia = () => ({ qtd: 1, servicoCod: '', descricao: '', valorUnit: 0, total: 0 });

  function pagina(params) {
    const b = DB.get();
    if (params && params.id) {
      const orig = b.ordens.find(o => o.id === params.id);
      limpar(orig ? JSON.parse(JSON.stringify(orig)) : null);
    } else limpar();
    App.aoRenderizar = ligar;
    App.acoesTopo(`<span class="badge b-blue">OS Nº ${os.numero}</span>`);

    return `<form id="form-os" class="stack" autocomplete="off">
      ${UI.card('Identificação', `
        <div class="form-grid">
          <div class="field"><label for="f-data">Data</label>
            <input class="input" type="date" id="f-data" value="${os.data}" required></div>
          <div class="field"><label for="f-local">Local do serviço</label>
            <input class="input" id="f-local" list="dl-locais" placeholder="Oficina, fazenda, filial…" value="${Fmt.esc(os.local)}" required>
            ${datalist('dl-locais', b.locais)}</div>
          <div class="field"><label for="f-condutor">Condutor</label>
            <input class="input" id="f-condutor" list="dl-cond" placeholder="Nome do condutor" value="${Fmt.esc(os.condutor)}">
            ${datalist('dl-cond', b.condutores)}</div>
          <div class="field"><label for="f-mec">Mecânico responsável</label>
            <input class="input" id="f-mec" list="dl-mec" placeholder="Quem executou" value="${Fmt.esc(os.mecanico)}" required>
            ${datalist('dl-mec', b.mecanicos)}</div>
        </div>`)}

      ${UI.card('Veículo', `
        <div class="form-grid">
          <div class="field" style="grid-column:1/-1;min-width:240px"><label for="f-veic">Veículo</label>
            <div class="veic-row">
              <input class="input" id="f-veic" list="dl-veiculos" autocomplete="off"
                placeholder="Nome, placa ou nº da frota…" value="${Fmt.esc(Veic.rotuloDe(os.veiculoId))}">
              ${Perm.pode('veiculos.editar') ? '<button type="button" class="btn ghost nowrap" id="novo-veic">+ Cadastrar veículo</button>' : ''}
            </div>${Veic.opcoes()}
            <div class="dim" id="veic-ajuda" style="font-size:11.5px;margin-top:5px"></div></div>
          <div class="field"><label for="f-placa">Placa</label>
            <input class="input" id="f-placa" value="${Fmt.esc(os.placa)}" readonly></div>
          <div class="field"><label for="f-frota">Frota</label>
            <input class="input" id="f-frota" value="${Fmt.esc(os.frota)}" readonly></div>
          <div class="field"><label for="f-km" id="lab-km">KM / Horímetro</label>
            <input class="input" type="number" step="0.1" min="0" id="f-km" placeholder="Leitura atual" value="${os.kmH == null ? '' : os.kmH}">
            <div class="k-sub dim" id="km-ajuda" style="font-size:11.5px;margin-top:5px"></div></div>
        </div>`)}

      <div id="box-reinc"></div>

      ${UI.card('Serviços executados', `<div id="itens"></div>${Serv.opcoes()}
        <div class="row" style="margin-top:var(--s3)">
          <button type="button" class="btn ghost sm" id="add-item">+ Adicionar serviço</button>
          <span class="dim" style="font-size:11.5px">O valor vem do catálogo. Serviço novo pode ser cadastrado na hora.</span>
        </div>`, '', true)}

      <div class="total-bar" id="total-bar"></div>

      ${UI.card('Observações', `
        <textarea class="input" id="f-obs" placeholder="Problema encontrado, causa provável, peça substituída, teste realizado, pendências…">${Fmt.esc(os.obs)}</textarea>`)}

      <div class="row no-print">
        <div class="field" style="margin:0"><label for="f-status" class="sr">Situação</label>
          <select class="input" id="f-status">${UI.opcoes(['Concluída', 'Aberta', 'Em andamento', 'Cancelada'], os.status)}</select></div>
        <div class="spacer"></div>
        <button type="button" class="btn ghost" id="btn-cancelar">Cancelar</button>
        <button type="submit" class="btn">Salvar ordem de serviço</button>
      </div>
    </form>`;
  }

  function htmlItens() {
    return `<div class="tw"><table class="itens-tbl"><thead><tr>
      <th>Qtd</th><th>Descrição do serviço</th><th class="ta-r" style="width:130px">Valor unitário</th>
      <th class="ta-r" style="width:130px">Valor total</th><th style="width:40px"></th></tr></thead><tbody>` +
      os.itens.map((it, i) => `<tr data-i="${i}">
        <td data-l="Qtd"><input type="number" min="1" step="1" value="${it.qtd}" data-c="qtd" aria-label="Quantidade"></td>
        <td class="serv" data-l="Serviço">
          <input data-c="descricao" list="dl-servicos" autocomplete="off"
            placeholder="Digite o serviço ou escolha da lista" value="${Fmt.esc(it.descricao)}" aria-label="Serviço executado">
          <div class="serv-ajuda" data-ajuda="${i}"></div>
        </td>
        <td class="ta-r" data-l="Valor unit."><input type="number" min="0" step="0.01" value="${it.valorUnit || ''}" data-c="valorUnit" aria-label="Valor unitário"></td>
        <td class="ta-r strong" data-l="Total"><span class="mono" data-tot>${Fmt.money(it.total)}</span></td>
        <td class="act"><button type="button" class="rm-btn" data-rm="${i}" aria-label="Remover serviço">✕</button></td>
      </tr>`).join('') + '</tbody></table></div>';
  }

  function recalcular() {
    os.itens.forEach(it => { it.total = Math.round((it.qtd || 0) * (it.valorUnit || 0) * 100) / 100; });
    os.total = Math.round(os.itens.reduce((s, i) => s + i.total, 0) * 100) / 100;
    document.querySelectorAll('#itens tbody tr').forEach(tr => {
      const i = +tr.dataset.i, el = tr.querySelector('[data-tot]');
      if (el) el.textContent = Fmt.money(os.itens[i].total);
    });
    const n = os.itens.filter(i => i.descricao || i.servicoCod).length;
    const q = os.itens.reduce((s, i) => s + (i.qtd || 0), 0);
    document.getElementById('total-bar').innerHTML =
      `<div><div class="lab">Valor total da ordem de serviço</div><div class="val">${Fmt.money(os.total)}</div></div>
       <div class="sub">${n} ${n === 1 ? 'serviço lançado' : 'serviços lançados'} · ${Fmt.num(q)} ${q === 1 ? 'item' : 'itens'}</div>`;
  }

  function checarReincidencia() {
    const box = document.getElementById('box-reinc');
    if (!box) return;
    if (!os.veiculoId || !os.data) { box.innerHTML = ''; return; }
    const provisoria = Object.assign({}, os, { id: os.id || '__nova', numero: os.numero });
    const ant = Rec.anteriores(provisoria, DB.get().ordens, DB.cfg().janelaReincidencia);
    if (!ant.length) { box.innerHTML = ''; return; }
    const v = DB.veiculo(os.veiculoId);
    const linhas = ant.slice(0, 4).map(a => {
      const dkm = (os.kmH != null && a.os.kmH != null) ? Fmt.num(Math.max(0, os.kmH - a.os.kmH)) + (v.unidade === 'H' ? ' h' : ' km') : '—';
      return `<tr><td class="nowrap">${Fmt.date(a.os.data)}</td>
        <td>${a.grupos.map(g => `<span class="badge b-amber">${Fmt.esc(Rec.nomeGrupo(g))}</span>`).join(' ')}</td>
        <td>${Fmt.esc(a.os.itens.map(i => i.descricao).join(' · '))}</td>
        <td class="nowrap">${Fmt.esc(a.os.mecanico)}</td>
        <td class="ta-r nowrap">${Fmt.money(a.os.total)}</td>
        <td class="ta-r nowrap"><strong>${a.dias} dias</strong><br><span class="dim">${dkm}</span></td></tr>`;
    }).join('');
    box.innerHTML = `<div class="alert-box"><span class="ic">⚠️</span><div style="flex:1;min-width:0">
      <h3>Possível reincidência</h3>
      <p style="margin-bottom:10px">Este veículo já esteve na oficina pelo mesmo sistema nos últimos ${DB.cfg().janelaReincidencia} dias.
      Confira o histórico antes de fechar a OS.</p>
      <div class="tw" style="background:#fff;border-radius:8px"><table>
        <thead><tr><th>Data</th><th>Sistema</th><th>Serviço realizado</th><th>Mecânico</th><th class="ta-r">Valor</th><th class="ta-r">Intervalo</th></tr></thead>
        <tbody>${linhas}</tbody></table></div>
      <div style="margin-top:10px"><button type="button" class="btn ghost sm" data-hist="${Fmt.esc(os.veiculoId)}">Ver histórico completo</button></div>
    </div></div>`;
    box.querySelector('[data-hist]').addEventListener('click', () => App.irPara('veiculo/' + os.veiculoId));
  }

  /** Aviso abaixo do serviço: do catálogo, ou atalho para cadastrar. */
  function ajudaItem(i) {
    const el = document.querySelector(`[data-ajuda="${i}"]`);
    if (!el) return;
    const it = os.itens[i];
    if (!it || !(it.descricao || '').trim()) { el.innerHTML = ''; return; }
    const s = it.servicoCod ? DB.servico(it.servicoCod) : null;
    if (s) {
      el.innerHTML = `<span class="badge b-green">Catálogo</span> <span class="dim">${Fmt.esc(s.categoria)} · ${Fmt.money(s.valor)}</span>`;
      return;
    }
    el.innerHTML = `<span class="dim">Serviço fora do catálogo.</span>` +
      (Perm.pode('servicos.editar') ? ` <button type="button" class="link-cad" data-cad="${i}">Cadastrar este serviço</button>` : '');
    // mousedown: o blur do campo não apaga o aviso antes do clique
    const bc = el.querySelector('[data-cad]');
    if (bc) bc.addEventListener('mousedown', ev => { ev.preventDefault(); cadastrarServico(i); });
  }

  function cadastrarServico(i) {
    const it = os.itens[i];
    Servicos.novo(it.descricao, it.valorUnit, s => {
      it.servicoCod = s.codigo; it.descricao = s.descricao; it.valorUnit = s.valor;
      const dl = document.getElementById('dl-servicos');
      if (dl) dl.outerHTML = Serv.opcoes();
      const tr = document.querySelector(`#itens tr[data-i="${i}"]`);
      if (tr) {
        tr.querySelector('input[data-c=descricao]').value = s.descricao;
        tr.querySelector('input[data-c=valorUnit]').value = s.valor;
      }
      ajudaItem(i); recalcular(); checarReincidencia();
      UI.toast('Serviço cadastrado no catálogo.', 'ok');
    });
  }

  function ligarItens() {
    const cont = document.getElementById('itens');
    cont.innerHTML = htmlItens();
    cont.querySelectorAll('tr[data-i]').forEach(tr => {
      const i = +tr.dataset.i;
      tr.querySelectorAll('[data-c]').forEach(el => {
        el.addEventListener('input', () => {
          const c = el.dataset.c;
          if (c === 'qtd') os.itens[i].qtd = Math.max(1, +el.value || 1);
          else if (c === 'valorUnit') os.itens[i].valorUnit = +el.value || 0;
          else if (c === 'descricao') {
            const it = os.itens[i];
            it.descricao = el.value;
            const s = Serv.resolver(el.value);
            if (s) {
              if (s.codigo !== it.servicoCod) {         // trocou de serviço: puxa o valor do catálogo
                it.servicoCod = s.codigo; it.valorUnit = s.valor;
                const vu = tr.querySelector('input[data-c=valorUnit]');
                if (vu) vu.value = s.valor;
              }
            } else it.servicoCod = '';
            ajudaItem(i);
          }
          recalcular();
          if (c === 'descricao') checarReincidencia();
        });
      });
      ajudaItem(i);
      const rm = tr.querySelector('[data-rm]');
      if (rm) rm.addEventListener('click', () => {
        os.itens.splice(i, 1);
        if (!os.itens.length) os.itens.push(linhaVazia());
        ligarItens(); recalcular(); checarReincidencia();
      });
    });
    recalcular();
  }

  function ligar() {
    const $ = id => document.getElementById(id);
    ligarItens();
    $('add-item').addEventListener('click', () => { os.itens.push(linhaVazia()); ligarItens(); });

    /* Local e condutor seguem o veículo enquanto o mecânico não os alterar à mão. */
    let localAuto = !os.local, condutorAuto = !os.condutor;
    /* aplica o veículo escolhido (digitado, selecionado na lista ou recém-cadastrado) */
    function aplicarVeiculo(v, digitado) {
      os.veiculoId = v ? v.id : '';
      $('f-placa').value = v ? v.placa : '';
      $('f-frota').value = v ? v.frota : '';
      os.placa = v ? v.placa : ''; os.frota = v ? v.frota : '';
      os.unidade = v ? v.unidade : 'KM';
      $('lab-km').textContent = os.unidade === 'H' ? 'Horímetro (h)' : 'Quilometragem (km)';
      $('km-ajuda').textContent = v && v.kmAtual != null
        ? 'Última leitura registrada: ' + Fmt.kmh(v.kmAtual, v.unidade) + (v.kmAtualData ? ' em ' + Fmt.date(v.kmAtualData) : '')
        : v ? 'Nenhuma leitura anterior registrada.' : '';
      const ajuda = $('veic-ajuda');
      if (v) {
        ajuda.innerHTML = `<span class="badge b-green">${Fmt.esc(v.tipo)}</span> ${Fmt.esc(v.nome)} — ` +
          `${v.placa !== '—' ? 'placa ' + Fmt.esc(v.placa) : 'sem placa cadastrada'}` +
          `${v.frota !== '—' ? ' · frota ' + Fmt.esc(v.frota) : ''}`;
        if (v.local && (localAuto || !os.local)) { $('f-local').value = v.local; os.local = v.local; localAuto = true; }
        if (v.condutor && (condutorAuto || !os.condutor)) { $('f-condutor').value = v.condutor; os.condutor = v.condutor; condutorAuto = true; }
      } else if (digitado) {
        ajuda.innerHTML = `Nenhum veículo encontrado com “${Fmt.esc(digitado)}”.` +
          (Perm.pode('veiculos.editar') ? ` <button type="button" class="link-cad" id="cad-rapido">Cadastrar este veículo</button>` : '');
        const bt = document.getElementById('cad-rapido');
        // mousedown: o blur do campo não chega a redesenhar este aviso antes do clique
        if (bt) bt.addEventListener('mousedown', ev => { ev.preventDefault(); abrirCadastro(digitado); });
      } else ajuda.textContent = '';
      checarReincidencia();
    }
    function abrirCadastro(texto) {
      Veiculos.novo(texto, v => {
        document.getElementById('dl-veiculos').outerHTML = Veic.opcoes();
        $('f-veic').value = Veic.rotuloDe(v.id);
        ultimoTexto = $('f-veic').value;
        aplicarVeiculo(v);
        UI.toast('Veículo cadastrado e selecionado.', 'ok');
      });
    }
    let ultimoTexto = null;
    const buscarVeiculo = forcar => {
      const t = $('f-veic').value.trim();
      if (!forcar && t === ultimoTexto) return;   // evita redesenhar o aviso a cada blur
      ultimoTexto = t;
      aplicarVeiculo(t ? Veic.resolver(t) : null, t);
    };
    $('f-veic').addEventListener('change', () => buscarVeiculo());
    $('f-veic').addEventListener('input', () => { if (Veic.resolver($('f-veic').value.trim())) buscarVeiculo(); });
    $('f-veic').addEventListener('blur', () => buscarVeiculo());
    if ($('novo-veic')) $('novo-veic').addEventListener('mousedown', ev => { ev.preventDefault(); abrirCadastro($('f-veic').value.trim()); });
    ['data', 'local', 'condutor', 'mec', 'obs', 'status'].forEach(k => {
      const map = { data: 'data', local: 'local', condutor: 'condutor', mec: 'mecanico', obs: 'obs', status: 'status' };
      $('f-' + k).addEventListener('input', e => {
        os[map[k]] = e.target.value;
        if (k === 'local') localAuto = false;
        if (k === 'condutor') condutorAuto = false;
        if (k === 'data') checarReincidencia();
      });
      $('f-' + k).addEventListener('change', e => { os[map[k]] = e.target.value; });
    });
    $('f-km').addEventListener('input', e => { os.kmH = e.target.value === '' ? null : +e.target.value; });
    $('btn-cancelar').addEventListener('click', () => App.irPara('ordens'));

    if (os.veiculoId) $('f-veic').dispatchEvent(new Event('change'));

    $('form-os').addEventListener('submit', e => {
      e.preventDefault();
      if (!os.veiculoId) {
        UI.toast('Escolha o veículo — digite o nome, a placa ou cadastre um novo.', 'warn');
        $('f-veic').focus(); return;
      }
      os.itens = os.itens.filter(i => (i.descricao || '').trim() && i.total >= 0);
      if (!os.itens.length) { UI.toast('Lance ao menos um serviço antes de salvar.', 'warn'); os.itens = [linhaVazia()]; ligarItens(); return; }
      const v = DB.veiculo(os.veiculoId);
      os.setor = os.itens.some(i => /ar.?cond|g[áa]s|compressor/i.test(i.descricao)) ? 'Ar Condicionado'
        : os.itens.some(i => /molejo|mola|estirante|quinta roda/i.test(i.descricao)) ? 'Posto de Mola' : 'Mecânica';
      os.unidade = v ? v.unidade : 'KM';
      const salva = DB.salvarOS(os);
      UI.toast('OS Nº ' + salva.numero + ' salva — ' + Fmt.money(salva.total), 'ok');
      App.irPara('ordens/' + salva.id);
    });
  }
  return { pagina };
})();

/* ============================================================ CONSULTA DE OS */
const Ordens = (() => {
  let ord = { campo: 'data', dir: -1 };

  function pagina(params) {
    if (params && params.id) return detalhe(params.id);
    App.aoRenderizar = ligar;
    App.acoesTopo(Perm.pode('os.criar') ? `<button class="btn" data-rota="nova-os">+ Nova OS</button>` : '');
    return `<div class="stack">
      ${Filtros.barra(['periodo', 'local', 'veiculo', 'mecanico', 'grupo', 'status', 'busca'])}
      <div id="lista-os"></div></div>`;
  }

  function lista() {
    const os = Q.filtrar(Estado.filtros);
    const reinc = new Set(Q.reincidencias(os).map(r => r.os.id));
    const c = ord.campo, d = ord.dir;
    const ordenadas = [...os].sort((a, b) => {
      let x = a[c], y = b[c];
      if (c === 'veiculo') { x = DB.nomeVeiculo(a.veiculoId); y = DB.nomeVeiculo(b.veiculoId); }
      if (x == null) x = ''; if (y == null) y = '';
      return (x > y ? 1 : x < y ? -1 : 0) * d;
    });
    const linhas = ordenadas.map(o => ({
      _cls: 'clickable', _attr: ` data-os="${o.id}"`,
      n: `<strong>${o.numero}</strong>${reinc.has(o.id) ? ' <span class="badge b-amber" title="Reincidência">⚠</span>' : ''}`,
      data: `<span class="nowrap">${Fmt.date(o.data)}</span>`,
      veic: `<div class="strong">${Fmt.esc(DB.nomeVeiculo(o.veiculoId))}</div><div class="dim" style="font-size:11.5px">${Fmt.esc(o.placa)} · Frota ${Fmt.esc(o.frota)}</div>`,
      local: Fmt.esc(o.local || '—'),
      cond: Fmt.esc(o.condutor || '—'),
      mec: Fmt.esc(o.mecanico || '—'),
      serv: `<span class="dim">${o.itens.length} ${o.itens.length === 1 ? 'serviço' : 'serviços'}</span>`,
      total: `<span class="strong nowrap">${Fmt.money(o.total)}</span>`,
      st: UI.badgeStatus(o.status),
    }));
    const cols = [
      { t: 'Nº', k: 'n' }, { t: 'Data', k: 'data', s: 'data' }, { t: 'Veículo / placa / frota', k: 'veic', s: 'veiculo' },
      { t: 'Local', k: 'local', s: 'local' }, { t: 'Condutor', k: 'cond' }, { t: 'Mecânico', k: 'mec', s: 'mecanico' },
      { t: 'Serviços', k: 'serv' }, { t: 'Total', k: 'total', cls: 'ta-r', s: 'total' }, { t: 'Situação', k: 'st' },
    ];
    const cabec = cols.map(c => `<th class="${c.cls || ''}${c.s ? ' sortable' : ''}"${c.s ? ` data-ord="${c.s}"` : ''}>${c.t}${ord.campo === c.s ? (d > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('');
    const corpo = linhas.length
      ? `<div class="tw"><table><thead><tr>${cabec}</tr></thead><tbody>` +
      linhas.map(l => `<tr class="${l._cls}"${l._attr}>` + cols.map(c => `<td class="${c.cls || ''}">${l[c.k]}</td>`).join('') + '</tr>').join('') +
      `<tr class="tot-row"><td colspan="7">${os.length} ordens de serviço</td><td class="ta-r">${Fmt.money(Q.soma(os))}</td><td></td></tr>` +
      '</tbody></table></div>'
      : UI.vazio('Nenhuma OS encontrada', 'Nenhuma ordem de serviço corresponde aos filtros selecionados.',
        '<button class="btn sm" data-rota="nova-os">Registrar nova OS</button>');
    return UI.card('', corpo, '', true);
  }

  function ligar() {
    Filtros.ligar(() => { document.getElementById('lista-os').innerHTML = lista(); ligarLista(); });
    document.getElementById('lista-os').innerHTML = lista();
    ligarLista();
  }
  function ligarLista() {
    document.querySelectorAll('[data-os]').forEach(tr =>
      tr.addEventListener('click', () => App.irPara('ordens/' + tr.dataset.os)));
    document.querySelectorAll('[data-ord]').forEach(th =>
      th.addEventListener('click', () => {
        const c = th.dataset.ord;
        ord = { campo: c, dir: ord.campo === c ? -ord.dir : -1 };
        document.getElementById('lista-os').innerHTML = lista(); ligarLista();
      }));
    document.querySelectorAll('[data-rota]').forEach(b => b.addEventListener('click', () => App.irPara(b.dataset.rota)));
  }

  function detalhe(id) {
    const o = DB.get().ordens.find(x => x.id === id);
    if (!o) return UI.vazio('OS não encontrada', 'Esta ordem de serviço não existe mais na base.');
    const v = DB.veiculo(o.veiculoId) || {};
    const ant = Rec.anteriores(o, DB.get().ordens, DB.cfg().janelaReincidencia);
    App.aoRenderizar = () => {
      document.querySelectorAll('[data-acao]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.acao;
        if (a === 'voltar') App.irPara('ordens');
        if (a === 'editar') App.irPara('nova-os/' + o.id);
        if (a === 'duplicar') {
          const c = JSON.parse(JSON.stringify(o));
          c.id = ''; c.numero = DB.proximoNumero(); c.data = Dt.today(); c.origem = 'sistema';
          const nova = DB.salvarOS(c);
          UI.toast('OS duplicada como Nº ' + nova.numero, 'ok'); App.irPara('nova-os/' + nova.id);
        }
        if (a === 'imprimir') window.print();
        if (a === 'veiculo') App.irPara('veiculo/' + o.veiculoId);
        if (a === 'excluir') {
          UI.modal('Excluir OS Nº ' + o.numero, '<p>Esta ação remove a ordem de serviço da base. Não é possível desfazer.</p>',
            `<button class="btn ghost" data-fechar>Manter</button><button class="btn danger" id="conf-excluir">Excluir OS</button>`);
          document.getElementById('conf-excluir').addEventListener('click', () => {
            DB.excluirOS(o.id); UI.fecharModal(); UI.toast('OS Nº ' + o.numero + ' excluída.', 'ok'); App.irPara('ordens');
          });
        }
      }));
    };
    App.acoesTopo(`<button class="btn ghost sm" data-acao="voltar">Voltar</button>
      ${Perm.pode('os.criar') ? '<button class="btn ghost sm" data-acao="duplicar">Duplicar</button>' : ''}
      <button class="btn ghost sm" data-acao="imprimir">Imprimir</button>
      ${Perm.pode('os.editar') ? '<button class="btn sm" data-acao="editar">Editar</button>' : ''}`);

    const itens = o.itens.map(i => ({
      q: Fmt.num(i.qtd), d: Fmt.esc(i.descricao),
      g: `<span class="badge b-gray">${Fmt.esc(Rec.grupoDe(i.descricao).nome)}</span>`,
      vu: Fmt.money(i.valorUnit), t: `<span class="strong">${Fmt.money(i.total)}</span>`
    }));
    return `<div class="stack">
      ${ant.length ? `<div class="alert-box"><span class="ic">⚠️</span><div>
        <h3>Reincidência identificada</h3>
        <p style="margin:0">Última ocorrência do mesmo sistema em ${Fmt.date(ant[0].os.data)} — há ${ant[0].dias} dias
        (${ant[0].grupos.map(Rec.nomeGrupo).join(', ')}), no valor de ${Fmt.money(ant[0].os.total)}.</p></div></div>` : ''}
      ${UI.card('Ordem de serviço Nº ' + o.numero, `
        <div class="grid g3">
          ${[['Data', Fmt.date(o.data)], ['Local do serviço', Fmt.esc(o.local || '—')], ['Condutor', Fmt.esc(o.condutor || '—')],
        ['Veículo', Fmt.esc(v.nome || '—')], ['Placa', Fmt.esc(o.placa)], ['Frota', Fmt.esc(o.frota)],
        [o.unidade === 'H' ? 'Horímetro' : 'Quilometragem', Fmt.kmh(o.kmH, o.unidade)], ['Mecânico', Fmt.esc(o.mecanico)],
        ['Situação', UI.badgeStatus(o.status)]].map(([l, val]) =>
          `<div><div class="eyebrow">${l}</div><div class="strong" style="margin-top:3px">${val}</div></div>`).join('')}
        </div>`, `<button class="btn ghost sm" data-acao="veiculo">Ver histórico do veículo</button>`)}
      ${UI.card('Serviços executados', UI.tabela(
          [{ t: 'Qtd', k: 'q' }, { t: 'Descrição', k: 'd' }, { t: 'Sistema', k: 'g' },
          { t: 'Valor unitário', k: 'vu', cls: 'ta-r' }, { t: 'Valor total', k: 't', cls: 'ta-r' }], itens,
          { total: { d: 'TOTAL DA ORDEM DE SERVIÇO', t: Fmt.money(o.total) } }), '', true)}
      <div class="total-bar"><div><div class="lab">Valor total da ordem de serviço</div><div class="val">${Fmt.money(o.total)}</div></div>
        <div class="sub">${o.itens.length} ${o.itens.length === 1 ? 'serviço' : 'serviços'} · ${Fmt.esc(o.setor)}</div></div>
      ${o.obs ? UI.card('Observações', `<p style="margin:0;white-space:pre-wrap">${Fmt.esc(o.obs)}</p>`) : ''}
      ${Perm.pode('os.excluir') ? '<div class="row no-print"><div class="spacer"></div><button class="btn ghost sm" data-acao="excluir">Excluir OS</button></div>' : ''}
    </div>`;
  }
  return { pagina };
})();

/* ============================================================ SERVIÇOS */
const Servicos = (() => {
  let busca = '', cat = '';
  function pagina() {
    App.aoRenderizar = ligar;
    App.acoesTopo(Perm.pode('servicos.editar') ? `<button class="btn sm" id="novo-serv">+ Novo serviço</button>` : '');
    return `<div class="stack">
      ${UI.card('', `<div class="row">
        <input class="input" id="s-busca" placeholder="Buscar serviço…" style="max-width:280px" value="${Fmt.esc(busca)}">
        <select class="input" id="s-cat" style="max-width:240px">${UI.opcoes([...new Set(DB.get().servicos.map(s => s.categoria))].sort(), cat, 'Todas as categorias')}</select>
        <div class="spacer"></div><span class="dim" id="s-cont"></span></div>`)}
      <div id="lista-serv"></div></div>`;
  }
  function lista() {
    const b = DB.get();
    const f = b.servicos.filter(s =>
      (!cat || s.categoria === cat) &&
      (!busca || (s.descricao + ' ' + s.codigo).toLowerCase().includes(busca.toLowerCase())));
    const linhas = f.map(s => ({
      cod: `<span class="mono dim">${s.codigo}</span>`, d: Fmt.esc(s.descricao),
      cat: `<span class="badge b-blue">${Fmt.esc(s.categoria)}</span>`,
      un: 'Serviço', v: `<span class="strong">${Fmt.money(s.valor)}</span>`,
      st: s.status === 'Inativo' ? '<span class="badge b-gray">Inativo</span>' : '<span class="badge b-green">Ativo</span>',
      ac: Perm.pode('servicos.editar') ? `<button class="btn ghost sm" data-edit="${s.codigo}">Editar</button>` : ''
    }));
    const el = document.getElementById('s-cont');
    if (el) el.textContent = f.length + ' de ' + b.servicos.length + ' serviços';
    return UI.card('', UI.tabela([{ t: 'Código', k: 'cod' }, { t: 'Serviço', k: 'd' }, { t: 'Categoria', k: 'cat' },
    { t: 'Unidade', k: 'un' }, { t: 'Valor', k: 'v', cls: 'ta-r' }, { t: 'Situação', k: 'st' }, { t: '', k: 'ac', cls: 'ta-r' }], linhas,
      { vazioT: 'Nenhum serviço encontrado', vazioM: 'Ajuste a busca ou cadastre um novo serviço.' }), '', true);
  }
  /** Cadastro rápido a partir do que foi digitado na OS. */
  function novo(descricao, valor, aoSalvar) {
    editar('', aoSalvar, { descricao: (descricao || '').trim(), valor: +valor || 0 });
  }

  function editar(cod, aoSalvar, base) {
    const s = cod ? Object.assign({}, DB.servico(cod))
      : Object.assign({ codigo: '', descricao: '', categoria: 'Mecânica', valor: 0, status: 'Ativo', origem: 'sistema' }, base || {});
    const cats = [...new Set(DB.get().servicos.map(x => x.categoria))].sort();
    const parecidos = cod ? [] : DB.get().servicos.filter(x =>
      s.descricao.length > 4 && x.descricao.toLowerCase().includes(s.descricao.toLowerCase().slice(0, 12))).slice(0, 3);
    UI.modal(cod ? 'Editar serviço' : 'Cadastrar serviço', `
      <div class="field"><label for="m-d">Descrição do serviço</label><input class="input" id="m-d" value="${Fmt.esc(s.descricao)}"></div>
      <div class="form-grid">
        <div class="field"><label for="m-c">Categoria</label><input class="input" id="m-c" list="dl-cat" value="${Fmt.esc(s.categoria)}">${datalist('dl-cat', cats)}</div>
        <div class="field"><label for="m-v">Valor (R$)</label><input class="input" type="number" step="0.01" min="0" id="m-v" value="${s.valor}"></div>
        <div class="field"><label for="m-s">Situação</label><select class="input" id="m-s">${UI.opcoes(['Ativo', 'Inativo'], s.status || 'Ativo')}</select></div>
      </div>
      ${s.origem === 'planilha' ? '<p class="dim" style="font-size:12px;margin:0">Serviço importado da planilha. O registro original é preservado no histórico.</p>' : ''}
      ${parecidos.length ? `<div class="alert-box info" style="margin-top:var(--s3)"><span class="ic">ℹ️</span><div>
        <h3>Já existe algo parecido no catálogo</h3>
        <p style="margin:0">${parecidos.map(x => Fmt.esc(x.descricao) + ' — ' + Fmt.money(x.valor)).join('<br>')}</p></div></div>` : ''}`,
      `<button class="btn ghost" data-fechar>Cancelar</button>` +
      `<button class="btn" id="m-salvar">${cod ? 'Salvar serviço' : 'Cadastrar serviço'}</button>`);
    setTimeout(() => { const d = document.getElementById('m-d'); if (d) d.focus(); }, 50);
    document.getElementById('m-salvar').addEventListener('click', () => {
      s.descricao = document.getElementById('m-d').value.trim();
      s.categoria = document.getElementById('m-c').value.trim() || 'Mecânica';
      s.valor = +document.getElementById('m-v').value || 0;
      s.status = document.getElementById('m-s').value;
      if (!s.descricao) { UI.toast('Informe a descrição do serviço.', 'warn'); return; }
      DB.salvarServico(s);
      UI.fecharModal();
      if (aoSalvar) { aoSalvar(s); return; }
      UI.toast('Serviço salvo.', 'ok');
      const el = document.getElementById('lista-serv');
      if (el) { el.innerHTML = lista(); ligarLista(); } else App.render();
    });
  }
  function ligar() {
    document.getElementById('lista-serv').innerHTML = lista(); ligarLista();
    document.getElementById('s-busca').addEventListener('input', e => { busca = e.target.value; document.getElementById('lista-serv').innerHTML = lista(); ligarLista(); });
    document.getElementById('s-cat').addEventListener('change', e => { cat = e.target.value; document.getElementById('lista-serv').innerHTML = lista(); ligarLista(); });
    const bs = document.getElementById('novo-serv');
    if (bs) bs.addEventListener('click', () => editar(''));
  }
  function ligarLista() { document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editar(b.dataset.edit))); }
  return { pagina, novo, editar };
})();

/* ============================================================ VEÍCULOS */
const Veiculos = (() => {
  let busca = '', tipo = '', pendencia = '';

  // O que deixa o cadastro completo. Essenciais aparecem em destaque; os demais são complemento.
  const CAMPOS = [
    { k: 'placa', nome: 'Placa', essencial: true },
    { k: 'frota', nome: 'Nº da frota', essencial: true },
    { k: 'local', nome: 'Local', essencial: true },
    { k: 'condutor', nome: 'Condutor', essencial: true },
    { k: 'kmAtual', nome: 'KM/H atual', essencial: true },
    { k: 'marca', nome: 'Marca' }, { k: 'modelo', nome: 'Modelo' }, { k: 'ano', nome: 'Ano' },
  ];
  const vazio = v => v == null || v === '' || v === '—';
  const faltando = v => CAMPOS.filter(c => vazio(v[c.k]));
  const faltandoEssencial = v => faltando(v).filter(c => c.essencial);
  function pagina(params) {
    if (params && params.id) return detalhe(params.id);
    App.aoRenderizar = ligar;
    App.acoesTopo(Perm.pode('veiculos.editar') ? `<button class="btn sm" id="novo-veiculo">+ Novo veículo</button>` : '');
    return `<div class="stack">
      ${UI.card('', `<div class="row" style="margin-bottom:var(--s3)">
        <input class="input" id="v-busca" placeholder="Buscar por nome, placa ou frota…" style="max-width:300px" value="${Fmt.esc(busca)}">
        <select class="input" id="v-tipo" style="max-width:200px">${UI.opcoes([...new Set(DB.get().veiculos.map(v => v.tipo))].sort(), tipo, 'Todos os tipos')}</select>
        <div class="spacer"></div><span class="dim" id="v-cont"></span></div>
        <div class="row" style="gap:7px">
          <span class="eyebrow" style="margin-right:2px">A completar</span>
          ${chipsPendencia()}
        </div>`)}
      <div id="lista-veic"></div></div>`;
  }
  /** Chips com a contagem de veículos que estão sem cada informação. */
  function chipsPendencia() {
    const vs = DB.get().veiculos;
    const chips = CAMPOS.map(c => ({ c, n: vs.filter(v => vazio(v[c.k])).length })).filter(x => x.n);
    const completos = vs.filter(v => !faltando(v).length).length;
    if (!chips.length) return `<span class="dim" style="font-size:12.5px">Todos os ${vs.length} cadastros estão completos.</span>`;
    return `<button class="chip${pendencia === '' ? ' on' : ''}" data-pend="">Todos (${vs.length})</button>` +
      chips.map(x => `<button class="chip${pendencia === x.c.k ? ' on' : ''}" data-pend="${x.c.k}">
        ${Fmt.esc(x.c.nome)} <strong>${x.n}</strong></button>`).join('') +
      (completos ? `<span class="dim" style="font-size:12px;margin-left:4px">${completos} completo(s)</span>` : '');
  }

  function lista() {
    const b = DB.get();
    const custo = {}; const nOS = {};
    b.ordens.forEach(o => { custo[o.veiculoId] = (custo[o.veiculoId] || 0) + o.total; nOS[o.veiculoId] = (nOS[o.veiculoId] || 0) + 1; });
    const f = b.veiculos.filter(v => (!tipo || v.tipo === tipo) &&
      (!pendencia || vazio(v[pendencia])) &&
      (!busca || (v.nome + ' ' + v.placa + ' ' + v.frota + ' ' + (v.condutor || '')).toLowerCase().includes(busca.toLowerCase())));
    const podeEditar = Perm.pode('veiculos.editar');
    const linhas = f.sort((a, c) => (custo[c.id] || 0) - (custo[a.id] || 0)).map(v => {
      const falta = faltando(v);
      return {
        _cls: 'clickable', _attr: ` data-veic="${v.id}"`,
        n: `<div class="strong">${Fmt.esc(v.nome)}</div><div class="dim" style="font-size:11.5px">${Fmt.esc([v.marca, v.modelo, v.ano].filter(Boolean).join(' ')) || 'marca e modelo a preencher'}</div>`,
        tp: `<span class="badge b-gray">${Fmt.esc(v.tipo)}</span>`,
        pl: `<span class="mono${vazio(v.placa) ? ' dim' : ''}">${Fmt.esc(v.placa)}</span>`,
        fr: `<span class="mono${vazio(v.frota) ? ' dim' : ''}">${Fmt.esc(v.frota)}</span>`,
        loc: Fmt.esc(v.local || '—'), cond: Fmt.esc(v.condutor || '—'),
        km: Fmt.kmh(v.kmAtual, v.unidade),
        os: Fmt.num(nOS[v.id] || 0),
        ct: `<span class="strong">${Fmt.money(custo[v.id] || 0)}</span>`,
        cp: (() => {
          const ess = falta.filter(x => x.essencial);
          const tit = Fmt.esc(falta.map(x => x.nome).join(', '));
          if (ess.length) return `<span class="badge b-amber" title="${tit}">faltam ${ess.length}</span>`;
          if (falta.length) return `<span class="badge b-gray" title="${tit}">complementar</span>`;
          return '<span class="badge b-green">completo</span>';
        })(),
        ax: podeEditar ? `<button class="btn ghost sm" data-edit-v="${v.id}">Editar</button>` : '',
      };
    });
    const el = document.getElementById('v-cont');
    if (el) el.textContent = f.length + ' de ' + b.veiculos.length + ' veículos' +
      (pendencia ? ' sem ' + (CAMPOS.find(c => c.k === pendencia) || {}).nome : '');
    return UI.card('', UI.tabela([{ t: 'Veículo', k: 'n' }, { t: 'Tipo', k: 'tp' }, { t: 'Placa', k: 'pl' }, { t: 'Frota', k: 'fr' },
    { t: 'Local', k: 'loc' }, { t: 'Condutor', k: 'cond' }, { t: 'KM / H', k: 'km', cls: 'ta-r' },
    { t: 'OS', k: 'os', cls: 'ta-r' }, { t: 'Custo total', k: 'ct', cls: 'ta-r' },
    { t: 'Cadastro', k: 'cp', cls: 'ta-c' }, { t: '', k: 'ax', cls: 'ta-r' }], linhas,
      { vazioT: 'Nenhum veículo encontrado', vazioM: 'Ajuste a busca ou os filtros.' }), '', true);
  }
  function ligar() {
    const pintar = () => { document.getElementById('lista-veic').innerHTML = lista(); ligarLista(); };
    pintar();
    document.getElementById('v-busca').addEventListener('input', e => { busca = e.target.value; pintar(); });
    document.getElementById('v-tipo').addEventListener('change', e => { tipo = e.target.value; pintar(); });
    const ligarChips = () => document.querySelectorAll('[data-pend]').forEach(c =>
      c.addEventListener('click', () => {
        pendencia = c.dataset.pend;
        document.querySelectorAll('[data-pend]').forEach(x => x.classList.toggle('on', x.dataset.pend === pendencia));
        pintar();
      }));
    ligarChips();
    const bn = document.getElementById('novo-veiculo');
    if (bn) bn.addEventListener('click', () => novo(''));
  }
  function ligarLista() {
    document.querySelectorAll('[data-veic]').forEach(tr => tr.addEventListener('click', () => App.irPara('veiculo/' + tr.dataset.veic)));
    document.querySelectorAll('[data-edit-v]').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      editar(DB.veiculo(b.dataset.editV));
    }));
  }

  /** Interpreta o que o mecânico digitou: "Hilux ABC1D23 frota 10209.22". */
  function deTexto(txt) {
    const t = String(txt || '').trim();
    const mp = t.toUpperCase().match(/(?:^|[^A-Z0-9])([A-Z]{3}[\s\-]?\d[A-Z0-9]\d{2})(?![A-Z0-9])/);
    const placa = mp ? mp[1].replace(/[\s\-]/g, '') : '';
    const mf = t.match(/\b(?:frota\s*)?(\d{4,5}\.\d{2}|F\s?\d{3})\b/i);
    const frota = mf ? mf[1].toUpperCase().replace(/\s/g, '') : '';
    let nome = t;
    if (placa) nome = nome.replace(new RegExp(mp[1], 'i'), '');
    if (frota) nome = nome.replace(new RegExp('(frota\\s*)?' + mf[1].replace('.', '\\.'), 'i'), '');
    nome = nome.replace(/\bplaca\b|·/gi, '').replace(/\s{2,}/g, ' ').trim(' -·:'.split('').join(''));
    nome = nome.replace(/^[\s\-·:]+|[\s\-·:]+$/g, '');
    return { nome, placa, frota };
  }

  function novo(texto, aoSalvar) {
    const d = deTexto(texto);
    editar({
      id: '', nome: d.nome, placa: d.placa || '—', frota: d.frota || '—', tipo: 'Camionete',
      unidade: 'KM', marca: '', modelo: '', ano: '', condutor: '', local: '',
      descricao: texto || '', status: 'Ativo', kmAtual: null, origem: 'sistema'
    }, aoSalvar);
  }

  function editar(v, aoSalvar) {
    const criando = !v.id;
    const falta = criando ? [] : faltando(v);
    UI.modal(criando ? 'Cadastrar veículo' : 'Editar veículo', `
      ${falta.length ? `<div class="alert-box info" style="margin-bottom:var(--s4)"><span class="ic">✎</span><div>
        <h3>Faltam ${falta.length} ${falta.length === 1 ? 'informação' : 'informações'} neste cadastro</h3>
        <p style="margin:0">${falta.filter(c => c.essencial).length
          ? '<strong>Essenciais:</strong> ' + falta.filter(c => c.essencial).map(c => Fmt.esc(c.nome)).join(' · ') + '<br>' : ''}
        ${falta.filter(c => !c.essencial).length
          ? 'Complementares: ' + falta.filter(c => !c.essencial).map(c => Fmt.esc(c.nome)).join(' · ') + '<br>' : ''}
        Preencha quando localizar o dado — o histórico do veículo é mantido.</p>
      </div>` : ''}
      <div class="form-grid">
        <div class="field"><label for="e-n">Veículo</label><input class="input" id="e-n" value="${Fmt.esc(v.nome)}"></div>
        <div class="field"><label for="e-ma">Marca</label><input class="input" id="e-ma" value="${Fmt.esc(v.marca || '')}"></div>
        <div class="field"><label for="e-mo">Modelo</label><input class="input" id="e-mo" value="${Fmt.esc(v.modelo || '')}"></div>
        <div class="field"><label for="e-an">Ano</label><input class="input" id="e-an" value="${Fmt.esc(v.ano || '')}"></div>
        <div class="field"><label for="e-pl">Placa</label><input class="input" id="e-pl" value="${Fmt.esc(v.placa)}"></div>
        <div class="field"><label for="e-fr">Nº da frota</label><input class="input" id="e-fr" value="${Fmt.esc(v.frota)}"></div>
        <div class="field"><label for="e-tp">Tipo</label><select class="input" id="e-tp">${UI.opcoes(['Moto', 'Carro', 'Camionete', 'Caminhão', 'Carreta', 'Trator', 'Colheitadeira', 'Máquina', 'Outros'], v.tipo)}</select></div>
        <div class="field"><label for="e-un">Medição</label><select class="input" id="e-un">${UI.opcoes([{ v: 'KM', t: 'Quilometragem (km)' }, { v: 'H', t: 'Horímetro (h)' }], v.unidade)}</select></div>
        <div class="field"><label for="e-km">KM / H atual</label><input class="input" type="number" step="0.1" id="e-km" value="${v.kmAtual == null ? '' : v.kmAtual}"></div>
        <div class="field"><label for="e-lo">Local</label><input class="input" id="e-lo" list="dl-locais2" value="${Fmt.esc(v.local || '')}">${datalist('dl-locais2', DB.get().locais)}</div>
        <div class="field"><label for="e-co">Condutor</label><input class="input" id="e-co" list="dl-cond2" value="${Fmt.esc(v.condutor || '')}">${datalist('dl-cond2', DB.get().condutores)}</div>
        <div class="field"><label for="e-st">Situação</label><select class="input" id="e-st">${UI.opcoes(['Ativo', 'Em manutenção', 'Inativo'], v.status || 'Ativo')}</select></div>
      </div>`,
      `<button class="btn ghost" data-fechar>Cancelar</button>` +
      `<button class="btn" id="e-salvar">${criando ? 'Cadastrar veículo' : 'Salvar veículo'}</button>`);
    // destaca o que está em branco e leva o cursor para o primeiro campo a completar
    const pendentes = [...document.querySelectorAll('#modal .form-grid input')]
      .filter(i => !i.value || i.value === '—');
    pendentes.forEach(i => i.classList.add('pendente'));
    setTimeout(() => {
      const alvo = criando ? document.getElementById('e-n') : pendentes[0];
      if (alvo) alvo.focus();
    }, 50);
    document.getElementById('e-salvar').addEventListener('click', () => {
      const g = id => document.getElementById(id).value.trim();
      if (!g('e-n')) { UI.toast('Informe o nome do veículo.', 'warn'); document.getElementById('e-n').focus(); return; }
      const placa = (g('e-pl') || '—').toUpperCase().replace(/\s/g, '');
      if (criando) {
        const igual = DB.get().veiculos.find(x => placa !== '—' && x.placa === placa);
        if (igual) { UI.toast('Já existe um veículo com a placa ' + placa + '.', 'warn'); return; }
        v.id = placa !== '—' ? placa : 'VE' + Date.now().toString(36).toUpperCase();
      }
      Object.assign(v, {
        nome: g('e-n'), marca: g('e-ma'), modelo: g('e-mo'), ano: g('e-an'),
        placa, frota: g('e-fr') || '—', tipo: g('e-tp'), unidade: g('e-un'),
        kmAtual: g('e-km') === '' ? null : +g('e-km'), local: g('e-lo'), condutor: g('e-co'), status: g('e-st')
      });
      v.descricao = [v.nome, v.placa !== '—' ? v.placa : ''].filter(Boolean).join(' ');
      DB.salvarVeiculo(v);
      const b = DB.get();
      if (v.local && !b.locais.includes(v.local)) { b.locais.push(v.local); b.locais.sort(); }
      if (v.condutor && !b.condutores.includes(v.condutor)) { b.condutores.push(v.condutor); b.condutores.sort(); }
      DB.save();
      UI.fecharModal();
      if (aoSalvar) { aoSalvar(v); return; }
      UI.toast(criando ? 'Veículo cadastrado.' : 'Veículo atualizado.', 'ok');
      App.render();
    });
  }

  function detalhe(id) {
    const v = DB.veiculo(id);
    if (!v) return UI.vazio('Veículo não encontrado', 'Este veículo não existe na base.');
    const b = DB.get();
    const os = b.ordens.filter(o => o.veiculoId === id).sort((a, c) => (c.data || '').localeCompare(a.data || ''));
    const rec = Q.reincidencias(os, b.ordens);
    const recIds = new Set(rec.map(r => r.os.id));
    const total = Q.soma(os);
    const grupos = Q.porGrupoServico(os);
    const servMais = {};
    os.forEach(o => o.itens.forEach(i => { const d = i.descricao.trim(); servMais[d] = (servMais[d] || 0) + (i.qtd || 1); }));
    const topServ = Object.entries(servMais).sort((a, c) => c[1] - a[1]).slice(0, 6);

    App.aoRenderizar = () => {
      document.querySelectorAll('[data-acao]').forEach(bt => bt.addEventListener('click', () => {
        if (bt.dataset.acao === 'voltar') App.irPara('veiculos');
        if (bt.dataset.acao === 'editar') editar(v);
        if (bt.dataset.acao === 'nova') App.irPara('nova-os');
      }));
      document.querySelectorAll('[data-os]').forEach(el => el.addEventListener('click', () => App.irPara('ordens/' + el.dataset.os)));
      Chart.ligarTooltips(document.getElementById('pagina'));
    };
    const falta = faltandoEssencial(v);
    App.acoesTopo(`<button class="btn ghost sm" data-acao="voltar">Voltar</button>
      ${Perm.pode('veiculos.editar') ? `<button class="btn ${falta.length ? '' : 'ghost '}sm" data-acao="editar">
        ${falta.length ? 'Completar cadastro (' + falta.length + ')' : 'Editar cadastro'}</button>` : ''}
      ${Perm.pode('os.criar') ? '<button class="btn sm" data-acao="nova">+ Nova OS</button>' : ''}`);

    const timeline = os.slice(0, 40).map(o => {
      const r = recIds.has(o.id);
      const gs = Rec.gruposDaOS(o).map(Rec.nomeGrupo).join(' · ');
      return `<div class="tl-item${r ? ' rec' : ''}">
        <div class="tl-d">${Fmt.date(o.data)} · ${Fmt.kmh(o.kmH, v.unidade)} · ${Fmt.esc(o.mecanico)}</div>
        <div class="tl-c"><a href="#/ordens/${o.id}" class="strong">OS ${o.numero}</a>
          <span class="dim">${Fmt.esc(gs)}</span>
          ${r ? '<span class="badge b-amber">reincidência</span>' : ''}
          <span class="v">${Fmt.money(o.total)}</span></div>
        <div class="dim" style="font-size:12px">${Fmt.esc(o.itens.map(i => i.descricao).join(' · '))}</div>
      </div>`;
    }).join('');

    return `<div class="stack">
      ${UI.card(v.nome, `<div class="grid g3">
        ${[['Placa', Fmt.esc(v.placa)], ['Frota', Fmt.esc(v.frota)], ['Tipo', Fmt.esc(v.tipo)],
        ['Marca / modelo', Fmt.esc([v.marca, v.modelo].filter(Boolean).join(' ') || '—')],
        [v.unidade === 'H' ? 'Horímetro atual' : 'KM atual', Fmt.kmh(v.kmAtual, v.unidade)],
        ['Local', Fmt.esc(v.local || '—')], ['Condutor', Fmt.esc(v.condutor || '—')],
        ['Situação', `<span class="badge b-green">${Fmt.esc(v.status || 'Ativo')}</span>`],
        ['Última manutenção', os.length ? Fmt.date(os[0].data) : '—']].map(([l, val]) =>
          `<div><div class="eyebrow">${l}</div><div class="strong" style="margin-top:3px">${val}</div></div>`).join('')}</div>`)}

      <div class="grid kpis">
        ${UI.kpi('Total de OS', Fmt.num(os.length))}
        ${UI.kpi('Total gasto', Fmt.money0(total))}
        ${UI.kpi('Custo médio por OS', Fmt.money0(os.length ? total / os.length : 0))}
        ${UI.kpi('Reincidências', Fmt.num(rec.length), rec.length ? 'Voltou pelo mesmo sistema' : 'Nenhuma no histórico', rec.length > 0)}
      </div>

      <div class="grid g2">
        ${UI.card('Gasto por sistema do veículo', Chart.barsH(grupos.slice(0, 8).map(g => ({
          rotulo: g.nome, valor: g.valor,
          tip: `<strong>${Fmt.esc(g.nome)}</strong><br>${Fmt.money(g.valor)} · ${g.qtd} serviços`
        })), { aria: 'Gasto por sistema' }))}
        ${UI.card('Serviços mais realizados', topServ.length ? `<div class="stack" style="gap:9px">${topServ.map(([d, q]) =>
          `<div class="row" style="gap:9px"><span style="flex:1;min-width:0">${Fmt.esc(d)}</span>
           <span class="badge b-blue">${q}×</span></div>`).join('')}</div>` : UI.vazio('Sem serviços', 'Nenhum serviço registrado.'))}
      </div>

      ${rec.length ? UI.card('Problemas recorrentes', UI.tabela(
      [{ t: 'Sistema', k: 'g' }, { t: 'Ocorrência anterior', k: 'a' }, { t: 'Ocorrência seguinte', k: 'b' }, { t: 'Intervalo', k: 'i', cls: 'ta-r' }, { t: 'Valor somado', k: 'v', cls: 'ta-r' }],
      rec.map(r => ({
        g: r.anterior.grupos.map(g => `<span class="badge b-amber">${Fmt.esc(Rec.nomeGrupo(g))}</span>`).join(' '),
        a: Fmt.date(r.anterior.os.data) + ' — OS ' + r.anterior.os.numero,
        b: Fmt.date(r.os.data) + ' — OS ' + r.os.numero,
        i: `<strong>${r.anterior.dias} dias</strong>`,
        v: Fmt.money(r.os.total + r.anterior.os.total)
      })), {}), '', true) : ''}

      ${UI.card('Histórico de manutenção', os.length ? `<div class="tl">${timeline}</div>` :
        UI.vazio('Sem histórico', 'Este veículo ainda não possui ordens de serviço registradas.'))}
    </div>`;
  }
  return { pagina, detalhe, novo, editar };
})();
