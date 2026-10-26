---
title: 'S06 — Cancelamento de lote e estorno ao líder'
type: 'feature'
created: '2026-10-26'
status: 'done'
baseline_commit: '705d184'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-lanceauto/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-lanceauto/slice-06-cancelamento-estorno.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O leiloeiro não tem como tirar um lote do ar. Lote agendado errado fica em Agendados até abrir sozinho; lote ao vivo com lance trava o saldo do líder até o fim. O Painel não oferece ação alguma, a Sala não conhece o estado "Cancelado" e a cadeia de auditoria não tem a linha que registra a decisão.

**Approach:** Implementar a S06 inteira como está na fatia (§1–§17): `POST /lots/:id/cancel` com `confirmEntryCount`, service `cancelLot` numa transação (lote `FOR UPDATE` → dono → cancelado → encerrado → contagem → carteira do líder → `REFUND` → linha `Bid kind=CANCEL` → `UPDATE Lot`), eventos `lot:cancelled`/`showcase:lot`/`wallet:updated` depois do commit, `refundedCents` em `GET /my/lots`, e no web o botão "Cancelar" no Painel, o `CancelDialog`, a seção "Cancelados", a Sala cancelada e a Vitrine/Painel reagindo sem recarregar. Mais o seed do "cancelado de demonstração" pelos services com `FakeClock` e os itens do `deferred-work.md` que couberem. Deploy no Railway.

## Boundaries & Constraints

**Always:** a fatia vence a arquitetura e o EXPERIENCE; T1–T13 valem sobre a fatia. Servidor é a verdade de tempo, saldo e valor (sem atualização otimista: a linha só muda de seção quando o servidor confirma). `Date`/`Date.now()` proibidos em `apps/api/src` fora de `infra/clock.ts`; `now = clock.now()` lido **uma vez, depois do lock do lote**. Ordem de locks: lote (`FOR UPDATE`) → carteira do líder (lê `total`/`committed` da linha devolvida por esse lock). `Bid` append-only: a linha CANCEL é INSERT. Hash com a chave como primeiro argumento (`entryHash`, `sealHash`); campos nulos viram `""`. `version` = `entryCount`. Ids TEXT (nunca `::uuid`). Mutação só por REST via service; eventos devolvidos pelo service e publicados pela rota depois do commit. DTOs públicos sem `userId`, nome ou e-mail, e a resposta do cancelamento não identifica o líder; token do comprovante nunca em DTO público. Erros no envelope pt-BR. Contratos em `packages/shared`; `web` não importa `api`. Onde a fatia diz Neon/Render/Vercel, ler Railway. Os textos canônicos de `REFUND`/`RELEASE` **não mudam**. `LOT_CANCELLED` na recusa de lance usa o texto do PRD ("Este lote foi cancelado pelo leiloeiro."). Sem migração: se algo exigir uma, parar e justificar antes. Commits atômicos em português, sem `Co-Authored-By` nem marca de IA (o AGENTS.md vence a instrução automática); push ao fim de cada etapa; diário `progresso.md` do item 75 em diante.

