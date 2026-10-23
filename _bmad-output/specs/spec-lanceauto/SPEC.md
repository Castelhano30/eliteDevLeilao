---
id: SPEC-lanceauto
companions:
  - rastreabilidade.md
  - slice-00-fundacao.md
  - slice-01-contas-acesso-carteira.md
  - slice-02-catalogo-lotes-vitrine.md
  - slice-03-lances-sala.md
  - slice-04-tempo-real.md
  - slice-05-fechamento-comprovante.md
  - slice-06-cancelamento-estorno.md
  - slice-07-meus-arremates.md
  - slice-08-auditoria.md
  - slice-09-polimento-entrega.md
sources:
  - ../../planning-artifacts/PRD — Plataforma de Leilão de Carros (Teste Técnico).md
  - ../../planning-artifacts/EXPERIENCE.md
  - ../../planning-artifacts/DESIGN.md
  - ../../planning-artifacts/architecture/architecture-eliteDevLeilao-2026-10-22/ARCHITECTURE-SPINE.md
  - ../../progresso.md
---

> **Contrato canônico.** Esta SPEC e os arquivos de `companions:` são o contrato completo para construir, testar e validar o LanceAuto. As fontes em `sources:` servem só para rastreio; não precisam ser abertas. Quando uma fatia contradiz a arquitetura ou o EXPERIENCE, vale a fatia (os conflitos já foram resolvidos, ver "Conflitos resolvidos").

# LanceAuto — Casa de Leilões de Carros

## Como construir (uma fatia por contexto)

1. Abra **este arquivo** + **o arquivo da fatia** + o código que já existe. Mais nada.
2. Siga a ordem S00 → S09. Cada fatia lista `depende_de`, termina deployável e demonstrável, e declara em "Retrofits" o que muda em código anterior.
3. Dúvida que a fatia não resolve: não invente. Registre na seção "Perguntas abertas" da fatia e siga com a sugestão marcada.
4. Feito = "Definition of Done" da fatia cumprida, migração aplicada no deploy, smoke no link público.

## Decisões transversais da revisão (valem sobre qualquer fatia)

Saíram de uma revisão independente das dez fatias. Quando uma fatia disser outra coisa, vale esta lista.

