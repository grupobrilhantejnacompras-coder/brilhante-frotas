# Sistema de Ordens de Serviço de Frotas — Grupo Brilhante

Documentação de entrega · Juína/MT · agosto de 2026

---

## 1. O que foi entregue

`Sistema_OS_Grupo_Brilhante.html` — sistema web completo, em arquivo único (310 KB), que
substitui o controle da planilha `RELATORIO SEMANAL OFICINA`. Funciona no computador,
tablet e celular, sem instalação, sem servidor e sem internet.

**Como abrir:** dois cliques no arquivo. Ele abre no navegador (Chrome ou Edge).

**Acesso inicial:** usuário `Kamau` · senha `159753`
(pode ser alterado em *Configurações → Acesso*).

---

## 2. A planilha como banco de dados

A planilha não foi descartada nem reescrita — ela **é** a base do sistema. Todas as abas
foram lidas e transformadas em registros utilizáveis:

| Aba da planilha | Vira o quê no sistema |
|---|---|
| `valores` | Catálogo de serviços com preço — **77 serviços** em 5 categorias (ampliável pela própria OS) |
| `Mecanica` | 152 ordens de serviço (mecânico Jeferson) |
| `Posto de mola` | 47 ordens de serviço (Vandame) |
| `Ser.ar cond.` | 45 ordens de serviço (ar condicionado) |
| `OP.F.` | 3 ordens de serviço (Operação Florestal) |
| `Ser.mecanica`, `Ser.postomola`, `Ar cond.` | Resumos semanais — não geram OS (são totais calculados) |

**Total carregado: 247 ordens de serviço · 659 serviços lançados · 99 veículos ·
30 condutores · 15 locais · R$ 116.927 de histórico (fev a ago/2026).**

### Como a leitura foi feita

Cada aba de detalhe é um conjunto de blocos `Data | Quilom. | Serviço | Valor`, um bloco
por veículo. O sistema:

1. localiza cada cabeçalho "Data" e o nome do veículo ao lado;
2. agrupa em uma OS todos os serviços lançados sob a mesma data;
3. extrai a placa do título do bloco (`Hilux QMS4G35/Sebastião` → placa QMS4G35, condutor
   Sebastião) e unifica o mesmo veículo que aparece em abas diferentes;
4. separa quantidade da descrição (`2Bieleta · R$ 80` → 2 × R$ 40);
5. identifica se o veículo mede KM ou horímetro pelo tipo (máquina e trator = horas).

### Inconsistências: preservadas, não apagadas

Nada foi excluído. O que estava fora do padrão está sinalizado em
**Configurações → Dados a revisar**:

- 6 OS sem data na planilha;
- 9 datas fora de 2026 (`2204-04-04`, `17/07/206`, `1607/2026`) — corrigidas para 2026 e marcadas;
- placas com digitação divergente (`NPJ6497`/`NPJ6E97`, `RFS6Q67`/`RFS6G67`) — unificadas por tabela de correspondência;
- número de frota em branco onde a planilha não tinha — editável na tela de veículos.

---

## 3. Importação de novas planilhas

*Configurações → Importar planilha (.xlsx)*

O sistema **lê o arquivo .xlsx direto no navegador** (descompacta o arquivo e interpreta as
abas, sem enviar nada para lugar nenhum). O fluxo:

1. escolher o arquivo;
2. o sistema mostra uma **prévia**: quantas OS, serviços e veículos novos foram encontrados;
3. só grava depois de confirmar;
4. lançamentos que já existem na base são ignorados — reimportar a mesma planilha não duplica nada.

Assim, a rotina da semana continua a mesma: preencher a planilha e importar, ou lançar
direto no sistema. Os dois caminhos alimentam a mesma base.

> Verificado: reimportar a planilha original resulta em **0 OS novas**; importar sobre uma
> base vazia reconstrói as 247 OS e os 77 serviços.

---

## 4. Telas

