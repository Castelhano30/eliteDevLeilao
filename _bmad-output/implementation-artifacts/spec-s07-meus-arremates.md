---
title: 'S07 — Meus arremates'
type: 'feature'
created: '2026-10-27'
status: 'in-progress'
baseline_commit: '0356ac462c51487f97c55fe546986914cc9307cf'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-lanceauto/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-lanceauto/slice-07-meus-arremates.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O licitante não tem onde ver os lotes em que deu lance. Só a Sala de cada lote diz se ele está ganhando, e a Carteira lista o que está travado sem ligar o valor ao lote. Não há tela com Ganhando, Superado, Arrematado, Perdido e Cancelado, nem rota que entregue esse estado pronto.

**Approach:** Implementar a S07 como está na fatia (§1–§17): `GET /me/bids` com `MyBidItem` e `bidderLotState` em `packages/shared`, índice `Bid(bidderId)` por migração, tela `/arremates` com abas, ingressos (`BidTicket`), "Apurando" derivado no cliente, atualização por `showcase:lot`/`wallet:updated`/reconexão, "Meus arremates" no cabeçalho e links na Carteira. Deploy no Railway.

## Boundaries & Constraints

**Always:** a fatia vence a arquitetura e o EXPERIENCE; T1–T13 valem sobre a fatia. O `state` vem pronto do servidor (INV-1); a única derivação no cliente é o **rótulo** "Apurando", com `lotStatus(lot, serverClock.now())`. Sem atualização otimista: a lista só muda com a resposta do `GET`. Dinheiro em centavos (`…Cents`), UI em reais inteiros (INV-2). `Date`/`Date.now()` proibidos em `apps/api/src` fora de `infra/clock.ts`; `now = clock.now()`. Ids TEXT (`::text[]`, nunca `::uuid`). `CANCELLED` nunca é `LOST`; `cancelledAt` vence tudo em `bidderLotState`. DTO sem `userId`, nome, e-mail nem `leaderId`; `receiptToken` só em `WON` e só do `Receipt` cujo `winnerId` é o usuário (T9); `winnerPseudonym` só em `WON`/`LOST`. A posição vem de `rankFrom` (S03), com o maior lance de cada licitante. Erro no envelope pt-BR (INV-16). Contratos em `packages/shared`; `web` não importa `api` (INV-17). Onde a fatia diz Neon/Render/Vercel, ler Railway. Reaproveitar `FilterTabs`, `Stamp`, `Button`, `FeedbackState`, `LotTag`, `CarPhoto`, `ChipLicitante`, `PlacarPosicao`, `BotaoCopiarLink` (já compartilhado: não há o que extrair), `getSocket`/`showcase:join`, `apiClient`. Teste antes do código nas partes puras; prova de mutação nos pontos críticos. Commits atômicos em português, sem `Co-Authored-By` nem marca de IA (o AGENTS.md vence a instrução automática); push ao fim de cada fase; diário `progresso.md` do item 80 em diante. A outra sessão (code review da S06) é só leitura: nada da S06 muda fora do que a S07 exige; bug da S06 vai para o `deferred-work.md`.

