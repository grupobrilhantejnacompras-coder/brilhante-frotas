/* ============================================================
   NÚCLEO — utilitários, base de dados e regras de negócio
   ============================================================ */

/* ---------- Fmt: formatação ---------- */
const Fmt = (() => {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const n0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const n1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  return {
    money: v => brl.format(v || 0),
    money0: v => brl0.format(v || 0),
    moneyK: v => (Math.abs(v) >= 1000 ? 'R$ ' + n1.format(v / 1000) + ' mil' : brl0.format(v || 0)),
    num: v => n0.format(v || 0),
    num1: v => n1.format(v || 0),
    date: iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—',
    dateShort: iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—',
    kmh: (v, un) => v == null ? '—' : n0.format(v) + ' ' + (un === 'H' ? 'h' : 'km'),
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  };
})();

/* ---------- Dt: datas (ISO YYYY-MM-DD) ---------- */
const Dt = (() => {
  const today = () => new Date().toISOString().slice(0, 10);
  const d = iso => { const [y, m, dd] = iso.split('-').map(Number); return new Date(y, m - 1, dd); };
  const iso = dt => [dt.getFullYear(), String(dt.getMonth() + 1).padStart(2, '0'), String(dt.getDate()).padStart(2, '0')].join('-');
  const add = (i, n) => { const x = d(i); x.setDate(x.getDate() + n); return iso(x); };
  const diff = (a, b) => Math.round((d(a) - d(b)) / 86400000);
  const weekStart = i => { const x = d(i); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return iso(x); };  // segunda
  const monthStart = i => i.slice(0, 8) + '01';
  const monthEnd = i => { const x = d(i); return iso(new Date(x.getFullYear(), x.getMonth() + 1, 0)); };
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const agora = () => { const x = new Date(), p = n => String(n).padStart(2, '0'); return { data: iso(x), hora: p(x.getHours()) + ':' + p(x.getMinutes()) }; };
  return { today, agora, add, diff, weekStart, monthStart, monthEnd, iso, d, diaSemana: i => DIAS[d(i).getDay()] };
})();