| Tela | Para que serve |
|---|---|
| **Dashboard** | 6 indicadores, alertas gerenciais, 4 gráficos e 2 rankings — tudo respondendo aos filtros |
| **Nova OS** | Registro rápido: data automática, campo de veículo com digitação livre e cadastro na hora, placa e frota preenchidas pelo veículo, valor buscado no catálogo, total calculado |
| **Ordens de serviço** | Consulta com busca, filtros, ordenação por coluna, visualizar, editar, duplicar, imprimir e excluir |
| **Serviços** | Catálogo importado da planilha; adicionar, editar valor, desativar |
| **Veículos** | Cadastro completo, edição de qualquer veículo já existente, painel de dados a completar e histórico com linha do tempo |
| **Relatórios** | Três visões: relatório semanal, resumo executivo e **painel interativo da diretoria** — todos imprimíveis, e o painel exportável em HTML |
| **Reincidências** | Análise dedicada: quem voltou, por qual sistema, em quantos dias e quanto custou |
| **Usuários** | Cadastro de usuários, perfis de acesso e permissões individuais |
| **Configurações** | Parâmetros, importação, backup, dados a revisar, acesso |

---

## 4.1 Campo de veículo — digitar ou cadastrar

Na tela de Nova OS o veículo não é uma lista fechada. O mecânico **digita** o que souber —
nome, placa ou número da frota — e o sistema completa sozinho:

- `QMS4G35` → Hilux · QMS4G35;
- `trailbl` → Trailblezer;
- `10209.22` → o veículo daquela frota.

Ao encontrar, preenche placa, frota, tipo de medição (km ou horímetro), última leitura
registrada e sugere local e condutor do veículo — que continuam editáveis.

**Se o veículo não existir**, aparece na hora o atalho *Cadastrar este veículo* (ou o botão
*+ Cadastrar veículo* ao lado do campo). O formulário abre **já preenchido com o que foi
digitado**: de `Hilux Nova SPX1A11 frota 10500.10` ele separa nome, placa e frota
automaticamente. Basta conferir o tipo, salvar, e o veículo já fica selecionado na OS —
sem sair da tela e sem perder o que já foi lançado.

Placa duplicada é bloqueada, e o veículo novo passa a valer para todo o sistema: dashboard,
histórico, reincidências e relatórios.

## 4.2 Serviços executados — digitar ou cadastrar

O mesmo vale para cada linha de serviço da OS. O campo é livre: o mecânico começa a digitar
e o navegador sugere os 77 serviços do catálogo, mostrando o valor ao lado. Ao escolher um
deles, o **valor unitário é preenchido sozinho** e a linha marca *Catálogo · categoria · valor*.

Se o serviço não estiver na tabela, nada trava — ele digita a descrição e o valor
normalmente. Abaixo do campo aparece *Serviço fora do catálogo · **Cadastrar este serviço***.
Clicando, abre o cadastro **já preenchido com a descrição e o valor digitados**; basta
escolher a categoria e salvar. O serviço entra no catálogo na hora, passa a valer para as
próximas OS e aparece na tela de Serviços.

Se já houver algo parecido cadastrado, o sistema avisa antes de salvar — evita o mesmo
serviço com dois nomes e dois preços.

---

## 4.3 Painel da diretoria — interativo e compartilhável

Em *Relatórios → Painel da diretoria*, o período escolhido vira um painel completo:

- **6 indicadores**: valor total, OS, veículos atendidos, serviços executados, custo médio
  por OS e **variação percentual contra o período anterior de mesma duração**;
- **alertas gerenciais** — veículos que repetem o mesmo sistema ou concentram custo;
- **5 gráficos**: evolução semanal, gastos por tipo de serviço, gastos por local, serviços
  por mecânico e ranking dos veículos com maior custo (em âmbar os que têm reincidência);
- **tabelas** de veículos atendidos e de reincidências, com clique para abrir o veículo.

**Interativo:** clicar em qualquer barra filtra o painel inteiro — por sistema, local,
mecânico ou tipo de veículo. O filtro ativo vira uma etiqueta no topo, e *Limpar tudo*
volta à visão completa.

### Enviar para a diretoria

Três botões no topo do painel:

| Botão | O que faz |
|---|---|
| **Baixar painel (.html)** | Gera um arquivo único — `Painel-Frotas-Brilhante-<período>.html` — com os dados daquele período embutidos |
| **Compartilhar** | Envia o arquivo pelo compartilhamento do aparelho (WhatsApp, e-mail, Drive). Onde não houver, baixa o arquivo |
| **Copiar resumo** | Copia um resumo em texto — total, OS, veículos, custo médio, reincidências, variação e os 3 maiores custos — pronto para colar no WhatsApp |