**Never:** a página de Auditoria e qualquer link para ela (S08), "Meus arremates" e o estado Cancelado deles (S07), editar ou reabrir lote, mexer nos textos de `REFUND`/`RELEASE`, `git checkout` em arquivo com edição não commitada (copiar antes), `Date.now()` no web fora de `lib/server-clock.ts` e dos formatadores. Encerrar ou cancelar o lote 001 do Felipe em produção: o smoke usa lote novo.

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Saída esperada | Erro |
|---|---|---|---|
| Sem lances | agendado ou ao vivo, `entryCount = 0`, `confirm = 0` | `200 CANCELLED`; linha CANCEL `seq=1`, `prevHash` = genesis; sem `REFUND`; eventos `lot:cancelled` + `showcase:lot` | N/A |
| Com lances | 2 lances, B líder com R$ 20.500,00, `confirm = 2` | B: `committed` −2.050.000, `total` igual; `REFUND` com `lotId`; CANCEL `seq=3`; `bidCount` 2; eventos nesta ordem, `wallet:updated` só a B | N/A |
| Contagem velha | `entryCount = 3`, `confirm = 2` | nada muda; `details.entryCount = 3`; com `confirm = 3` cancela e estorna o NOVO líder | `LOT_CHANGED` 409 |
| Já cancelado | segundo `POST` | sem 2º `REFUND`, sem 2ª linha | `LOT_CANCELLED` 409 |
| Fronteira | `now == endsAt`, `now > endsAt`, `settledAt` | nada muda | `LOT_ENDED` 409 |
| Fronteira | `endsAt − now = 1 s` | cancela | N/A |
| Papel / dono | licitante; leiloeiro de outro lote; sem token | nada muda | `ROLE_NOT_ALLOWED` 403 / `FORBIDDEN` 403 / `UNAUTHENTICATED` 401 |
| Corpo / id | sem `confirmEntryCount`, `-1`, `1.5`; id inexistente | nada muda | `VALIDATION` 400 (`fields.confirmEntryCount`) / `NOT_FOUND` 404 |
| Corrida | `Promise.all([cancel, bid])` ×20 | (a) lance antes: `LOT_CHANGED`; (b) cancel antes: lance `LOT_CANCELLED`, sem `HOLD`; nunca saldo comprometido de lote cancelado | sem deadlock |
| Corrida | 5 × cancelar o mesmo lote | 1 sucesso, 4 `LOT_CANCELLED`, 1 `REFUND`, 1 linha CANCEL | N/A |
| Job | lote cancelado com `endsAt` vencido | job não liquida (sem `SALE_*`, sem `Receipt`) | N/A |
| Carteira inconsistente | `committed < currentBidCents` | rollback total, nada muda | `INTERNAL` 500 |
| Sala | `lot:cancelled` chega com formulário digitado | `'refetch'`, valor descartado, faixa neutra "Lote cancelado", sem formulário, "Cancelado em dd/mm às HH:mm:ss" | URL direta nunca 404 |

</frozen-after-approval>

## Code Map

- `packages/shared/src/` -- `lots.ts` (`MyLotCard.refundedCents: number | null`; `cancelledAt` já vem do `LotCard`), novo `cancel.ts` (`cancelLotSchema` zod, `CANCEL_TEXT` com todas as mensagens da §8, títulos com plural), `index.ts`. `LotState.lot.cancelledAt`, `LedgerEntryDto.lotNumber` e `BID_TEXT.lotCancelled` **já existem** (conferido): nada a acrescentar.
- `apps/api/src/services/lot.service.ts` -- `cancelLot(userId, lotId, confirmEntryCount)` (ou `cancel.service.ts` se crescer): tx `ReadCommitted` com `TX_OPTIONS`, `SELECT … FOR UPDATE` do lote, `wallet.update` com `updatedAt: now`, `LedgerEntry REFUND`, `bid.create` CANCEL, `lot.update`, eventos. Reusa `LOT_SELECT`, `toLotCard`, `toWalletDto`, `lotRoom`/`SHOWCASE_ROOM`/`userRoom`. `myLots` passa a preencher `refundedCents`.
- `apps/api/src/services/lot-mappers.ts` -- `toMyLotCard` com `refundedCents` (cancelado e `bidCount > 0` → `currentBidCents`; senão `null`).
- `apps/api/src/routes/lots.ts` -- `POST /lots/:id/cancel`: `requireAuth` → `requireRole(AUCTIONEER, texto da §8)` → `parseBody(cancelLotSchema)` → service → `publisher.publish(events)` → `200 LotState`. `apps/api/src/app.ts` só repassa o service.
- `apps/api/src/domain/audit-chain.ts` -- já aceita `kind: 'CANCEL'` e campos nulos; só ganha o teste da string canônica exata.
- `apps/api/src/seed/showcase.ts`, `prisma/seed.ts` -- `seedCancelledLot` pelos services com `FakeClock` (§11) e idempotente por título; `seedLiveBids` passa a pular lote cancelado/encerrado (com log).
- `apps/api/test/helpers/bids.ts` -- `assertLotInvariants` entende `REFUND` e lote cancelado (líder gravado mas sem comprometido).
- `apps/web/src/lib/` -- puros: `cancel-dialog.ts` (estado idle/submitting/changed/error, plural, contagem por evento), `cancel-errors.ts` (código → mensagem da §8), decisão da seção "Cancelados"; `realtime/lot-reducer.ts` (`lot:cancelled` → `'refetch'`, já existe; conferir descarte do valor digitado), `realtime/showcase-cache.ts` (CANCELLED sai da lista, já existe).
- `apps/web/src/components/` -- `cancel-dialog.tsx` (sobre `ui/dialog.tsx`), `painel-screen.tsx` (coluna de ação, seção "Cancelados", placares e Total recebido sem cancelados, live region, foco), `sala.tsx` + `lots/bid-panel.tsx` (estado Cancelado com `ui/stamp.tsx`), `lots/lot-card.tsx` e `vitrine.tsx` (remover texto antigo, se houver), `wallet-screen.tsx` (só conferir `REFUND`).
- Docs -- `slice-06` (§16 com Railway, texto de `LOT_CANCELLED`, perguntas respondidas; §17), `slice-03` (tabela de mensagens e AC-3.4 alinhados ao texto do PRD), `deferred-work.md`, `README.md` (regra do cancelamento), `progresso.md` (75+).