/* ---------- Rec: grupos de problema e reincidência ---------- */
const Rec = (() => {
  // Cada serviço é classificado em um sistema do veículo. É o que permite dizer
  // "este veículo voltou pelo mesmo problema".
  const GRUPOS = [
    { id: 'freios', nome: 'Freios', rx: /freio|pastilha|sapat|sapad|campana|lona|pin[çc]a|sangria|cilindro.*freio|disco/i },
    { id: 'ar', nome: 'Ar Condicionado', rx: /ar.?cond|g[áa]s|compres|evaporador|nitrog|h[ie]gieniz|condensador|intercule|intercooler|\bar\b/i },
    { id: 'suspensao', nome: 'Suspensão e Molejo', rx: /amortec|bieleta|molejo|mola|estabilizador|batente|jumelo|bande?ja|bandja|bucha|feixe|balan[çc]a|peito de a[çc]o/i },
    { id: 'direcao', nome: 'Direção', rx: /dire[çc][ãa]o|terminal|axial|pivo|piv[ôo]|caixa.*dire|barra/i },
    { id: 'transmissao', nome: 'Transmissão e Tração', rx: /embreagem|c[âa]mbio|cardan|carda|cruzeta|diferencial|semi.?eixo|coifa|homocin|transfer|cubo|rolamento|tra[çc][ãa]o|quinta roda|catraca|mancal|garfo/i },
    { id: 'motor', nome: 'Motor', rx: /motor|bico|bomba|turbina|corre[ia]|coxim|junta|cabe[çc]ote|velas|tanque|combust/i },
    { id: 'arrefecimento', nome: 'Arrefecimento', rx: /radiador|arrefec|reservat[óo]rio|reserv\.agua|ventila|mangueira/i },
    { id: 'eletrica', nome: 'Elétrica', rx: /el[ée]tric|el[ée]tro|l[âa]mpada|lampada|alternador|partida|bateria|scan[en]er|scaner|aparelho|farol|lanterna|lant\.|lente|fecha|vidro|painel|cabo/i },
    { id: 'pneus', nome: 'Pneus e Rodas', rx: /pneu|roda|remend|calibr/i },
    { id: 'estrutura', nome: 'Estrutura e Solda', rx: /solda|chassis|carro[çc]|carroceria|ca[çc]amba|para.?barro|parabarro|respig|retrovisor|estirante|guincho|engate|carreta|cabine|gabine|dolly/i },
    { id: 'gerais', nome: 'Serviços Gerais e Obras', rx: /pintura|almoxarif|escrit[óo]rio|encanament|p[ao]rtilheira|prateleira|adapta[çc]|montagem|serv\.? ?gerais|concha|faca|bitorneira|caixa d'agua|m[ãa]o de obra|porta/i, rotina: true },
    { id: 'rotina', nome: 'Revisão e Lubrificação', rx: /engraxamento|[óoée]l[ée]?o|oleo|filtro|revis|palheta|lavagem|limpeza|ajuste|regulagem|desloc|socorro|posi[çc][ãa]o|atf/i, rotina: true },
  ];
  const OUTROS = { id: 'outros', nome: 'Outros', rx: null };

  function grupoDe(desc) {
    const s = String(desc || '');
    for (const g of GRUPOS) if (g.rx.test(s)) return g;
    return OUTROS;
  }
  const gruposDaOS = os => [...new Set((os.itens || []).map(i => grupoDe(i.descricao).id))];
  const nomeGrupo = id => (GRUPOS.find(g => g.id === id) || OUTROS).nome;
  const ehRotina = id => !!(GRUPOS.find(g => g.id === id) || {}).rotina;

  /** Ocorrências anteriores do mesmo sistema no mesmo veículo. */
  function anteriores(os, todas, janelaDias) {
    if (!os.data || !os.veiculoId) return [];
    const gs = gruposDaOS(os).filter(g => !ehRotina(g));
    if (!gs.length) return [];
    const out = [];
    for (const o of todas) {
      if (o === os || o.id === os.id || !o.data) continue;
      if (o.veiculoId !== os.veiculoId) continue;
      if (o.data > os.data || (o.data === os.data && (o.numero || 0) >= (os.numero || 0))) continue;
      const dias = Dt.diff(os.data, o.data);
      if (dias > janelaDias) continue;
      const comuns = gruposDaOS(o).filter(g => gs.includes(g));
      if (!comuns.length) continue;
      out.push({ os: o, dias, grupos: comuns });
    }
    return out.sort((a, b) => a.dias - b.dias);
  }
  return { GRUPOS: GRUPOS.concat([OUTROS]), grupoDe, gruposDaOS, nomeGrupo, ehRotina, anteriores };
})();

/* ---------- Perm: perfis de acesso e permissões ---------- */
const Perm = (() => {
  // Cada permissão libera uma ação concreta. O perfil é só um atalho para um conjunto delas.
  const LISTA = [
    { id: 'dashboard', nome: 'Ver dashboard', grupo: 'Visualizar' },
    { id: 'os.ver', nome: 'Ver ordens de serviço', grupo: 'Visualizar' },
    { id: 'veiculos.ver', nome: 'Ver veículos', grupo: 'Visualizar' },
    { id: 'servicos.ver', nome: 'Ver base de serviços', grupo: 'Visualizar' },
    { id: 'relatorios.ver', nome: 'Ver relatórios e painel da diretoria', grupo: 'Visualizar' },
    { id: 'reincidencias.ver', nome: 'Ver análise de reincidências', grupo: 'Visualizar' },
    { id: 'os.criar', nome: 'Registrar nova OS', grupo: 'Operar' },
    { id: 'os.editar', nome: 'Editar OS existente', grupo: 'Operar' },
    { id: 'os.excluir', nome: 'Excluir OS', grupo: 'Operar' },
    { id: 'veiculos.editar', nome: 'Cadastrar e editar veículos', grupo: 'Operar' },
    { id: 'servicos.editar', nome: 'Cadastrar e editar serviços', grupo: 'Operar' },
    { id: 'exportar', nome: 'Exportar painel e backup', grupo: 'Operar' },
    { id: 'importar', nome: 'Importar planilha', grupo: 'Administrar' },
    { id: 'config', nome: 'Alterar configurações do sistema', grupo: 'Administrar' },
    { id: 'usuarios', nome: 'Gerenciar usuários e acessos', grupo: 'Administrar' },
  ];
  const TODAS = LISTA.map(p => p.id);

  const PERFIS = {
    'Administrador': { desc: 'Acesso total, incluindo usuários e configurações.', perms: TODAS.slice() },
    'Gestor': {
      desc: 'Opera e analisa tudo, sem gerenciar usuários.',
      perms: ['dashboard', 'os.ver', 'veiculos.ver', 'servicos.ver', 'relatorios.ver', 'reincidencias.ver',
        'os.criar', 'os.editar', 'os.excluir', 'veiculos.editar', 'servicos.editar', 'exportar', 'importar']
    },
    'Mecânico': {
      desc: 'Registra OS e consulta veículos e serviços. Sem relatórios nem exclusões.',
      perms: ['os.ver', 'veiculos.ver', 'servicos.ver', 'os.criar', 'os.editar', 'veiculos.editar', 'servicos.editar']
    },
    'Diretoria': {
      desc: 'Somente leitura: dashboard, relatórios e reincidências.',
      perms: ['dashboard', 'os.ver', 'veiculos.ver', 'servicos.ver', 'relatorios.ver', 'reincidencias.ver', 'exportar']
    },
  };
  const nomesPerfis = () => Object.keys(PERFIS);
  const doPerfil = perfil => (PERFIS[perfil] || PERFIS['Mecânico']).perms.slice();

  /** O usuário logado pode fazer isso? */
  function pode(chave) {
    const u = Estado.usuario;
    if (!u) return false;
    if (u.perfil === 'Administrador') return true;
    // Regra fixa: Mecânico nunca vê o dashboard, mesmo que alguém marque
    // a permissão manualmente na ficha do usuário (perfil personalizado).
    if (chave === 'dashboard' && u.perfil === 'Mecânico') return false;
    return (u.permissoes || []).includes(chave);
  }
  const nome = id => (LISTA.find(p => p.id === id) || {}).nome || id;
  return { LISTA, TODAS, PERFIS, nomesPerfis, doPerfil, pode, nome };
})();

/* ---------- Equipe cadastrada de fábrica ----------
   Estes usuários nascem junto com o sistema: quem abrir a versão publicada
   já encontra o próprio login pronto, sem precisar cadastrar de novo.
   A senha pode ser trocada depois em "Minha conta".                        */
const EQUIPE = [
  { id: 'U1', nome: 'Kamau', usuario: 'Kamau', senha: '159753', perfil: 'Administrador', setor: 'Compras' },
  { id: 'U2', nome: 'Taini', usuario: 'Taini', senha: '0000', perfil: 'Administrador', setor: 'Almoxarifado' },
  { id: 'U3', nome: 'Clayton', usuario: 'Clayton', senha: '1234', perfil: 'Gestor', setor: 'Oficina' },
  { id: 'U4', nome: 'Guilherme', usuario: 'Guilherme', senha: '0000', perfil: 'Diretoria', setor: 'Diretoria' },
  { id: 'U5', nome: 'Jeferson', usuario: 'Jeferson', senha: '1111', perfil: 'Mecânico', setor: 'Oficina' },
  { id: 'U6', nome: 'Allan', usuario: 'Allan', senha: '2222', perfil: 'Mecânico', setor: 'Oficina' },
  { id: 'U7', nome: 'Gemerson', usuario: 'Gemerson', senha: '3333', perfil: 'Mecânico', setor: 'Oficina' },
  { id: 'U8', nome: 'Vandame', usuario: 'Vandame', senha: '4444', perfil: 'Mecânico', setor: 'Oficina' },
];
const novoUsuarioPadrao = u => ({
  id: u.id, nome: u.nome, usuario: u.usuario, senha: u.senha, perfil: u.perfil,
  permissoes: Perm.doPerfil(u.perfil), status: 'Ativo', setor: u.setor || '',
  criadoEm: Dt.today(), ultimoAcesso: '', deFabrica: true
});

/* ---------- DB: base de dados (planilha + localStorage) ---------- */
const DB = (() => {
  const KEY = 'brilhante_os_v1';
  const EQUIPE_VERSAO = 2;      // aumentar aqui quando novos usuários entrarem de fábrica
  let d = null;

  const semente = () => {
    const p = JSON.parse(JSON.stringify(window.DADOS_PLANILHA));
    p.ordens.forEach((o, i) => { o.id = 'P' + (i + 1); });
    p.veiculos.forEach(v => { v.ano = v.ano || ''; v.status = v.status || 'Ativo'; v.kmAtual = null; });
    // último KM/H conhecido por veículo
    p.ordens.forEach(o => {
      if (o.kmH == null) return;
      const v = p.veiculos.find(x => x.id === o.veiculoId);
      if (v && (v.kmAtual == null || (o.data || '') >= (v.kmAtualData || ''))) { v.kmAtual = o.kmH; v.kmAtualData = o.data; }
    });
    p.config = { janelaReincidencia: 90, alertaOSmes: 3 };
    p.usuarios = EQUIPE.map(novoUsuarioPadrao);
    p.equipeVersao = EQUIPE_VERSAO;
    p.versao = 1;
    return p;
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        d = JSON.parse(raw);
        if (!d.config) d.config = semente().config;
        migrar();
        return d;
      }
    } catch (e) { console.warn('localStorage indisponível, usando memória.', e); }
    d = semente();
    save();
    return d;
  }
  /** Bases criadas antes do módulo de usuários continuam funcionando. */
  function migrar() {
    if (!Array.isArray(d.usuarios) || !d.usuarios.length) {
      d.usuarios = [{
        id: 'U1', nome: d.config.usuario || 'Kamau', usuario: d.config.usuario || 'Kamau',
        senha: d.config.senha || '159753', perfil: 'Administrador', permissoes: Perm.doPerfil('Administrador'),
        status: 'Ativo', setor: 'Compras', criadoEm: Dt.today(), ultimoAcesso: ''
      }];
      delete d.config.usuario; delete d.config.senha;
      save();
    }
    // Corrige tanto quem nunca teve o campo (bases antigas) quanto quem ficou
    // com a lista vazia por causa de uma sincronização com a nuvem que ainda
    // não tinha as permissões preenchidas do lado de lá (semente da v6.0) —
    // sem isso, o usuário perde acesso a tudo sem nenhum aviso, mesmo
    // conseguindo entrar normalmente.
    let corrigiuPermVazia = false;
    d.usuarios.forEach(u => {
      if (u.perfil !== 'Administrador' && (!Array.isArray(u.permissoes) || !u.permissoes.length)) {
        u.permissoes = Perm.doPerfil(u.perfil);
        corrigiuPermVazia = true;
      }
    });
    if (corrigiuPermVazia) save();
    // Mecânico nunca deve ter a permissão de dashboard salva na ficha (mesmo que
    // tenha sido marcada manualmente antes desta regra existir). Perm.pode() já
    // bloqueia isso na prática, mas aqui a ficha do usuário fica consistente
    // com o que ele realmente pode fazer.
    let limpouPerm = false;
    d.usuarios.forEach(u => {
      if (u.perfil === 'Mecânico' && Array.isArray(u.permissoes) && u.permissoes.includes('dashboard')) {
        u.permissoes = u.permissoes.filter(p => p !== 'dashboard');
        limpouPerm = true;
      }
    });
    if (limpouPerm) save();
    // Equipe de fábrica: entra uma única vez em bases antigas, sem tocar em quem já existe
    // nem ressuscitar quem o administrador excluiu depois.
    if ((d.equipeVersao || 0) < EQUIPE_VERSAO) {
      const tem = l => d.usuarios.some(u => String(u.usuario).trim().toLowerCase() === l.toLowerCase());
      const ids = new Set(d.usuarios.map(u => u.id));
      EQUIPE.forEach(e => {
        if (tem(e.usuario)) return;
        const novo = novoUsuarioPadrao(e);
        if (ids.has(novo.id)) novo.id = 'U' + e.usuario.toUpperCase();
        d.usuarios.push(novo); ids.add(novo.id);
      });
      d.equipeVersao = EQUIPE_VERSAO;
      save();
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch (e) { console.warn('Não foi possível gravar localmente.', e); return false; }
  }
  const get = () => d || load();

  const veiculo = id => get().veiculos.find(v => v.id === id) || null;
  const servico = cod => get().servicos.find(s => s.codigo === cod) || null;
  const nomeVeiculo = id => { const v = veiculo(id); return v ? v.nome : '—'; };
  const rotuloVeiculo = id => { const v = veiculo(id); return v ? v.nome + (v.placa !== '—' ? ' · ' + v.placa : '') : '—'; };

  function proximoNumero() { return get().ordens.reduce((m, o) => Math.max(m, o.numero || 0), 0) + 1; }

  function salvarOS(os) {
    const b = get();
    // Carimbo de auditoria: quem registrou/alterou e quando (não editável pelo usuário).
    const quem = (typeof Estado !== 'undefined' && Estado.usuario) ? (Estado.usuario.nome || Estado.usuario.usuario) : '';
    const ag = Dt.agora();
    if (os.id && b.ordens.some(o => o.id === os.id)) {
      os.alteradoPor = quem; os.alteradoData = ag.data; os.alteradoHora = ag.hora;   // preserva a criação original
      const i = b.ordens.findIndex(o => o.id === os.id);
      b.ordens[i] = os;
    } else {
      os.id = 'OS' + Date.now().toString(36).toUpperCase();
      os.numero = proximoNumero();
      os.criadoPor = quem; os.criadoData = ag.data; os.criadoHora = ag.hora;
      delete os.alteradoPor; delete os.alteradoData; delete os.alteradoHora;
      b.ordens.push(os);
    }
    // atualiza KM/H do veículo e cadastros auxiliares
    const v = veiculo(os.veiculoId);
    if (v && os.kmH != null && (v.kmAtual == null || os.kmH >= v.kmAtual)) { v.kmAtual = os.kmH; v.kmAtualData = os.data; }
    if (os.local && !b.locais.includes(os.local)) b.locais.push(os.local), b.locais.sort();
    if (os.condutor && !b.condutores.includes(os.condutor)) b.condutores.push(os.condutor), b.condutores.sort();
    if (os.mecanico && !b.mecanicos.includes(os.mecanico)) b.mecanicos.push(os.mecanico), b.mecanicos.sort();
    save();
    return os;
  }
  function excluirOS(id) { const b = get(); b.ordens = b.ordens.filter(o => o.id !== id); save(); }
  function salvarVeiculo(v) {
    const b = get(); const i = b.veiculos.findIndex(x => x.id === v.id);
    if (i >= 0) b.veiculos[i] = v; else b.veiculos.push(v);
    save(); return v;
  }
  function salvarServico(s) {
    const b = get(); const i = b.servicos.findIndex(x => x.codigo === s.codigo);
    if (i >= 0) b.servicos[i] = s;
    else { s.codigo = s.codigo || 'SV' + String(b.servicos.length + 1).padStart(3, '0'); b.servicos.push(s); }
    save(); return s;
  }
  const usuarios = () => get().usuarios || [];
  const usuarioPorLogin = login => usuarios().find(u =>
    String(u.usuario).trim().toLowerCase() === String(login).trim().toLowerCase()) || null;

  function salvarUsuario(u) {
    const b = get();
    if (!u.id) { u.id = 'U' + Date.now().toString(36).toUpperCase(); u.criadoEm = Dt.today(); b.usuarios.push(u); }
    else { const i = b.usuarios.findIndex(x => x.id === u.id); if (i >= 0) b.usuarios[i] = u; else b.usuarios.push(u); }
    save(); return u;
  }
  function excluirUsuario(id) {
    const b = get();
    const admins = b.usuarios.filter(u => u.perfil === 'Administrador' && u.status === 'Ativo');
    const alvo = b.usuarios.find(u => u.id === id);
    if (alvo && alvo.perfil === 'Administrador' && admins.length <= 1) return false;   // nunca ficar sem admin
    b.usuarios = b.usuarios.filter(u => u.id !== id);
    save(); return true;
  }

  function restaurar() { try { localStorage.removeItem(KEY); } catch (e) { } d = null; return load(); }
  function exportarJSON() { return JSON.stringify(get(), null, 1); }

  /* ---------- Backup: leitura, conferência e importação ----------
     Serve para levar a base de um computador (ou do arquivo local) para o
     sistema publicado na internet, que começa vazio em cada navegador.      */
  const assinaturaOS = o => [o.data || '', o.veiculoId || '', o.mecanico || '',
  Math.round((o.total || 0) * 100), (o.itens || []).length].join('|');

  function lerBackup(texto) {
    let b; try { b = JSON.parse(texto); } catch (e) { throw new Error('O arquivo não é um backup válido (.json).'); }
    if (!b || !Array.isArray(b.ordens) || !Array.isArray(b.veiculos) || !Array.isArray(b.servicos))
      throw new Error('O arquivo não tem a estrutura de um backup do sistema.');
    return b;
  }
  /** O que existe no arquivo e o que dele ainda não está na base atual. */
  function conferirBackup(b) {
    const at = get();
    const sig = new Set(at.ordens.map(assinaturaOS));
    const ids = new Set(at.ordens.map(o => o.id));
    const novasOS = b.ordens.filter(o => !ids.has(o.id) && !sig.has(assinaturaOS(o)));
    const placas = new Set(at.veiculos.map(v => (v.placa || '') + '|' + v.nome));
    const cods = new Set(at.servicos.map(s => s.codigo));
    const logins = new Set(at.usuarios.map(u => String(u.usuario).toLowerCase()));
    return {
      arquivo: {
        ordens: b.ordens.length, veiculos: b.veiculos.length, servicos: b.servicos.length,
        usuarios: (b.usuarios || []).length, total: b.ordens.reduce((s, o) => s + (o.total || 0), 0)
      },
      atual: {
        ordens: at.ordens.length, veiculos: at.veiculos.length, servicos: at.servicos.length,
        usuarios: at.usuarios.length, total: at.ordens.reduce((s, o) => s + (o.total || 0), 0)
      },
      novas: {
        ordens: novasOS.length,
        veiculos: b.veiculos.filter(v => !placas.has((v.placa || '') + '|' + v.nome)).length,
        servicos: b.servicos.filter(s => !cods.has(s.codigo)).length,
        usuarios: (b.usuarios || []).filter(u => !logins.has(String(u.usuario).toLowerCase())).length
      }
    };
  }
  /** modo: 'substituir' troca a base inteira · 'mesclar' só acrescenta o que falta. */
  function importarBackup(b, modo) {
    if (modo === 'substituir') {
      d = JSON.parse(JSON.stringify(b));
      if (!d.config) d.config = { janelaReincidencia: 90, alertaOSmes: 3 };
      if (!Array.isArray(d.usuarios) || !d.usuarios.length) d.usuarios = EQUIPE.map(novoUsuarioPadrao);
      migrar(); save();
      return { modo, ordens: d.ordens.length, veiculos: d.veiculos.length, servicos: d.servicos.length, usuarios: d.usuarios.length };
    }
    const at = get(), r = { modo, ordens: 0, veiculos: 0, servicos: 0, usuarios: 0 };
    const cods = new Set(at.servicos.map(s => s.codigo));
    b.servicos.forEach(s => { if (!cods.has(s.codigo)) { at.servicos.push(s); cods.add(s.codigo); r.servicos++; } });

    const chaveV = v => (v.placa || '') + '|' + v.nome;
    const mapaV = new Map(at.veiculos.map(v => [chaveV(v), v]));
    const deParaV = {};                                   // id do backup → id daqui
    b.veiculos.forEach(v => {
      const igual = mapaV.get(chaveV(v));
      if (igual) {                                        // completa os campos que faltam aqui
        deParaV[v.id] = igual.id;
        ['frota', 'local', 'condutor', 'marca', 'modelo', 'ano'].forEach(k => {
          if ((igual[k] == null || igual[k] === '' || igual[k] === '—') && v[k] && v[k] !== '—') igual[k] = v[k];
        });
      } else {
        const novo = JSON.parse(JSON.stringify(v));
        if (at.veiculos.some(x => x.id === novo.id)) novo.id = 'V' + Date.now().toString(36).toUpperCase() + r.veiculos;
        deParaV[v.id] = novo.id; at.veiculos.push(novo); mapaV.set(chaveV(novo), novo); r.veiculos++;
      }
    });
    const sig = new Set(at.ordens.map(assinaturaOS));
    const idsOS = new Set(at.ordens.map(o => o.id));
    let num = proximoNumero();
    b.ordens.forEach(o => {
      const c = JSON.parse(JSON.stringify(o));
      c.veiculoId = deParaV[c.veiculoId] || c.veiculoId;
      if (idsOS.has(c.id) || sig.has(assinaturaOS(c))) return;
      c.id = 'OS' + Date.now().toString(36).toUpperCase() + r.ordens;
      c.numero = num++;
      at.ordens.push(c); idsOS.add(c.id); sig.add(assinaturaOS(c)); r.ordens++;
    });
    const logins = new Set(at.usuarios.map(u => String(u.usuario).toLowerCase()));
    (b.usuarios || []).forEach(u => {
      if (logins.has(String(u.usuario).toLowerCase())) return;
      const c = JSON.parse(JSON.stringify(u));
      if (at.usuarios.some(x => x.id === c.id)) c.id = 'U' + Date.now().toString(36).toUpperCase() + r.usuarios;
      at.usuarios.push(c); logins.add(String(c.usuario).toLowerCase()); r.usuarios++;
    });
    ['locais', 'condutores', 'mecanicos'].forEach(k => {
      (b[k] || []).forEach(x => { if (x && !at[k].includes(x)) at[k].push(x); });
      at[k].sort();
    });
    save();
    return r;
  }

  return {
    get, load, save, veiculo, servico, nomeVeiculo, rotuloVeiculo, salvarOS, excluirOS,
    salvarVeiculo, salvarServico, proximoNumero, restaurar, exportarJSON,
    lerBackup, conferirBackup, importarBackup,
    usuarios, usuarioPorLogin, salvarUsuario, excluirUsuario,
    cfg: () => get().config,
  };
})();

