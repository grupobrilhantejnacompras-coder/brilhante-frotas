/* ============================================================
   CONFIGURAÇÕES — parâmetros, base de dados e qualidade dos dados
   ============================================================ */
const Config = (() => {
  function pagina() {
    const b = DB.get(), c = DB.cfg();
    const semData = b.ordens.filter(o => !o.data);
    const suspeitas = b.ordens.filter(o => o.dataSuspeita);
    const semValor = b.ordens.filter(o => !o.total);
    App.aoRenderizar = ligar;
    App.acoesTopo('');

    const revisar = [...semData.map(o => ({ o, m: 'Sem data na planilha' })),
    ...suspeitas.map(o => ({ o, m: 'Data corrigida na importação (ano fora de 2026)' })),
    ...semValor.map(o => ({ o, m: 'Valor total zerado' }))];

    return `<div class="stack">
      ${UI.card('Regras de reincidência', `
        <div class="form-grid">
          <div class="field"><label for="c-janela">Janela de reincidência (dias)</label>
            <input class="input" type="number" min="7" max="365" id="c-janela" value="${c.janelaReincidencia}">
            <div class="dim" style="font-size:11.5px;margin-top:5px">Um retorno pelo mesmo sistema dentro deste prazo é sinalizado como reincidência.</div></div>
          <div class="field"><label for="c-osmes">Alerta de OS por veículo no período</label>
            <input class="input" type="number" min="1" max="20" id="c-osmes" value="${c.alertaOSmes}">
            <div class="dim" style="font-size:11.5px;margin-top:5px">Acima deste número o veículo aparece nos alertas gerenciais.</div></div>
        </div>
        <div class="row" style="margin-top:var(--s3)"><button class="btn sm" id="c-salvar">Salvar parâmetros</button></div>`)}

      ${UI.card('Base de dados', `
        <p>A planilha <strong>${Fmt.esc(b.origem)}</strong> é a base do sistema. Os lançamentos ficam gravados
        neste navegador e podem ser atualizados a qualquer momento importando a planilha da semana.</p>
        <div class="grid kpis" style="margin:var(--s4) 0">
          ${UI.kpi('Ordens de serviço', Fmt.num(b.ordens.length))}
          ${UI.kpi('Serviços cadastrados', Fmt.num(b.servicos.length))}
          ${UI.kpi('Veículos', Fmt.num(b.veiculos.length))}
          ${UI.kpi('Valor histórico', Fmt.money0(b.ordens.reduce((s, o) => s + o.total, 0)))}
        </div>
        <div class="row">
          ${Perm.pode('importar') ? `<button class="btn" id="c-importar">${Ico.imp} Importar planilha (.xlsx)</button>` : ''}
          ${Perm.pode('exportar') ? '<button class="btn ghost" id="c-exportar">Exportar backup (.json)</button>' : ''}
          ${Perm.pode('importar') ? '<button class="btn ghost" id="c-imp-backup">Importar backup (.json)</button>' : ''}
          ${Perm.pode('usuarios') ? '<button class="btn ghost" id="c-restaurar">Restaurar dados da planilha original</button>' : ''}
        </div>
        <p class="dim" style="font-size:12px;margin:var(--s3) 0 0">A importação mostra uma prévia antes de gravar e ignora lançamentos que já existem.</p>`)}

      ${UI.card('Versão publicada', `
        <p>Esta é a <strong>versão ${VERSAO.n}</strong>, gerada em ${VERSAO.data}.
        Confira este número depois de publicar no endereço oficial
        <strong>brilhante.vercel.app</strong> — se aparecer um número menor, o navegador está
        mostrando a versão antiga: atualize com <strong>Ctrl + Shift + R</strong>.</p>`)}

      ${UI.card('Onde os dados ficam guardados', `
        <p>Os lançamentos ficam gravados <strong>dentro do navegador de cada pessoa</strong>. Isso vale tanto para o arquivo
        aberto no computador quanto para o endereço publicado na internet — são <strong>cofres separados</strong>:
        o que foi digitado em um não aparece no outro, e cada celular ou computador que abrir o site começa com a base original da planilha.</p>
        <ol class="lista-passos">
          <li>No computador onde estão os lançamentos, clique em <strong>Exportar backup (.json)</strong>.</li>
          <li>Abra o sistema no endereço publicado e entre como administrador.</li>
          <li>Clique em <strong>Importar backup (.json)</strong> e escolha o arquivo. Use <em>Substituir</em> na primeira vez e <em>Acrescentar</em> nas seguintes.</li>
        </ol>
        <p class="dim" style="font-size:12px;margin:var(--s3) 0 0">Enquanto não houver um servidor central, exporte o backup ao fim de cada semana:
        é o que garante a base se o navegador for limpo ou o computador trocado. Vale lembrar também que as senhas ficam gravadas
        em texto no navegador — o controle de acesso organiza a rotina, mas não protege como uma autenticação de servidor.</p>`)}

      ${UI.card('Dados a revisar', revisar.length ? `
        <p class="dim">Registros importados com inconsistência na planilha. Nada foi apagado — corrija quando for conveniente.</p>
        ${UI.tabela([{ t: 'OS', k: 'n' }, { t: 'Veículo', k: 'v' }, { t: 'Data', k: 'd' }, { t: 'Situação encontrada', k: 'm' }, { t: '', k: 'a', cls: 'ta-r' }],
      revisar.slice(0, 40).map(r => ({
        n: r.o.numero, v: Fmt.esc(DB.nomeVeiculo(r.o.veiculoId)), d: Fmt.date(r.o.data),
        m: `<span class="badge b-amber">${Fmt.esc(r.m)}</span>`,
        a: `<button class="btn ghost sm" data-osrev="${r.o.id}">Abrir</button>`
      })), {})}` : UI.vazio('Base consistente', 'Nenhum registro pendente de revisão.'), '', revisar.length ? true : false)}

      ${UI.card('Acesso ao sistema', `
        <p>Cada pessoa entra com o próprio login, e o perfil define o que ela enxerga e pode alterar.</p>
        <div class="grid kpis" style="margin:var(--s4) 0">
          ${UI.kpi('Usuários cadastrados', Fmt.num(DB.usuarios().length))}
          ${UI.kpi('Ativos', Fmt.num(DB.usuarios().filter(u => u.status === 'Ativo').length))}
          ${UI.kpi('Administradores', Fmt.num(DB.usuarios().filter(u => u.perfil === 'Administrador').length))}
          ${UI.kpi('Perfis disponíveis', Fmt.num(Perm.nomesPerfis().length))}
        </div>
        <div class="row">
          ${Perm.pode('usuarios') ? '<button class="btn" data-ir="usuarios">Gerenciar usuários e acessos</button>' : ''}
          <button class="btn ghost" data-ir="minha-conta">Minha conta e senha</button>
        </div>`)}
    </div>`;
  }

  function ligar() {
    const $ = id => document.getElementById(id);
    $('c-salvar').addEventListener('click', () => {
      const c = DB.cfg();
      c.janelaReincidencia = Math.min(365, Math.max(7, +$('c-janela').value || 90));
      c.alertaOSmes = Math.min(20, Math.max(1, +$('c-osmes').value || 3));
      DB.save(); UI.toast('Parâmetros salvos.', 'ok'); App.render();
    });
    document.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => App.irPara(b.dataset.ir)));
    if ($('c-importar')) $('c-importar').addEventListener('click', () => Importar.abrir());
    if ($('c-exportar')) $('c-exportar').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([DB.exportarJSON()], { type: 'application/json' }));
      a.download = 'backup-os-brilhante-' + Dt.today() + '.json';
      a.click(); URL.revokeObjectURL(a.href);
      UI.toast('Backup exportado.', 'ok');
    });
    if ($('c-imp-backup')) $('c-imp-backup').addEventListener('click', abrirBackup);
    if ($('c-restaurar')) $('c-restaurar').addEventListener('click', () => {
      UI.modal('Restaurar dados originais',
        '<p>Isso descarta as ordens de serviço criadas no sistema e volta ao conteúdo da planilha importada. Não é possível desfazer.</p>',
        `<button class="btn ghost" data-fechar>Cancelar</button><button class="btn danger" id="conf-rest">Restaurar</button>`);
      $('conf-rest').addEventListener('click', () => { DB.restaurar(); UI.fecharModal(); UI.toast('Base restaurada.', 'ok'); App.render(); });
    });
    document.querySelectorAll('[data-osrev]').forEach(b => b.addEventListener('click', () => App.irPara('ordens/' + b.dataset.osrev)));
  }

  /* ---------- Importar backup (.json) ---------- */
  function abrirBackup() {
    UI.modal('Importar backup (.json)', `
      <p>Escolha o arquivo <strong>backup-os-brilhante-….json</strong> exportado no outro computador.
      Nada é gravado antes de você conferir a prévia.</p>
      <div class="field" style="margin-top:var(--s3)">
        <input class="input" type="file" id="bk-arq" accept=".json,application/json">
      </div>
      <div id="bk-previa"></div>`,
      `<button class="btn ghost" data-fechar>Cancelar</button>
       <button class="btn" id="bk-mesclar" disabled>Acrescentar o que falta</button>
       <button class="btn danger" id="bk-subst" disabled>Substituir a base</button>`);

    const $ = id => document.getElementById(id);
    let base = null;

    $('bk-arq').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        base = DB.lerBackup(await f.text());
        const c = DB.conferirBackup(base);
        $('bk-previa').innerHTML = `
          <div class="grid kpis" style="margin:var(--s4) 0">
            ${UI.kpi('OS no arquivo', Fmt.num(c.arquivo.ordens), Fmt.money0(c.arquivo.total))}
            ${UI.kpi('OS nesta base', Fmt.num(c.atual.ordens), Fmt.money0(c.atual.total))}
            ${UI.kpi('OS que ainda faltam aqui', Fmt.num(c.novas.ordens))}
          </div>
          <p><strong>Acrescentar o que falta:</strong> soma ${Fmt.num(c.novas.ordens)} ordens,
             ${Fmt.num(c.novas.veiculos)} veículos, ${Fmt.num(c.novas.servicos)} serviços e
             ${Fmt.num(c.novas.usuarios)} usuários, sem apagar nada do que já existe aqui.</p>
          <p><strong>Substituir a base:</strong> descarta o conteúdo atual deste navegador e deixa exatamente
             o que está no arquivo (${Fmt.num(c.arquivo.ordens)} ordens, ${Fmt.num(c.arquivo.veiculos)} veículos,
             ${Fmt.num(c.arquivo.usuarios)} usuários). Use na primeira carga do sistema publicado.</p>
          ${base.origem ? `<p class="dim" style="font-size:12px">Origem do arquivo: ${Fmt.esc(base.origem)}</p>` : ''}`;
        $('bk-mesclar').disabled = false; $('bk-subst').disabled = false;
      } catch (err) {
        base = null; $('bk-previa').innerHTML = `<p class="badge b-amber" style="display:inline-block;margin-top:var(--s3)">${Fmt.esc(err.message)}</p>`;
        $('bk-mesclar').disabled = true; $('bk-subst').disabled = true;
      }
    });

    const aplicar = modo => {
      if (!base) return;
      const r = DB.importarBackup(base, modo);
      UI.fecharModal();
      UI.toast(modo === 'substituir'
        ? `Base substituída: ${Fmt.num(r.ordens)} ordens e ${Fmt.num(r.usuarios)} usuários.`
        : `Backup acrescentado: +${r.ordens} OS, +${r.veiculos} veículos, +${r.servicos} serviços, +${r.usuarios} usuários.`, 'ok');
      Auth.revalidar(); App.render();
    };
    $('bk-mesclar').addEventListener('click', () => aplicar('mesclar'));
    $('bk-subst').addEventListener('click', () => {
      UI.modal('Confirmar substituição',
        '<p>Todo o conteúdo gravado neste navegador será descartado e trocado pelo do arquivo. Não é possível desfazer.</p>',
        `<button class="btn ghost" data-fechar>Cancelar</button><button class="btn danger" id="bk-ok">Substituir</button>`);
      document.getElementById('bk-ok').addEventListener('click', () => aplicar('substituir'));
    });
  }
  return { pagina };
})();

/* ============================================================ INICIALIZAÇÃO */
App.registrar('dashboard', Painel.pagina);
App.registrar('nova-os', Nova.pagina);
App.registrar('ordens', Ordens.pagina);
App.registrar('servicos', Servicos.pagina);
App.registrar('veiculos', Veiculos.pagina);
App.registrar('veiculo', Veiculos.pagina);
App.registrar('relatorios', Relatorios.pagina);
App.registrar('reincidencias', Reincidencias.pagina);
App.registrar('config', Config.pagina);
App.registrar('usuarios', Usuarios.pagina);
App.registrar('minha-conta', Usuarios.minhaConta);
App.registrar('sem-acesso', () => App.semAcesso());

(function iniciar() {
  DB.load();
  Auth.restaurar();
  if (Estado.usuario && !location.hash) location.hash = '#/' + Auth.paginaInicial();
  App.render();
})();