| # | Decisão |
|---|---|
| T1 | **Rate limit.** `app.set('trust proxy', 1)` em produção. `makeRateLimiter({windowMs, max, keyGenerator?, skip?})`; o handler lança `AppError(RATE_LIMITED)` (envelope, nunca texto puro). Envs `AUTH_RATE_LIMIT_MAX` (padrão 30) e `RATE_LIMIT_DISABLED=1`, ambos no `.env.example`; testes usam o desligador e só o AC de limite o reativa. `RATE_LIMITED` já nasce em `ErrorCode` na S00. Auditoria: 60/min por IP, decidido. |
| T2 | **Testes de integração.** Vitest da API com `fileParallelism: false`; setup global roda `prisma migrate deploy` em `DATABASE_URL_TEST` (CI idem). O helper de adulteração faz `DISABLE TRIGGER`, `UPDATE` e `ENABLE TRIGGER` numa só transação. |
| T3 | **Monorepo e deploy.** `packages/shared` compila para `dist` (`exports` apontando para ele); build na ordem shared → api → web. Render: build e start explícitos, com `prisma generate` e `migrate deploy`. Vercel: Root Directory `apps/web`, install na raiz. Compose: `NEXT_PUBLIC_API_URL` como build-arg (aponta para `localhost`), `healthcheck` no banco e `depends_on: service_healthy`. `DIRECT_URL` sempre definido; no Neon, `DATABASE_URL` pooled com `?pgbouncer=true`. |
| T4 | **`version` = `entryCount`.** `LotState`, `LotSummary`, `LotCard` e todos os eventos expõem `version`; um só reducer (`applyLotEvent`, S04) substitui o `applyBid` da S03. `showcase:lot` leva `version` e o upsert descarta versão menor. |
| T5 | **Assinaturas da cadeia, chave sempre primeiro:** `genesisHash(key, lot)`, `entryHash(key, {lotId, seq, kind, pseudonym, amountCents, at, prevHash})`, `sealHash(key, lotId, entryCount, lastHash)`. O genesis usa `startsAt.toISOString()` do `Date` já parseado. |
| T6 | **Relógio.** Services gravam `createdAt`/`at` com `clock.now()` explícito. A proibição de `Date.now()`/`new Date()` vale só em `apps/api/src` (exceto `infra/clock.ts` e testes); no web, só em `lib/server-clock.ts` e nos formatadores; `shared` não usa. |
| T7 | **Cache do TanStack.** `["me"]` (usuário + carteira), `["wallet","summary"]` (lido pelo chip de saldo), `["wallet","ledger"]` (infinito). Depósito e `wallet:updated` escrevem em `summary` e invalidam `ledger`. |
| T8 | **Textos canônicos** em constantes de `packages/shared`: RELEASE "Saldo liberado · lance superado", REFUND "Estorno · lote cancelado", nota "TOTAL NÃO MUDA". `LOT_CANCELLED` usa o texto do PRD ("Este lote foi cancelado pelo leiloeiro."); o texto longo fica só no aviso da Sala. |
| T9 | **Token do comprovante** só vai ao vencedor. A auditoria pública mostra `receiptCode`, nunca o token. |
| T10 | **Líder que reenvia.** `BELOW_MINIMUM` com `leaderId == userId` leva `reason = 'OWN_LEAD'` e mensagem própria ("Você já está na frente. Para cobrir o próprio lance, o mínimo é R$ X,00."), no lugar do texto enganoso "Alguém levantou a mão". O código continua `BELOW_MINIMUM` e a ordem de validação do PRD não muda. |
| T11 | **Seed.** `createLot` aceita `{allowPast: true}` só para o seed; as regras `início >= agora − 60 s` e duração mínima de 5 min vivem no zod de `POST /lots`. O seed da S02 é provisório; a S09 reescreve o final (001 arrematado … 005 ao vivo), com `pg_advisory_lock`. |
| T12 | **Prioridade se o prazo apertar.** Nunca cortar: S00 a S05 e S08, deploy no ar desde o dia 1. Cortar primeiro, nesta ordem: itens marcados "se sobrar tempo" nas fatias (picote, códigos de barras, variações decorativas, flips, `visibilitychange`), depois o polimento visual da S09, depois S07. |
| T13 | **Verificar no dia 1** (premissas não checadas): formato real das respostas da FIPE v2 e da Wikipedia (incluindo a grafia "VolksWagen"), versões de Next/Prisma/libs, `suppressHydrationWarning` do tema, `migrate deploy` sem migrações, release command do Render. |

## Why

**Mandato com prazo:** o teste técnico Elite Dev da Verzel (7 dias corridos, deploy obrigatório) pede uma casa de leilões online de carros. Leiloeiros montam lotes a partir de carros de uma API pública; licitantes com saldo simulado disputam cada lote com lances ao vivo; o vencedor recebe um comprovante compartilhável; qualquer pessoa, sem login, audita o histórico e vê se foi adulterado. A avaliação pesa: regras de lance e saldo corretas (inclusive simultâneas), sala ao vivo sem recarregar, resiliência à queda da API externa, histórico à prova de adulteração com a técnica explicada, deploy com dados prontos e README detalhado.

## Escopo

**Dentro:** cadastro/login com dois papéis; busca FIPE e criação de lote com imagem Wikipedia; vitrine com busca e filtro; sala ao vivo; carteira simulada; lances com prorrogação e recusas; fechamento com liquidação e comprovante; Meus arremates; painel do leiloeiro com cancelamento (com estorno) e total recebido; auditoria pública HMAC-SHA256; privacidade por pseudônimo; resiliência; seed, deploy, README, Docker Compose, testes e dark mode.

**Fora:** nota fiscal, revenda entre usuários, aplicativo nativo, recuperação de senha, pagamento real, preço de reserva, lance automático, chat, notificação por e-mail, edição de lote agendado, paginação da vitrine, filtro de preço, mais de uma instância da API, assinatura Ed25519 (só citada no README).

## Capabilities

- **CAP-1**
  - **intent:** Visitante cria conta ou entra escolhendo o papel de licitante ou leiloeiro, e o back-end faz valer o papel.
  - **success:** Rota de licitante recusa leiloeiro e vice-versa; senha curta e e-mail repetido voltam com erro por campo; token expirado volta ao login. (S01)