/* ---------- Filtro de período ---------- */
const Periodo = (() => {
  const opcoes = [
    { id: 'tudo', nome: 'Todo o período' },
    { id: 'hoje', nome: 'Hoje' },
    { id: 'ontem', nome: 'Ontem' },
    { id: 'semana', nome: 'Esta semana' },
    { id: 'semana-1', nome: 'Semana passada' },
    { id: 'mes', nome: 'Este mês' },
    { id: 'mes-1', nome: 'Mês passado' },
    { id: 'custom', nome: 'Personalizado' },
  ];
  function faixa(id, de, ate) {
    const h = Dt.today();
    switch (id) {
      case 'hoje': return [h, h];
      case 'ontem': return [Dt.add(h, -1), Dt.add(h, -1)];
      case 'semana': { const s = Dt.weekStart(h); return [s, Dt.add(s, 6)]; }
      case 'semana-1': { const s = Dt.add(Dt.weekStart(h), -7); return [s, Dt.add(s, 6)]; }
      case 'mes': return [Dt.monthStart(h), Dt.monthEnd(h)];
      case 'mes-1': { const m = Dt.add(Dt.monthStart(h), -1); return [Dt.monthStart(m), Dt.monthEnd(m)]; }
      case 'custom': return [de || '2000-01-01', ate || h];
      default: return ['1900-01-01', '2999-12-31'];
    }
  }
  return { opcoes, faixa };
})();

