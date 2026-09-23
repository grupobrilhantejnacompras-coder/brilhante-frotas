/* ============================================================
   USUÁRIOS E ACESSOS — cadastro de usuários, perfis e permissões
   ============================================================ */
const Usuarios = (() => {
  let busca = '', filtroPerfil = '';

  const ehPadrao = u => {
    const p = Perm.doPerfil(u.perfil).slice().sort().join('|');
    return (u.permissoes || []).slice().sort().join('|') === p;
  };
  const contaAdmins = () => DB.usuarios().filter(u => u.perfil === 'Administrador' && u.status === 'Ativo').length;

  function pagina() {
    App.aoRenderizar = ligar;
    App.acoesTopo(`<button class="btn sm" id="novo-usuario">+ Novo usuário</button>`);
    // Atualiza a lista com o que estiver na nuvem (outros computadores podem
    // ter criado/editado usuários desde a última vez que este abriu aqui).
    if (window.Nuvem && Estado.pagina === 'usuarios') {
      Nuvem.sincronizarUsuarios().then(mudou => { if (mudou && Estado.pagina === 'usuarios') App.render(); }).catch(() => { });
    }
    return `<div class="stack">
      ${UI.card('', `<div class="row">
        <input class="input" id="u-busca" placeholder="Buscar por nome ou usuário…" style="max-width:280px" value="${Fmt.esc(busca)}">
        <select class="input" id="u-perfil" style="max-width:220px">${UI.opcoes(Perm.nomesPerfis(), filtroPerfil, 'Todos os perfis')}</select>
        <div class="spacer"></div><span class="dim" id="u-cont"></span></div>`)}
      <div id="lista-usuarios"></div>
      ${UI.card('Perfis disponíveis', `<div class="grid g2">${Perm.nomesPerfis().map(p => `
        <div style="border:1px solid var(--line);border-radius:9px;padding:var(--s3) var(--s4)">
          <div class="strong">${Fmt.esc(p)}</div>
          <div class="dim" style="font-size:12.5px;margin:3px 0 8px">${Fmt.esc(Perm.PERFIS[p].desc)}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">${Perm.doPerfil(p).map(x =>
        `<span class="badge b-gray" style="font-size:10.5px">${Fmt.esc(Perm.nome(x))}</span>`).join('')}</div>
        </div>`).join('')}</div>
        <p class="dim" style="font-size:12px;margin:var(--s4) 0 0">O perfil é um atalho: ao cadastrar, você pode marcar ou desmarcar
        qualquer permissão individualmente para aquele usuário.</p>`)}
    </div>`;
  }

  function lista() {
    const us = DB.usuarios().filter(u =>
      (!filtroPerfil || u.perfil === filtroPerfil) &&
      (!busca || (u.nome + ' ' + u.usuario + ' ' + (u.setor || '')).toLowerCase().includes(busca.toLowerCase())));
    const eu = Estado.usuario ? Estado.usuario.id : '';
    const linhas = us.map(u => ({
      n: `<div class="strong">${Fmt.esc(u.nome)}${u.id === eu ? ' <span class="badge b-blue">você</span>' : ''}</div>
          <div class="dim" style="font-size:11.5px">${Fmt.esc(u.setor || 'Setor não informado')}</div>`,
      us: `<span class="mono">${Fmt.esc(u.usuario)}</span>`,
      pf: `<span class="badge ${u.perfil === 'Administrador' ? 'b-blue' : 'b-gray'}">${Fmt.esc(u.perfil)}</span>` +
        (ehPadrao(u) ? '' : ' <span class="badge b-amber" title="Permissões ajustadas manualmente">personalizado</span>'),
      pm: `<span class="dim">${(u.permissoes || []).length} de ${Perm.TODAS.length}</span>`,
      st: u.status === 'Ativo' ? '<span class="badge b-green">Ativo</span>' : '<span class="badge b-gray">Inativo</span>',
      ac: `<span class="nowrap">${Fmt.date(u.ultimoAcesso) === '—' ? '<span class="dim">nunca entrou</span>' : Fmt.date(u.ultimoAcesso)}</span>`,
      ax: `<button class="btn ghost sm" data-edit-u="${u.id}">Editar</button>`,
    }));
    const el = document.getElementById('u-cont');
    if (el) el.textContent = us.length + ' de ' + DB.usuarios().length + ' usuários';
    return UI.card('', UI.tabela([{ t: 'Nome', k: 'n' }, { t: 'Usuário', k: 'us' }, { t: 'Perfil', k: 'pf' },
    { t: 'Permissões', k: 'pm' }, { t: 'Situação', k: 'st' }, { t: 'Último acesso', k: 'ac' }, { t: '', k: 'ax', cls: 'ta-r' }],
      linhas, { vazioT: 'Nenhum usuário encontrado', vazioM: 'Ajuste a busca ou cadastre um novo usuário.' }), '', true);
  }

  function checkboxes(marcadas, perfil) {
    const grupos = {};
    Perm.LISTA.forEach(p => (grupos[p.grupo] = grupos[p.grupo] || []).push(p));
    return Object.keys(grupos).map(g => `<div style="margin-bottom:var(--s3)">
      <div class="eyebrow" style="margin-bottom:6px">${Fmt.esc(g)}</div>
      <div class="perm-grid">${grupos[g].map(p => {
        const bloqueada = p.id === 'dashboard' && perfil === 'Mecânico';
        return `<label class="perm-item"${bloqueada ? ' title="Mecânico não vê o dashboard, mesmo marcando aqui"' : ''}>
        <input type="checkbox" data-perm="${p.id}"${(marcadas.includes(p.id) && !bloqueada) ? ' checked' : ''}${bloqueada ? ' disabled' : ''}>
        <span${bloqueada ? ' class="dim"' : ''}>${Fmt.esc(p.nome)}${bloqueada ? ' (bloqueado p/ Mecânico)' : ''}</span></label>`;
      }).join('')}</div></div>`).join('');
  }

  function editar(id) {
    const orig = id ? DB.usuarios().find(x => x.id === id) : null;
    const u = orig ? JSON.parse(JSON.stringify(orig)) : {
      id: '', nome: '', usuario: '', senha: '', perfil: 'Mecânico',
      permissoes: Perm.doPerfil('Mecânico'), status: 'Ativo', setor: '', ultimoAcesso: ''
    };
    const eu = Estado.usuario && Estado.usuario.id === u.id;
    const ultimoAdmin = orig && orig.perfil === 'Administrador' && orig.status === 'Ativo' && contaAdmins() <= 1;

    UI.modal(orig ? 'Editar usuário' : 'Cadastrar usuário', `
      <div class="form-grid">
        <div class="field"><label for="uu-nome">Nome completo</label><input class="input" id="uu-nome" value="${Fmt.esc(u.nome)}"></div>
        <div class="field"><label for="uu-user">Usuário (login)</label><input class="input" id="uu-user" autocapitalize="none" value="${Fmt.esc(u.usuario)}"></div>
        <div class="field"><label for="uu-senha">${orig ? 'Nova senha' : 'Senha'}</label>
          <input class="input" type="text" id="uu-senha" placeholder="${orig ? 'deixe em branco para manter' : 'defina uma senha'}"></div>
        <div class="field"><label for="uu-setor">Setor</label><input class="input" id="uu-setor" list="dl-setores" value="${Fmt.esc(u.setor || '')}">
          ${datalist('dl-setores', ['Compras', 'Oficina', 'Almoxarifado', 'Frota', 'Logística', 'Agrícola', 'Pecuária', 'Financeiro', 'Diretoria'])}</div>
        <div class="field"><label for="uu-perfil">Perfil de acesso</label>
          <select class="input" id="uu-perfil">${UI.opcoes(Perm.nomesPerfis(), u.perfil)}</select>
          <div class="dim" id="uu-perfil-desc" style="font-size:11.5px;margin-top:5px"></div></div>
        <div class="field"><label for="uu-status">Situação</label>
          <select class="input" id="uu-status"${ultimoAdmin ? ' disabled' : ''}>${UI.opcoes(['Ativo', 'Inativo'], u.status)}</select>
          ${ultimoAdmin ? '<div class="dim" style="font-size:11.5px;margin-top:5px">Único administrador ativo — não pode ser inativado.</div>' : ''}</div>
      </div>
      <div style="margin-top:var(--s4)">
        <div class="row" style="margin-bottom:var(--s3)">
          <h3 style="flex:1">O que este usuário pode fazer</h3>
          <button type="button" class="btn ghost sm" id="uu-padrao">Restaurar padrão do perfil</button>
        </div>
        <div id="uu-perms">${checkboxes(u.permissoes || [], u.perfil)}</div>
        <p class="dim" style="font-size:12px;margin:0">Administrador tem acesso total independentemente das marcações.</p>
      </div>`,
      `${orig && !eu ? `<button class="btn danger" id="uu-excluir" style="margin-right:auto">Excluir usuário</button>` : ''}
       <button class="btn ghost" data-fechar>Cancelar</button>
       <button class="btn" id="uu-salvar">${orig ? 'Salvar alterações' : 'Cadastrar usuário'}</button>`, '760px');

    const $ = i => document.getElementById(i);
    const descPerfil = () => { $('uu-perfil-desc').textContent = Perm.PERFIS[$('uu-perfil').value].desc; };
    descPerfil();
    $('uu-perfil').addEventListener('change', () => {
      descPerfil();
      $('uu-perms').innerHTML = checkboxes(Perm.doPerfil($('uu-perfil').value), $('uu-perfil').value);
    });
    $('uu-padrao').addEventListener('click', () => { $('uu-perms').innerHTML = checkboxes(Perm.doPerfil($('uu-perfil').value), $('uu-perfil').value); });

    const bx = $('uu-excluir');
    if (bx) bx.addEventListener('click', () => {
      UI.modal('Excluir ' + u.nome, '<p>O usuário perde o acesso imediatamente. As ordens de serviço que ele registrou continuam na base.</p>',
        `<button class="btn ghost" data-fechar>Manter</button><button class="btn danger" id="uu-conf-excluir">Excluir usuário</button>`);
      $('uu-conf-excluir').addEventListener('click', () => {
        if (!DB.excluirUsuario(u.id)) { UI.toast('Este é o único administrador ativo — não pode ser excluído.', 'warn'); return; }
        UI.fecharModal(); UI.toast('Usuário excluído.', 'ok'); App.render();
      });
    });

    $('uu-salvar').addEventListener('click', () => {
      const nome = $('uu-nome').value.trim(), login = $('uu-user').value.trim(), senha = $('uu-senha').value;
      if (!nome) { UI.toast('Informe o nome do usuário.', 'warn'); $('uu-nome').focus(); return; }
      if (!login) { UI.toast('Informe o usuário de login.', 'warn'); $('uu-user').focus(); return; }
      const dup = DB.usuarioPorLogin(login);
      if (dup && dup.id !== u.id) { UI.toast('Já existe um usuário com o login "' + login + '".', 'warn'); return; }
      if (!orig && senha.length < 4) { UI.toast('Defina uma senha com pelo menos 4 caracteres.', 'warn'); $('uu-senha').focus(); return; }

      u.nome = nome; u.usuario = login; u.setor = $('uu-setor').value.trim();
      u.perfil = $('uu-perfil').value;
      u.status = $('uu-status').disabled ? 'Ativo' : $('uu-status').value;
      if (senha) u.senha = senha;
      u.permissoes = [...document.querySelectorAll('#uu-perms [data-perm]:checked')].map(c => c.dataset.perm);
      if (u.perfil === 'Administrador') u.permissoes = Perm.TODAS.slice();
      else if (!u.permissoes.length) {
        // Sem isso, dava pra salvar um usuário sem nenhuma permissão marcada
        // e ele cair direto em "Acesso restrito" ao entrar — mesmo efeito do
        // bug da sincronização, só que causado aqui na tela em vez da nuvem.
        UI.toast('Marque ao menos uma permissão — sem nenhuma, o usuário não consegue acessar nada no sistema.', 'warn');
        return;
      }

      // Sinaliza pra nuvem se a senha mudou agora ou se é pra manter a atual
      // (campo em branco numa edição não deve sobrescrever a senha lá).
      u._novaSenhaPlana = senha || null;
      DB.salvarUsuario(u);
      UI.fecharModal();
      UI.toast(orig ? 'Usuário atualizado.' : 'Usuário cadastrado.', 'ok');
      if (eu) { Auth.aplicar(DB.usuarios().find(x => x.id === u.id)); }
      App.render();
    });
  }

  function ligar() {
    const pintar = () => { document.getElementById('lista-usuarios').innerHTML = lista(); ligarLista(); };
    pintar();
    document.getElementById('u-busca').addEventListener('input', e => { busca = e.target.value; pintar(); });
    document.getElementById('u-perfil').addEventListener('change', e => { filtroPerfil = e.target.value; pintar(); });
    const bn = document.getElementById('novo-usuario');
    if (bn) bn.addEventListener('click', () => editar(''));
  }
  const ligarLista = () => document.querySelectorAll('[data-edit-u]').forEach(b =>
    b.addEventListener('click', () => editar(b.dataset.editU)));

  /* ---------- minha conta ---------- */
  function minhaConta() {
    const u = DB.usuarios().find(x => x.id === Estado.usuario.id);
    if (!u) return UI.vazio('Sessão expirada', 'Entre novamente no sistema.');
    App.aoRenderizar = () => {
      const $ = i => document.getElementById(i);
      $('mc-salvar').addEventListener('click', () => {
        const nome = $('mc-nome').value.trim();
        if (!nome) { UI.toast('Informe seu nome.', 'warn'); return; }
        u.nome = nome; u._novaSenhaPlana = null; DB.salvarUsuario(u); Auth.aplicar(u);
        UI.toast('Dados atualizados.', 'ok'); App.render();
      });
      $('mc-trocar').addEventListener('click', async () => {
        const atual = $('mc-atual').value, nova = $('mc-nova').value, conf = $('mc-conf').value;
        if (nova.length < 4) { UI.toast('A nova senha precisa de pelo menos 4 caracteres.', 'warn'); return; }
        if (nova !== conf) { UI.toast('A confirmação não confere com a nova senha.', 'warn'); return; }
        const btn = $('mc-trocar'); btn.disabled = true;
        let confere = String(atual) === String(u.senha); // reserva local (offline)
        if (window.Nuvem) {
          try { confere = !!(await Nuvem.verificarLoginNuvem(u.usuario, atual)); } catch (e) { /* mantém a checagem local */ }
        }
        btn.disabled = false;
        if (!confere) { UI.toast('A senha atual não confere.', 'warn'); $('mc-atual').focus(); return; }
        u.senha = nova; u._novaSenhaPlana = nova; DB.salvarUsuario(u);
        $('mc-atual').value = $('mc-nova').value = $('mc-conf').value = '';
        UI.toast('Senha alterada.', 'ok');
      });
    };
    App.acoesTopo('');
    return `<div class="stack">
      ${UI.card('Meus dados', `
        <div class="form-grid">
          <div class="field"><label for="mc-nome">Nome</label><input class="input" id="mc-nome" value="${Fmt.esc(u.nome)}"></div>
          <div class="field"><label for="mc-user">Usuário</label><input class="input" id="mc-user" value="${Fmt.esc(u.usuario)}" readonly></div>
          <div class="field"><label for="mc-perfil">Perfil</label><input class="input" id="mc-perfil" value="${Fmt.esc(u.perfil)}" readonly></div>
          <div class="field"><label for="mc-setor">Setor</label><input class="input" id="mc-setor" value="${Fmt.esc(u.setor || '—')}" readonly></div>
        </div>
        <div class="row" style="margin-top:var(--s3)"><button class="btn sm" id="mc-salvar">Salvar nome</button></div>`)}

      ${UI.card('Trocar senha', `
        <div class="form-grid">
          <div class="field"><label for="mc-atual">Senha atual</label><input class="input" type="password" id="mc-atual" autocomplete="current-password"></div>
          <div class="field"><label for="mc-nova">Nova senha</label><input class="input" type="password" id="mc-nova" autocomplete="new-password"></div>
          <div class="field"><label for="mc-conf">Confirmar nova senha</label><input class="input" type="password" id="mc-conf" autocomplete="new-password"></div>
        </div>
        <div class="row" style="margin-top:var(--s3)"><button class="btn sm" id="mc-trocar">Alterar senha</button></div>`)}

      ${UI.card('O que eu posso fazer', `<div class="perm-grid">${Perm.LISTA.map(p => {
        const tem = u.perfil === 'Administrador' || (u.permissoes || []).includes(p.id);
        return `<div class="perm-item" style="cursor:default"><span class="badge ${tem ? 'b-green' : 'b-gray'}">${tem ? 'sim' : 'não'}</span>
          <span${tem ? '' : ' class="dim"'}>${Fmt.esc(p.nome)}</span></div>`;
      }).join('')}</div>`)}
    </div>`;
  }

  return { pagina, minhaConta, editar };
})();
