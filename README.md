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
| `site/` | **o que vai para a Vercel** — `index.html` + `vercel.json` |
| `VERSAO.txt` | contador de versão, incrementado a cada build |
| `teste*.js` | 7 suítes automatizadas (Playwright) |
| `DOCUMENTACAO.md` | manual funcional do sistema |

`Sistema_OS_Grupo_Brilhante.html` na raiz é a mesma coisa que `site/index.html`,
mantido com esse nome para quem usa o sistema abrindo o arquivo direto no computador.

## Como alterar o sistema

1. edite o arquivo certo em `src/` (nunca o HTML gerado — ele é sobrescrito);
2. `python3 build.py` — mostra a versão nova e atualiza `site/index.html`;
3. `node teste.js` … `node teste7.js` — todas devem terminar com “Erros: nenhum”;
4. publique (abaixo).

Ordem de concatenação e nomes dos módulos: ver `ORDEM` em `build.py`.

## Publicar na Vercel

**Endereço oficial:** https://brilhante.vercel.app
Endereços longos (`brilhante-xxxxx-….vercel.app`) são previews protegidos por login da
Vercel — não servem para a equipe.

Arraste a pasta **`site`** inteira no projeto `brilhante` da Vercel
(Deployments → Create Deployment). Nunca crie um projeto novo: o endereço mudaria.

Depois de publicar, confira o número da versão no rodapé da tela de login e em
*Configurações → Versão publicada*. Se for menor que o do build, é cache: `Ctrl + Shift + R`.

O `vercel.json` já manda o navegador revalidar a cada visita, então uma publicação nova
aparece na próxima atualização da página.

## Dados

Cada navegador guarda a própria base (`localStorage`, chave `brilhante_os_v1`).
Publicar **não** transporta lançamentos. Para levar dados de um lugar a outro:
*Configurações → Exportar backup (.json)* e, no destino, *Importar backup (.json)*
(“Substituir a base” na primeira carga, “Acrescentar o que falta” depois).

Uma versão nova **não apaga** o que já está gravado no navegador: a função `migrar()`
em `src/01_core.js` ajusta a base antiga e só acrescenta o que falta.

## Próximo passo natural

Quando a oficina e o escritório precisarem ver os mesmos dados ao mesmo tempo, trocar o
`localStorage` por uma API. Todo o acesso a dados passa por um único módulo (`DB`), então
a troca não mexe nas telas.
