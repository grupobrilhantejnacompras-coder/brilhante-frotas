/* ============================================================
   SINCRONIZAÇÃO COM SUPABASE — Ordens de Serviço
   As O.S. passam a ser gravadas/lidas na nuvem, para acesso de
   qualquer computador. O localStorage continua como reserva
   offline: se a internet cair, o app segue funcionando e
   sincroniza quando a conexão voltar.
   Desde a v6.20 o cadastro de veículos também é espelhado na nuvem
   (tabela "veiculos_cadastro") e a numeração das O.S. é protegida contra repetição.
   (Serviços seguem locais.)
   ============================================================ */
const Nuvem = (() => {
  const URL = 'https://ysszhioygqyjbcgjgpca.supabase.co';
  const KEY = 'sb_publishable_YCcTEzIBU08P-P-xxlKTkA_2eJE-irT';
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  let online = true;
  let ultimaSync = null;                                       // quando a nuvem foi lida com sucesso pela última vez
  try { ultimaSync = localStorage.getItem('brilhante_ultima_sync'); } catch (e) { }

  // A coluna "status" (situação da O.S.) pode ainda não existir na tabela da nuvem.
  // null = não sei; true = existe; false = não existe (então não é enviada).
  let colStatus = null;
  // OS do app  ->  linha do banco
  const paraLinha = o => ({
    id: o.id, numero: o.numero ?? null, data: o.data || null, veiculo_id: o.veiculoId || null,
    placa: o.placa || null, frota: o.frota || null, local: o.local || null, condutor: o.condutor || null,
    mecanico: o.mecanico || null, km_h: (o.kmH ?? null), tipo_medidor: o.tipoMedidor || null,
    obs: o.obs || null, itens: o.itens || [], total: o.total || 0,
    criado_por: o.criadoPor || null, criado_data: o.criadoData || null, criado_hora: o.criadoHora || null,
    alterado_por: o.alteradoPor || null, alterado_data: o.alteradoData || null, alterado_hora: o.alteradoHora || null,
    ...(colStatus !== false ? { status: o.status || null } : {})
  });
  // linha do banco  ->  OS do app
  const paraOS = l => ({
    id: l.id, numero: l.numero, data: l.data, veiculoId: l.veiculo_id,
    placa: l.placa, frota: l.frota, local: l.local, condutor: l.condutor,
    mecanico: l.mecanico, kmH: l.km_h == null ? null : Number(l.km_h),
    tipoMedidor: l.tipo_medidor, obs: l.obs, itens: l.itens || [], total: Number(l.total) || 0,
    criadoPor: l.criado_por, criadoData: l.criado_data, criadoHora: l.criado_hora,
    alteradoPor: l.alterado_por, alteradoData: l.alterado_data, alteradoHora: l.alterado_hora,
    status: l.status || ''
  });

  async function req(path, opts, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
    try {
      const r = await fetch(URL + '/rest/v1/' + path, { ...opts, headers: { ...H, ...(opts && opts.headers) }, signal: ctrl.signal });
      if (!r.ok) throw new Error('Supabase ' + r.status);
      return r;
    } finally { clearTimeout(t); }
  }
  // Envia O.S. (uma ou várias). Se o banco recusar por causa da coluna "status" que
  // ainda não existe, reenvia sem ela — a O.S. nunca deixa de ser salva por isso.
  async function postarOrdens(lista) {
    const enviar = () => req('ordens', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(lista.map(paraLinha)) });
    try { await enviar(); }
    catch (e) {
      if (colStatus === false || !/ 400$/.test(e.message)) throw e;
      colStatus = false;
      try { await enviar(); } catch (e2) { colStatus = null; throw e2; }
    }
  }
  const enviarUma = os => postarOrdens([os]);
  // envia várias de uma vez (migração), em blocos
  async function enviarVarias(lista) {
    for (let i = 0; i < lista.length; i += 100) await postarOrdens(lista.slice(i, i + 100));
  }
  const apagarUma = id => req('ordens?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
  async function baixarTodas() {
    const linhas = await (await req('ordens?select=*')).json();
    if (linhas.length) colStatus = ('status' in linhas[0]);   // a nuvem mostra se tem a coluna
    linhas.forEach(l => DB.lembrarMaxNuvem(l.numero));        // o próximo número nunca fica abaixo do que já existe na nuvem
    return linhas.map(paraOS);
  }
  // Consulta leve do maior número de O.S. na nuvem (usada ao abrir "Nova OS" e antes de numerar).
  async function atualizarMaximo() {
    try {
      const l = await (await req('ordens?select=numero&numero=not.is.null&order=numero.desc&limit=1', {}, 5000)).json();
      if (l[0]) DB.lembrarMaxNuvem(l[0].numero);
      return l[0] ? Number(l[0].numero) : 0;
    } catch (e) { return null; }
  }
  // O número já está em uso por OUTRA O.S. na nuvem? (lança erro se estiver offline)
  async function numeroEmUso(os) {
    const l = await (await req('ordens?select=id&numero=eq.' + encodeURIComponent(os.numero) + '&id=neq.' + encodeURIComponent(os.id) + '&limit=1', {}, 6000)).json();
    return l.length > 0;
  }
  function renumerar(os) {
    const de = os.numero; os.numero = DB.proximoNumero(); DB.save();
    try { UI.toast('O número ' + de + ' já estava em uso em outro computador. Esta OS foi salva como Nº ' + os.numero + '.', 'warn'); } catch (e) { }
    return os.numero;
  }
  /* Envia uma O.S. NOVA garantindo número único: confere antes e, se houver conflito
     (ou se o banco recusar por índice único — HTTP 409), pega o próximo número livre. */
  async function enviarNova(os) {
    for (let t = 0; t < 5; t++) {
      if (!(await numeroEmUso(os))) {
        try { await enviarUma(os); return; }
        catch (e) { if (!/ 409$/.test(e.message)) throw e; }
      }
      await atualizarMaximo();
      renumerar(os);
    }
    throw new Error('numeracao');
  }

  function marcadas() { return new Set(DB.get().sincronizados || []); }
  function marcar(ids, incluir) {
    const b = DB.get(); const s = new Set(b.sincronizados || []);
    ids.forEach(id => incluir ? s.add(id) : s.delete(id));
    b.sincronizados = [...s]; DB.save();
  }

  /* Sincroniza: sobe as O.S. locais que ainda não estão na nuvem
     (migração inicial + lançamentos feitos offline) e baixa o resto.
     A nuvem é a fonte da verdade — some do local o que foi excluído
     em outro computador. Devolve true se a base mudou. */
  async function sincronizar() {
    const base = DB.get();
    let remotas;
    try { remotas = await baixarTodas(); online = true; }
    catch (e) { online = false; return false; }               // offline: mantém o local
    // Situação da O.S.: a que veio da nuvem vale; se a nuvem ainda não tem (coluna nova ou
    // ficha antiga), mantém a deste aparelho; sem nenhuma, usa 'Concluída' (padrão do sistema).
    const locaisPorId = new Map(base.ordens.map(o => [o.id, o]));
    const semStatusNaNuvem = [];
    remotas.forEach(o => {
      if (o.status) return;
      o.status = (locaisPorId.get(o.id) || {}).status || 'Concluída';
      semStatusNaNuvem.push(o);
    });
    // Veículos: cadastro compartilhado entre os computadores (antes das O.S., para a categoria já valer).
    try { await sincronizarVeiculos(); } catch (e) { }
    const idsRemotos = new Set(remotas.map(o => o.id));
    const jaSync = marcadas();
    // sobe as locais nunca sincronizadas
    const subir = base.ordens.filter(o => !idsRemotos.has(o.id) && !jaSync.has(o.id));
    // O.S. feitas offline podem ter pego um número que outro computador já usou: renumera ANTES de subir.
    // Regra: quem já está na nuvem mantém o número; entre as novas, a mais antiga (pela data) mantém.
    if (subir.length) {
      const usados = new Set(remotas.map(o => String(o.numero)));
      let max = Math.max(DB.maiorNumero(), ...remotas.map(o => Number(o.numero) || 0));
      let mudouNum = false;
      [...subir].sort((a, b) => ((a.data || '') + (a.criadoHora || '') + a.id).localeCompare((b.data || '') + (b.criadoHora || '') + b.id)).forEach(o => {
        if (o.numero != null && o.numero !== '' && !usados.has(String(o.numero))) { usados.add(String(o.numero)); return; }
        o.numero = ++max; usados.add(String(o.numero)); mudouNum = true;
      });
      if (mudouNum) DB.lembrarMaxNuvem(max);
    }
    let subiram = [];
    if (subir.length) {
      try { await enviarVarias(subir); subiram = subir; }
      catch (e) {
        // um bloco falhou (offline ou número recusado pelo banco): tenta uma a uma; o que não subir fica pendente.
        for (const o of subir) { try { await enviarNova(o); subiram.push(o); } catch (e2) { online = false; } }
      }
    }
    // base final = remotas + as locais (as que não subiram continuam locais, pendentes para a próxima vez)
    const mapa = new Map(remotas.map(o => [o.id, o]));
    subir.forEach(o => { if (!mapa.has(o.id)) mapa.set(o.id, o); });
    base.ordens = [...mapa.values()];
    const pendentes = new Set(subir.filter(o => !subiram.includes(o)).map(o => o.id));
    base.sincronizados = [...mapa.keys()].filter(id => !pendentes.has(id));
    // "Equipe Ar Condicionado" → Gemerson (mesma pessoa): corrige o que veio da nuvem
    // e grava de volta lá; se falhar (offline), a próxima sincronização tenta de novo.
    const renomeadas = DB.normalizarMecanicos(base);
    if (renomeadas.length) {
      try { await enviarVarias(renomeadas); }
      catch (e) { online = false; base.sincronizados = base.sincronizados.filter(id => !renomeadas.some(o => o.id === id)); }
    }
    // Coluna "status" já existe no banco mas estas O.S. ainda estão sem situação lá: grava.
    if (colStatus === true && semStatusNaNuvem.length) {
      try { await enviarVarias(semStatusNaNuvem); } catch (e) { /* tenta de novo na próxima */ }
    }
    DB.save();
    ultimaSync = new Date().toISOString();
    try { localStorage.setItem('brilhante_ultima_sync', ultimaSync); } catch (e) { }
    return true;
  }

  // Chamados em segundo plano ao salvar/excluir uma O.S.
  // O.S. nova (ainda não marcada como sincronizada) passa pela conferência de número único.
  function aoSalvar(os) {
    const nova = !marcadas().has(os.id);
    marcar([os.id], true);
    (nova ? enviarNova(os) : enviarUma(os)).catch(() => marcar([os.id], false));
  }
  function aoExcluir(id) { apagarUma(id).catch(() => {}); }

  /* ---------- Veículos (cadastro compartilhado) ----------
     Tabela "veiculos_cadastro" (ver supabase_v620.sql). Se ela ainda não existir, nada muda:
     o cadastro segue local e o app funciona como antes. */
  let veicNuvem = null;                                        // null = não sei; true = tabela existe; false = não existe
  const veicParaLinha = v => ({ id: v.id, nome: v.nome || null, placa: v.placa || null, tipo: v.tipo || null, dados: v, atualizado_em: new Date().toISOString() });
  const linhaParaVeic = l => {
    const d = (l.dados && typeof l.dados === 'object') ? l.dados : {};
    const v = Object.assign({}, d, { id: l.id });
    if (v.nome == null && l.nome != null) v.nome = l.nome;
    if (v.placa == null && l.placa != null) v.placa = l.placa;
    if (v.tipo == null && l.tipo != null) v.tipo = l.tipo;
    return v;
  };
  const canon = v => JSON.stringify(Object.keys(v).sort().map(k => [k, v[k]]));
  // mescla um veículo local com o da nuvem: a nuvem vale, exceto o KM/H, onde vale o mais recente.
  function mesclarVeic(l, r) {
    const m = Object.assign({}, l, r);
    const lNovo = l.kmAtual != null && (r.kmAtual == null || (l.kmAtualData || '') > (r.kmAtualData || '') ||
      ((l.kmAtualData || '') === (r.kmAtualData || '') && Number(l.kmAtual) > Number(r.kmAtual)));
    if (lNovo) { m.kmAtual = l.kmAtual; m.kmAtualData = l.kmAtualData; }
    return { m, localMaisNovo: lNovo };
  }
  async function postarVeiculos(lista) {
    for (let i = 0; i < lista.length; i += 100)
      await req('veiculos_cadastro', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(lista.slice(i, i + 100).map(veicParaLinha)) }, 12000);
  }
  function pendenciaVeic(ids, incluir) {
    const b = DB.get(); const s = new Set(b.veiculosPendentes || []);
    ids.forEach(id => incluir ? s.add(id) : s.delete(id));
    b.veiculosPendentes = [...s]; DB.save();
  }
  /* Une o cadastro local ao da nuvem: o que só existe na nuvem entra; o que só existe aqui sobe;
     edições feitas aqui e ainda não enviadas não são sobrescritas. Devolve true se o local mudou. */
  async function sincronizarVeiculos() {
    let linhas;
    try { linhas = await (await req('veiculos_cadastro?select=*&limit=5000', {}, 10000)).json(); veicNuvem = true; }
    catch (e) { if (/ (400|404)$/.test(e.message)) veicNuvem = false; return false; }
    const b = DB.get();
    const pend = new Set(b.veiculosPendentes || []);
    const remotos = new Map(linhas.map(l => [l.id, linhaParaVeic(l)]));
    const idxLocal = new Map(b.veiculos.map((v, i) => [v.id, i]));
    let mudou = false; const subir = [];
    remotos.forEach((r, id) => {
      if (!idxLocal.has(id)) { b.veiculos.push(r); mudou = true; return; }
      const i = idxLocal.get(id), l = b.veiculos[i];
      if (pend.has(id)) { subir.push(l); return; }
      const { m, localMaisNovo } = mesclarVeic(l, r);
      if (canon(m) !== canon(l)) { b.veiculos[i] = m; mudou = true; }
      if (localMaisNovo) subir.push(m);
    });
    b.veiculos.forEach(v => { if (!remotos.has(v.id)) subir.push(v); });
    if (mudou) DB.save();
    if (subir.length) {
      try { await postarVeiculos(subir); pendenciaVeic(subir.map(v => v.id), false); }
      catch (e) { /* tenta de novo na próxima sincronização */ }
    }
    return mudou;
  }
  // Ao cadastrar/editar um veículo (ou quando o KM/H dele muda por uma O.S.): envia em segundo plano.
  function aoSalvarVeiculo(v) {
    pendenciaVeic([v.id], true);
    if (veicNuvem === false) return;
    postarVeiculos([v]).then(() => pendenciaVeic([v.id], false)).catch(() => { });
  }

  /* ---------- Usuários (login, cadastro e permissões) ----------
     A senha nunca trafega em texto puro fora do RPC (que a transforma em
     hash no próprio banco) e a leitura pública usa uma VIEW sem a coluna
     de hash — ver supabase_usuarios_sync.sql. */
  const linhaParaUsuario = l => ({
    id: l.id, nome: l.nome, usuario: l.usuario, perfil: l.perfil,
    setor: l.setor || '', status: l.status || 'Ativo',
    permissoes: l.permissoes || [], ultimoAcesso: l.ultimo_acesso || '',
    criadoEm: l.criado_em || ''
  });

  async function baixarUsuarios() {
    const r = await req('usuarios_publico?select=*', {}, 8000);
    return (await r.json()).map(linhaParaUsuario);
  }

  /* Baixa a lista de usuários da nuvem (fonte da verdade) e atualiza o
     cache local — usada pela tela de Usuários e como reserva offline de
     login. Devolve true se algo mudou. */
  async function sincronizarUsuarios() {
    let remotos;
    try { remotos = await baixarUsuarios(); }
    catch (e) { return false; }
    const b = DB.get();
    const porId = new Map((b.usuarios || []).map(u => [u.id, u]));
    const antes = JSON.stringify(b.usuarios || []);
    // mantém a senha em cache local só como reserva offline (não é mais usada pra login online).
    // Se a nuvem não tiver permissões preenchidas pra alguém (ficha antiga),
    // não deixa isso apagar o que já existe neste aparelho — mantém o local
    // ou cai pro padrão do perfil, nunca fica sem nenhuma.
    b.usuarios = remotos.map(r => {
      const local = porId.get(r.id) || {};
      const semPermissoes = !Array.isArray(r.permissoes) || !r.permissoes.length;
      return {
        ...r, senha: local.senha || '',
        permissoes: semPermissoes
          ? ((Array.isArray(local.permissoes) && local.permissoes.length) ? local.permissoes : Perm.doPerfil(r.perfil))
          : r.permissoes
      };
    });
    DB.save();
    return JSON.stringify(b.usuarios) !== antes;
  }

  /* Confere usuário/senha direto no banco (hash nunca sai de lá).
     Devolve o usuário (sem senha) se bateu, ou null se não achou. */
  async function verificarLoginNuvem(usuario, senha) {
    const r = await req('rpc/verificar_login', {
      method: 'POST', body: JSON.stringify({ p_usuario: usuario, p_senha: senha })
    }, 6000);
    const linhas = await r.json();
    return linhas && linhas[0] ? linhaParaUsuario(linhas[0]) : null;
  }

  /* Cria ou atualiza um usuário na nuvem. senhaPlana === null/undefined
     mantém a senha atual (a função no banco só troca o hash se vier algo). */
  async function salvarUsuarioNuvem(u, senhaPlana) {
    return req('rpc/salvar_usuario', {
      method: 'POST',
      body: JSON.stringify({
        p_id: u.id, p_nome: u.nome, p_usuario: u.usuario, p_senha: senhaPlana || null,
        p_perfil: u.perfil, p_setor: u.setor || null, p_status: u.status || 'Ativo',
        p_permissoes: u.permissoes || []
      })
    });
  }
  async function excluirUsuarioNuvem(id) {
    return req('rpc/excluir_usuario', { method: 'POST', body: JSON.stringify({ p_id: id }) });
  }

  return {
    sincronizar, aoSalvar, aoExcluir, get online() { return online; },
    get ultimaSync() { return ultimaSync; }, statusNaNuvem: () => colStatus,
    sincronizarVeiculos, aoSalvarVeiculo, statusVeiculosNuvem: () => veicNuvem,
    atualizarMaximo, enviarOrdens: enviarVarias,
    sincronizarUsuarios, verificarLoginNuvem, salvarUsuarioNuvem, excluirUsuarioNuvem
  };
})();
window.Nuvem = Nuvem;