**Never:** a linha CANCEL na Auditoria e os links "Auditoria do lote" / "Auditar este lote" (S08); botão "Conferir na auditoria" (oculto até a S08, sem botão vazio nem link quebrado); paginação (R-7.11); evento novo no Socket.IO; mudar `Bid` ou o banco além do índice; `git checkout` em arquivo com edição não commitada (copiar antes); `Date.now()` no web fora de `lib/server-clock.ts` e dos formatadores; tocar nos lotes 001 e nos de dados do Felipe em produção.

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Saída esperada | Erro |
|---|---|---|---|
| Sem lances | licitante sem `Bid kind=BID` | `200 {items: [], serverTime}`; consulta 2 e `findMany` puladas | N/A |
| Lidero ao vivo | só eu dei lance | `LEADING`, `myRank 1`, `bidderCount 1` | N/A |
| Superado | A e B, B líder | A: `OUTBID`, `myRank 2`, `bidderCount 2`, `myBestBidCents` = maior de A | N/A |
| Posição | A 30.000, B 28.000, C 25.000; B deu 25.000 e depois 28.000 | B: `myRank 2`, `bidderCount 3` (conta o maior de B) | N/A |
| Apurando | `endsAt` passado, `settledAt` nulo | `state` continua `LEADING`/`OUTBID`, `lot.status "CLOSING"`; a tela mostra "APURANDO", sem "Cobrir lance" | N/A |
| Arrematado | liquidado, eu líder | `WON`, `receiptToken` do meu `Receipt`, `winnerPseudonym` = o meu, `myRank null` | N/A |
| Perdido | liquidado, outro venceu | `LOST`, `receiptToken null`, `winnerPseudonym` do vencedor naquele lote | N/A |
| Cancelado liderando | cancelado, eu era o líder | `CANCELLED`, `refundedCents = currentBidCents` | N/A |
| Cancelado superado | cancelado, eu fora da frente | `CANCELLED`, `refundedCents null` (nunca `LOST`) | N/A |
| Lote alheio | outro venceu lote sem lance meu | fora da minha lista; o token dele nunca aparece | N/A |
| Papel / token | leiloeiro; sem token | nada devolvido | `ROLE_NOT_ALLOWED` 403 / `UNAUTHENTICATED` 401 |
| Privacidade | qualquer resposta | nenhuma chave `userId`, `name`, `email`, `leaderId`, `bidderId` (varredura recursiva) | N/A |
| Evento fora da lista | `showcase:lot` de lote que não está na lista | ignorado, sem refetch | N/A |
| Evento velho | `card.version` < versão já vista | descartado | N/A |
| Relógio passa de `endsAt` | `LEADING`/`OUTBID` em tela | selo vira "APURANDO" sozinho, sem esperar evento | N/A |
| Âncora | `/arremates#lote-018` com aba filtrada | volta a "Todos", rola e foca o `<li>` | N/A |
| Cópia bloqueada | clipboard negado | mensagem de falha e campo `readonly` com o link | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/my-bids.ts` (novo) -- `BidderLotState`, `bidderLotState(l, me)` (datas `Date|string|null`), `MyBidItem`, `MyBidsResponse`, `MY_BIDS_TEXT` (§8, plural e anúncios), `transitionAnnouncement`; `index.ts` exporta. `LotCard`, `lotStatus`, `receiptPath`, `COPIED_LABEL_MS`, `copyLinkAriaLabel` já existem.
- `apps/api/prisma/schema.prisma` + `migrations/…_add_bid_bidder_index` -- `@@index([bidderId])` em `Bid`; SQL `CREATE INDEX "Bid_bidderId_idx" ON "Bid"("bidderId")`.
- `apps/api/src/domain/my-bids.ts` (novo, puro) -- agrupa as linhas da consulta 2 por lote em `Map<bidderId, best>` e chama `rankFrom` (`domain/rank.ts`, não reimplementar); `compareMyBids` (R-7.9).
- `apps/api/src/services/my-bids.service.ts` (novo) -- consulta 1 (`$queryRaw`, `MAX(amountCents)` e `MAX(pseudonym)` por lote), consulta 2 (`= ANY($::text[])`), `lot.findMany({include item,receipt})` via `LOT_SELECT`/`toLotCard`/`toNumber` de `lot-mappers.ts`; devolve `{items, serverTime}` ordenado. Lista vazia na consulta 1 pula o resto.
- `apps/api/src/routes/my-bids.ts` (novo) + `app.ts` -- `GET /me/bids`: `requireAuth` → `requireRole("BIDDER", MY_BIDS_TEXT.roleNotAllowed)`. A rota do Painel é `/my/lots`; não confundir com `/me`.
- `apps/api/test/helpers/bids.ts`, `settlement.ts`, `lots.ts` -- reaproveitar (`makeUser`, `postBid`, `FORBIDDEN_KEYS`, `collectKeys`, `makeSettlement`, `insertLot`). `seed/showcase.ts` não muda: a distribuição real já bate com a §11 (Ana `OUTBID`/`WON`/`CANCELLED`, Bruno `LEADING`/`LOST`/`CANCELLED`).
- `apps/web/src/lib/` (novos, puros) -- `my-bid-view.ts` (estado + `nowMs` → selo, frase, valores, ações, nomes acessíveis, apurando), `my-bids-tabs.ts` (abas, contadores, vazio por aba), `my-bids-events.ts` (decisão de evento por lista/versão, debounce de 300 ms, anúncios de transição, âncora `#lote-NNN`); `lot-query.ts` ganha `MY_BIDS_KEY = ["me","bids"]`; `lib/realtime/use-my-bids.ts` (hook: `useQuery`, `useShowcaseLive(MY_BIDS_KEY)` para entrar na sala e refazer na conexão, mais ouvintes de `showcase:lot` filtrado e `wallet:updated`).
- `apps/web/src/components/` -- `my-bids/bid-ticket.tsx`, `status-seal.tsx`, `bid-ticket-list.tsx`; `ui/stamp.tsx` ganha `perdido` (`tinta2`, tracejado, −2°; `cancelado` e `arrematado` já existem); `lots/placar-posicao.tsx` ganha tom `neutro` e `sub` opcional; `site-header.tsx` (item "Meus arremates" para `BIDDER`); `wallet-screen.tsx` (itens de `leadingLots` viram link `/arremates#lote-NNN`); `app/(site)/arremates/page.tsx` com `RequireAuth role="BIDDER"` (leiloeiro cai no `?aviso=papel` da S01).
- Docs -- `slice-07` (§16 com Railway, decisões, perguntas; §17), `README.md` (Meus arremates e a definição de Perdido), `deferred-work.md`, `progresso.md` (80+).

