---
title: 'S03 — Lances e Sala (transação do lance, saldo comprometido, painel de lance)'
type: 'feature'
created: '2026-10-24'
status: 'done'
baseline_commit: '9af63121c26cd340af70436a57209720d28da5da'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-lanceauto/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-lanceauto/slice-03-lances-sala.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O LanceAuto tem lotes e carteira, mas ninguém consegue dar lance: a Sala é só leitura, o saldo nunca é comprometido e não existe histórico nem cadeia de hashes.

**Approach:** Implementar a S03 inteira como está na fatia (contrato canônico, §1–§17), sem tempo real (S04): migração `add_bid`, domínio puro, `POST /lots/:id/bids` numa transação, retrofits de `GET /lots/:id` e `GET /wallet`, painel de lance na Sala, bloco "Travado onde você lidera" e linhas HOLD/RELEASE na Carteira, seed com 5 lances pelo `placeBid`, README e deploy no Railway.

## Boundaries & Constraints

**Always:** a fatia vence a arquitetura; T1–T13 do SPEC.md valem sobre a fatia. Dinheiro em centavos `BigInt`/`number`; `Date` só em `infra/clock.ts` na API; services gravam `createdAt`/`at` com `clock.now()`, lido **depois** do lock do lote. Ordem de lock: `Lot FOR UPDATE` → carteiras `ORDER BY userId FOR UPDATE`; saldos lidos da query que trava. Ordem de validação C1: período → valor → liderança → papel → saldo (`OWN_LEAD` em `details.reason`). `version` = `entryCount` (T4); funções da cadeia com a chave como 1º argumento (T5). Eventos (`bid:placed`, `showcase:lot`, `wallet:updated`) ficam num `DomainEvent[]` entregue ao `Publisher` só depois do commit, nunca em erro. DTOs públicos sem `userId`/`bidderId`/`leaderId`/nome/e-mail. Contratos em `packages/shared`; `web` não importa `apps/api`. Sem atualização otimista. Q1–Q6 da §16 seguem a sugestão marcada; dúvida nova vai para "Perguntas abertas" da fatia. Deploy no Railway (onde a fatia diz Neon/Render, ler Railway).

