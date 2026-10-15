/* ============================================================
   PAINEL EXECUTIVO — visão para a Diretoria (v6.19)
   Usa somente as O.S. reais da base do sistema (sincronizada com a nuvem).
   Nada é estimado nem preenchido: o que não existe aparece como "não
   cadastrado", com a indicação do que precisa ser registrado.
   Cada indicador tem "Cálculo e consulta": explicação, consulta equivalente
   e a lista das O.S. usadas na conta.
   ============================================================ */
const Executivo = (() => {
  const SEM_CAT = '(sem categoria)', SEM_SIT = 'Sem situação';
  const EM_ABERTO = ['Aberta', 'Em andamento'];
  const SITUACOES = ['Aberta', 'Em andamento', 'Concluída', 'Cancelada'];

  /* ---------- utilitários ---------- */
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const placaNorm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const placaValida = p => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p);
  const resps = o => String(o.mecanico || '').split(',').map(x => x.trim()).filter(Boolean);
  const aq = s => String(s).replace(/'/g, "''");
  const kfmt = v => v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + ' mil' : String(Math.round(v));
  const fx = () => (Estado.fx = Estado.fx || { de: '', ate: '', veiculo: '', placa: '', categoria: '', status: '', resp: '' });
  const categoriaDe = o => { const v = DB.veiculo(o.veiculoId); return (v && v.tipo) ? v.tipo : SEM_CAT; };
  const situacaoDe = o => o.status || SEM_SIT;
  const chaveVeic = o => o.veiculoId || ('placa:' + (placaNorm(o.placa) || 'sem-veiculo'));
  const dadosVeic = o => {
    const v = DB.veiculo(o.veiculoId);
    return { nome: v ? v.nome : (o.placa && placaNorm(o.placa) ? o.placa : 'Veículo não cadastrado'), placa: v ? v.placa : (o.placa || '—'), frota: v ? v.frota : (o.frota || '—'), cat: v && v.tipo ? v.tipo : SEM_CAT };
  };
  const mesRot = m => m.slice(5, 7) + '/' + m.slice(2, 4);
  const horaBR = iso => { try { const d = new Date(iso); const p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; } catch (e) { return '—'; } };

  /* ---------- filtro ---------- */
  function filtrar(f) {
    const placa = placaNorm(f.placa);
    return DB.get().ordens.filter(o => {
      if ((f.de || f.ate) && !o.data) return false;
      if (f.de && o.data < f.de) return false;
      if (f.ate && o.data > f.ate) return false;
      if (f.veiculo && o.veiculoId !== f.veiculo) return false;
      if (placa && !placaNorm(o.placa).includes(placa)) return false;
      if (f.categoria && categoriaDe(o) !== f.categoria) return false;
      if (f.status && situacaoDe(o) !== f.status) return false;
      if (f.resp && !resps(o).includes(f.resp)) return false;
      return true;
    });
  }

  /* condições equivalentes em SQL (para "Ver consulta") */
  function condicoes(f, semCanceladas) {
    const c = [];
    if (f.de) c.push(`data >= '${aq(f.de)}'`);
    if (f.ate) c.push(`data <= '${aq(f.ate)}'`);
    if (f.veiculo) c.push(`veiculo_id = '${aq(f.veiculo)}'  -- ${DB.rotuloVeiculo(f.veiculo)}`);
    if (placaNorm(f.placa)) c.push(`upper(regexp_replace(placa, '[^A-Za-z0-9]', '', 'g')) LIKE '%${aq(placaNorm(f.placa))}%'`);
    if (f.categoria) c.push(f.categoria === SEM_CAT
      ? `veiculo_id NOT IN (SELECT id FROM veiculos_cadastro WHERE coalesce(tipo, '') <> '')`
      : `veiculo_id IN (SELECT id FROM veiculos_cadastro WHERE tipo = '${aq(f.categoria)}')`);
    if (f.status) c.push(f.status === SEM_SIT ? `coalesce(status, '') = ''` : `status = '${aq(f.status)}'`);
    if (f.resp) c.push(`mecanico ILIKE '%${aq(f.resp)}%'`);
    if (semCanceladas) c.push(`status IS DISTINCT FROM 'Cancelada'`);
    return c;
  }
  const sql = (select, f, o = {}) => {
    const c = condicoes(f, o.semCanceladas).concat(o.extra || []);
    return `${select}\nFROM ${o.from || 'ordens'}\nWHERE ${c.length ? c.join('\n  AND ') : 'TRUE'}${o.tail ? '\n' + o.tail : ''};`;
  };

  /* ---------- cálculo ---------- */
  function contexto() {
    const f = fx();
    const os = filtrar(f);
    const osC = os.filter(o => o.status !== 'Cancelada');          // custo não conta O.S. cancelada
    const emAberto = os.filter(o => EM_ABERTO.includes(o.status));
    const concl = os.filter(o => o.status === 'Concluída');
    const canc = os.filter(o => o.status === 'Cancelada');
    const soma = Q.soma(osC);

    const meses = new Map();
    osC.filter(o => o.data).forEach(o => {
      const k = o.data.slice(0, 7); const e = meses.get(k) || { chave: k, qtd: 0, valor: 0 };
      e.qtd++; e.valor += o.total || 0; meses.set(k, e);
    });
    const evolucao = [...meses.values()].sort((a, b) => a.chave.localeCompare(b.chave));

    const cats = new Map();
    osC.forEach(o => { const k = categoriaDe(o); const e = cats.get(k) || { chave: k, qtd: 0, valor: 0, veic: new Set() }; e.qtd++; e.valor += o.total || 0; e.veic.add(chaveVeic(o)); cats.set(k, e); });
    const categorias = [...cats.values()].sort((a, b) => b.valor - a.valor);

    const vs = new Map();
    osC.forEach(o => { const k = chaveVeic(o); const e = vs.get(k) || { chave: k, os: [], qtd: 0, valor: 0, ...dadosVeic(o) }; e.os.push(o); e.qtd++; e.valor += o.total || 0; vs.set(k, e); });
    const veiculos = [...vs.values()].sort((a, b) => b.valor - a.valor);

    const sv = new Map();
    osC.forEach(o => (o.itens || []).forEach(i => {
      const cat = i.servicoCod ? DB.servico(i.servicoCod) : null;
      const nome = cat && cat.descricao ? cat.descricao : String(i.descricao || '').trim();
      const k = norm(nome); if (!k) return;
      const e = sv.get(k) || { chave: k, nome, os: new Set(), linhas: 0, valor: 0, catalogo: 0, texto: 0 };
      e.os.add(o.id); e.linhas++; e.valor += i.total || 0; if (cat) e.catalogo++; else e.texto++;
      sv.set(k, e);
    }));
    const servicos = [...sv.values()].sort((a, b) => b.os.size - a.os.size || b.valor - a.valor);

    return { f, os, osC, emAberto, concl, canc, soma, evolucao, categorias, veiculos, servicos,
      veicAtendidos: new Set(osC.map(chaveVeic)), veicAbertos: new Set(emAberto.map(chaveVeic)) };
  }

  /* ---------- definições dos indicadores (explicação + consulta + O.S. usadas) ---------- */
  function indicadores(x) {
    const { f } = x;
    const statusNuvem = (window.Nuvem && Nuvem.statusNaNuvem) ? Nuvem.statusNaNuvem() : null;
    const avisoSit = statusNuvem === true ? '' : 'Atenção: a situação da O.S. só é compartilhada entre computadores depois que a coluna "status" for criada no banco da nuvem; até lá vale a situação marcada neste aparelho.';
    const base = { campos: 'ordens.id, ordens.data, ordens.total' };
    const D = {};
    D.total = { ...base, nome: 'Total de ordens de serviço', valor: Fmt.num(x.os.length), conjunto: x.os,
      explica: ['Conta todas as O.S. do filtro atual, em qualquer situação (inclui canceladas).'],
      sql: sql('SELECT count(*) AS total_os', f) };
    D.emAberto = { ...base, nome: 'Ordens em aberto', valor: Fmt.num(x.emAberto.length), conjunto: x.emAberto,
      explica: ['Conta as O.S. cuja situação é "Aberta" ou "Em andamento", dentro do filtro atual.', 'A situação é a que foi marcada no formulário da O.S.'], aviso: avisoSit,
      sql: sql('SELECT count(*) AS os_em_aberto', f, { extra: [`status IN ('Aberta', 'Em andamento')`] }) };
    D.concluidas = { ...base, nome: 'Ordens concluídas', valor: Fmt.num(x.concl.length), conjunto: x.concl,
      explica: ['Conta as O.S. com situação "Concluída" dentro do filtro atual.'], aviso: avisoSit,
      sql: sql('SELECT count(*) AS os_concluidas', f, { extra: [`status = 'Concluída'`] }) };
    D.atrasadas = { nome: 'Ordens atrasadas', valor: '—', conjunto: [], naoCalc: true,
      motivo: 'A O.S. não tem prazo (data prevista de conclusão). Sem ele não há como saber se uma ordem está atrasada, e o painel não estima esse dado.',
      cadastrar: ['Criar o campo "Prazo previsto" no formulário da O.S. e preenchê-lo ao abrir a ordem.', 'Regra sugerida: atrasada = situação Aberta/Em andamento e data de hoje maior que o prazo previsto.'] };
    D.gasto = { ...base, nome: 'Gasto total com manutenção', valor: Fmt.money(x.soma), conjunto: x.osC,
      explica: ['Soma do campo Total das O.S. do filtro atual, exceto as canceladas.', 'O Total de cada O.S. é a soma de quantidade × valor unitário dos itens lançados nela.'],
      sql: sql('SELECT sum(total) AS gasto_total', f, { semCanceladas: true }) };
    D.pecasServicos = { nome: 'Gasto com peças e com serviços', valor: '—', conjunto: [], naoCalc: true,
      motivo: 'Os itens da O.S. têm descrição, quantidade e valor, mas não informam se são peça, mão de obra ou serviço de terceiro. Separar por texto seria adivinhar.',
      cadastrar: ['Criar o campo "Tipo do item" (Peça, Serviço, Terceiro) em cada linha da O.S.', 'Opcional: classificar o cadastro de serviços e preencher o tipo automaticamente.'] };
    D.medio = { ...base, nome: 'Custo médio por ordem', valor: Fmt.money(x.osC.length ? x.soma / x.osC.length : 0), conjunto: x.osC,
      explica: ['Gasto total dividido pela quantidade de O.S. não canceladas do filtro atual.'],
      sql: sql('SELECT sum(total) / nullif(count(*), 0) AS custo_medio_por_os', f, { semCanceladas: true }) };
    D.veiculos = { ...base, nome: 'Veículos atendidos', valor: Fmt.num(x.veicAtendidos.size), conjunto: x.osC,
      explica: ['Quantidade de veículos diferentes (pelo cadastro de veículos) com pelo menos uma O.S. não cancelada no filtro atual.'],
      sql: sql('SELECT count(DISTINCT veiculo_id) AS veiculos_atendidos', f, { semCanceladas: true }) };
    D.veicAbertos = { ...base, nome: 'Veículos com manutenção em aberto', valor: Fmt.num(x.veicAbertos.size), conjunto: x.emAberto, aviso: avisoSit,
      explica: ['Veículos diferentes com pelo menos uma O.S. "Aberta" ou "Em andamento" no filtro atual.', 'É um retrato do que está parado agora. Os dias parados não podem ser medidos porque a O.S. não tem data de conclusão.'],
      sql: sql('SELECT count(DISTINCT veiculo_id) AS veiculos_com_os_em_aberto', f, { extra: [`status IN ('Aberta', 'Em andamento')`] }) };
    D.disponibilidade = { nome: 'Dias parado e disponibilidade por veículo', valor: '—', conjunto: [], naoCalc: true,
      motivo: 'Existe só a data da O.S. Faltam a data de entrada na oficina e a data de conclusão para medir quantos dias cada veículo ficou parado.',
      cadastrar: ['Registrar "Data de entrada" e "Data de conclusão" em cada O.S.', 'Com as duas datas, disponibilidade = dias úteis no período menos dias parados.'] };
    D.evolucao = { ...base, nome: 'Evolução mensal dos custos', valor: x.evolucao.length + (x.evolucao.length === 1 ? ' mês' : ' meses'), conjunto: x.osC.filter(o => o.data),
      explica: ['Agrupa as O.S. não canceladas pelo mês da data (AAAA-MM) e soma o Total de cada mês.', 'O.S. sem data não entram neste gráfico (veja "Qualidade dos dados").'],
      sql: sql("SELECT substr(data, 1, 7) AS mes, count(*) AS qtd_os, sum(total) AS gasto", f, { semCanceladas: true, extra: ['data IS NOT NULL'], tail: 'GROUP BY 1\nORDER BY 1' }) };
    D.categoria = { ...base, nome: 'Custo por categoria de frota', valor: x.categorias.length + ' categorias', conjunto: x.osC,
      explica: ['Cada O.S. recebe a categoria do veículo no cadastro de veículos (campo Tipo: Caminhão, Trator, Carreta…).', 'Veículo sem tipo ou fora do cadastro entra em "(sem categoria)". O cadastro de veículos é do sistema, não é lido da nuvem.'],
      sql: sql("SELECT coalesce(nullif(v.tipo, ''), '(sem categoria)') AS categoria, count(*) AS qtd_os, sum(o.total) AS gasto", f, { semCanceladas: true, from: 'ordens o LEFT JOIN veiculos_cadastro v ON v.id = o.veiculo_id', tail: 'GROUP BY 1\nORDER BY 3 DESC' }) };
    D.veiculosCusto = { ...base, nome: 'Veículos com maior custo de manutenção', valor: Fmt.num(x.veiculos.length) + ' veículos', conjunto: x.osC,
      explica: ['Soma o Total das O.S. não canceladas por veículo (identificado pelo cadastro) e ordena do maior para o menor.', 'A placa é a do cadastro do veículo. Equipamentos sem placa aparecem como "sem placa" e continuam separados pelo veículo.'],
      sql: sql('SELECT veiculo_id, max(placa) AS placa, count(*) AS qtd_os, sum(total) AS gasto', f, { semCanceladas: true, tail: 'GROUP BY veiculo_id\nORDER BY gasto DESC' }) };
    D.servicos = { ...base, nome: 'Serviços mais recorrentes', valor: Fmt.num(x.servicos.length) + ' serviços distintos', conjunto: x.osC,
      explica: ['Cada linha de item das O.S. não canceladas conta como uma ocorrência do serviço. Ordena pelo número de O.S. em que o serviço aparece.', 'Quando o item veio do catálogo de serviços, usa o nome do catálogo; senão usa o texto digitado, sem diferenciar maiúsculas, acentos e espaços. Textos escritos de formas diferentes continuam separados.'],
      sql: sql("SELECT lower(trim(item->>'descricao')) AS servico, count(DISTINCT o.id) AS qtd_os, sum((item->>'total')::numeric) AS valor", f, { semCanceladas: true, from: "ordens o, jsonb_array_elements(o.itens) AS item", tail: 'GROUP BY 1\nORDER BY 2 DESC, 3 DESC\nLIMIT 10' }) };
    return D;
  }

  /* ---------- qualidade dos dados ---------- */
  function qualidade(x) {
    const out = [];
    const add = (id, nivel, titulo, detalhe, itens, extra) => { if (itens.length || (extra && extra.fixo)) out.push({ id, nivel, titulo, detalhe, itens }); };
    const todas = DB.get().ordens;
    const os = x.os;
    const b = DB.get();
    add('sem-data', 'medio', 'O.S. sem data', 'Ficam fora da evolução mensal e dos filtros de data. Conferido na base inteira.',
      todas.filter(o => !o.data).map(o => ({ os: o, motivo: 'Data não informada' })));
    const hoje = Dt.today();
    add('data-suspeita', 'medio', 'Data suspeita ou no futuro', 'Data posterior a hoje ou marcada como suspeita na importação da planilha: pode ser erro de digitação e distorce a evolução mensal.',
      os.filter(o => o.data && (o.data > hoje || o.dataSuspeita)).map(o => ({ os: o, motivo: o.data > hoje ? 'Data ' + Fmt.date(o.data) + ' é depois de hoje' : 'Data marcada como suspeita na importação' })));
    add('veic-sem-cadastro', 'alto', 'O.S. de veículo que não está no cadastro', 'Sem cadastro neste aparelho, a categoria e o nome do veículo não podem ser lidos. A causa mais comum é o veículo ter sido cadastrado em outro computador antes do cadastro ir para a nuvem (v6.20): entre no sistema naquele computador e clique em "Atualizar agora" para ele enviar os veículos.',
      os.filter(o => !DB.veiculo(o.veiculoId)).map(o => ({ os: o, motivo: 'Veículo "' + (o.veiculoId || '—') + '" não cadastrado' })));
    add('placa-fora', 'medio', 'Placa fora do padrão', 'Placas que não seguem o formato antigo (AAA1234) nem o Mercosul (AAA1B23): possível erro de digitação.',
      os.filter(o => { const p = placaNorm(o.placa); return p && !placaValida(p); }).map(o => ({ os: o, motivo: 'Placa "' + o.placa + '"' })));
    add('placa-diverge', 'medio', 'Placa da O.S. diferente da do cadastro', 'A O.S. guarda uma placa e o veículo cadastrado outra.',
      os.filter(o => { const v = DB.veiculo(o.veiculoId); const a = placaNorm(o.placa), c = v ? placaNorm(v.placa) : ''; return v && a && c && a !== c; })
        .map(o => ({ os: o, motivo: 'O.S.: ' + o.placa + ' · cadastro: ' + DB.veiculo(o.veiculoId).placa })));
    add('sem-placa', 'info', 'Veículo sem placa cadastrada', 'Equipamentos ou veículos sem placa: o custo é somado pelo veículo, mas não dá para buscar por placa.',
      os.filter(o => !placaNorm(dadosVeic(o).placa)).map(o => ({ os: o, motivo: 'Sem placa' })));
    add('sem-categoria', 'medio', 'Veículo sem categoria (tipo)', 'Entra em "(sem categoria)" no custo por categoria de frota.',
      os.filter(o => DB.veiculo(o.veiculoId) && !DB.veiculo(o.veiculoId).tipo).map(o => ({ os: o, motivo: 'Tipo não preenchido no cadastro' })));
    // número de O.S. repetido
    const porNum = new Map();
    os.forEach(o => { if (o.numero == null || o.numero === '') return; const k = String(o.numero); (porNum.get(k) || porNum.set(k, []).get(k)).push(o); });
    const rep = [...porNum.entries()].filter(([, l]) => l.length > 1);
    add('num-repetido', 'alto', 'Número de O.S. repetido', rep.length + ' número(s) usados em mais de uma O.S. (ex.: ' + rep.slice(0, 3).map(([k, l]) => 'nº ' + k + ' ×' + l.length).join(', ') + '). Costuma acontecer quando dois computadores lançam ao mesmo tempo.',
      rep.flatMap(([k, l]) => l.map(o => ({ os: o, motivo: 'Nº ' + k + ' usado ' + l.length + ' vezes' }))));
    // possíveis duplicidades
    const assin = o => (o.itens || []).map(i => norm(i.descricao) + ':' + (i.qtd || 1) + ':' + (i.total || 0)).sort().join('|');
    const forte = new Map(), fraca = new Map();
    os.filter(o => o.data).forEach(o => {
      const kf = [o.data, chaveVeic(o), (o.total || 0).toFixed(2), assin(o)].join('#');
      (forte.get(kf) || forte.set(kf, []).get(kf)).push(o);
      const kw = [o.data, chaveVeic(o), (o.total || 0).toFixed(2)].join('#');
      (fraca.get(kw) || fraca.set(kw, []).get(kw)).push(o);
    });
    const gf = [...forte.values()].filter(l => l.length > 1);
    add('dup-forte', 'alto', 'Possível O.S. duplicada (mesmos dados)', gf.length + ' grupo(s) com mesma data, mesmo veículo, mesmos itens e mesmo valor.',
      gf.flatMap(l => l.map(o => ({ os: o, motivo: 'Igual a ' + l.filter(z => z !== o).map(z => 'nº ' + z.numero).join(', ') }))));
    const idsF = new Set(gf.flat().map(o => o.id));
    const gw = [...fraca.values()].filter(l => l.length > 1 && !l.every(o => idsF.has(o.id)));
    add('dup-fraca', 'medio', 'Mesma data, veículo e valor (itens diferentes)', gw.length + ' grupo(s). Pode ser coincidência; vale conferir.',
      gw.flatMap(l => l.map(o => ({ os: o, motivo: 'Mesmo dia, veículo e valor que ' + l.filter(z => z !== o).map(z => 'nº ' + z.numero).join(', ') }))));
    add('total-diverge', 'alto', 'Total diferente da soma dos itens', 'O valor gravado na O.S. não bate com a soma dos itens.',
      os.filter(o => Math.abs((o.itens || []).reduce((s, i) => s + (i.total || 0), 0) - (o.total || 0)) > 0.01)
        .map(o => ({ os: o, motivo: 'Itens somam ' + Fmt.money((o.itens || []).reduce((s, i) => s + (i.total || 0), 0)) + ' · Total ' + Fmt.money(o.total) })));
    add('sem-itens', 'medio', 'O.S. sem itens ou com valor zero', 'Entram na contagem de ordens, mas não somam custo.',
      os.filter(o => !(o.itens || []).length || !(o.total > 0)).map(o => ({ os: o, motivo: !(o.itens || []).length ? 'Sem itens' : 'Valor zero' })));
    const lista = new Set((b.mecanicos || []).map(m => m));
    add('responsavel', 'medio', 'Responsável fora da lista ou com espaço sobrando', 'Nomes digitados de forma diferente separam o mesmo mecânico em dois no filtro por responsável.',
      os.filter(o => { const m = String(o.mecanico || ''); return !m.trim() || m !== m.trim() || /\s{2,}/.test(m) || resps(o).some(r => !lista.has(r)); })
        .map(o => ({ os: o, motivo: !String(o.mecanico || '').trim() ? 'Sem responsável' : 'Nome "' + o.mecanico + '"' })));
    add('sem-situacao', 'medio', 'O.S. sem situação', 'Não entram em abertas nem em concluídas.', os.filter(o => !o.status).map(o => ({ os: o, motivo: 'Situação em branco' })));
    const semCod = os.filter(o => (o.itens || []).some(i => !i.servicoCod));
    add('sem-catalogo', 'info', 'Itens lançados sem escolher serviço do catálogo', (semCod.reduce((s, o) => s + o.itens.filter(i => !i.servicoCod).length, 0)) + ' item(ns) em ' + semCod.length + ' O.S. O ranking de serviços usa o texto digitado nesses casos.',
      semCod.map(o => ({ os: o, motivo: o.itens.filter(i => !i.servicoCod).length + ' item(ns) sem catálogo' })));
    const sn = (window.Nuvem && Nuvem.statusNaNuvem) ? Nuvem.statusNaNuvem() : null;
    if (sn !== true) add('status-nuvem', sn === false ? 'alto' : 'info', sn === false ? 'Situação da O.S. ainda não é gravada na nuvem' : 'Situação na nuvem ainda não verificada',
      sn === false ? 'A coluna "status" não existe na tabela da nuvem. As situações (aberta, em andamento, concluída) valem só neste aparelho e podem divergir entre computadores. Para corrigir, criar a coluna no banco (arquivo supabase_v620.sql, no SQL Editor do Supabase).' : 'Abra a página depois de sincronizar (botão "Atualizar agora") para verificar.', [], { fixo: true });
    const vn = (window.Nuvem && Nuvem.statusVeiculosNuvem) ? Nuvem.statusVeiculosNuvem() : null;
    if (vn !== true) add('veic-nuvem', vn === false ? 'alto' : 'info', vn === false ? 'Cadastro de veículos ainda não é compartilhado na nuvem' : 'Cadastro de veículos na nuvem ainda não verificado',
      vn === false ? 'A tabela "veiculos_cadastro" não existe na nuvem. Cada computador mantém o seu próprio cadastro, então categoria e nome do veículo podem divergir. Para corrigir, criar a tabela no banco (arquivo supabase_v620.sql, no SQL Editor do Supabase).' : 'Abra a página depois de sincronizar (botão "Atualizar agora") para verificar.', [], { fixo: true });
    return out;
  }

  /* ---------- blocos de tela ---------- */
  const NIVEL = { alto: ['b-red', 'Corrigir'], medio: ['b-amber', 'Revisar'], info: ['b-gray', 'Informativo'] };
  const btnCalc = id => `<button type="button" class="k-act" data-ind="${id}">Cálculo e consulta</button>`;
  const kpiI = (id, lab, val, sub, alerta, ico) => UI.kpi(lab, val, sub, alerta, ico).replace(/<\/div>$/, btnCalc(id) + '</div>');
  const cardI = (id, titulo, corpo, semPad) => UI.card(titulo, corpo, `<button type="button" class="btn ghost sm" data-ind="${id}">Cálculo e consulta</button>`, semPad);

  function barraFiltros() {
    const f = fx(), b = DB.get();
    const veic = b.veiculos.slice().sort((a, c) => String(a.nome).localeCompare(String(c.nome), 'pt-BR'));
    const cats = [...new Set(b.veiculos.map(v => v.tipo).filter(Boolean))].sort(); cats.push(SEM_CAT);
    const L = (rot, html) => `<label class="fx-f"><span>${rot}</span>${html}</label>`;
    return `<section class="card no-print"><div class="card-b"><div class="fx-grid" id="fx-bar">
      ${L('Data inicial', `<input class="input" type="date" id="fx-de" value="${Fmt.esc(f.de)}">`)}
      ${L('Data final', `<input class="input" type="date" id="fx-ate" value="${Fmt.esc(f.ate)}">`)}
      ${L('Atalho de período', `<select class="input" id="fx-atalho"><option value="">Escolher…</option><option value="tudo">Todo o período</option><option value="30">Últimos 30 dias</option><option value="mes">Este mês</option><option value="mes-1">Mês passado</option><option value="ano">Este ano</option></select>`)}
      ${L('Veículo', `<select class="input" id="fx-veiculo"><option value="">Todos os veículos</option>${veic.map(v => `<option value="${Fmt.esc(v.id)}"${v.id === f.veiculo ? ' selected' : ''}>${Fmt.esc(v.nome)}${v.placa && v.placa !== '—' ? ' · ' + Fmt.esc(v.placa) : ''}</option>`).join('')}</select>`)}
      ${L('Placa', `<input class="input" id="fx-placa" placeholder="Ex.: ABC1D23" value="${Fmt.esc(f.placa)}" autocomplete="off">`)}
      ${L('Categoria da frota', `<select class="input" id="fx-cat">${UI.opcoes(cats, f.categoria, 'Todas as categorias')}</select>`)}
      ${L('Situação da O.S.', `<select class="input" id="fx-status">${UI.opcoes(SITUACOES, f.status, 'Todas as situações')}</select>`)}
      ${L('Responsável', `<select class="input" id="fx-resp">${UI.opcoes(b.mecanicos || [], f.resp, 'Todos os responsáveis')}</select>`)}
      <div class="fx-f fx-b"><button type="button" class="btn ghost sm" id="fx-limpar">Limpar filtros</button></div>
    </div></div></section>`;
  }

  function cabecalho(x) {
    const todas = DB.get().ordens;
    const datas = todas.map(o => o.data).filter(Boolean).sort();
    const carimbos = todas.flatMap(o => [[o.criadoData, o.criadoHora], [o.alteradoData, o.alteradoHora]]).filter(p => p[0]).map(p => p[0] + ' ' + (p[1] || '00:00')).sort();
    const ult = carimbos.length ? carimbos[carimbos.length - 1] : '';
    const sync = (window.Nuvem && Nuvem.ultimaSync) ? horaBR(Nuvem.ultimaSync) : null;
    const agora = Dt.agora();
    const chip = (r, v) => `<div class="ex-chip"><span>${r}</span><strong>${v}</strong></div>`;
    return `<section class="card ex-head"><div class="card-b">
      <div class="ex-top"><div><div class="ex-eyebrow">Grupo Brilhante · Frota e manutenção</div><h2 class="ex-title">Visão da Diretoria</h2></div>
        <div class="spacer"></div>
        <button type="button" class="btn sm no-print" id="ex-atualizar">Atualizar agora</button></div>
      <div class="ex-chips">
        ${chip('Tela montada em', Fmt.date(agora.data) + ' ' + agora.hora)}
        ${chip('Última sincronização com a nuvem', sync || 'ainda não sincronizado neste aparelho')}
        ${chip('Última O.S. gravada ou alterada', ult ? Fmt.date(ult.slice(0, 10)) + ' ' + ult.slice(11, 16) : '—')}
        ${chip('O.S. mais recente (data)', datas.length ? Fmt.date(datas[datas.length - 1]) : '—')}
        ${chip('O.S. na base · no filtro', Fmt.num(todas.length) + ' · ' + Fmt.num(x.os.length))}
      </div></div></section>`;
  }

  function conteudo(x, D, Qd) {
    const naoCal = (id, lab, ico) => kpiI(id, lab, '—', 'não cadastrado — veja o que registrar', 'nc', ico);
    const kpis = `<div class="sec-t">Visão geral</div><div class="grid kpis">
      ${kpiI('total', 'Total de OS', Fmt.num(x.os.length), x.canc.length ? Fmt.num(x.canc.length) + ' cancelada(s) incluída(s)' : 'em qualquer situação', false, 'ordens')}
      ${kpiI('emAberto', 'OS em aberto', Fmt.num(x.emAberto.length), x.emAberto.length ? x.os.filter(o => o.status === 'Aberta').length + ' abertas · ' + x.os.filter(o => o.status === 'Em andamento').length + ' em andamento' : 'nenhuma em aberto', x.emAberto.length > 0, 'relogio')}
      ${kpiI('concluidas', 'OS concluídas', Fmt.num(x.concl.length), x.os.length ? Math.round(x.concl.length / x.os.length * 100) + '% do total' : '', false, 'ok')}
      ${naoCal('atrasadas', 'OS atrasadas', 'alerta')}
    </div>
    <div class="sec-t">Custos</div><div class="grid kpis">
      ${kpiI('gasto', 'Gasto total', Fmt.money0(x.soma), 'peças e serviços lançados nas OS', false, 'dinheiro')}
      ${naoCal('pecasServicos', 'Peças × serviços', 'serv')}
      ${kpiI('medio', 'Custo médio por OS', Fmt.money0(x.osC.length ? x.soma / x.osC.length : 0), '', false, 'grafico')}
    </div>
    <div class="sec-t">Frota</div><div class="grid kpis">
      ${kpiI('veiculos', 'Veículos atendidos', Fmt.num(x.veicAtendidos.size), '', false, 'veic')}
      ${kpiI('veicAbertos', 'Veículos com OS em aberto', Fmt.num(x.veicAbertos.size), x.veicAbertos.size ? 'parados ou em manutenção agora' : 'nenhum', x.veicAbertos.size > 0, 'veic')}
      ${naoCal('disponibilidade', 'Dias parado', 'relogio')}
    </div>`;

    const gEvo = cardI('evolucao', 'Evolução mensal dos custos', x.evolucao.length
      ? Chart.barsV(x.evolucao.map(m => ({ rotulo: mesRot(m.chave), valor: m.valor, tip: `<strong>${mesRot(m.chave)}</strong><br>${Fmt.money(m.valor)}<br>${m.qtd} ordens de serviço` })), { fmt: kfmt, aria: 'Gasto por mês' })
      : UI.vazio('Sem custos no período', 'Nenhuma O.S. com data e valor no filtro atual.'));
    const gCat = cardI('categoria', 'Custo por categoria de frota', x.categorias.length
      ? Chart.barsH(x.categorias.slice(0, 10).map(c => ({ rotulo: c.chave, valor: c.valor, cor: c.chave === SEM_CAT ? '#9CA3AF' : undefined,
        tip: `<strong>${Fmt.esc(c.chave)}</strong><br>${Fmt.money(c.valor)}<br>${c.qtd} OS · ${c.veic.size} veículos` })), { aria: 'Gasto por categoria de frota' })
      : UI.vazio('Sem dados', 'Nenhuma O.S. no filtro atual.'));
    const top = x.veiculos.slice(0, 10);
    const gVeic = cardI('veiculosCusto', 'Veículos com maior custo', top.length
      ? Chart.barsH(top.map(v => ({ rotulo: v.nome + (v.placa && v.placa !== '—' ? ' ' + v.placa : ''), valor: v.valor,
        tip: `<strong>${Fmt.esc(v.nome)}</strong> · ${Fmt.esc(v.placa)}<br>${Fmt.money(v.valor)} em ${v.qtd} OS` })), { aria: 'Veículos com maior custo', labelW: 190 })
      : UI.vazio('Sem dados', 'Nenhuma O.S. no filtro atual.'));
    const sv = x.servicos.slice(0, 10);
    const gServ = cardI('servicos', 'Serviços mais recorrentes', UI.tabela(
      [{ t: '#', k: 'p' }, { t: 'Serviço', k: 's' }, { t: 'Em OS', k: 'n', cls: 'ta-r' }, { t: 'Valor somado', k: 'v', cls: 'ta-r' }],
      sv.map((s, i) => ({ p: `<span class="dim">${i + 1}</span>`, s: `<span class="strong">${Fmt.esc(s.nome)}</span>${s.texto && !s.catalogo ? ' <span class="badge b-gray" title="Texto digitado, sem serviço do catálogo">texto</span>' : ''}`, n: Fmt.num(s.os.size), v: Fmt.money(s.valor) })),
      { vazioT: 'Sem serviços', vazioM: 'Nenhuma O.S. no filtro atual.' }), true);

    const tabVeic = cardI('veiculosCusto', 'Custo por veículo e placa', UI.tabela(
      [{ t: '#', k: 'p' }, { t: 'Veículo', k: 'v' }, { t: 'Placa', k: 'pl' }, { t: 'Frota', k: 'f' }, { t: 'Categoria', k: 'c' },
        { t: 'OS', k: 'n', cls: 'ta-r' }, { t: 'Total gasto', k: 't', cls: 'ta-r' }, { t: 'Média por OS', k: 'm', cls: 'ta-r' }, { t: '% do gasto', k: 'pc', cls: 'ta-r' }],
      x.veiculos.slice(0, 15).map((v, i) => ({
        _cls: 'clickable', _attr: ` data-veic="${Fmt.esc(v.os[0].veiculoId || '')}"`,
        p: `<span class="dim">${i + 1}</span>`, v: `<span class="strong">${Fmt.esc(v.nome)}</span>`, pl: `<span class="mono">${Fmt.esc(v.placa)}</span>`,
        f: `<span class="mono">${Fmt.esc(v.frota)}</span>`, c: Fmt.esc(v.cat), n: Fmt.num(v.qtd), t: `<span class="strong">${Fmt.money(v.valor)}</span>`,
        m: Fmt.money(v.valor / v.qtd), pc: x.soma ? (v.valor / x.soma * 100).toFixed(1).replace('.', ',') + '%' : '—'
      })), { vazioT: 'Sem dados', vazioM: 'Nenhuma O.S. no filtro atual.', total: x.veiculos.length > 15 ? { v: `<span class="dim">+ ${x.veiculos.length - 15} veículos fora do top 15</span>` } : undefined }), true);

    const grav = { alto: 0, medio: 1, info: 2 };
    const q = Qd.slice().sort((a, b) => grav[a.nivel] - grav[b.nivel]);
    const nq = q.filter(i => i.nivel !== 'info').length;
    const boxQ = UI.card('Qualidade dos dados — inconsistências e possíveis duplicidades',
      q.length ? `<p class="dim" style="margin:0 0 var(--s3)">Verificação feita sobre as ordens do filtro atual. Nada é corrigido automaticamente: os números acima usam os dados como estão registrados.</p>
        <div class="stack" style="gap:9px">${q.map(i => `<div class="q-item"><span class="badge ${NIVEL[i.nivel][0]}">${NIVEL[i.nivel][1]}</span>
          <div class="q-t"><strong>${Fmt.esc(i.titulo)}</strong><div class="dim">${Fmt.esc(i.detalhe)}</div></div>
          ${i.itens.length ? `<button type="button" class="btn ghost sm" data-q="${i.id}">Ver ${i.itens.length} OS</button>` : ''}</div>`).join('')}</div>`
        : UI.sucesso('Nenhuma inconsistência encontrada', 'Nas verificações feitas, os dados do filtro atual estão consistentes.'),
      nq ? `<span class="badge b-amber">${nq} ${nq === 1 ? 'ponto' : 'pontos'} de atenção</span>` : '');

    const nc = ['atrasadas', 'pecasServicos', 'disponibilidade'].map(id => D[id]);
    const boxNC = UI.card('Indicadores que ainda não existem — o que precisa ser cadastrado',
      `<div class="grid g3">${nc.map(d => `<div class="nc-card"><h3>${Fmt.esc(d.nome)}</h3><p class="dim">${Fmt.esc(d.motivo)}</p>
        <div class="nc-t">Cadastrar</div><ul>${d.cadastrar.map(c => `<li>${Fmt.esc(c)}</li>`).join('')}</ul></div>`).join('')}</div>`);

    return kpis +
      `<div class="sec-t">Evolução e composição</div><div class="grid g2 ex-g2">${gEvo}${gCat}</div>` +
      `<div class="sec-t">Veículos e serviços</div><div class="grid g2 ex-g2">${gVeic}${gServ}</div>` +
      `<div class="stack" style="margin-top:var(--s4)">${tabVeic}</div>` +
      `<div class="sec-t">Confiança nos dados</div><div class="stack">${boxQ}${boxNC}</div>`;
  }

  /* ---------- janelas (modais) ---------- */
  function linhasOS(lista, motivos) {
    return lista.map(it => {
      const o = it.os || it; const v = dadosVeic(o);
      return { _cls: 'clickable', _attr: ` data-os="${Fmt.esc(o.id)}"`, n: `<span class="strong">${Fmt.esc(o.numero)}</span>`, d: Fmt.date(o.data),
        v: `${Fmt.esc(v.nome)} <span class="dim mono">${Fmt.esc(v.placa)}</span>`, s: UI.badgeStatus(situacaoDe(o)), t: Fmt.money(o.total), m: it.motivo ? `<span class="dim">${Fmt.esc(it.motivo)}</span>` : '' };
    });
  }
  function tabelaOS(itens, comMotivo) {
    const MAX = 100;
    const cols = [{ t: 'Nº', k: 'n' }, { t: 'Data', k: 'd' }, { t: 'Veículo', k: 'v' }, { t: 'Situação', k: 's' }, { t: 'Valor', k: 't', cls: 'ta-r' }];
    if (comMotivo) cols.push({ t: 'Motivo', k: 'm' });
    return UI.tabela(cols, linhasOS(itens.slice(0, MAX))) + (itens.length > MAX ? `<p class="dim" style="margin:var(--s2) 0 0">Mostrando ${MAX} de ${Fmt.num(itens.length)}. Baixe o CSV para ver todas.</p>` : '');
  }
  function ligarLinhasOS(bg) {
    bg.querySelectorAll('[data-os]').forEach(r => r.addEventListener('click', () => { UI.fecharModal(); App.irPara('ordens/' + r.dataset.os); }));
  }
  function baixarCSV(nome, lista) {
    const esc = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const cab = ['Nº OS', 'Data', 'Veículo', 'Placa', 'Categoria', 'Responsável', 'Situação', 'Valor', 'Itens'];
    const lin = lista.map(o => { const v = dadosVeic(o); return [o.numero, o.data || '', v.nome, v.placa, v.cat, o.mecanico || '', situacaoDe(o), String(o.total || 0).replace('.', ','), (o.itens || []).map(i => i.descricao).join(' | ')].map(esc).join(';'); });
    const blob = new Blob(['﻿' + [cab.map(esc).join(';')].concat(lin).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function janelaIndicador(d, f) {
    const filtroTxt = condicoes(f).length ? 'Filtros ativos: ' + condicoes(f).map(c => c.split('  --')[0]).join(' · ') : 'Sem filtros: todas as ordens da base.';
    let corpo;
    if (d.naoCalc) {
      corpo = `<div class="ind-v">Não calculável</div><h3 class="ind-h">Por que não</h3><p>${Fmt.esc(d.motivo)}</p>
        <h3 class="ind-h">O que precisa ser cadastrado</h3><ul>${d.cadastrar.map(c => `<li>${Fmt.esc(c)}</li>`).join('')}</ul>
        <p class="dim">Enquanto isso não existir, o painel mostra "—" e não faz estimativas.</p>`;
    } else {
      corpo = `<div class="ind-v">${d.valor}</div>
        <h3 class="ind-h">Como é calculado</h3>${d.explica.map(t => `<p>${Fmt.esc(t)}</p>`).join('')}
        ${d.aviso ? `<p class="ind-aviso">${Fmt.esc(d.aviso)}</p>` : ''}
        <h3 class="ind-h">Consulta equivalente</h3><pre class="sql">${Fmt.esc(d.sql)}</pre>
        <p class="dim">${Fmt.esc(filtroTxt)} O painel faz a conta no navegador sobre as O.S. da base, sincronizada com a tabela <code>ordens</code> da nuvem; a consulta acima é a forma equivalente de conferir.</p>
        <h3 class="ind-h">Ordens usadas na conta (${Fmt.num(d.conjunto.length)})</h3>${tabelaOS(d.conjunto)}`;
    }
    const rodape = (d.naoCalc ? '' : `<button type="button" class="btn ghost" id="ind-copiar">Copiar consulta</button><button type="button" class="btn ghost" id="ind-csv">Baixar CSV das ordens</button>`) + `<div class="spacer"></div><button type="button" class="btn" data-fechar>Fechar</button>`;
    const bg = UI.modal(d.nome, corpo, rodape, '820px');
    ligarLinhasOS(bg);
    const c = bg.querySelector('#ind-copiar');
    if (c) c.addEventListener('click', () => { try { navigator.clipboard.writeText(d.sql).then(() => UI.toast('Consulta copiada', 'ok'), () => UI.toast('Não foi possível copiar', 'warn')); } catch (e) { UI.toast('Não foi possível copiar', 'warn'); } });
    const v = bg.querySelector('#ind-csv');
    if (v) v.addEventListener('click', () => baixarCSV('executivo_' + d.nome.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.csv', d.conjunto));
  }
  const escCSV = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  function baixarTexto(nome, linhas) {
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const csvRenumeracao = prop => ['ID da O.S.;Nº antigo;Nº novo;Data;Veículo;Placa;Responsável;Valor'].concat(prop.map(m => {
    const v = dadosVeic(m.os);
    return [m.os.id, m.de, m.para, m.os.data || '', v.nome, v.placa, m.os.mecanico || '', String(m.os.total || 0).replace('.', ',')].map(escCSV).join(';');
  }));
  const assinaturaProp = prop => prop.map(m => m.os.id + '>' + m.para).join('|');

  /* Corrige números de O.S. repetidos. Regra: a O.S. mais antiga (pela data) mantém o número; as outras
     recebem números novos acima do maior número existente (incluindo o da nuvem). Primeiro mostra o que
     vai mudar; só altera depois do clique em "Aplicar". A nuvem é atualizada ANTES do aparelho. */
  function janelaRenumeracao() {
    const prop = DB.propostaRenumeracao();
    if (!prop.length) { UI.toast('Nenhum número repetido para corrigir.', 'ok'); return; }
    const cols = [{ t: 'Data', k: 'd' }, { t: 'Veículo', k: 'v' }, { t: 'Valor', k: 't', cls: 'ta-r' }, { t: 'Nº atual', k: 'de' }, { t: 'Passa a ser', k: 'para' }];
    const linhas = prop.map(m => { const v = dadosVeic(m.os); return { d: Fmt.date(m.os.data), v: `${Fmt.esc(v.nome)} <span class="dim mono">${Fmt.esc(v.placa)}</span>`, t: Fmt.money(m.os.total), de: `<span class="dim">${Fmt.esc(m.de)}</span>`, para: `<span class="strong">${Fmt.esc(m.para)}</span>` }; });
    const corpo = `<p><b>${Fmt.num(prop.length)} O.S.</b> vão receber número novo. Em cada número repetido, a O.S. <b>mais antiga</b> (pela data) continua com o número; as outras passam a usar números ainda livres, em ordem de data.</p>
      <p class="ind-aviso">Atenção: se alguma dessas O.S. já foi impressa ou citada com o número antigo, use o CSV abaixo para conferir "nº antigo → nº novo". O valor, a data e os itens não mudam.</p>
      ${UI.tabela(cols, linhas.slice(0, 200))}${linhas.length > 200 ? `<p class="dim">Mostrando 200 de ${linhas.length}. O CSV traz todas.</p>` : ''}`;
    const bg = UI.modal('Corrigir números repetidos', corpo,
      `<button type="button" class="btn ghost" id="rn-csv">Baixar CSV (de → para)</button><div class="spacer"></div><button type="button" class="btn ghost" data-fechar>Cancelar</button><button type="button" class="btn" id="rn-aplicar">Aplicar renumeração</button>`, '820px');
    bg.querySelector('#rn-csv').addEventListener('click', () => baixarTexto('renumeracao_os_previa.csv', csvRenumeracao(prop)));
    const bt = bg.querySelector('#rn-aplicar');
    bt.addEventListener('click', async () => {
      bt.disabled = true; bt.textContent = 'Conferindo a nuvem…';
      let atual = null;
      try {
        const ok = !!(window.Nuvem && await Nuvem.sincronizar());
        if (ok) { const mx = await Nuvem.atualizarMaximo(); if (mx !== null) atual = DB.propostaRenumeracao(); }
      } catch (e) { }
      if (!atual) { UI.toast('Sem conexão com a nuvem. Nada foi alterado — tente de novo com internet.', 'warn'); bt.disabled = false; bt.textContent = 'Aplicar renumeração'; return; }
      if (assinaturaProp(atual) !== assinaturaProp(prop)) { UI.fecharModal(); UI.toast('A nuvem mudou desde que você abriu esta tela. Confira a nova prévia.', 'warn'); if (atual.length) janelaRenumeracao(); else App.render(); return; }
      bt.textContent = 'Gravando na nuvem…';
      try { await Nuvem.enviarOrdens(prop.map(m => Object.assign({}, m.os, { numero: m.para }))); }
      catch (e) { UI.toast('Não foi possível gravar na nuvem (' + e.message + '). Nada foi alterado neste aparelho.', 'err'); bt.disabled = false; bt.textContent = 'Aplicar renumeração'; return; }
      DB.aplicarRenumeracao(prop);
      baixarTexto('renumeracao_os_aplicada.csv', csvRenumeracao(prop));
      UI.fecharModal(); UI.toast(prop.length + ' O.S. renumeradas. O CSV com "nº antigo → nº novo" foi baixado.', 'ok'); App.render();
    });
  }

  function janelaQualidade(i) {
    const pode = i.id === 'num-repetido' && Perm.pode('os.editar') && Perm.pode('os.excluir') && DB.propostaRenumeracao().length > 0;
    const bg = UI.modal(i.titulo, `<p>${Fmt.esc(i.detalhe)}</p>${tabelaOS(i.itens, true)}`,
      `<button type="button" class="btn ghost" id="q-csv">Baixar CSV</button>${pode ? '<button type="button" class="btn ghost" id="q-corrigir">Corrigir números repetidos</button>' : ''}<div class="spacer"></div><button type="button" class="btn" data-fechar>Fechar</button>`, '820px');
    ligarLinhasOS(bg);
    bg.querySelector('#q-csv').addEventListener('click', () => baixarCSV('qualidade_' + i.id + '.csv', i.itens.map(z => z.os)));
    const c = bg.querySelector('#q-corrigir');
    if (c) c.addEventListener('click', () => { UI.fecharModal(); janelaRenumeracao(); });
  }

  /* ---------- página ---------- */
  function pagina() {
    App.aoRenderizar = ligar;
    App.acoesTopo('');
    return `<div class="stack" id="exec-raiz"><div id="ex-cab"></div>${barraFiltros()}<div id="exec"></div></div>`;
  }

  function ligar() {
    let ctx, D, Qd;
    const pintar = () => {
      ctx = contexto(); D = indicadores(ctx); Qd = qualidade(ctx);
      document.getElementById('ex-cab').innerHTML = cabecalho(ctx);
      const el = document.getElementById('exec');
      el.innerHTML = conteudo(ctx, D, Qd);
      Chart.ligarTooltips(el);
      ligarAtualizar();
      el.querySelectorAll('[data-ind]').forEach(b => b.addEventListener('click', () => janelaIndicador(D[b.dataset.ind], ctx.f)));
      el.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => janelaQualidade(Qd.find(i => i.id === b.dataset.q))));
      el.querySelectorAll('tr[data-veic]').forEach(r => { if (r.dataset.veic) r.addEventListener('click', () => App.irPara('veiculo/' + r.dataset.veic)); });
    };
    function ligarAtualizar() {
      const btn = document.getElementById('ex-atualizar');
      if (!btn) return;
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = 'Atualizando…';
        let ok = false;
        try { ok = !!(window.Nuvem && await Nuvem.sincronizar()); } catch (e) { }
        UI.toast(ok ? 'Dados atualizados com a nuvem' : 'Sem conexão com a nuvem — mostrando os dados deste aparelho', ok ? 'ok' : 'warn');
        pintar();
      });
    }
    const f = fx();
    const set = (id, chave, ev) => { const e = document.getElementById('fx-' + id); if (e) e.addEventListener(ev || 'change', () => { f[chave] = e.value; pintar(); }); };
    set('de', 'de'); set('ate', 'ate'); set('veiculo', 'veiculo'); set('placa', 'placa', 'input');
    set('cat', 'categoria'); set('status', 'status'); set('resp', 'resp');
    const atalho = document.getElementById('fx-atalho');
    atalho.addEventListener('change', () => {
      const h = Dt.today(); const v = atalho.value; atalho.value = '';
      if (!v) return;
      if (v === 'tudo') { f.de = ''; f.ate = ''; }
      else if (v === '30') { f.de = Dt.add(h, -29); f.ate = h; }
      else if (v === 'mes') { f.de = Dt.monthStart(h); f.ate = Dt.monthEnd(h); }
      else if (v === 'mes-1') { const m = Dt.add(Dt.monthStart(h), -1); f.de = Dt.monthStart(m); f.ate = Dt.monthEnd(m); }
      else if (v === 'ano') { f.de = h.slice(0, 4) + '-01-01'; f.ate = h.slice(0, 4) + '-12-31'; }
      document.getElementById('fx-de').value = f.de; document.getElementById('fx-ate').value = f.ate;
      pintar();
    });
    document.getElementById('fx-limpar').addEventListener('click', () => { Estado.fx = null; App.render(); });
    pintar();
  }

  return { pagina, filtrar, contexto, indicadores, qualidade };
})();