O arquivo gerado **abre sozinho em qualquer navegador**, sem login, sem internet e sem o
sistema: cabeçalho com a logo, filtros por local, serviço, mecânico e tipo, os mesmos
gráficos com tooltip, tabelas e botão de imprimir/PDF. É seguro enviar para quem não usa o
sistema — ele contém apenas o período selecionado e é somente leitura.

---

## 4.4 Completar o cadastro dos veículos

A planilha trouxe os veículos com o que ela tinha — muitos ficaram sem número de frota, sem
ano, sem condutor. Em *Veículos*, uma faixa de etiquetas mostra **quantos veículos estão sem
cada informação**:

`Todos (99)` · `Placa 22` · `Nº da frota 89` · `Local 68` · `Condutor 64` · `KM/H atual 28` · `Marca 36` · `Modelo 52` · `Ano 99`

Clicando em *Nº da frota 89*, a lista passa a mostrar só esses 89 veículos. Cada linha tem o
botão **Editar** — abre o cadastro com um aviso do que falta e os campos em branco
destacados em âmbar, com o cursor já no primeiro deles. Preencheu, salvou, a etiqueta
diminui. Dá para fazer aos poucos, conforme os dados forem sendo localizados.

A coluna *Cadastro* mostra a situação de cada veículo: **faltam N** (dados essenciais),
**complementar** (só marca/modelo/ano) ou **completo**. Na página do veículo, o botão do topo
vira *Completar cadastro (N)* quando há pendência.

Nada do histórico se perde ao editar: as OS continuam ligadas ao mesmo veículo.

---

## 4.5 Usuários e níveis de acesso

*Usuários* (menu Sistema, visível para administradores).

Cada pessoa entra com o próprio login. O sistema traz quatro perfis prontos:

| Perfil | O que faz |
|---|---|
| **Administrador** | Acesso total, incluindo usuários e configurações |
| **Gestor** | Opera e analisa tudo, sem gerenciar usuários |
| **Mecânico** | Registra e edita OS, consulta veículos e serviços. Sem relatórios, sem excluir |
| **Diretoria** | Somente leitura: dashboard, relatórios e reincidências, com exportação do painel |

O perfil é apenas um atalho: ao cadastrar, aparecem **15 permissões individuais** agrupadas em
*Visualizar*, *Operar* e *Administrar* — dá para marcar ou desmarcar qualquer uma para aquele
usuário. O botão *Restaurar padrão do perfil* volta ao conjunto original, e usuários com ajuste
manual ficam marcados como **personalizado** na lista.

O bloqueio vale de verdade, não é só esconder botão:

- o menu lateral mostra apenas o que a pessoa pode abrir;
- digitar o endereço de uma página proibida cai numa tela de *acesso restrito*;
- botões de excluir, editar e exportar não aparecem para quem não tem a permissão;
- cada usuário entra direto na primeira página do seu perfil (o mecânico abre na Nova OS);
- usuário **Inativo** não entra, e o sistema não deixa excluir ou inativar o último administrador.

Cada pessoa troca a própria senha em **Minha conta** (clicando no nome, no rodapé do menu),
onde também vê a lista do que pode e do que não pode fazer.

### Equipe já cadastrada

O sistema **nasce com a equipe pronta**. Quem abrir o arquivo ou o endereço publicado já
encontra o próprio login funcionando, sem precisar cadastrar de novo:

| Nome | Usuário | Senha | Perfil | Setor |
|---|---|---|---|---|
| Kamau | `Kamau` | `159753` | Administrador | Compras |
| Taini | `Taini` | `0000` | Administrador | Almoxarifado |
| Clayton | `Clayton` | `1234` | Gestor | Oficina |
| Guilherme | `Guilherme` | `0000` | Diretoria | Diretoria |
| Jeferson | `Jeferson` | `1111` | Mecânico | Oficina |
| Allan | `Allan` | `2222` | Mecânico | Oficina |
| Gemerson | `Gemerson` | `3333` | Mecânico | Oficina |
| Vandame | `Vandame` | `4444` | Mecânico | Oficina |

Taini recebeu o mesmo acesso do Kamau (Administrador), como pedido. O login não diferencia
maiúsculas de minúsculas — `jeferson` e `Jeferson` entram igual.