## Tasks & Acceptance

O build corre em **duas fases**, cada uma com `lint`, `typecheck`, `test` e `build` na raiz (saída real no diário), commits atômicos e `git push` ao fim. Banco de testes próprio: `DATABASE_URL_TEST=…/lanceauto_test_s07`.

### Fase 1 — Servidor: shared, migração, `GET /me/bids`, seed

**Execution:**
- [x] Linha de base -- medida na raiz com a árvore limpa: shared 99, api 353, web 288 (o diário dizia 284; o commit do M1 da S06 acrescentou 4).
- [x] `packages/shared/src/my-bids.ts` -- teste antes: `bidderLotState` cobre `cancelledAt`×`settledAt`×`leaderId` (eu / outro / nulo) e `cancelledAt` vence; contrato e textos (AC-7.12).
- [x] Migração `add_bid_bidder_index` -- `@@index([bidderId])`, migração aplicada no banco de testes e conferida sem drift.
- [x] `domain/my-bids.ts` -- teste antes: posição e `bidderCount` com vários lances por licitante, 1 licitante, três licitantes; ordenação R-7.9.
- [x] `my-bids.service.ts` + rota + `app.ts` -- AC-7.1 a 7.11 e 7.13, mais a transição por serviço (A superado → `OUTBID`; liquida → `LOST`; cancela → `CANCELLED`) e o teste de seed (§11, cinco estados nas duas contas).
- [x] Prova de mutação no servidor -- `cancelledAt` não vencer, contar lances em vez de licitantes, soltar `receiptToken` fora de `WON`, esquecer a checagem de papel; cópia de segurança antes, nunca `git checkout`.
- [x] Fechamento da fase -- raiz com saída real; push; CI verde; Railway API `SUCCESS` com a migração aplicada no start; leitura pública de `/me/bids` com as contas do seed; diário (80+) e "Onde parei".

**Fora da Fase 1:** `apps/web` além do que o typecheck exigir pelo contrato novo.