- **CAP-2**
  - **intent:** Licitante deposita saldo simulado (até R$ 10.000.000,00 por depósito) e vê total, comprometido, disponível e extrato.
  - **success:** Depósito soma ao total; o extrato mostra a linha; depósito de R$ 10.000.000,01 é recusado. (S01; comprometer/liberar em S03)
- **CAP-3**
  - **intent:** Leiloeiro cria lote escolhendo marca, modelo e ano da FIPE, confere ou troca a imagem sugerida e agenda início, fim, lance inicial e incremento; o servidor guarda um snapshot completo.
  - **success:** Com a FIPE fora do ar, o formulário mostra o erro e preserva os campos; lote criado exibe foto (ou ilustração padrão) sem nenhuma chamada externa. (S02)
- **CAP-4**
  - **intent:** Qualquer pessoa vê a vitrine com lotes ao vivo, agendados e encerrados, com busca e filtro; cancelados nunca aparecem.
  - **success:** Busca "gol" encontra "Volkswagen Gol"; busca "kombi" sem resultado mostra o vazio de filtro; lote cancelado não aparece. (S02, S04 ao vivo)
- **CAP-5**
  - **intent:** Licitante dá lance sob todas as regras (período, mínimo, liderança, papel, saldo) dentro de uma única transação, com recusas que dizem o motivo e o valor exato.
  - **success:** Dois lances simultâneos resultam em um único líder, saldos e ledger consistentes; cada código de recusa volta com o texto previsto. (S03)
- **CAP-6**
  - **intent:** A sala do lote mostra lance atual, histórico, posição, "você está ganhando/superado" e contagem regressiva do servidor, atualizados sem recarregar, inclusive prorrogação e reconexão.
  - **success:** Lance dado em um navegador aparece em outro sem recarregar; lance nos últimos 2 min leva o fim a lance + 2 min para todos; queda e volta do socket recupera o estado sem duplicar linhas. (S03 estrutura, S04 tempo real)
- **CAP-7**
  - **intent:** Ao chegar o fim, o lote fecha uma única vez: com lances, debita o vencedor, credita o leiloeiro e gera o comprovante por token; sem lances, fecha sem vencedor.
  - **success:** N execuções simultâneas da rotina geram 1 comprovante e 1 débito; o link do comprovante abre sem login e sem nome ou e-mail. (S05)
- **CAP-8**
  - **intent:** Leiloeiro cancela o próprio lote agendado ou ao vivo, com ou sem lances; o líder é estornado e o cancelamento entra no histórico.
  - **success:** Após cancelar lote com lance de R$ 165.000,00, o comprometido do líder cai a zero, o lote some da vitrine e a auditoria mostra a linha de cancelamento. (S06)
- **CAP-9**
  - **intent:** Leiloeiro vê seus lotes por status, o resultado de cada encerrado e o total recebido, e cancela pelo painel.
  - **success:** Total recebido = soma das vendas liquidadas dele; lote cancelado fica em seção própria. (S02 base, S05, S06)
- **CAP-10**
  - **intent:** Licitante acompanha os lotes em que deu lance como ganhando, superado, arrematado, perdido ou cancelado, com comprovante e link para copiar.
  - **success:** Cada lote cai no estado certo e o botão leva ao lote ou comprovante daquele lote. (S07)
- **CAP-11**
  - **intent:** Qualquer pessoa audita o histórico de um lote e recebe o veredito íntegro ou adulterado, apontando o primeiro registro problemático.
  - **success:** Alterar, remover do meio, inserir ou apagar os últimos lances direto no banco faz a auditoria acusar. (S08)
- **CAP-12**
  - **intent:** Nenhuma tela ou resposta pública revela nome, e-mail ou id de usuário; o pseudônimo muda de lote para lote.
  - **success:** O mesmo licitante aparece com pseudônimos diferentes em dois lotes; DTOs públicos não têm userId/nome/e-mail. (S03, S05, S08)