## Tasks & Acceptance

O build corre em **duas fases**, cada uma em sessão de contexto própria se o contexto apertar. Fase 1: servidor, shared, seed e deploy. Fase 2: web, Chrome real e fechamento. Entre as duas o estado fica no diário ("Onde parei") e neste spec. Um commit atômico por bloco; `git push` ao fim de cada etapa; teste antes do código nas partes de regra.

### Fase 1 — Servidor: cancelamento, estorno, eventos, seed (shared + `apps/api`)

**Execution:**
- [x] Linha de base -- `npm run lint`, `typecheck`, `test`, `build` com saída real (medido: shared 84, api 314, web 249; a fatia esperava 312 e 242, e os commits de correção da S05 depois do item 71 explicam a diferença).
- [x] `packages/shared` -- `cancelLotSchema`, `CANCEL_TEXT`, `refundedCents`; testes.
- [x] Hash/seal da linha CANCEL -- string canônica exata (`v1|entry|{lotId}|{seq}|CANCEL|||{at}|{prevHash}`) e `sealHash` com o `entryCount` novo; mudar `seq`/`at`/`prevHash` muda o hash.
- [x] `cancelLot` + rota + eventos -- AC-6.1, 6.2, 6.6 a 6.12, 6.14 (um erro por caso, com prova de que nada muda), cadeia recalculada de ponta a ponta com a linha CANCEL.
- [x] Leituras -- `GET /lots` sem cancelado, `GET /lots/:id` 200 cancelado com `bids[]` só `BID`, `GET /my/lots` com `cancelledAt`/`refundedCents`, `GET /wallet.leadingLots` sem cancelado; AC-6.3, 6.4, 6.5, 6.13, 6.23; privacidade (resposta e `lot:cancelled` sem `userId`, nome, e-mail).
- [x] Concorrência com **prova de mutação** -- `Promise.all([cancel, bid])` ×20 em ordens aleatórias (AC-6.19, §13), 5 × cancelar, cancelar × job; sem deadlock. Mutantes: tirar a checagem de `confirmEntryCount` (`LOT_CHANGED`), tirar o `FOR UPDATE` do lote, ler `committed` fora do lock; cópia de segurança antes, nunca `git checkout` em edição não commitada.
- [x] Seed -- lote "cancelado de demonstração" pelos services com `FakeClock` (§11), invariante de saldo verdadeira, idempotente; `seedLiveBids` checa `cancelledAt`/`endsAt`; teste do seed.
- [x] Fechamento da fase -- `lint`, `typecheck`, `test`, `build` na raiz com saída real no diário; push; CI verde; deploy da API no Railway `SUCCESS` (o web antigo segue funcionando: mudança aditiva); log do seed; diário (75+) e "Onde parei" com o que a Fase 2 precisa saber.

**Fora da Fase 1:** qualquer arquivo de `apps/web` (exceto o que o typecheck exigir pelo contrato novo), README, `resolved:` do `deferred-work.md`, smoke em produção.

### Fase 2 — Web: Painel, diálogo, Sala cancelada, verificação e entrega (`apps/web`)

**Execution:**
- [x] Retomada -- ler o diário, este spec e a §16 da fatia; `lint`, `typecheck`, `test` como linha de base da fase.
- [x] Web puro, com teste antes -- estado do diálogo, plural, mapeamento de erro → mensagem, seção "Cancelados", refetch do Painel por `showcase:lot` próprio; mutação nos testes novos.
- [x] Web telas -- Painel (botão, seção, placares, live region, foco), `CancelDialog`, Sala cancelada (carimbo, aviso, reduced-motion), Vitrine; "se sobrar tempo" por último: aviso "Chegou lance novo: agora são {N}.".
- [x] Documentação -- §16 e §17 da fatia, `slice-03`, `resolved:`/`alvo:` no `deferred-work.md`, README, diário.
- [x] Verificação -- `lint`, `typecheck`, `test`, `build` na raiz; Chrome real (ACs [manual] 6.15 a 6.18, 6.20 a 6.22, 6.24, claro e noite, 390 px, dois clientes, corrida do diálogo); push, CI verde, Railway web e API `SUCCESS` no commit certo, smoke público com lote novo.