### Fase 2 — Web: tela, tempo real, verificação e entrega

**Execution:**
- [ ] Retomada -- ler o diário e este spec; `lint`, `typecheck`, `test` como base da fase.
- [ ] Web puro, com teste antes -- `my-bid-view` (selo, frase, valores, ações, nome acessível único, "Apurando" sem "Cobrir lance"), `my-bids-tabs` (contadores batem com as listas; `CANCELLED` só em Todos), `my-bids-events` (evento fora da lista, versão velha, debounce, anúncios, âncora), `receiptUrl` já testado.
- [ ] Web telas -- `Stamp perdido`, `PlacarPosicao neutro`, `BidTicket`/`StatusSeal`/`BidTicketList`, `useMyBids`, rota `/arremates`, cabeçalho, links da Carteira; estados carregando, erro, erro com dados, vazio total, vazio por aba.
- [ ] Prova de mutação no web -- "Apurando" mostrar "Cobrir lance", contar `CANCELLED` em "Perdidos", aceitar evento fora da lista, aceitar versão velha, anúncio em carga inicial.
- [ ] Documentação -- §16 e §17 da fatia, README, `deferred-work.md`, diário.
- [ ] Verificação -- raiz; Chrome real (ACs [manual] 7.8, 7.14 a 7.22, claro/noite, 390 px, teclado, dois clientes, queda do socket); push, CI verde, Railway web e API `SUCCESS` no commit certo, smoke no link público (Ana e Bruno do seed).

**Acceptance Criteria:** AC-7.1 a 7.13 [auto] fecham na Fase 1; AC-7.8 (tela), 7.14 a 7.22 [manual] na Fase 2 (Chrome local e link público). Leitor de tela e aparelho real **não** serão conferidos por mim: ficam como pendência do Felipe, sem marcar feito.

## Decisões do build (a registrar na §16 da fatia)

1. **Railway** no lugar de Neon/Render/Vercel; a "migração aplicada no deploy" vale para o start da API (`migrate deploy`).
2. **`BotaoCopiarLink` já é componente compartilhado** (S05): nada a extrair.
3. **Ordem dos finalizados (R-7.9 e Q10):** `WON`, `LOST` e `CANCELLED` juntos por `endsAt` decrescente, desempate pelo número do lote decrescente; ativos antes, `OUTBID` antes de `LEADING`, por `endsAt` crescente. O servidor ordena; o cliente não reordena.
4. **Pseudônimo próprio** sai de `MAX(Bid.pseudonym)` da consulta 1 (constante por usuário e lote), sem a chave HMAC no service. O chip mostra "Neste lote você é Licitante XXXX." sem a marca "VOCÊ" em ocre: AC-7.21 pede só "Cobrir lance" em ocre e vence o §9.
5. **"Ver comprovante" abre em outra guia** (`target=_blank`, `rel=noopener noreferrer`, "(abre em outra guia)" só para leitor de tela), igual ao link da Sala (item 73 do diário).
6. **Sem polling** enquanto há ingresso "apurando": a §7 manda evento, `wallet:updated` e reconexão; o fechamento publica `showcase:lot`. Se faltar na prática, entra no `deferred-work.md`.
7. **Anúncios de transição** só os quatro da §8 e só entre duas respostas do servidor (nunca na carga inicial); voltar a `LEADING` não anuncia (a fatia não manda).
8. **Evento:** versão menor que a já vista é descartada; versão igual só refaz se o status mudou (o fechamento não incrementa `entryCount`, C10).
9. **Ocre** só no "Cobrir lance" (vários `OUTBID` podem ter vários, interpretação por cartão da §16.3 da fatia).

## Implementation Notes

### Fase 1 (servidor, 27/10/2026)