- **CAP-13**
  - **intent:** FIPE e Wikipedia só são chamadas pelo back, com cache, timeout e uso de cache vencido; vitrine, salas, auditoria e comprovante dependem só do banco.
  - **success:** Com as duas APIs derrubadas, essas quatro telas funcionam e só o Criar lote mostra o aviso. (S02; verificado na S09)
- **CAP-14**
  - **intent:** O avaliador roda o projeto pelo README e pelo link público, com dados de teste prontos, Docker Compose, testes e dois temas.
  - **success:** Um desconhecido segue só o README e chega ao fluxo completo; o link público mostra os 5 estados de lote e 3 usuários. (S00, S09)

## Constraints (invariantes de negócio e técnicos)

| ID | Invariante |
|---|---|
| INV-1 | O servidor é a fonte de verdade de tempo, saldo e valores. Sem atualização otimista; relógio da tela = `Date.now() + offset` (offset de cada resposta/evento). |
| INV-2 | Dinheiro em centavos inteiros (`BigInt` no banco, `number` nas bordas, campos `…Cents`). UI só em reais inteiros `R$ 31.000,00`. `MAX_DEPOSIT_CENTS = 1_000_000_000` por depósito. |
| INV-3 | Datas ISO UTC `Z` (ms). `new Date()`/`Date.now()` proibidos em `apps/api/src` fora de `infra/clock.ts` (escopo exato em T6). UI em America/Sao_Paulo. |
| INV-4 | Toda mutação por REST via service; Socket.IO só transmite; eventos saem **depois** do commit. |
| INV-5 | Lock: lote (`FOR UPDATE`) → carteiras por `userId` ascendente; ReadCommitted; depósito trava só a própria carteira. |
| INV-6 | Carteira é cache; `LedgerEntry` append-only na mesma transação; `committed >= 0` e `total >= committed`; disponível = total − comprometido, calculado. |
| INV-7 | `Bid` só recebe inserção (trigger rejeita UPDATE/DELETE). |
| INV-8 | Ordem de validação do lance: LOT_CANCELLED → LOT_NOT_STARTED → LOT_ENDED → BELOW_MINIMUM → ALREADY_WINNING → ROLE_NOT_ALLOWED → INSUFFICIENT_BALANCE. |
| INV-9 | Prorrogação: `endsAt − now <= 2 min` ⇒ `endsAt = now + 2 min`; sem teto; `originalEndsAt` imutável. |
| INV-10 | Fechamento por rotina (5 s + varredura no boot), `SKIP LOCKED`, relê sob lock, liquida uma vez; `GET` nunca liquida. |
| INV-11 | `lotStatus(lot, now)` é função pura em `packages/shared` (CANCELLED, SCHEDULED, LIVE, CLOSING, SOLD, UNSOLD). |
| INV-12 | Cadeia HMAC-SHA256 v1 (genesis, entry, seal; kinds BID e CANCEL) com chave só em env; formato exato nas S02, S03 e S08. |
| INV-13 | Pseudônimo `Licitante XXXX` = HMAC(usuário, lote); DTO público sem userId/nome/e-mail; token do comprovante = 24 bytes aleatórios. |
| INV-14 | Telas públicas leem só o banco; só `/catalog/*` e `POST /lots` chamam FIPE/Wikipedia. |
| INV-15 | Um papel por conta; autorização no back-end. |
| INV-16 | Erro `{error:{code,message,details?}}` com mensagem em pt-BR; toda resposta de estado de lote traz `serverTime`. |
| INV-17 | Contratos em `packages/shared`; `web` nunca importa `apps/api`. |
| INV-18 | Voz do pátio: frases curtas, motivo e valor exato em todo erro, sem exclamação/emoji; dados verificáveis em IBM Plex Mono. |

Stack: Next.js (App Router) + React + TypeScript; Node + Express + Socket.IO; PostgreSQL + Prisma; zod, TanStack Query, Tailwind, Vitest; npm workspaces (`apps/web`, `apps/api`, `packages/shared`). Hosts alvo: Vercel (web), Render (API), Neon (banco); versões e hosts a confirmar no dia 1.

## Glossário