**Never:** Socket.IO de verdade (S04), fechamento/comprovante (S05), cancelamento/`REFUND`/`CANCEL` (S06), Meus arremates (S07), auditoria (S08); `Receipt`; editar ou apagar `Bid`; `::uuid` em SQL; criar contas de smoke em produção sem necessidade; `Co-Authored-By` ou marca de IA em commits.

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Saída esperada | Erro |
|---|---|---|---|
| Lance válido | ao vivo, `amount >= mínimo`, saldo ok | 201 `{bid, lot: LotSummary, wallet, serverTime}`; HOLD (e RELEASE do líder anterior) no ledger | — |
| Abaixo do mínimo | `amount < mínimo` | 422 `BELOW_MINIMUM {minimumCents, currentBidCents, reason}` | `OWN_LEAD` > `OUTDATED` > `MINIMUM` |
| Líder reenvia | `leaderId == userId`, `amount >= mínimo` | 409 `ALREADY_WINNING` (antes de saldo) | — |
| Leiloeiro | `AUCTIONEER`, lance que passaria | 403 `ROLE_NOT_ALLOWED`; encerrado/cancelado/baixo cai no código anterior | — |
| Sem saldo | `amount > disponível` (ou sem carteira → 0) | 422 `INSUFFICIENT_BALANCE {availableCents}` | nada criado |
| Prorrogação | `endsAt − now <= 2 min` | `endsAt = now + 2 min`, `extended` só se `newEndsAt > endsAt`; `originalEndsAt` fixo | — |
| Falha no INSERT do `Bid` | violação forçada | rollback total; nenhum evento | 500 `INTERNAL` |
| 10 lances iguais em paralelo | `Promise.all`, `expected = null` | 1 × 201, 9 × `BELOW_MINIMUM` | — |
| Lances cruzados A↔B | Ana cobre Bruno em L2 e Bruno cobre Ana em L1 | ambos 201, sem deadlock | — |
| `GET` durante lances | leitura concorrente | `currentBidCents` nunca sem o `bid` em `bids[]` | — |
| Seed em produção já populada | lote ao vivo 001 sem lances | 5 lances pelo `placeBid`, uma vez só | falha clara se recusado |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` + nova migração `add_bid` -- `ChainKind`, `Bid` (`@@unique([lotId,seq])`, `@@index([lotId,bidderId])`), `bids` em `Lot`/`User`, `@@index([leaderId])` em `Lot`; SQL à mão: `Bid_shape_chk`, trigger append-only e os CHECKs de `Lot` adiados (`bidCount>=0`, `entryCount>=0`, `currentBidCents IS NULL OR >= startingBidCents`).
- `apps/api/src/domain/audit-chain.ts` -- já tem `genesisHash`/`sealHash` (chave 1º); acrescentar `entryHash(key, {lotId,seq,kind,pseudonym,amountCents,at,prevHash})`. Novos: `domain/bid-rules.ts`, `domain/pseudonym.ts`, `domain/rank.ts` (puros, `now: Date`, sem Prisma).
- `apps/api/src/services/lot.service.ts` + `lot-mappers.ts` -- `getLotState(id, viewer?)` ganha lances, `bidderCount`, `myPseudonym/myRank/myBestBidCents`; `leaderId` nunca vai ao DTO. Ler o lote primeiro e os lances com `seq <= entryCount` (consistência AC-3.43).
- `apps/api/src/services/bid.service.ts` (novo) -- `placeBid(userId, role, lotId, input)` devolve `{response, events}`; `$transaction` com `maxWait/timeout` 10 s; trava via `$queryRaw`, escreve com `tx.wallet.update({updatedAt: now})`, `tx.ledgerEntry.create`, `tx.bid.create`, `tx.lot.update`.
- `apps/api/src/services/wallet.service.ts` + `mappers.ts` -- `leadingLots` real; `lotNumber` do extrato por um `lot.findMany({id in})` (adiado da revisão).
- `apps/api/src/routes/lots.ts` -- `POST /lots/:id/bids` (`requireAuth`, `makeRateLimiter` 30/min por usuário com `message`, `parseBody`); `GET /lots/:id` passa `req.user`; a rota entrega `events` ao `Publisher` após o service retornar. `app.ts` -- `AppDeps.publisher?` (padrão `NoopPublisher`).
- `apps/api/src/middleware/rate-limit.ts` -- opção `message` (padrão continua `RATE_LIMITED_MESSAGE`).
- `packages/shared/src/{lots,wallet,errors,texts}.ts` + novo `bids.ts` -- `placeBidSchema`, `BidDTO`, `LotSummary`, `PlaceBidResponse`, `BidPlacedPayload`, `BelowMinimumReason`, textos de recusa (funções de mensagem usadas por API e web), `LotStateLot` renomeia `minimumNextCents` → `minimumBidCents` e ganha `bidderCount`, `myPseudonym`, `myRank`, `myBestBidCents`; `LotState.bids: BidDTO[]`; `LotCard` já tem `version`.
- `apps/api/prisma/seed.ts` + `src/seed/showcase.ts` -- `seedLiveBids` idempotente: acha o lote ao vivo do plano (`Fiat Uno Mille Way 2010`) e, se `bidCount == 0`, dá 5 lances alternados pelo `placeBid` (Bruno, Ana, Bruno, Ana, Bruno).
- `apps/api/test/helpers/{app,lots}.ts` -- `makeTestApp` aceita `publisher`; helper `assertLotInvariants(lotId)` e criação de lote ao vivo para lances.
- `apps/web/src/components/sala.tsx` -- renderiza `BidPanel` na 2ª coluna; `Cronometro` já aceita `originalEndsAt`; `lib/use-server-clock.ts` (`useOnReach`: extrair a lógica para função pura e testar — adiado da S02).
- `apps/web/src/components/{bid-panel,bid-form,bid-history,placar-posicao,faixa-status,chip-licitante}.tsx` (novos) e `components/ui/{field,button,refusal-message}.tsx` (reusar). `lib/money-mask.ts` -- `maskReais` ganha limite de dígitos por parâmetro (13 no lance, 9 no depósito); `lib/lot-state.ts` (novo) -- `applyLotEvent`, derivação viewer × estado, `ordinal`, `plural`, regra `dirty`, atalhos.
- `apps/web/src/components/{balance-chip,wallet-screen}.tsx`, `lib/format.ts` -- `setQueryData` no chip; bloco "Travado onde você lidera", `Nada travado no momento.`, linhas HOLD/RELEASE com número do lote.
- `README.md`, `.env.example` -- seção de lances (prorrogação, ordem C1, pseudônimo e colisão de 4 hex, tempo real na S04).

## Tasks & Acceptance

**Execution (ordem; um commit atômico por bloco):**
- [x] `packages/shared` -- `bids.ts` (schema, DTOs, textos), renomear `minimumNextCents` no `LotStateLot`, estender `LotState`/`LotSummary` -- contrato único para API e web; testes dos textos.
- [x] `apps/api/src/domain` -- `bid-rules`, `entryHash`, `pseudonym`, `rank` com testes unitários (vetor fixo da §4.5 por `createHmac` independente, 4 limites da prorrogação, matriz C1).
- [x] `apps/api/prisma` -- schema + migração `add_bid` (CHECKs, trigger, CHECKs de `Lot`); aplicar local e no banco de teste.
- [x] `apps/api/src/services` + `routes` + `app.ts` -- `placeBid`, rate limit, `Publisher` injetável, `GET /lots/:id` estendido, `GET /wallet` com `leadingLots` e `lotNumber`.
- [x] `apps/api/test` -- integração AC-3.1…3.46 e AC-3.65 (um `it` cada, `FakeClock`, varredura de chaves proibidas, rollback forçado, publisher falso), concorrência AC-3.38…3.43 com `assertLotInvariants`.
- [x] `apps/web` -- utilitários puros + testes (`maskReais`/`parseReais`, `plural`, `ordinal`, `applyLotEvent`, faixa/placar, `dirty`, atalhos, `useOnReach` puro); componentes; Sala; chip; Carteira.
- [x] `apps/api/prisma/seed.ts` + `src/seed` -- 5 lances idempotentes e teste do seed.
- [x] `README.md`, `progresso.md`, fatia (§16 e §17) -- texto, diário (itens a partir do 46: o 45 já é a revisão geral), perguntas abertas.
- [x] Deploy -- push, CI verde, migração no start da API no Railway, smoke HTTP público.

**Acceptance Criteria:** AC-3.1 a AC-3.46 e AC-3.65 [auto] da §12; AC-3.47 a AC-3.64 [manual] (o que não for possível conferir fica listado para o Felipe); §17 inteira.

## Implementation Notes

Implementado direto, sem subagente de implementação. Decisões novas do build estão nas perguntas 7 a 10 da §16 da fatia. A camada de revisão (step-04) não rodou no build, porque exige revisores em paralelo e o pedido não os autorizava; o Felipe a pediu depois (`bmad-code-review`), e a triagem está no "Review Triage Log". Verificação e smoke no diário, itens 46 a 55.

## Spec Change Log

## Review Triage Log

Revisão de 24/10/2026, `9af6312..293a480`: quatro camadas em paralelo (cega, casos de borda, lacunas de verificação, auditor de aceitação), cada achado conferido no código antes do veredito. 24 achados: 5 corrigidos, 6 adiados, 13 descartados. Os ACs 3.62 e o roteiro com dois navegadores reais seguem com o Felipe.

| # | Achado | Veredito | Rota | Evidência |
|---|---|---|---|---|
| 1 | Sala agendada gasta as 10 conferências em ~10 s | medium | patch (`e6277ed`) | `openingChecks` era incrementado dentro do `refetchInterval`, que o TanStack reavalia a cada `setOptions` (cada render; a Sala re-renderiza por segundo). Agora `nextOpeningCheck` só conta resposta nova. |
| 2 | `myPseudonym` do GET nunca comparado ao gravado em `bids[]` | medium | patch (`79b75c2`) | bids.test.ts só tinha regex; trocar os argumentos de `pseudonymFor` no `getLotState` não derrubava nada (mutação feita: o teste novo falha). |
| 3 | CHECKs de `Bid` e `Lot` sem teste | medium | patch (`4a303d7`) | Nenhum teste citava `Bid_shape_chk`, `lot_bid_count_nonneg`, `lot_entry_count_nonneg` nem `lot_current_bid_min`. |
| 4 | Filtro e ordem do `leadingLots` sem teste | low | patch (`46f10f4`) | wallet.test.ts só afirmava `[]`; sem `cancelledAt: null` o teste novo falha (mutação feita). |
| 5 | DoD §17 e diário dizem "dois navegadores" e "42 verificações" sem a ressalva | low | patch | Item 54 foi HTTP; item 55 deixa o roteiro com o Felipe. Linha 487 e item 52 reescritos. |
| 6 | `publisher.publish` sem `try/catch` depois do commit | low (média na S04) | defer | Hoje o publisher é `NoopPublisher`; decidir junto do publisher do Socket.IO. |
| 7 | `applyLotEvent`: recalcula o mínimo, não vê salto de `version`, não atualiza `status` | low | defer | O mínimo recalculado sai igual ao do servidor; o gap só existe com eventos reais (S04). |
| 8 | `BidPanel`/`BidForm`/`Sala` com decisões inline sem teste | low | defer | Conferido no Chrome; extrair funções puras com o reducer da S04. |
| 9 | `GET /lots/:id` sem limite de histórico, rank em memória | low | defer | Pergunta 5 da fatia; escala atual não sente. |
| 10 | Testes de concorrência com `Math.random` sem semente | low | defer | Sem falha hoje; falha não reproduzível. |
| 11 | `seedLiveBids` documenta "ao vivo" mas só checa existência e `bidCount == 0` | low | defer | Em produção o lote 001 já tem lances; falha do seed não derruba o deploy; S09 recria os lotes. |
| 12 | `Button` do atalho dentro do `<form>` enviaria o lance | false | rejeitado | button.tsx:40 tem `type = "button"` por padrão. |
| 13 | Seed que falha aborta o deploy | false | rejeitado | railway.json: `(npx tsx …/seed.ts \|\| echo seed-falhou-subindo-sem-ele)`. |
| 14 | `ALREADY_WINNING` deveria refazer o GET | false | rejeitado | §9.3.8: "`ALREADY_WINNING` ⇒ nada"; bid-refusal.test.ts trava. |
| 15 | Formulário some em 00:00 antes do GET | low | rejeitado | Pergunta 10 da §16, decisão registrada; AC-3.59 satisfeito. |
| 16 | Rótulo do HOLD diferente da §9.4 | low | rejeitado | Pergunta 9 da §16, decisão registrada. |
| 17 | `entryHash` não cobre `bidderId` | low | rejeitado | Campos prescritos na §4.5 e no T5; corrigir seria editar o spec. |
| 18 | Colisão de 4 hex confunde "VOCÊ" e o rank no cliente | low | rejeitado | Colisão aceita na §4 e no README. |
| 19 | `Bid.bidderId` com `SET NULL` contra o trigger; `P2003` → 401 inalcançável | low | rejeitado | `Wallet_userId_fkey` é `RESTRICT` e todo usuário tem carteira: o usuário não é apagado. |
| 20 | 401 do POST sem o texto "Entre para dar lances." | low | rejeitado | `requireAuth` não aceita mensagem e a S01 limpa o token e redireciona; o texto não aparece. |
| 21 | Rate limit sem fallback por IP | low | rejeitado | `requireAuth` vem antes; `req.user` sempre existe. |
| 22 | `userRoom` de `../socket` e `parseBody` de `./auth` | low | rejeitado | Sem dano nomeado; a S04 reorganiza as salas. |
| 23 | Laço redundante no AC-3.39; `RATE_LIMITED` e 401 sem caso próprio no `describeBidFailure` | low | rejeitado | Cosmético; o `default` mostra a mensagem do servidor e o 401 é da S01. |
| 24 | A camada de revisão (step-04) não rodou | info | resolvido | Esta revisão. |

## Design Notes

- Bid hash e seal: `entryHash(KEY, {lotId, seq, kind:"BID", pseudonym, amountCents, at, prevHash})` com `at.toISOString()` do `Date` gravado; seal = `sealHash(KEY, lotId, seq, hash)`.
- Posição: `GROUP BY bidderId` com `MAX(amountCents)` sobre `kind='BID' AND seq <= entryCount`; `myRank = 1 + #outros com maior lance > o meu`.
- O seed roda o `placeBid` com o `SystemClock`, o lote fica 30 dias aberto e não cai na janela de 2 min. A guarda "lote ao vivo sem lances" é o que o torna idempotente em produção (o seed antigo só cria lotes com o banco vazio e o 001 já existe lá).
- `Wallet.updatedAt` sem default no banco: o `tx.wallet.update` do Prisma o preenche, com `updatedAt: now` explícito para o `FakeClock`; nenhum `UPDATE` cru de carteira.

## Verification

**Commands:**
- `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` -- exit 0, saída real no diário.
- CI do GitHub verde no push.
- Smoke HTTP na API pública: lance válido, recusa de mínimo, recusa de saldo, `ALREADY_WINNING`, `GET /lots/:id` com `bids` e `leadingLots`.

**Manual checks:**
- AC-3.47 a AC-3.64 no navegador (local e link público), claro e noite, desktop e 390 px.
