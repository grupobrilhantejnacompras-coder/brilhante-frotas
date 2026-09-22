/* ============================================================
   SINCRONIZAÇÃO COM SUPABASE — Ordens de Serviço
   As O.S. passam a ser gravadas/lidas na nuvem, para acesso de
   qualquer computador. O localStorage continua como reserva
   offline: se a internet cair, o app segue funcionando e
   sincroniza quando a conexão voltar.
   (Login, usuários, veículos e serviços seguem locais.)
   ============================================================ */
const Nuvem = (() => {
  const URL = 'https://ysszhioygqyjbcgjgpca.supabase.co';
  const KEY = 'sb_publishable_YCcTEzIBU08P-P-xxlKTkA_2eJE-irT';
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  let online = true;

  // OS do app  ->  linha do banco
  const paraLinha = o => ({
    id: o.id, numero: o.numero ?? null, data: o.data || null, veiculo_id: o.veiculoId || null,
    placa: o.placa || null, frota: o.frota || null, local: o.local || null, condutor: o.condutor || null,
    mecanico: o.mecanico || null, km_h: (o.kmH ?? null), tipo_medidor: o.tipoMedidor || null,
    obs: o.obs || null, itens: o.itens || [], total: o.total || 0,
    criado_por: o.criadoPor || null, criado_data: o.criadoData || null, criado_hora: o.criadoHora || null,
    alterado_por: o.alteradoPor || null, alterado_data: o.alteradoData || null, alterado_hora: o.alteradoHora || null
  });
  // linha do banco  ->  OS do app
  const paraOS = l => ({
    id: l.id, numero: l.numero, data: l.data, veiculoId: l.veiculo_id,
    placa: l.placa, frota: l.frota, local: l.local, condutor: l.condutor,
    mecanico: l.mecanico, kmH: l.km_h == null ? null : Number(l.km_h),
    tipoMedidor: l.tipo_medidor, obs: l.obs, itens: l.itens || [], total: Number(l.total) || 0,
    criadoPor: l.criado_por, criadoData: l.criado_data, criadoHora: l.criado_hora,
    alteradoPor: l.alterado_por, alteradoData: l.alterado_data, alteradoHora: l.alterado_hora
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
  const enviarUma = os => req('ordens', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(paraLinha(os)) });
  // envia várias de uma vez (migração), em blocos
  async function enviarVarias(lista) {
    for (let i = 0; i < lista.length; i += 100) {
      const bloco = lista.slice(i, i + 100).map(paraLinha);
      await req('ordens', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(bloco) });
    }
  }
  const apagarUma = id => req('ordens?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
  async function baixarTodas() { return (await (await req('ordens?select=*')).json()).map(paraOS); }

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
    const idsRemotos = new Set(remotas.map(o => o.id));
    const jaSync = marcadas();
    // sobe as locais nunca sincronizadas
    const subir = base.ordens.filter(o => !idsRemotos.has(o.id) && !jaSync.has(o.id));
    if (subir.length) { try { await enviarVarias(subir); } catch (e) { online = false; } }
    // base final = remotas + as que acabaram de subir
    const mapa = new Map(remotas.map(o => [o.id, o]));
    subir.forEach(o => { if (!mapa.has(o.id)) mapa.set(o.id, o); });
    base.ordens = [...mapa.values()];
    base.sincronizados = [...mapa.keys()];
    DB.save();
    return true;
  }

  // Chamados em segundo plano ao salvar/excluir uma O.S.
  function aoSalvar(os) { marcar([os.id], true); enviarUma(os).catch(() => marcar([os.id], false)); }
  function aoExcluir(id) { apagarUma(id).catch(() => {}); }

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
    // mantém a senha em cache local só como reserva offline (não é mais usada pra login online)
    b.usuarios = remotos.map(r => ({ ...r, senha: (porId.get(r.id) || {}).senha || '' }));
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
    sincronizarUsuarios, verificarLoginNuvem, salvarUsuarioNuvem, excluirUsuarioNuvem
  };
})();
window.Nuvem = Nuvem;

/* Embrulha DB.salvarOS/excluirOS para espelhar na nuvem, sem alterar o core. */
(function ligarNuvem() {
  const _salvar = DB.salvarOS, _excluir = DB.excluirOS;
  DB.salvarOS = function (os) { const r = _salvar.call(DB, os); try { Nuvem.aoSalvar(r); } catch (e) { } return r; };
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