Implementada direto, sem subagente (o prompt da sessão trazia banco, portas e regras de commit que o spec não repete). Linha de base confirmada na raiz com a árvore limpa: shared 99, api 353, web 288. Depois: shared **121** (+22), api **386** (+33: 10 do domínio, 22 de `GET /me/bids`, 1 do seed), web 288 (nenhum arquivo de `apps/web` mudou; o typecheck não exigiu).

Desvios e decisões menores, nenhum mexe no bloco congelado:
- **Leituras num só snapshot.** As três consultas (lotes do usuário, melhor lance de cada licitante, `findMany` do lote) rodam numa transação `RepeatableRead`, para a posição nunca misturar dois instantes. O spec não pedia; custa só o `BEGIN`/`COMMIT`.
- **Consulta 2** também filtra `bidderId IS NOT NULL` (a linha CANCEL não tem autor; o `kind='BID'` já a exclui, é só defesa).
- **`Cache-Control: no-store`** na rota: a resposta leva o token do comprovante do dono.
- **`MY_BIDS_TEXT` tem funções** (frases e selos com valor, posição e plural) além das constantes; os textos de copiar link (`Link copiado`, falha) não foram duplicados: a Fase 2 usa `RECEIPT_TEXT.copied`/`copyFailed` e `COPIED_LABEL_MS`.
- **Desempate da ordem (R-7.9):** pelo número do lote (crescente nos ativos, decrescente nos finalizados), para a ordem ser estável.
- **Migração escrita à mão** (`20261027120000_add_bid_bidder_index`, um `CREATE INDEX`); `prisma migrate diff` do banco contra o schema: sem diferença.
- **Teste de seed** em arquivo próprio (`seed/my-bids.seed.test.ts`), para não mexer no `showcase.test.ts`.
- **Sem ocorrência de bug da S06** nesta fase; nada novo no `deferred-work.md`.
- **Deslize meu:** rodei o teste do domínio uma vez sem exportar `DATABASE_URL_TEST`; o `globalSetup` leu o `.env` e aplicou a migração do índice em `lanceauto_test`, banco que a sessão em paralelo usa. Só `CREATE INDEX`, nenhum dado tocado; registrado no diário.

Prova de mutação (cópia no scratchpad, restauração por cópia, sem `git checkout`): M1 `cancelledAt` não vence, M2 `bidderCount` = `bidCount`, M3 `receiptToken` fora de `WON`, M4 sem `requireRole`, M5 estorno a quem não liderava, M6 `myRank` fora de `LEADING`/`OUTBID`: **mortos**. M7 (tirar `receipt.winnerId === userId`) **sobreviveu** na 1ª rodada: a checagem é redundante no fluxo normal (`WON` já implica ser o vencedor). Acrescentei o teste de dado inconsistente (Receipt de outro) e M7 morreu. Não coberto por teste: o `RepeatableRead` em si (exigiria uma escrita concorrente entre as leituras).

## Spec Change Log

## Review Triage Log

## Verification

Cada fase fecha com os quatro comandos abaixo na raiz e a saída real no diário.

**Commands:**
- `npm run lint` -- expected: exit 0
- `npm run typecheck` -- expected: exit 0
- `npm test` -- expected: exit 0 (linha de base shared 99, api 353, web 288; só sobem)
- `npm run build` -- expected: exit 0 (shared → api → web; rota `/arremates`)

**Manual checks:**
- Chrome real (playwright-core do cache do npx, banco descartável próprio, API compilada e `next start` em portas livres, `localhost`, texto sem `<script>`/`<style>`): AC-7.8 (tela), 7.14 a 7.22; Ana e Bruno do seed em dois navegadores; abas e contadores de 2 dígitos; "Cobrir lance" some em "Apurando"; cópia do link e falha da área de transferência; âncora vinda da Carteira; queda do socket; claro e noite; 390 px sem rolagem lateral.
- Produção: CI verde, Railway web e API `SUCCESS` no commit certo, `migrate deploy` aplicado, smoke de leitura com Ana e Bruno (estados do seed). Escrita só com lote novo, se for preciso para provar o tempo real, e registrada no diário.
