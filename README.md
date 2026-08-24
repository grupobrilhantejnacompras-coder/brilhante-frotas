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
| `src/10_supabase.js` | sincronização das O.S. com o Supabase (nuvem) |
| `supabase_schema_brilhante.sql` | schema do banco Supabase (tabelas, RLS, login por hash) |
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
- **O que sincroniza hoje:** só as **O.S.** (`src/10_supabase.js`). Login, usuários,
  veículos e catálogo de serviços ainda são **locais** (semente embutida no build).
- **Como funciona:** ao salvar/excluir uma O.S., o app espelha no Supabase; ao logar, ele
  baixa todas as O.S. da nuvem e mescla. O módulo embrulha `DB.salvarOS`/`DB.excluirOS`
  sem alterar o core.
- **CSP:** o host do Supabase está liberado em `connect-src` no `vercel.json`.

Rodar o schema (`supabase_schema_brilhante.sql`) no **SQL Editor** do Supabase é seguro
repetir (usa `IF NOT EXISTS` / `ON CONFLICT`). Ele também cria o login seguro por hash
(`verificar_login`) — hoje ainda não usado pelo app (ver próximo passo).

Backup manual continua disponível: *Configurações → Exportar / Importar backup (.json)*.
Uma versão nova **não apaga** o que já está gravado: a função `migrar()` em
`src/01_core.js` ajusta a base antiga e só acrescenta o que falta.

## Próximo passo registrado — login no servidor

Hoje o **login é feito no navegador** (as senhas ficam na semente, dentro do `index.html`).
Consequências:

- as senhas ficam **visíveis no código** (por isso o repositório é privado);
- a **troca de senha** (*Minha conta → Trocar senha*) só vale **no computador onde foi feita** —
  não atravessa para os outros.

Para resolver os dois de uma vez, mudar o login do app para validar no Supabase pela
função **`verificar_login`** (já criada e testada no schema):

1. no login, em vez de comparar com a semente local, chamar
   `POST /rest/v1/rpc/verificar_login` com usuário e senha;
2. as senhas passam a existir **só como hash** no banco (nunca no código);
3. a **troca de senha** passa a valer **em todos os computadores** (via `salvar_usuario`);
4. cada usuário redefine a própria senha e isso reflete em qualquer lugar.

É a única mudança que altera **como todos entram** no sistema — fazer só com o "ok" do
Kamau. Todo o acesso a dados passa por um único módulo (`DB` / `Nuvem`), então a troca
fica contida e não mexe nas telas.