| Termo | Significado |
|---|---|
| Lote | Um carro em leilão, com lance inicial, incremento, início e fim; número sequencial exibido com 3 dígitos. |
| Item | Snapshot do carro (FIPE + imagem) gravado na criação do lote. |
| Lance atual | Maior lance aceito; sem lances, o mínimo aceito é o lance inicial. |
| Mínimo aceito | Sem lances: lance inicial. Com lances: lance atual + incremento do lote. |
| Líder | Autor do lance atual; tem o valor comprometido. |
| Superado | Deixou de ser líder; o comprometido volta ao disponível na mesma transação do lance que o superou. |
| Posição | Colocação do maior lance de cada licitante entre os licitantes distintos ("2º de 4"). |
| Saldo total / comprometido / disponível | Total − comprometido = disponível. Comprometido = lances que lideram. |
| Prorrogação | Lance nos últimos 2 min leva o fim a horário do lance + 2 min. |
| Apurando (CLOSING) | Entre o fim do lote e a liquidação; lances bloqueados, resultado pendente. |
| Liquidação | Débito do vencedor, crédito do leiloeiro, emissão do comprovante; uma vez por lote. |
| Estorno | Liberação do comprometido do líder quando o lote é cancelado. |
| Comprovante | Recibo público do arremate, aberto por token aleatório (`/c/{token}`). |
| Pseudônimo | "Licitante 7F3A": 4 hex de HMAC(usuário, lote); muda por lote. |
| Cadeia / selo | Hashes encadeados dos lances + HMAC da contagem e do último hash do lote. |
| Veredito | OK (íntegro), BROKEN_AT {seq}, SEAL_MISMATCH, RECEIPT_MISMATCH (adulterado). |
| Pátio | Nome de marca da vitrine/painel; voz do produto. |

## Mapa das fatias

Ordem pensada para ter algo demonstrável cedo. Ajustes em relação à ordem sugerida: o **comprovante** nasce com o fechamento (S05), porque o `Receipt` e o botão "Ver comprovante" da Sala encerrada dependem dele; **Meus arremates** vem depois do cancelamento (S07), porque precisa do estado Cancelado; a regra de **prorrogação** vive na transação do lance (S03) e a **visibilidade para todos** é do tempo real (S04).

| Fatia | Entrega demonstrável | Depende de | Dia |
|---|---|---|---|
| [S00 Fundação](slice-00-fundacao.md) | Monorepo, tokens/tema em código, 15 primitivos, CI, Compose, deploy mínimo no ar (web chama /health, socket conecta) | — | 1 |
| [S01 Contas, acesso e carteira](slice-01-contas-acesso-carteira.md) | Cadastro/login por papel, cabeçalho por papel, depósito, extrato | S00 | 1–2 |
| [S02 Catálogo, lotes e vitrine](slice-02-catalogo-lotes-vitrine.md) | FIPE+Wikipedia com cache, criar lote, Vitrine, Painel base, Sala somente leitura | S01 | 2 |
| [S03 Lances e Sala](slice-03-lances-sala.md) | Transação de lance completa, recusas, Sala com painel de lance, seed com lances | S02 | 3 |
| [S04 Tempo real](slice-04-tempo-real.md) | Dois navegadores sincronizados, prorrogação visível, reconexão, vitrine/carteira vivas | S03 | 4 |
| [S05 Fechamento e comprovante](slice-05-fechamento-comprovante.md) | Rotina de fechamento, liquidação, comprovante público, Sala encerrada, total recebido | S04 | 5 |
| [S06 Cancelamento e estorno](slice-06-cancelamento-estorno.md) | Cancelar com diálogo, estorno ao líder, linha CANCEL, Sala cancelada | S05 | 5–6 |
| [S07 Meus arremates](slice-07-meus-arremates.md) | Tela de arremates com estados, comprovante e links | S06 | 6 |
| [S08 Auditoria](slice-08-auditoria.md) | Veredito HMAC, tela pública, teste de adulteração, texto do README | S07 | 6 |
| [S09 Polimento e entrega](slice-09-polimento-entrega.md) | Acessibilidade, responsivo, temas, seed final, README, deploy final, checklist AC1–AC15 | S08 | 7 |

## Rastreabilidade