Bases que já estavam em uso recebem esses usuários automaticamente na primeira abertura da
nova versão, sem mexer em ninguém que já existia e sem trazer de volta quem foi excluído.

> **Senhas curtas em site público.** `0000`, `1111` e `1234` são práticas na oficina, mas o
> endereço publicado está aberto na internet: qualquer pessoa com o link pode tentar. Para os
> perfis que enxergam valores e relatórios — Taini, Clayton e Guilherme — vale trocar por algo
> menos óbvio em *Minha conta*. Os mecânicos, que só registram OS, podem ficar com as curtas.

---

## 5. Como a reincidência é identificada

Cada serviço é classificado automaticamente em um **sistema do veículo** — Freios,
Suspensão e Molejo, Direção, Transmissão e Tração, Motor, Arrefecimento, Elétrica,
Ar Condicionado, Pneus e Rodas, Estrutura e Solda.

Quando um veículo volta pelo **mesmo sistema** dentro da janela configurada
(padrão: 90 dias, ajustável), o sistema alerta — na hora de abrir a OS, no dashboard,
na página do veículo e no relatório semanal — mostrando data anterior, serviço,
mecânico, valor e o intervalo em dias e em KM/horas.

Serviços de rotina (troca de óleo, filtros, engraxamento, lavagem, ajustes) e serviços
gerais de oficina **não** contam como reincidência — repetir revisão é o esperado,
repetir conserto de freio não é.

Na base atual: **69 reincidências**, sendo Freios e Transmissão os sistemas que mais voltam.

---

## 6. Onde os dados ficam gravados

No próprio navegador, no computador onde o sistema é usado (armazenamento local do
navegador — chave `brilhante_os_v1`). Ordens de serviço, veículos, serviços **e os usuários**
ficam nesse mesmo lugar. Não depende de internet nem de servidor.

Como os dados são locais, as senhas ficam gravadas em texto no navegador — o controle de
acesso organiza quem faz o quê no dia a dia, mas não substitui um servidor com autenticação
quando o sistema sair deste computador.

Consequências práticas:

- **use sempre o mesmo arquivo, no mesmo computador e navegador** — é onde ficam os lançamentos;
- faça **backup** periódico em *Configurações → Exportar backup (.json)*;
- *Restaurar dados da planilha original* volta tudo ao estado da importação inicial.

### 6.1 O sistema publicado na internet (brilhante.vercel.app)

Publicar o arquivo dá endereço, HTTPS e acesso pelo celular — mas **não cria um banco de dados
compartilhado**. O armazenamento continua sendo o do navegador de cada pessoa, e ele é separado
por endereço e por aparelho:

| Onde se abre | Onde os dados ficam |
|---|---|
| Arquivo no computador da oficina | Naquele computador, naquele navegador |
| `brilhante.vercel.app` no PC do escritório | Naquele PC |
| `brilhante.vercel.app` no celular do mecânico | Naquele celular |

São **cofres separados**. Uma OS registrada no celular não aparece no PC, e cada aparelho que
abre o site pela primeira vez começa com a base original da planilha (247 OS) e a equipe acima.

Cada build recebe um **número de versão**, mostrado no rodapé da tela de login e em
*Configurações → Versão publicada*. É por ele que se confere, em dois segundos, se o site
já está com a versão nova ou se o navegador está servindo cache antigo.

**Para levar os lançamentos de um lugar para o outro** foi criado o *Importar backup (.json)*
em Configurações:

1. no computador onde estão os lançamentos → **Exportar backup (.json)**;
2. abrir o endereço publicado e entrar como administrador;
3. **Importar backup (.json)** → escolher o arquivo → conferir a prévia → gravar.

A prévia mostra quantas OS existem no arquivo, quantas já existem ali e quantas faltam, e
oferece dois caminhos:

- **Acrescentar o que falta** — soma só o que não existe naquele navegador, sem apagar nada.
  Importar o mesmo arquivo duas vezes não duplica nada;
- **Substituir a base** — descarta o conteúdo daquele navegador e deixa exatamente o do
  arquivo. É o caminho da primeira carga no site publicado.

Ao acrescentar, veículos iguais são reconhecidos pela placa e têm os campos vazios completados
com o que vier no arquivo (é assim que o número de frota preenchido na oficina chega ao escritório).

