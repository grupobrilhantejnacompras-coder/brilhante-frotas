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

  async function req(path, opts) {
    const r = await fetch(URL + '/rest/v1/' + path, { ...opts, headers: { ...H, ...(opts && opts.headers) } });
    if (!r.ok) throw new Error('Supabase ' + r.status);
    return r;
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

  return { sincronizar, aoSalvar, aoExcluir, get online() { return online; } };
})();
window.Nuvem = Nuvem;

/* Embrulha DB.salvarOS/excluirOS para espelhar na nuvem, sem alterar o core. */
(function ligarNuvem() {
  const _salvar = DB.salvarOS, _excluir = DB.excluirOS;
  DB.salvarOS = function (os) { const r = _salvar.call(DB, os); try { Nuvem.aoSalvar(r); } catch (e) { } return r; };
  DB.excluirOS = function (id) { const r = _excluir.call(DB, id); try { Nuvem.aoExcluir(id); } catch (e) { } return r; };
  // Ao abrir já logado, sincroniza em segundo plano e atualiza a tela.
  if (typeof Estado !== 'undefined' && Estado.usuario) {
    Nuvem.sincronizar().then(mudou => { if (mudou) App.render(); }).catch(() => { });
  }
})();