Cada requisito do PRD (131 IDs: regras R1–R15, escopo E1–E13, opcionais, telas, mensagens, API externa, auditoria, privacidade, seed, README, entrega, critérios de aceite AC1–AC15, pontos técnicos e piso de UX) aponta para a fatia que o **termina** em [rastreabilidade.md](rastreabilidade.md). Resumo por fatia:

| Fatia | Termina |
|---|---|
| S00 | MONO, DKR, DEP, UX-THEME, O3, O5, H4 |
| S01 | E1, E5, R7, R9, PERM-V/B/A, T2, T4, AUTH, DM-User/Wallet/Ledger, S1 |
| S02 | E2, E3, E12, O1, T1, T8, X1–X7, DM-Item, DM-Lot, STAT, S3, S8 |
| S03 | R1–R6, R8, E6, M1–M8, TX, DM-Bid, H1–H3, P2, P3, AC1–AC5, S2 |
| S04 | RT, R10, E4, CLK, AC6, AC7 |
| S05 | R11–R13, E7, SET, DM-Receipt, T6, P4, AC8, AC9, S4, S5 |
| S06 | R14, R15, O2, E9, T3, T7, AC10, S6 |
| S07 | E8, T5 |
| S08 | E10, E11, T9, H5, A1–A5, P1, L1, AC11, AC12 |
| S09 | E13, D1–D10, AC13–AC15, TST, O4, S7, S9, UX-A11Y/RESP/RECON/VOICE |

## Conflitos resolvidos (precedência: decisões do usuário > PRD > arquitetura > EXPERIENCE > DESIGN)

| # | Conflito | Resolução |
|---|---|---|
| C1 | Ordem de validação do lance: PRD (valor antes de liderança, papel depois) × arquitetura (papel antes; liderança antes de valor) | PRD vence: INV-8. Efeito: líder que dá lance abaixo do mínimo recebe BELOW_MINIMUM; a UI previne o reenvio com botão inerte. Ver pergunta Q1. |
| C2 | Cancelamento com corrida (P36): arquitetura exige `confirmEntryCount`/`LOT_CHANGED`; triagem sugeria cancelar o estado atual | Arquitetura vence; o diálogo único atualiza a contagem e pede nova confirmação. |
| C3 | DESIGN "nunca foto" × PRD imagem real | PRD vence: foto do snapshot (`contain`, crédito em legenda), ilustração SVG como fallback. |
| C4 | PRD "oito telas" lista nove | São nove; Acesso é uma tela com duas abas. |
| C5 | Status: arquitetura tem CLOSING/SOLD/UNSOLD; PRD tem 5 estados | Vocabulário de UX do PRD; CLOSING é só "apurando". |
| C6 | Tema: select "Tema" (DESIGN) × chave manual (arquitetura) | Unificado: sistema por padrão, controle manual no cabeçalho, `data-theme` antes da pintura; tokens dos dois temas na S00. |
| C7 | DESIGN: pseudônimo no cabeçalho × decisão: pseudônimo por lote | Cabeçalho mostra só "VOCÊ · papel"; pseudônimo só dentro do lote. |
| C8 | Cancelamento no histórico: PRD exige registro; triagem sugeria não cobrir na cadeia | Arquitetura vence: linha `CANCEL` na própria cadeia; a S06 grava a linha também em lote sem lances. |
| C9 | Ocre × ferrugem no botão de confirmar cancelamento (EXPERIENCE × DESIGN/P9) | Ocre no confirmar; ferrugem só no aviso. |
| C10 | `lot:closed` não incrementa `entryCount`, então a regra "ignorar version <= atual" o descartaria | `lot:closed` aplica com `>=` e é idempotente (S04). |
| C11 | Texto de `LOT_CANCELLED`: PRD "Este lote foi cancelado pelo leiloeiro." × EXPERIENCE (texto longo) | PRD vence na recusa; o texto longo fica no aviso da Sala (T8). |
| C12 | Token do comprovante: S08 o expunha na auditoria pública × S05 e PRD (só o vencedor) | S05 e PRD vencem (T9). |
| C13 | Textos do extrato (RELEASE/REFUND) diferentes entre S01, S03 e S06 | Constantes únicas em `packages/shared` (T8). |

