---
title: 'S03 — Lances e Sala (transação do lance, saldo comprometido, painel de lance)'
type: 'feature'
created: '2026-10-24'
status: 'in-progress'
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
- [ ] `packages/shared` -- `bids.ts` (schema, DTOs, textos), renomear `minimumNextCents` no `LotStateLot`, estender `LotState`/`LotSummary` -- contrato único para API e web; testes dos textos.
- [ ] `apps/api/src/domain` -- `bid-rules`, `entryHash`, `pseudonym`, `rank` com testes unitários (vetor fixo da §4.5 por `createHmac` independente, 4 limites da prorrogação, matriz C1).
- [ ] `apps/api/prisma` -- schema + migração `add_bid` (CHECKs, trigger, CHECKs de `Lot`); aplicar local e no banco de teste.
- [ ] `apps/api/src/services` + `routes` + `app.ts` -- `placeBid`, rate limit, `Publisher` injetável, `GET /lots/:id` estendido, `GET /wallet` com `leadingLots` e `lotNumber`.
- [ ] `apps/api/test` -- integração AC-3.1…3.46 e AC-3.65 (um `it` cada, `FakeClock`, varredura de chaves proibidas, rollback forçado, publisher falso), concorrência AC-3.38…3.43 com `assertLotInvariants`.
- [ ] `apps/web` -- utilitários puros + testes (`maskReais`/`parseReais`, `plural`, `ordinal`, `applyLotEvent`, faixa/placar, `dirty`, atalhos, `useOnReach` puro); componentes; Sala; chip; Carteira.
- [ ] `apps/api/prisma/seed.ts` + `src/seed` -- 5 lances idempotentes e teste do seed.
- [ ] `README.md`, `progresso.md`, fatia (§16 e §17) -- texto, diário (itens a partir do 46: o 45 já é a revisão geral), perguntas abertas.
- [ ] Deploy -- push, CI verde, migração no start da API no Railway, smoke HTTP público.

**Acceptance Criteria:** AC-3.1 a AC-3.46 e AC-3.65 [auto] da §12; AC-3.47 a AC-3.64 [manual] (o que não for possível conferir fica listado para o Felipe); §17 inteira.

## Implementation Notes

## Spec Change Log

## Review Triage Log

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