**Acceptance Criteria:** AC-6.1 a 6.14, 6.19 e 6.23 [auto] fecham na Fase 1; AC-6.15 a 6.18, 6.20 a 6.22 e 6.24 [manual] na Fase 2 (Chrome local e link público). Leitor de tela e aparelho real **não** serão conferidos por mim: ficam como pendência do Felipe, sem marcar feito. §17 adaptada ao Railway.

## Decisões do build (a registrar na §16 da fatia)

1. **Railway no lugar de Neon/Render/Vercel:** "migração aplicada no deploy" vale para o start da API; esta fatia não tem migração.
2. **`DomainEvent` é `{ type, room, payload }`**; `lot:cancelled` leva `{ lotId, version, serverTime }` (o `Publisher` carimba o `serverTime`).
3. **Texto de `LOT_CANCELLED` na recusa de lance:** o código (`BID_TEXT.lotCancelled`, `DEFAULT_MESSAGES`) e a S03 (tabela de mensagens, AC-3.4 e §16) já usam o texto do PRD; conferir por busca nos documentos e registrar na §16 da S06 que o alinhamento da §16 item 7 já estava feito. Só mexer se a busca achar texto antigo.
4. **`refundedCents`** sai de `bidCount > 0 → currentBidCents` (todo lote com lance tem líder), sem coluna nova.
5. **`LedgerEntryDto.lotNumber`, `LotState.lot.cancelledAt` e `LotCard.cancelledAt`** já existem desde a S02/S03: nada a acrescentar nesses contratos.
6. **Pergunta 1 da §16 (linha CANCEL em lote sem lances):** sugestão adotada, sim, sempre.

## Implementation Notes

**Fase 1 (servidor), 26/10/2026.** Implementada direto, sem subagente. Commits `ff654ae` a `8c77353`; saída real, prova de mutação e roteiro na API real no diário, itens 75 e 76. Desvios do Code Map, a registrar na §16: o service é `services/cancel.service.ts` (`lot.service.ts` já é grande), e `summarizeBids` saiu do `getLotState` para `lot-mappers.ts` para a resposta do cancelamento usar a mesma conta. A camada de revisão (step-04) **não rodou**: ela exige revisores em paralelo; fica para o `bmad-code-review` se o Felipe pedir.

**Fase 2 (web), 26/10/2026.** Implementada direto, sem subagente. Commits `528e613` a `9ed7e10` e o de documentação final; saída real, prova de mutação (web 6 de 6), Chrome real (64/64) e smoke público (19/19, lote 013) no diário, itens 78 e 79. O aviso opcional "Chegou lance novo" entrou. Efeito em produção: lotes 010 (seed), 011 e 012 (cancelados sem lances por defeito do meu script de smoke) e 013 (cancelado com 2 lances). A revisão em paralelo (step-04) segue **não rodada**.

## Spec Change Log

## Review Triage Log

## Verification

Cada fase fecha com os quatro comandos abaixo na raiz e a saída real no diário.

**Commands:**
- `npm run lint` -- expected: exit 0
- `npm run typecheck` -- expected: exit 0
- `npm test` -- expected: exit 0 (linha de base shared 84, api 314, web 249; só sobem)
- `npm run build` -- expected: exit 0 (shared → api → web)

**Manual checks:**
- Chrome real (playwright-core do cache do npx, banco descartável, API compilada na 4100, `next start` na 3100, `localhost`, `textContent` sem `<script>`/`<style>`): AC-6.15 a 6.18, 6.20 a 6.22, 6.24; diálogo com a corrida (lance entra no meio → `LOT_CHANGED`, contagem atualiza e pede de novo); temas claro e noite; 390 px.
- Produção: CI verde, Railway web e API `SUCCESS` no commit certo, smoke com **lote novo** (contas do seed): cancelar lote com lances e ver Sala, Vitrine e Carteira atualizarem. Não cancelar o lote 001.