/* Embrulha DB.salvarOS/excluirOS para espelhar na nuvem, sem alterar o core. */
(function ligarNuvem() {
  const _salvar = DB.salvarOS, _excluir = DB.excluirOS;
  const _salvarV = DB.salvarVeiculo;
  DB.salvarOS = function (os) {
    const v = DB.veiculo(os.veiculoId), kmAntes = v ? v.kmAtual : null, dataAntes = v ? v.kmAtualData : null;
    const r = _salvar.call(DB, os);
    try { Nuvem.aoSalvar(r); } catch (e) { }
    // o KM/H atual do veículo muda ao lançar uma O.S.: leva o veículo atualizado junto
    try { const v2 = DB.veiculo(r.veiculoId); if (v2 && (v2.kmAtual !== kmAntes || v2.kmAtualData !== dataAntes)) Nuvem.aoSalvarVeiculo(v2); } catch (e) { }
    return r;
  };
  DB.salvarVeiculo = function (v) { const r = _salvarV.call(DB, v); try { Nuvem.aoSalvarVeiculo(r); } catch (e) { } return r; };
  DB.excluirOS = function (id) { const r = _excluir.call(DB, id); try { Nuvem.aoExcluir(id); } catch (e) { } return r; };

  // Embrulha DB.salvarUsuario/excluirUsuario do mesmo jeito, pra criação/edição/
  // exclusão de usuário valer em qualquer computador ou celular, não só onde foi feita.
  const _salvarU = DB.salvarUsuario, _excluirU = DB.excluirUsuario;
  DB.salvarUsuario = function (u) {
    const novo = !u.id;
    // _novaSenhaPlana: null = "manter a senha atual" (edição sem trocar senha);
    // string = senha nova digitada agora; undefined (não veio) só acontece em
    // telas que não mexem em senha (ex.: salvar só o nome) — também mantém.
    const senhaCloud = Object.prototype.hasOwnProperty.call(u, '_novaSenhaPlana')
      ? u._novaSenhaPlana : (novo ? u.senha : null);
    delete u._novaSenhaPlana;
    const r = _salvarU.call(DB, u);
    try { Nuvem.salvarUsuarioNuvem(r, senhaCloud).catch(() => { }); } catch (e) { }
    return r;
  };
  DB.excluirUsuario = function (id) {
    const r = _excluirU.call(DB, id);
    if (r) { try { Nuvem.excluirUsuarioNuvem(id).catch(() => { }); } catch (e) { } }
    return r;
  };

  // Ao abrir já logado, sincroniza em segundo plano e atualiza a tela.
  if (typeof Estado !== 'undefined' && Estado.usuario) {
    Nuvem.sincronizar().then(mudou => { if (mudou) App.render(); }).catch(() => { });
    Nuvem.sincronizarUsuarios().then(mudou => { if (mudou) App.render(); }).catch(() => { });
  }
})();
