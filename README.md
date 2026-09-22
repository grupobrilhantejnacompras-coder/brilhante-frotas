# Brilhante Gestão de Frotas — projeto oficial

Sistema de ordens de serviço e manutenção de frotas do Grupo Brilhante.
Este repositório é a **única fonte de verdade**. Nada é editado direto no site publicado.

```
src/  →  build.py  →  site/index.html  →  Vercel  →  https://brilhante.vercel.app
```

## Estrutura

| Caminho | O que é |
|---|---|
| `src/*.js`, `src/style.css` | código-fonte, um arquivo por área do sistema |
| `dados_brilhante.json` | base extraída da planilha (247 OS, 99 veículos, 77 serviços) |
| `logo_min.svg` | logo institucional vetorizada |
| `extrair.py` | reprocessa a planilha original e regera `dados_brilhante.json` |
| `build.py` | junta tudo num arquivo único e publica em `site/index.html` |
| `src/10_supabase.js` | sincronização das O.S. e dos usuários com o Supabase (nuvem) |
| `supabase_schema_brilhante.sql` | schema original do banco Supabase (tabelas, RLS, login por hash) |
| `supabase_usuarios_sync.sql` | migração do login/usuários para o servidor — rodar uma vez no SQL Editor do Supabase (ver seção abaixo) |
| `site/` | **o que vai para a Vercel** — `index.html` + `vercel.json` |
| `VERSAO.txt` | contador de versão, incrementado a cada build |
| `teste*.js` | 9 suítes automatizadas (Playwright) |
| `DOCUMENTACAO.md` | manual funcional do sistema |

`Sistema_OS_Grupo_Brilhante.html` na raiz é a mesma coisa que `site/index.html`,
mantido com esse nome para quem usa o sistema abrindo o arquivo direto no computador.

## Como alterar o sistema

1. edite o arquivo certo em `src/` (nunca o HTML gerado — ele é sobrescrito);
2. `python3 build.py` — mostra a versão nova e atualiza `site/index.html`;
3. `node teste.js` … `node teste9.js` — todas devem terminar com “Erros: nenhum”;
4. publique (abaixo).

Ordem de concatenação e nomes dos módulos: ver `ORDEM` em `build.py`.

## Publicar na Vercel

**Endereço oficial:** https://brilhante.vercel.app
**Repositório:** `grupobrilhantejnacompras-coder/brilhante-frotas` (privado)

O projeto `brilhante` da Vercel está ligado a este repositório, branch `main`,
Framework Preset **Other** (site estático, sem build). Publicar é só isto:

```
commit em main  →  Vercel publica sozinha  →  brilhante.vercel.app
```

Não use o v0 e não crie outro projeto na Vercel — o endereço mudaria.

Para atualizar o sistema: gere o build (`python3 build.py`), substitua `index.html`
no repositório e faça o commit. Em seguida confira o número da versão no rodapé da
tela de login e em *Configurações → Versão publicada*. Se vier menor, é cache do
navegador: `Ctrl + Shift + R`. O `vercel.json` já manda revalidar a cada visita e
mantém `/sistema.html` funcionando (endereço antigo, redirecionado para `/`).

> O repositório é **privado por obrigação**: as senhas dos usuários ficam em texto
> dentro de `index.html`. Nunca torne este repositório público.

## Dados — nuvem (Supabase) + reserva local

Desde a **v6.0**, as **Ordens de Serviço ficam salvas no Supabase** (nuvem) e são
acessíveis de qualquer computador. O `localStorage` (chave `brilhante_os_v1`) continua
como **reserva offline**: se a internet cair, o app segue funcionando e sincroniza quando
a conexão voltar.

- **Projeto Supabase:** `ysszhioygqyjbcgjgpca` — `https://ysszhioygqyjbcgjgpca.supabase.co`
- **Chave usada no app:** a *publishable key* (`sb_publishable_…`), embutida em `index.html`.
  É pública por natureza; a proteção vem das políticas **RLS** do schema.