**Rotina sugerida enquanto não houver servidor:** os lançamentos ficam num computador só — o da
oficina. Toda sexta, exportar o backup e importar no endereço publicado, que passa a ser a
vitrine de consulta da diretoria. O backup exportado é também o seguro contra navegador limpo
ou computador trocado.

Quando o volume justificar servidor e acesso simultâneo, a estrutura já está pronta:
todos os dados passam por um único módulo (`DB`), que pode apontar para uma API sem
mexer no restante do sistema.

---

## 7. Organização do código

O arquivo entregue é único para facilitar o uso, mas foi construído a partir de módulos
separados (incluídos em `codigo-fonte.zip`):

```
src/
  style.css          tokens visuais, componentes, impressão, responsividade
  01_core.js         formatação, datas, motor de reincidência, banco de dados, consultas
  02_ui.js           gráficos SVG, tabelas, modais, avisos, estados vazios
  03_app.js          autenticação, navegação, ícones, roteamento
  04_pages_os.js     nova OS, consulta de OS, serviços, veículos e histórico
  05_filtros.js      barra de filtros reutilizável
  06_painel.js       dashboard, alertas gerenciais, reincidências
  07_relatorios.js   relatório semanal e resumo executivo
  08_importar.js     leitor de .xlsx no navegador
  08b_exportar.js    painel HTML autônomo para a diretoria
  08c_usuarios.js    usuários, perfis, permissões e minha conta
  09_config.js       configurações e inicialização
extrair.py           leitura da planilha original → base de dados
build.py             junta tudo no arquivo único
teste.js/teste2.js   testes automatizados no navegador
```

Nenhuma biblioteca externa é usada — gráficos, leitura de Excel e interface são próprios.
Isso mantém o sistema leve, offline e sem dependência de terceiros.

---

## 8. Testes executados

Todos automatizados em navegador real, sem erros de console:

- login inválido bloqueado / login válido entra no dashboard;
- 6 indicadores e gráficos renderizados; filtros de período recalculando;
- Nova OS: data automática, placa e frota preenchidas pelo veículo, última leitura de KM exibida;
- valor unitário buscado do catálogo; quantidade × valor = total do item; soma dos itens = total da OS;
- alerta de reincidência disparado com intervalo em dias e KM;
- OS salva, aberta em detalhe e mantida após recarregar a página;
- histórico do veículo com linha do tempo e problemas recorrentes;
- relatório semanal e resumo executivo gerados;
- listagem de serviços e veículos; configurações;
- importação de .xlsx: leitura correta, prévia, ausência de duplicação, reconstrução completa da base;
- tela de Nova OS no celular (390 px);
- edição de veículo existente: filtro por informação faltante, aviso do que falta, campos em
  branco destacados, gravação do nº da frota e persistência após recarregar;
- usuários: cadastro de mecânico e diretoria, permissões padrão do perfil, bloqueio de login
  duplicado, menu filtrado por permissão, rota proibida bloqueada, mecânico salvando OS sem
  ver o botão de excluir, diretoria sem acesso de edição, troca de senha e recusa de senha
  atual errada, usuário inativo impedido de entrar;
- **equipe de fábrica**: os 8 logins entram, cada um abre na primeira página do seu perfil e vê
  só o menu a que tem direito; senha errada recusada; base antiga recebe a equipe na primeira
  abertura; usuário excluído pelo administrador não volta;
- **backup entre navegadores**: exportar num navegador e importar em outro, prévia antes de
  gravar, *acrescentar* traz a OS e o usuário que faltavam sem duplicar as 247 originais,
  reimportar o mesmo arquivo não duplica nada, *substituir* deixa a base idêntica à do arquivo
  e mantém a sessão aberta, arquivo inválido recusado, mecânico sem acesso a Configurações.

---

## 9. Evolução prevista

A estrutura já comporta, sem retrabalho: fotos antes/depois, assinatura digital, aprovação de serviços, controle
de peças e estoque, manutenção preventiva por KM/horímetro, controle de pneus e
abastecimento, e integração com Power BI ou Google Sheets a partir do backup `.json`.

---

*Grupo Brilhante — Produzir Alimento, Gerar Sustento e Trazer Desenvolvimento.*
