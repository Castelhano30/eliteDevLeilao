# Uso de IA neste projeto

O LanceAuto foi feito entre **22 e 29 de outubro de 2026** (421 commits), com IA em quase todas as etapas. Este arquivo responde a três perguntas: **quais ferramentas** usei, **em que partes** e **o que foi decisão minha**. Também conta como conduzi a IA e o que custou trabalhar com ela.

Tudo o que está aqui tem registro no [diário de progresso](_bmad-output/progresso.md), que escrevi ao longo da semana, passo a passo, para servir de base a este relato. Os números entre parênteses (item 10, item 30…) apontam para esse diário.

## A resposta curta

Planejei o projeto **junto com a IA**: PRD, UX, arquitetura e a SPEC dividida em fatias saíram de conversas em que eu decidia e ela organizava e escrevia. Depois, a IA me ajudou a implementar backend, frontend, migrações e testes, uma fatia por vez, além de apoiar a revisão de código e a documentação.

**As decisões foram minhas:** a stack, as regras de negócio, o recorte de escopo, o que entra e o que fica de fora, o visual e cada ajuste depois de ver a tela rodando, quando publicar, e o que aceito ou descarto de cada revisão.


## As ferramentas

| Ferramenta | Para quê |
|---|---|
| **Claude** (conversa) | O PRD e a pesquisa de APIs externas (Tabela FIPE, Wikipedia). O texto saiu de uma conversa, com minha revisão e meus ajustes. |
| **Claude Design** | Uma boa base visual: 29 arquivos, 9 telas, com variações claro, noite e celular (item 2). |
| **Claude Code** com o **BMad Method** (v6.12.4) | Todo o resto: UX, arquitetura, SPEC, implementação, revisão de código, conferência no navegador e documentação. |

O BMad é um conjunto de skills que organiza o trabalho em etapas, cada uma com um documento de saída. A pasta `_bmad/` e as skills instaladas **não** estão no repositório: são ferramenta, reproduzível com `npx bmad-method install`. O que está versionado é o que produzi com elas, em [`_bmad-output/`](_bmad-output/).

### As skills que usei, na ordem

| # | Skill | O que produziu | Onde está |
|---|---|---|---|
| 1 | `bmad-help` | O mapa do fluxo (PRD → UX → arquitetura → SPEC → build) | item 1 do diário |
| 2 | *(sem skill)* PRD | Feito em conversa com o Claude. Havia duas versões (um PDF antigo de marketplace e o `.md` da casa de leilões); reconciliei e fiquei com o `.md` como fonte única | [`PRD — Plataforma de Leilão de Carros (Teste Técnico).md`](<_bmad-output/planning-artifacts/PRD — Plataforma de Leilão de Carros (Teste Técnico).md>) |
| 3 | `bmad-ux` | `DESIGN.md` (como o produto parece) e `EXPERIENCE.md` (como se comporta), com 40 perguntas abertas que triei uma a uma | [`DESIGN.md`](_bmad-output/planning-artifacts/DESIGN.md), [`EXPERIENCE.md`](_bmad-output/planning-artifacts/EXPERIENCE.md) |
| 4 | `bmad-architecture` | A espinha de arquitetura: 13 decisões vinculantes (AD-1 a AD-13), contratos REST e Socket.IO e o formato da cadeia de auditoria HMAC | [`ARCHITECTURE-SPINE.md`](_bmad-output/planning-artifacts/architecture/architecture-eliteDevLeilao-2026-10-22/ARCHITECTURE-SPINE.md) |
| 5 | `bmad-spec` | A **SPEC**: um `SPEC.md` curto com as decisões que valem para o projeto inteiro (T1–T13 e as invariantes INV-1 a INV-18), uma matriz com os **131 requisitos do PRD** (nenhum órfão) e **10 fatias de build** (S00 a S09) | [`specs/spec-lanceauto/`](_bmad-output/specs/spec-lanceauto/) |
| 6 | `bmad-build` | A implementação, uma fatia por vez, cada uma em contexto novo, com um spec de build commitado **antes** do código | [`implementation-artifacts/`](_bmad-output/implementation-artifacts/) |
| 7 | `bmad-code-review` | Revisão em camadas paralelas depois das fatias S03 e S04 (itens 56 e 64) | "Review Triage Log" dos specs de build |
| 8 | `bmad-agent-ux-designer` (Sally) | A proposta de compactação da interface (escala, cabeçalho, tema, perfil, saldo ocultável) | [`proposta-ux-compactacao.md`](_bmad-output/proposta-ux-compactacao.md) |