- **Tabelas:** `ordens`, `veiculos`, `servicos`, `usuarios` (ver `supabase_schema_brilhante.sql`).
- **O que sincroniza hoje:** as **O.S.** e o **login/usuários** (`src/10_supabase.js`).
  Veículos e catálogo de serviços ainda são **locais** (semente embutida no build).
- **Como funciona (O.S.):** ao salvar/excluir uma O.S., o app espelha no Supabase; ao logar, ele
  baixa todas as O.S. da nuvem e mescla. O módulo embrulha `DB.salvarOS`/`DB.excluirOS`
  sem alterar o core.
- **Como funciona (login/usuários):** o login confere usuário e senha direto no banco,
  pela função `verificar_login` (RPC) — é a fonte da verdade. Criar, editar, excluir
  usuário e trocar senha (`salvar_usuario`/`excluir_usuario`) também gravam no Supabase.
  Sem internet ou com o Supabase fora do ar, o app cai pra reserva local (último dado
  salvo naquele aparelho) sem travar o login. O módulo embrulha `DB.salvarUsuario`/
  `DB.excluirUsuario` do mesmo jeito que faz com as O.S.
- **CSP:** o host do Supabase está liberado em `connect-src` no `vercel.json`.

Rodar o schema (`supabase_schema_brilhante.sql`) no **SQL Editor** do Supabase é seguro
repetir (usa `IF NOT EXISTS` / `ON CONFLICT`).

**Migração do login (rodar uma vez, se ainda não rodou):** abra o `supabase_usuarios_sync.sql`
deste repositório, cole o conteúdo inteiro no **SQL Editor** do projeto Supabase
(`ysszhioygqyjbcgjgpca`) e clique **Run**. É seguro repetir. Ele tranca a tabela `usuarios`
por RLS (a senha nunca é lida pelo site), cria a view `usuarios_publico` (sem a senha, para
listar usuários na tela de administração) e as três funções `verificar_login`,
`salvar_usuario` e `excluir_usuario`, que são as únicas que enxergam o hash da senha.
Enquanto esse script não for rodado, o app funciona normalmente pela reserva local — as
chamadas ao Supabase falham e caem no fallback automaticamente.

Backup manual continua disponível: *Configurações → Exportar / Importar backup (.json)*.
Uma versão nova **não apaga** o que já está gravado: a função `migrar()` em
`src/01_core.js` ajusta a base antiga e só acrescenta o que falta.

## Login no servidor (implementado na v6.7)

O login passou a ser conferido **no Supabase** (fonte da verdade), não mais só no
navegador de cada aparelho. Isso resolveu a causa raiz de toda a instabilidade de login
observada até a v6.6: usuário, senha, cadastro e permissões viviam só no `localStorage`
de cada navegador — por isso um usuário criado ou uma senha trocada num aparelho não
aparecia nos outros.

O que mudou:

- o login (`Auth.entrar` em `src/03_app.js`) agora é **assíncrono**: chama
  `Nuvem.verificarLoginNuvem` primeiro (RPC `verificar_login` no Supabase) e só cai pra
  reserva local se não houver internet ou o Supabase estiver fora do ar;
- criar, editar, excluir usuário e trocar senha (`src/08c_usuarios.js`) gravam no Supabase
  via `salvar_usuario`/`excluir_usuario`, além de continuar salvando local;
- as senhas passam a existir **só como hash** no banco (nunca em texto no código); a
  tabela `usuarios` fica trancada por RLS e só as funções acima enxergam o hash;
- a **troca de senha** passa a valer **em qualquer computador ou celular** na hora.

Pré-requisito: rodar `supabase_usuarios_sync.sql` uma vez no SQL Editor do Supabase
(ver seção acima). Enquanto isso não é feito, o app segue funcionando normalmente pela
reserva local, sem travar ninguém.
