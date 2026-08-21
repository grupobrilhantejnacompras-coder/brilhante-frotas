/* ============================================================
   APLICAÇÃO — autenticação, navegação e estado de filtros
   ============================================================ */

const Ico = (() => {
  const w = p => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  return {
    dash: w('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
    nova: w('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
    lista: w('<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
    serv: w('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z"/>'),
    veic: w('<path d="M3 16V7a1 1 0 0 1 1-1h10v10M14 10h4l3 3v3h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'),
    rel: w('<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
    alerta: w('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
    conf: w('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    imp: w('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
    print: w('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>'),
    user: w('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>'),
    menu: w('<path d="M3 6h18M3 12h18M3 18h18"/>'),
    volta: w('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
  };
})();

const Estado = {
  usuario: null,
  pagina: 'dashboard',
  params: {},
  filtros: { periodo: 'tudo', de: '', ate: '', local: '', veiculo: '', frota: '', mecanico: '', grupo: '', status: '', busca: '' },
};

const LOGO_SVG = window.LOGO_SVG;
const VERSAO = window.APP_VERSAO || { n: '0', data: '' };

/* ---------- Autenticação ---------- */
const Auth = {
  /** Retorna null em caso de sucesso, ou a mensagem do que impediu a entrada. */
  entrar(login, senha) {
    const u = DB.usuarioPorLogin(login);
    if (!u || String(u.senha) !== String(senha)) return 'Usuário ou senha incorretos. Verifique e tente novamente.';
    if (u.status !== 'Ativo') return 'Este usuário está inativo. Procure o administrador do sistema.';
    u.ultimoAcesso = Dt.today();
    DB.save();
    Auth.aplicar(u);
    try { sessionStorage.setItem('brilhante_sessao', u.id); } catch (e) { }
    return null;
  },
  aplicar(u) {
    Estado.usuario = {
      id: u.id, nome: u.nome || u.usuario, usuario: u.usuario, perfil: u.perfil,
      permissoes: u.permissoes || Perm.doPerfil(u.perfil), setor: u.setor || ''
    };
  },
  sair() {
    Estado.usuario = null;
    try { sessionStorage.removeItem('brilhante_sessao'); } catch (e) { }
    location.hash = '';
    App.render();
  },
  restaurar() {
    try {
      const id = sessionStorage.getItem('brilhante_sessao');
      const u = id && DB.usuarios().find(x => x.id === id);
      if (u && u.status === 'Ativo') { Auth.aplicar(u); return true; }
    } catch (e) { }
    return false;
  },
  /** Depois de trocar a base (importação de backup), confere se quem está logado continua existindo. */
  revalidar() {
    const at = Estado.usuario; if (!at) return;
    const u = DB.usuarios().find(x => x.id === at.id) || DB.usuarioPorLogin(at.usuario);
    if (u && u.status === 'Ativo') { Auth.aplicar(u); try { sessionStorage.setItem('brilhante_sessao', u.id); } catch (e) { } }
    else { UI.toast('Seu usuário não existe na base importada. Entre novamente.', 'warn'); Auth.sair(); }
  },
  /** Primeira página que este usuário pode abrir. */
  paginaInicial() {
    const ordem = [['dashboard', 'dashboard'], ['os.criar', 'nova-os'], ['os.ver', 'ordens'],
    ['relatorios.ver', 'relatorios'], ['veiculos.ver', 'veiculos'], ['servicos.ver', 'servicos'],
    ['usuarios', 'usuarios'], ['config', 'config']];
    const achou = ordem.find(([perm]) => Perm.pode(perm));
    return achou ? achou[1] : 'sem-acesso';
  }
};

/* ---------- Navegação ---------- */
const MENU = [
  { sec: 'Operação' },
  { id: 'dashboard', nome: 'Dashboard', ic: 'dash', perm: 'dashboard' },
  { id: 'nova-os', nome: 'Nova Ordem de Serviço', ic: 'nova', perm: 'os.criar' },
  { id: 'ordens', nome: 'Ordens de Serviço', ic: 'lista', perm: 'os.ver' },
  { sec: 'Cadastros' },
  { id: 'servicos', nome: 'Serviços', ic: 'serv', perm: 'servicos.ver' },
  { id: 'veiculos', nome: 'Veículos', ic: 'veic', perm: 'veiculos.ver' },
  { sec: 'Gestão' },
  { id: 'relatorios', nome: 'Relatórios', ic: 'rel', perm: 'relatorios.ver' },
  { id: 'reincidencias', nome: 'Reincidências', ic: 'alerta', perm: 'reincidencias.ver', badge: () => Painel.totalReincidencias() },
  { sec: 'Sistema' },
  { id: 'usuarios', nome: 'Usuários', ic: 'user', perm: 'usuarios' },
  { id: 'config', nome: 'Configurações', ic: 'conf', perm: 'config' },
];

/* Permissão exigida por página (usada para bloquear rota digitada na barra de endereço). */
const PERM_PAGINA = {
  'dashboard': 'dashboard', 'nova-os': 'os.criar', 'ordens': 'os.ver',
  'servicos': 'servicos.ver', 'veiculos': 'veiculos.ver', 'veiculo': 'veiculos.ver',
  'relatorios': 'relatorios.ver', 'reincidencias': 'reincidencias.ver',
  'usuarios': 'usuarios', 'config': 'config', 'minha-conta': null, 'sem-acesso': null,
};

const TITULOS = {
  'dashboard': ['Visão geral', 'Dashboard da frota'],
  'nova-os': ['Registro', 'Nova ordem de serviço'],
  'ordens': ['Consulta', 'Ordens de serviço'],
  'servicos': ['Cadastro', 'Base de serviços'],
  'veiculos': ['Cadastro', 'Veículos da frota'],
  'veiculo': ['Cadastro', 'Histórico do veículo'],
  'relatorios': ['Gestão', 'Relatórios'],
  'reincidencias': ['Gestão', 'Análise de reincidências'],
  'config': ['Sistema', 'Configurações'],
  'usuarios': ['Sistema', 'Usuários e acessos'],
  'minha-conta': ['Sistema', 'Minha conta'],
  'sem-acesso': ['Sistema', 'Acesso restrito'],
};

const App = {
  paginas: {},
  registrar(id, fn) { this.paginas[id] = fn; },

  irPara(rota) { location.hash = '#/' + rota; },

  lerRota() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    const [p, ...rest] = h.split('/');
    Estado.pagina = p || 'dashboard';
    Estado.params = { id: rest.join('/') ? decodeURIComponent(rest.join('/')) : '' };
  },

  render() {
    const root = document.getElementById('root');
    if (!Estado.usuario) { root.innerHTML = this.telaLogin(); this.ligarLogin(); return; }
    this.lerRota();
    const exigida = PERM_PAGINA[Estado.pagina];
    if (exigida !== null && exigida !== undefined && !Perm.pode(exigida)) Estado.pagina = 'sem-acesso';
    const fn = this.paginas[Estado.pagina] || this.paginas[Auth.paginaInicial()] || (() => this.semAcesso());
    const [eyebrow, titulo] = TITULOS[Estado.pagina] || ['', 'Grupo Brilhante'];
    root.innerHTML = `<div id="app">
      ${this.nav()}
      <div class="main">
        <header class="topbar">
          <button class="btn ghost sm menu-toggle" id="btn-menu" aria-label="Abrir menu">${Ico.menu}</button>
          <div class="tt"><div class="eyebrow">${Fmt.esc(eyebrow)}</div><h1>${Fmt.esc(titulo)}</h1></div>
          <div class="topbar-actions" id="topbar-actions"></div>
        </header>
        <main class="content" id="pagina"></main>
      </div>
    </div>`;
    const alvo = document.getElementById('pagina');
    alvo.innerHTML = fn(Estado.params) || '';
    Chart.ligarTooltips(alvo);
    this.ligarShell();
    if (App.aoRenderizar) { const f = App.aoRenderizar; App.aoRenderizar = null; f(); }
    window.scrollTo(0, 0);
  },

  nav() {
    const visiveis = [];
    MENU.forEach(m => {
      if (m.sec) { visiveis.push(m); return; }
      if (!m.perm || Perm.pode(m.perm)) visiveis.push(m);
    });
    // não deixa cabeçalho de seção sem itens embaixo
    const filtrado = visiveis.filter((m, i) => !m.sec || (visiveis[i + 1] && !visiveis[i + 1].sec));
    const itens = filtrado.map(m => {
      if (m.sec) return `<div class="nav-sec">${Fmt.esc(m.sec)}</div>`;
      const on = Estado.pagina === m.id || (m.id === 'veiculos' && Estado.pagina === 'veiculo');
      const n = m.badge ? m.badge() : 0;
      return `<button class="nav-item${on ? ' on' : ''}" data-rota="${m.id}">
        <span class="ic">${Ico[m.ic]}</span><span>${Fmt.esc(m.nome)}</span>
        ${n ? `<span class="badge-n">${n}</span>` : ''}</button>`;
    }).join('');
    const u = Estado.usuario;
    return `<nav class="nav" id="nav" aria-label="Menu principal">
      <div class="nav-brand"><span class="logo">${LOGO_SVG}</span>
        <span><span class="t1">Brilhante</span><br><span class="t2">Gestão de Frotas</span></span></div>
      <div class="nav-menu">${itens}</div>
      <div class="nav-foot">
        <button class="nav-user" id="btn-conta" title="Minha conta">
          <span class="avatar">${Fmt.esc(u.nome[0].toUpperCase())}</span>
          <span style="text-align:left"><span class="u1">${Fmt.esc(u.nome)}</span><br><span class="u2">${Fmt.esc(u.perfil)}</span></span></button>
        <button class="link-out" id="btn-sair">Sair do sistema</button>
      </div></nav>`;
  },

  ligarShell() {
    document.querySelectorAll('[data-rota]').forEach(b =>
      b.addEventListener('click', () => { App.irPara(b.dataset.rota); fecharNav(); }));
    const s = document.getElementById('btn-sair');
    if (s) s.addEventListener('click', () => Auth.sair());
    const c = document.getElementById('btn-conta');
    if (c) c.addEventListener('click', () => App.irPara('minha-conta'));
    const m = document.getElementById('btn-menu');
    if (m) m.addEventListener('click', () => {
      const nav = document.getElementById('nav');
      nav.classList.add('open');
      const sc = document.createElement('div');
      sc.className = 'nav-scrim'; sc.id = 'scrim';
      sc.addEventListener('click', fecharNav);
      document.body.appendChild(sc);
    });
    function fecharNav() {
      const nav = document.getElementById('nav'); if (nav) nav.classList.remove('open');
      const sc = document.getElementById('scrim'); if (sc) sc.remove();
    }
  },

  acoesTopo(html) { const el = document.getElementById('topbar-actions'); if (el) el.innerHTML = html; },

  semAcesso() {
    App.acoesTopo('');
    return UI.vazio('Você não tem acesso a esta área',
      'Seu perfil (' + (Estado.usuario ? Estado.usuario.perfil : '—') + ') não inclui esta permissão. ' +
      'Fale com o administrador do sistema se precisar dela.',
      '<button class="btn sm" data-rota="' + Auth.paginaInicial() + '">Ir para a minha área</button>');
  },

  telaLogin() {
    return `<div id="login"><form class="login-card" id="form-login" autocomplete="off">
      <div class="login-brand">
        <span class="logo">${LOGO_SVG}</span>
        <span class="name">Grupo Brilhante</span>
        <span class="sub">Ordens de serviço · Manutenção de frotas</span>
      </div>
      <div id="login-err"></div>
      <div class="field"><label for="u">Usuário</label>
        <input class="input" id="u" name="u" autocomplete="username" autocapitalize="none" required></div>
      <div class="field"><label for="s">Senha</label>
        <input class="input" id="s" name="s" type="password" autocomplete="current-password" required></div>
      <button class="btn block" type="submit">Entrar</button>
      <div class="login-foot">Juína · Mato Grosso <span class="versao">v${VERSAO.n} · ${VERSAO.data}</span></div>
    </form></div>`;
  },

  ligarLogin() {
    const f = document.getElementById('form-login');
    f.addEventListener('submit', e => {
      e.preventDefault();
      const erro = Auth.entrar(f.u.value, f.s.value);
      if (!erro) {
        // Login OK → só então roda a animação de entrada; navegação/render inalterados.
        App.animarEntrada(() => { location.hash = '#/' + Auth.paginaInicial(); App.render(); });
      }
      else {
        document.getElementById('login-err').innerHTML = `<div class="login-err">${Fmt.esc(erro)}</div>`;
        f.s.value = ''; f.s.focus();
      }
    });
    setTimeout(() => { const u = document.getElementById('u'); if (u) u.focus(); }, 60);
  },

  /** Cortina cinematográfica logo→sistema. Só é chamada após login válido. */
  animarEntrada(cb) {
    let reduz = false;
    try { reduz = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }
    if (reduz) {                                   // acessibilidade: sem movimento
      cb();
      const flash = document.createElement('div'); flash.id = 'entrada-anim';
      flash.innerHTML = `<div class="ea-stage"><span class="ea-logo">${LOGO_SVG}</span></div>`;
      document.body.appendChild(flash);
      setTimeout(() => { flash.classList.add('ea-out'); setTimeout(() => flash.remove(), 600); }, 500);
      return;
    }
    const parts = Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2, d = 120 + (i % 3) * 34;
      const x = Math.round(Math.cos(a) * d), y = Math.round(Math.sin(a) * d);
      return `<span class="ea-part" style="--x:${x}px;--y:${y}px;animation-delay:${(0.7 + (i % 5) * 0.11).toFixed(2)}s"></span>`;
    }).join('');
    const ov = document.createElement('div');
    ov.id = 'entrada-anim';
    ov.innerHTML = `<div class="ea-stage"><span class="ea-logo">${LOGO_SVG}</span>${parts}</div>`;
    document.body.appendChild(ov);
    setTimeout(cb, 420);                            // sistema renderiza por baixo da cortina
    setTimeout(() => { ov.classList.add('ea-out'); setTimeout(() => ov.remove(), 640); }, 2680);
  },
};

window.addEventListener('hashchange', () => App.render());