**O que pulei, de propósito:** épicos, histórias e sprint planning. Com sete dias, a **fatia da SPEC** virou a unidade de trabalho (item 9), e cada fatia é autossuficiente. Isso tirou uma camada inteira de documentos.

## Onde a IA entrou

### 1 · Planejamento (22/10)

Do PRD saíram, no mesmo dia, o UX, a arquitetura e a SPEC com as 10 fatias. Onde o UX divergia do PRD, **o PRD venceu** (pseudônimo por lote, cancelamento com estorno, auditoria com HMAC-SHA256). A regra de precedência ficou escrita no [`AGENTS.md`](AGENTS.md): decisões minhas > PRD > arquitetura > EXPERIENCE > DESIGN.

Aceitei UX e arquitetura como rascunho, **sem o gate de revisão**, por agilidade (itens 7 e 8). A SPEC, ao contrário, **foi revisada**: cinco revisores independentes leram as dez fatias contra o PRD e a arquitetura e acharam cerca de 80 pontos. Entre os mais graves, uma consulta SQL da S07 que falharia no Postgres, o token do comprovante exposto na auditoria pública, um seed que violava a regra de datas e uma proteção contra SSRF incompleta no download de imagem. Tudo foi corrigido nas fatias **antes** de existir uma linha de código (item 10).

### 2 · Escrever o código (23/10 em diante)

Uma fatia por vez, da S00 à S09:

| Fatia | Conteúdo |
|---|---|
| S00 | Fundação: monorepo, API, web, Prisma, Docker, CI, deploy mínimo |
| S01 | Contas, acesso e carteira |
| S02 | Catálogo (FIPE + Wikipedia), lotes e vitrine |
| S03 | Lances e Sala |
| S04 | Tempo real (Socket.IO) |
| S05 | Fechamento, liquidação e comprovante |
| S06 | Cancelamento com estorno |
| S07 | Meus arremates |
| S08 | Auditoria pública (cadeia HMAC) |
| S09 | Polimento, responsivo, seed final, README |

A IA lia a SPEC, o arquivo da fatia e o código existente, e implementava backend, frontend, migrações e testes. As regras de como fazer isso estão no [`AGENTS.md`](AGENTS.md) do repositório, que todo agente lê antes de começar (veja "Como conduzi a ferramenta").

Depois das fatias vieram extras que não estavam na SPEC, **cada um por pedido meu**: compactação da interface, repaginação visual em 16 etapas (azul `#0033A0`, tipografia Manrope), carrossel de destaques, galeria de imagens do lote, rodada de responsividade mobile, rodapé em todas as páginas e a documentação Swagger/OpenAPI da API (`/docs`).

### 3 · Revisão de código

Usei revisão em camadas, com revisores em paralelo (leitura cega, casos de borda, lacunas de verificação, auditoria de aceitação) lendo o diff das fatias S03 e S04. Cada achado foi **conferido no código antes de virar correção**. Na S03 foram 24 achados: 5 corrigidos, 6 adiados (registrados em [`deferred-work.md`](_bmad-output/implementation-artifacts/deferred-work.md)) e 13 descartados (item 56). Houve também revisões gerais mais enxutas, em uma passada só e sem revisores em paralelo (itens 45 e 57), e no Swagger usei três revisores independentes.

### 4 · Testes e conferência

- **Testes automatizados** em cada fatia (Vitest, com Postgres real nos testes da API), mais a CI do GitHub. No fim da rodada mobile (28/10): shared 157, API 530, web 808.
- **Mutação:** para provar que os testes não passam à toa, tirei linhas de código de propósito e vi o teste falhar. Na S07, 10 de 10 mutações no web foram mortas (item 84).
- **Chrome real:** roteiros com o Chrome instalado (Playwright), banco descartável, API e web locais, vários clientes, queda de rede e axe-core. Depois de cada deploy, smoke no link público.
- **Conferência feita por mim, sem script:** leitor de tela e dois aparelhos reais na Sala, no Comprovante e na Carteira (S03 a S05, item 74), e a conferência visual de cada tela que mudou.