Contratos aditivos às definições da arquitetura (campos novos em `LotCard`/`LotState`/`GET /me/bids`/`GET /wallet`, `lot:leave`, `RATE_LIMITED`, `hammerAt`, `myReceiptToken` etc.) estão nas fatias que os criam; valem sobre a arquitetura.

## Non-goals

- Recuperação de senha, pagamento real, preço de reserva, lance automático, chat, notificação por e-mail, aplicativo nativo, nota fiscal, revenda.
- Edição de lote agendado (só cancelar).
- Escala horizontal da API (Redis/adapter), paginação da vitrine, filtro de preço.
- Verificação da cadeia no navegador (Ed25519): só citada no README como evolução.

## Success signal

Um avaliador abre o link público, entra com os usuários de teste, dá lances em dois navegadores e vê o relógio e o histórico se atualizarem sem recarregar, vê um lance nos últimos 2 min estender o prazo, recebe o comprovante ao fim, abre a auditoria como visitante e vê "íntegro"; depois o teste automatizado adultera um lance direto no banco e a auditoria acusa o registro exato. Tudo isso com FIPE e Wikipedia fora do ar nas telas públicas.

## Assumptions

- Total recebido do leiloeiro = soma dos créditos de venda liquidados; cancelados não entram.
- Hosts Vercel + Render + Neon e versões de libs não foram verificados; confirmar no dia 1 (S00) e deixar o lockfile mandar. Formatos reais das respostas da FIPE v2 e da Wikipedia também (S02).
- API aceita centavos inteiros positivos; a UI só produz múltiplos de 100.
- Datas do Criar lote são digitadas em America/Sao_Paulo (UTC−3, sem horário de verão) e convertidas para UTC.
- Meus arremates: "Cancelado" aparece só na aba Todos; "Perdido" = deu lance e outro venceu.
- Sem Playwright: aceite de UI por checklist manual; Vitest para API, shared e lógica pura do web.

## Open Questions

Todas têm sugestão nas fatias e **não bloqueiam** o build; decidir antes ou durante a S0 indicada.

- **Q1 (S03)** Manter a ordem do PRD (BELOW_MINIMUM antes de ALREADY_WINNING) ou voltar à da arquitetura? Hoje vale o PRD, com a mensagem própria `OWN_LEAD` (T10) para o líder que reenvia.
- **Q2 (S02)** Duração mínima do lote de 5 min e `início >= agora − 60 s` vêm da arquitetura, não do PRD. Manter?
- **Q3 (S06)** Lote cancelado **sem** lances também grava a linha CANCEL na cadeia (sugestão: sim)?
- **Q4 (S01/S09)** Usuários de teste: `leiloeiro@lanceauto.test`, `ana@lanceauto.test`, `bruno@lanceauto.test`, senha `lance1234`, saldos R$ 500.000 (Ana) e R$ 300.000 (Bruno). Confirmar.
- **Q5 (S01/S03/S08)** Limites de requisição (auth 30/min por IP, lance 30/min por usuário, auditoria 60/min por IP) e o novo código `RATE_LIMITED` 429.
- **Q6 (várias)** Muitos textos novos estão marcados "texto a revisar" (diálogo de cancelamento, erros de cadastro, conexão, "Como funciona"). Revisar a voz antes do polimento?
- **Q7 (S02)** Fotos do seed: começar com ilustração padrão e trocar por imagens livres com crédito depois?
- **Q8 (S09)** Mostrar "Acordando o pátio…" quando o Render demora a acordar? `seed:demo --relampago` com lote de 10 min para demonstrar prorrogação e fechamento?
- **Q9 (S09)** O repositório precisa ficar público antes da entrega (hoje é privado).
- **Q10 (S07)** Ordenação de Meus arremates (sugestão: superados, depois ganhando por fim mais próximo, depois os demais por fim decrescente) ou simples cronológica? O desempate dos superados está no R-7.9 da S07.
- **Q11 (S08)** O cartão Encerrado da Vitrine leva direto à auditoria (como no protótipo) ou à Sala, como diz o PRD? A S08 segue o protótipo.

Numeração: Q1 a Q11 são deste arquivo; as fatias têm listas próprias (por exemplo, "pergunta 1 da §16 da S03"). Quando uma fatia citar um Q, leia o número deste arquivo.
