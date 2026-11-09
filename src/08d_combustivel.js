/* ============================================================
   COMBUSTÍVEIS — módulo SEPARADO da OS
   Mostra o painel de combustível (combustivel/index.html) dentro do sistema.
   Não lê nem grava ordens de serviço, veículos, relatórios ou qualquer dado da OS:
   o painel roda isolado numa moldura (iframe) e tem as próprias planilhas embutidas.
   Acesso controlado pela permissão própria "combustivel.ver".
   ============================================================ */
const Combustivel = (() => {
  const CAMINHO = 'combustivel/index.html';

  function relatorios() {
    App.acoesTopo('');
    const publicado = /^https?:$/.test(location.protocol);
    if (!publicado) {
      return UI.vazio('Disponível no site publicado',
        'Os relatórios de combustível abrem dentro do site brilhante.vercel.app. Neste arquivo aberto no computador, entre pelo endereço do site para vê-los.');
    }
    return `<div class="comb-frame"><iframe id="comb-iframe" title="Relatórios de combustível — Grupo Brilhante" src="${CAMINHO}" referrerpolicy="same-origin"></iframe></div>`;
  }
  return { relatorios };
})();