/* ---------- Consultas agregadas ---------- */
const Q = (() => {
  function filtrar(f) {
    const b = DB.get();
    const [de, ate] = Periodo.faixa(f.periodo, f.de, f.ate);
    return b.ordens.filter(o => {
      if (f.periodo !== 'tudo') { if (!o.data) return false; if (o.data < de || o.data > ate) return false; }
      if (f.local && o.local !== f.local) return false;
      if (f.veiculo && o.veiculoId !== f.veiculo) return false;
      if (f.frota && o.frota !== f.frota) return false;
      if (f.mecanico && o.mecanico !== f.mecanico) return false;
      if (f.grupo && !Rec.gruposDaOS(o).includes(f.grupo)) return false;
      if (f.status && o.status !== f.status) return false;
      if (f.busca) {
        const t = (o.numero + ' ' + DB.rotuloVeiculo(o.veiculoId) + ' ' + o.placa + ' ' + o.frota + ' ' + o.local + ' ' +
          o.condutor + ' ' + o.mecanico + ' ' + (o.obs || '') + ' ' + o.itens.map(i => i.descricao).join(' ')).toLowerCase();
        if (!t.includes(f.busca.toLowerCase())) return false;
      }
      return true;
    });
  }
  const soma = os => os.reduce((s, o) => s + (o.total || 0), 0);
  const qtdItens = os => os.reduce((s, o) => s + o.itens.reduce((a, i) => a + (i.qtd || 1), 0), 0);

  function porChave(os, fn) {
    const m = new Map();
    os.forEach(o => {
      const k = fn(o); if (k == null || k === '') return;
      const e = m.get(k) || { chave: k, qtd: 0, valor: 0, veic: new Set() };
      e.qtd++; e.valor += o.total || 0; e.veic.add(o.veiculoId); m.set(k, e);
    });
    return [...m.values()].sort((a, b) => b.valor - a.valor);
  }
  function porGrupoServico(os) {
    const m = new Map();
    os.forEach(o => o.itens.forEach(i => {
      const g = Rec.grupoDe(i.descricao);
      const e = m.get(g.id) || { chave: g.id, nome: g.nome, qtd: 0, valor: 0 };
      e.qtd += (i.qtd || 1); e.valor += i.total || 0; m.set(g.id, e);
    }));
    return [...m.values()].sort((a, b) => b.valor - a.valor);
  }
  function porSemana(os) {
    const m = new Map();
    os.filter(o => o.data).forEach(o => {
      const k = Dt.weekStart(o.data);
      const e = m.get(k) || { chave: k, qtd: 0, valor: 0 };
      e.qtd++; e.valor += o.total || 0; m.set(k, e);
    });
    return [...m.values()].sort((a, b) => a.chave.localeCompare(b.chave));
  }
  /** OS do conjunto que possuem ocorrência anterior do mesmo sistema. */
  function reincidencias(os, todas) {
    const j = DB.cfg().janelaReincidencia;
    const base = todas || DB.get().ordens;
    const out = [];
    os.forEach(o => {
      const ant = Rec.anteriores(o, base, j);
      if (ant.length) out.push({ os: o, anterior: ant[0], todas: ant });
    });
    return out;
  }
  return { filtrar, soma, qtdItens, porChave, porGrupoServico, porSemana, reincidencias };
})();