### 5 · Documentação

O diário, o README, o Swagger e este arquivo foram redigidos com a IA **a partir do que eu decidi e dos specs**, que registraram cada decisão enquanto o motivo estava fresco. O diário é o que sustenta tudo: registra o que foi feito, com a saída real dos comandos, e também o que **não** foi confirmado (por exemplo, o item 27: "Deploy da S01: NÃO confirmado").

## O que foi decisão minha

- **A stack e a forma do produto:** Next.js + Express + Socket.IO + PostgreSQL/Prisma em monorepo (item 4), e a regra de que o servidor é a verdade de tempo, saldo e valor, sem atualização otimista.
- **As regras de negócio** (tabela do diário): prorrogação = horário do lance + 2 minutos; posição pelo maior lance de cada licitante; cancelamento com lances **faz estorno**; **sem edição** de lote agendado; depósito máximo de R$ 10 milhões; imagem da Wikipedia, editável.
- **O recorte de escopo:** o que entra, o que fica de fora e o que fica adiado, com motivo, no `deferred-work.md`.
- **A hospedagem:** troquei Render + Vercel + Neon por Railway (API, web e Postgres no mesmo projeto), porque o plano gratuito do Render hiberna e leva cerca de 50 s para acordar, o que atrapalha o Socket.IO e quem abre o link frio (item 22).
- **O visual, tela por tela** (veja "O design"). Depois de ver cada tela rodando, pedi os ajustes: o cartão Encerrado da vitrine passou a abrir a Sala e não a auditoria direta (item 89); o rodapé passou a existir em **todas** as páginas, inclusive na Sala, mesmo com a SPEC dizendo o contrário; a Sala ganhou nova ordem de foto, ficha e histórico; o extrato ganhou filtro por data; e várias rodadas de ajuste de tamanho, cor e mobile. Quando decidi algo que contradizia a SPEC, a decisão valeu e o diário registra a mudança.
- **Quando publicar.** Push e deploy das repaginações só aconteceram depois de eu aprovar; o diário marca cada um como "aprovado pelo Felipe".
- **O que aceito de cada revisão:** os três destinos (corrigir, adiar, descartar) eram meus.

## Como conduzi a ferramenta

Quatro regras moldaram o resultado. As três primeiras estão escritas no [`AGENTS.md`](AGENTS.md):

1. **Construir pela SPEC.** Por tarefa, a IA lê só a SPEC, o arquivo da fatia atual e o código existente. PRD, UX e arquitetura servem de rastreio, não de fonte. Isso evita que cada sessão reinterprete o projeto.
2. **Dúvida não se inventa.** Se a fatia não resolve uma questão, ela vai para "Perguntas abertas" com a sugestão marcada, e o trabalho segue. Quem decide sou eu.
3. **Feito é o "Definition of Done" da fatia:** migração aplicada, testes verdes, checklist manual feito, deploy atualizado e smoke no link público. Em vários pontos do diário deixei **explicitamente em aberto** o que a IA não podia provar sozinha (leitor de tela, aparelho real), em vez de marcar como feito.
4. **Spec antes do código.** O spec de build é commitado e enviado **antes** de qualquer implementação, e a linha de base do build passa a ser esse commit (S03, S05 e S09). A S05 foi feita em duas fases por pedido meu: servidor primeiro, depois a web.

Os commits seguem uma regra minha: atômicos, em português, enxutos, uma mudança lógica cada. Os commits foram feitos pelo agente a pedido meu, sob essas regras, e saem na minha conta (Castelhano30). Os quatro primeiros trazem o trailer de co-autoria da ferramenta; depois defini que só a minha conta aparece e que o uso de IA fica documentado aqui, em vez de espalhado nas mensagens de commit.

## O design

O Claude Design me deu uma boa base. A partir dela, alterei o que achei justo e válido, conforme o meu gosto: a cor (troquei o amarelo pelo azul `#0033A0`), a Sala, o rodapé, o cabeçalho no celular e vários outros detalhes, sempre depois de ver a tela rodando.

## O que isso me rendeu

Rendeu velocidade de execução: sem IA eu não entregaria este escopo em sete dias, com 10 fatias, tempo real, uma cadeia de auditoria criptográfica, a documentação e o deploy.
