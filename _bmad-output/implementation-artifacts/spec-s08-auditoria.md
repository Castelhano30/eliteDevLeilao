---
title: 'S08 — Auditoria pública e verificação da cadeia HMAC'
type: 'feature'
created: '2026-10-27'
status: 'done'
baseline_commit: 'df2895b7b8112c57a7ae37fd6bbec3e4edfcb6fc'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-lanceauto/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-lanceauto/slice-08-auditoria.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A cadeia HMAC é gravada desde a S02 (genesis), S03 (lances) e S06 (linha CANCEL), mas ninguém a confere. Não há rota nem tela que diga se o histórico de um lote é íntegro ou adulterado, nem teste que prove que mexer direto no banco é detectado; os links "Auditar este lote", "Verificar na auditoria", "Auditoria do lote" e "Conferir na auditoria" ainda não existem.

**Approach:** Implementar a S08 como está na fatia (§1–§17): `verifyChain` puro em `domain/audit-chain.ts`, `GET /lots/:id/audit` público (leitura `RepeatableRead`, `no-store`, 60/min por IP), contratos e frases em `packages/shared`, tela `/lotes/[id]/auditoria` com veredito, tabela e "Como a gente confere", e os retrofits da §15. Deploy no Railway.

**Decisão do Felipe (§16 pergunta 5 / SPEC Q11):** **SIM**, o cartão Encerrado (SOLD/UNSOLD) da Vitrine vai direto para a auditoria; AC-8.34 e a linha `lotCardHref` da §15 valem. Ao vivo, agendado e apurando seguem para a Sala.

## Boundaries & Constraints

**Always:** a fatia vence a arquitetura e o EXPERIENCE; T1–T13 valem sobre a fatia. Chave sempre primeiro nas funções da cadeia (T5). Comparação de hash com `timingSafeEqual` sobre buffers de mesmo tamanho (tamanho diferente = diferente). Precedência `BROKEN_AT` → `SEAL_MISMATCH` → `RECEIPT_MISMATCH` → `OK`, com `consistencyIssue` (R-8.16) e `sealOk`/`receiptOk` calculados mesmo com `BROKEN_AT`. A verificação é refeita a cada chamada; nada é gravado. `verifiedAt` e `serverTime` vêm do `Clock`; `lot.status` de `lotStatus(lot, clock.now())`. O DTO devolve só hashes **gravados**: sem valor original, hash esperado/recalculado, chave, `userId`, `bidderId`, `leaderId`, nome, e-mail nem o token do `Receipt` (R-8.7, T9, INV-13); `receipt` traz só `finalHash` e `receiptCode`. Token inválido ou expirado = visitante (nunca 401). `domain/` sem Prisma, Express nem `Date.now`. Ids TEXT (nunca `::uuid`). Erros no envelope pt-BR (INV-16). Contratos em `packages/shared`; `web` não importa `api` (INV-17). Onde a fatia diz Neon/Render/Vercel, ler Railway. Layout real do repo: `routes/*.ts(+.test.ts)`, `services/*.ts`, `domain/*.ts`; não criar `modules/`. Teste antes do código nas partes puras; prova de mutação nos pontos críticos (cópia no scratchpad, restauração por cópia, nunca `git checkout`). Commits atômicos em português, sem `Co-Authored-By` nem marca de IA (o AGENTS.md vence a instrução automática); push ao fim de cada fase; diário `progresso.md` do item 85 em diante. Comandos da raiz em sequência, nunca em paralelo (`prisma generate` colide no Windows).

**Never:** migração, coluna de veredito, cache ou tabela de verificações; evento Socket.IO na auditoria (R-8.14); paginação; verificação no navegador; tocar nos lotes de dados do Felipe em produção (smoke público só de leitura); mexer nas pendências da S06 (M2, B1, B2, B3); versionar `apps/web/AGENTS.md`; `Date.now()` no web fora de `lib/server-clock.ts` e dos formatadores.

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Saída esperada | Erro |
|---|---|---|---|
| Arrematado íntegro | 5 lances + `Receipt` | `OK`, `receiptChecked` e `receiptOk` true, 5 linhas `OK` | N/A |
| Valor alterado | `amountCents` da seq 3 | `BROKEN_AT`, `firstBad {seq 3, HASH}`, `[OK,OK,MISMATCH,BROKEN_LINK,BROKEN_LINK]`, `okCount 2` | N/A |
| Linha do meio apagada | seq 3 removida | `firstBad {seq 4, expectedSeq 3, SEQ_GAP}` | N/A |
| Fim apagado | 2 últimas removidas | `SEAL_MISMATCH`, `foundCount 3`, `registeredCount 5`, linhas `OK`, nenhuma inventada | N/A |
| Chave errada | cadeia recalculada com outra chave | `BROKEN_AT` seq 1 | N/A |
| Comprovante | `finalHash` trocado / `Receipt` apagado / valor trocado | `RECEIPT_MISMATCH` (`receiptOk false` / `RECEIPT_MISSING` / `RECEIPT_AMOUNT`) | N/A |
| Cancelado | lances + CANCEL; `cancelledAt` limpo | `OK` com a CANCEL (`pseudonym`/`amountCents` null); limpo → `SEAL_MISMATCH` `CANCEL_FLAG` | N/A |
| Sem lances | 0 linhas | `OK` só depois de conferir genesis, contagem e selo; `startingBidCents` alterado → `SEAL_MISMATCH` | N/A |
| Ao vivo | lances, sem `Receipt` | `OK`, `receipt null`, `receiptChecked false`, `receiptOk null` | N/A |
| `bidderId` trocado | outro dono na linha | `OK` (limitação documentada) | N/A |
| Lance concorrente | 20 lances alternados + 20 auditorias | sempre `OK`, `foundCount = registeredCount` | N/A |
| `mine` | token da Ana / sem token / expirado | só as linhas dela `true`; demais `false`, 200 | N/A |
| Id ruim | uuid inexistente, `abc` | nada | `NOT_FOUND` 404 no envelope |
| Limite | 61ª chamada do mesmo IP em 1 min | as 60 primeiras 200 | `RATE_LIMITED` 429 no envelope |

</frozen-after-approval>

## Code Map

- `apps/api/src/domain/audit-chain.ts` -- já tem `genesisHash`, `entryHash` (aceita `pseudonym`/`amountCents` null → ""), `sealHash`, `pseudoHash`. Acrescentar `verifyChain(key, lot, rows, receipt)` e `eq` (`timingSafeEqual`), tipos `AuditRow`/`AuditLot`/`ChainResult` da §4. Testes em `audit-chain.test.ts` (já existe).
- `apps/api/src/services/audit.service.ts` (novo) -- `db.$transaction(..., {isolationLevel: "RepeatableRead"})` como em `my-bids.service.ts`: lote (`LOT_SELECT` de `lot-mappers.ts` + `lastHash`, `seal`), `bid.findMany({where:{lotId}, orderBy:{seq:"asc"}})` com `bidderId` só para `mine`, `receipt` (`finalHash`, `amountCents`, `token` só para `receiptCode`). Lote ausente → `AppError("NOT_FOUND", undefined, LOT_TEXT.notFoundTitle)`. `toNumber` de `mappers.ts`; `itemImagePath`.
- `apps/api/src/routes/audit.ts` (novo) + `app.ts` -- `GET /lots/:id/audit`: `makeRateLimiter({windowMs: 60_000, max: 60, keyGenerator: (req) => \`audit:${req.ip}\`})` → `auth.optionalAuth` → `Cache-Control: no-store` → service. `trust proxy` já ligado em produção no `app.ts`. Registrar antes do `notFoundHandler`.
- `apps/api/test/helpers/tamper.ts` (novo) -- `withAppendOnlyTriggerDisabled(prisma, fn)` numa só `prisma.$transaction` (DISABLE → `fn(tx)` → ENABLE); `triggerEnabled(prisma)` lendo `pg_trigger.tgenabled`.
- `apps/api/src/routes/audit.test.ts`, `routes/audit.rate-limit.test.ts` (novos) -- reaproveitar `makeTestApp` (FakeClock em `2026-10-23T12:00Z`), `makeUser`, `postBid`, `insertLot`, `makeSettlement`, `FORBIDDEN_KEYS`, `collectKeys`, `tokenFor`; seed via `seedShowcaseLots`/`seedLiveBids`/`seedClosedLots`/`seedCancelledLot` como em `seed/my-bids.seed.test.ts`. O teste de rate limit apaga `RATE_LIMIT_DISABLED` (lido a cada requisição) e o restaura no `afterAll`. Os CHECKs de `Bid` (BID com autor/pseudônimo/valor; CANCEL sem) e `lot_current_bid_min` limitam as adulterações possíveis.
- `packages/shared/src/audit.ts` (novo, + `index.ts`) -- zod `auditRowDtoSchema`/`auditViewSchema`, tipos `AuditRowDto`/`AuditView`, `abbreviateHash`, `verdictSentence(view)`, `problemBanner(view)`, `AUDIT_TEXT` (§8: estados, rótulos de linha, CANCEL, legenda, live region, "Como a gente confere"). `formatLotNumber` (catalog), `formatBRL`, `formatBrasilia(iso, "seconds")`, `LOT_STATUS_LABEL`, `receiptCode` já existem.
- `apps/web/src/components/ui/data-table.tsx` -- acrescentar `rowClassName?`/`rowStyle?` opcionais (borda esquerda 6 px e fundo por status); os usos atuais não mudam.
- `apps/web/src/lib/audit-view.ts` (novo, puro) -- status → rótulo/ícone/cor, contadores em `ferrugem` por veredito, meta de status em texto, regra dos 400 ms e do clique repetido.
- `apps/web/src/app/(auditoria)/layout.tsx` + `lotes/[id]/auditoria/page.tsx` (novos) -- grupo próprio porque o layout `(publico)` fixa a legenda do Comprovante; `PublicHeader legend={AUDIT_TEXT.legend}`; `<title>` "Auditoria do lote {NNN} · LanceAuto" (`generateMetadata` via `serverGet` ou `document.title`), `robots: noindex`.
- `apps/web/src/components/audit/` (novos) -- `audit-screen.tsx` (useQuery `["audit", id]`, `staleTime 0`, `gcTime 0`, sem `refetchOnWindowFocus`, `fetchLot` extra só com sessão de licitante para `myReceiptToken`), `verdict-box.tsx`, `audit-table.tsx`, `hash-cell.tsx`, `row-status.tsx`, `how-we-check.tsx`, `verifying-indicator.tsx`. Reaproveitar `Stamp` (`integro`/`adulterado` já existem), `FeedbackState`, `Button`, `LotTag`, `PageShell`, `apiGet`.
- Retrofits -- `lib/lots.ts` `lotCardHref` (SOLD/UNSOLD → `/lotes/{id}/auditoria`) e `lots.test.ts`; `components/sala.tsx` (link "Auditar este lote" em todos os estados); `components/comprovante/comprovante.tsx` ou `recibo.tsx` (`receipt.auditUrl` já vem no DTO: "Verificar na auditoria" + "Auditar lote"); `components/painel-screen.tsx` (coluna/link "Auditoria do lote" em Encerrados e Cancelados); `lib/my-bid-view.ts` + testes (`my-bid-view.test.ts:97,118`, `bid-ticket-list.test.tsx:85-91` passam a exigir "Conferir na auditoria" em LOST e CANCELLED).
- Docs -- `slice-08` (§16 decisões e perguntas, §17), `README.md` (texto da técnica da §15), `deferred-work.md` (fechar o item "Conferir na auditoria" da S07), `progresso.md` (85+).

## Tasks & Acceptance

O build corre em **duas fases**, cada uma com `lint`, `typecheck`, `test` e `build` na raiz (saída real no diário), commits atômicos e `git push` ao fim. Banco de testes próprio: `DATABASE_URL_TEST=…/lanceauto_test_s08`.

### Fase 1 — Servidor: domínio, shared, `GET /lots/:id/audit`

**Execution:**
- [x] Linha de base -- raiz com a árvore limpa (esperado shared 121, api 386, web 372).
- [x] `domain/audit-chain.ts` -- teste antes (§14 itens 1–7): cadeias válidas de 0/1/5 linhas, tabela de adulteração por campo e linha, remoções, selo, comprovante, precedência, chave errada, CANCEL com nulos, todos os `consistencyIssue`.
- [x] `packages/shared/src/audit.ts` -- teste antes: `abbreviateHash`, `verdictSentence` e `problemBanner` para cada linha da §8 (plural "1 lance"/"2 lances", "registros" com CANCEL, `receiptOk` true/false no `BROKEN_AT`), schema zod aceitando o DTO.
- [x] `test/helpers/tamper.ts` + `audit.service.ts` + `routes/audit.ts` + `app.ts` -- integração AC-8.1 a 8.22 e 8.36 a 8.39, sanidade do trigger e "trigger habilitado depois de cada caso" (inclusive quando `fn` lança); AC-8.40 em `audit.rate-limit.test.ts`.
- [x] Prova de mutação no servidor -- precedência invertida, `eq` sem checar tamanho/sempre `===` fora do `timingSafeEqual`, `sealOk` sem `entryCount === rows.length`, linhas após a ruim como `OK`, `consistencyIssue` ignorado, `mine` sem token, token do `Receipt` no DTO, leitura fora da transação (se o teste concorrente pegar).
- [x] Fechamento da fase -- raiz com saída real; push; CI verde; Railway API `SUCCESS`; smoke de leitura `GET /lots/{arrematado do seed}/audit` = `OK` e sem `token`; diário.

### Fase 2 — Web: tela, retrofits, verificação e entrega

**Execution:**
- [x] Web puro, com teste antes -- `audit-view.ts` (rótulo/ícone por status, contadores, meta, 400 ms e clique ignorado durante a verificação) e `lotCardHref`/`myBidView` atualizados.
- [x] Tela T9 -- grupo `(auditoria)`, `AuditScreen` e componentes; estados Verificando, Íntegro, os três Adulterados, ao vivo, agendado, sem lances (`FeedbackState` vazio), cancelado, apurando, 404, erro com e sem resultado anterior ("DESATUALIZADO"), reduced-motion; live region e banner `role="alert"`; `HashCell` com `aria-expanded`/`aria-controls`, alvo 44 px.
- [x] Retrofits -- Vitrine, Sala, Comprovante, Painel, Meus arremates (e os testes que proibiam "auditoria").
- [x] Prova de mutação no web -- cartão Encerrado indo à Sala, LOST sem "Conferir na auditoria", status trocado de rótulo, segundo clique disparando outra chamada, Verificando sem mínimo.
- [x] Documentação -- §16 e §17 da fatia, README com o texto da técnica, `deferred-work.md`, diário.
- [x] Verificação -- raiz; Chrome real (estados da §9, claro/noite, 390 px, teclado, adulteração pelo psql no banco descartável vendo "Adulterado" na linha 03 e o banner de selo); push, CI verde, Railway web e API `SUCCESS` no mesmo SHA, smoke público só de leitura (arrematado do seed = Íntegro; seed inteiro `OK`).

**Acceptance Criteria:** AC-8.1 a 8.22 e 8.36 a 8.40 [auto] fecham na Fase 1; AC-8.23 a 8.35 [manual] na Fase 2 (Chrome local e link público). Leitor de tela (AC-8.29) e aparelho real ficam como pendência do Felipe, sem marcar feito.

## Decisões do build (a registrar na §16 da fatia)

1. **Railway** no lugar de Neon/Render/Vercel; sem migração nesta fatia.
2. **Layout do repo:** `services/audit.service.ts`, `routes/audit.ts`, testes colados (`routes/audit.test.ts`, `routes/audit.rate-limit.test.ts`); a fatia citava `modules/audit/`.
3. **404 de id malformado:** ids são TEXT; `abc` simplesmente não encontra o lote e cai no mesmo `NOT_FOUND`, sem validação de UUID (nunca `VALIDATION`).
4. **Rate limit por IP** com chave `audit:{req.ip}` (prefixo para não somar com outros limitadores) e a mensagem padrão do `RATE_LIMITED`.
5. **`receiptChecked`** = há `Receipt` **ou** `consistencyIssue === 'RECEIPT_MISSING'`; `okCount` = linhas `OK`.
6. **Rota em grupo `(auditoria)`** com layout próprio: o `(publico)` fixa a legenda do Comprovante.
7. **"Ver comprovante do lote"** só com sessão de licitante: a tela faz `GET /lots/:id` autenticado e mostra o link se vier `myReceiptToken`.
8. **`DataTable`** ganha `rowClassName`/`rowStyle` opcionais em vez de uma tabela nova.
9. **400 ms mínimos** no "Verificando" (sugestão da §16.2) e clique repetido ignorado enquanto a chamada está em voo.
10. **Texto da técnica vai ao README nesta fatia** (a §17 permite); a revisão final do README é da S09.

## Implementation Notes

Implementada direto, sem subagente (o prompt da sessão trazia banco, portas e regras de commit que o spec não repete). Linha de base na raiz: shared 121, api 386, web 372. Depois: shared **150** (+29), api **495** (+109), web **416** (+44); lint, typecheck e build exit 0; CI verde em c4c0e84; Railway web `SUCCESS` em c4c0e84 e API `SUCCESS` em 5ffd270 (nada de `apps/api` mudou depois).

Desvios e decisões menores, nenhum mexe no bloco congelado (as 16 decisões completas estão na §16 da fatia):
- **Chave do limitador** é a padrão por IP (sem `keyGenerator`): a decisão do build 4 do spec dizia `audit:{ip}`, mas o `express-rate-limit` 8 exige o helper de IPv6 para chave própria e cada limitador já tem a sua contagem.
- **404 sem validar UUID** (decisão 3) e **`receiptChecked`** com `RECEIPT_MISSING` (decisão 5) como previstos.
- **Retrato da leitura** provado por teste determinístico (`prisma.$extends` injeta um lance entre as leituras); as 20 auditorias paralelas não bastavam: a mutação `ReadCommitted` sobreviveu até o teste novo existir.
- **Frases novas** para selo fora com 0 e com 1 linha, e verbo no singular com N = 1 (a tabela da §8 não cobria); todas "(a revisar)".
- **Contraste:** o `.85` do elo quebrado ficou só nos dados da linha (a Situação a 100%) e "NÃO CONFERE" ficou em tinta com ícone e borda em ferrugem, porque ferrugem a 85% dava 4,26:1 no claro e 3,79:1 na noite, e sobre o fundo `falha` dava 3,80:1 na noite.
- **Ordem do veredito:** hora e "Verificar de novo" antes dos contadores, para o Tab seguir a leitura.
- **`refetch({ cancelRefetch: false })`** para dois cliques seguidos serem uma só chamada (o padrão da biblioteca cancela e refaz).
- **Texto da técnica no README** já nesta fatia.
- **Sem ocorrência de bug da S06**; as pendências M2, B1, B2, B3 não foram tocadas.
- **Deslizes meus:** regex do `receiptCode` com 3 dígitos fixos (a sequência de lotes passa de 999 nos testes); algumas rodadas do vitest sem exportar `DATABASE_URL_TEST` (o `globalSetup` aplicou `migrate deploy` em `lanceauto_test`, sem migração pendente).

Provas de mutação (cópia no scratchpad, restauração por cópia, nunca `git checkout`): domínio 13/13 mortas, servidor e rota 13/13, web 13/13. Chrome real: 85 de 85 verificações (`.tmp/s08-chrome.mjs`); smoke público de leitura: 14 de 14 (`.tmp/s08-smoke-prod.mjs`). Pendências do Felipe, sem marcar feito: leitor de tela (AC-8.29) e aparelho real.

## Spec Change Log

## Review Triage Log

## Verification

Cada fase fecha com os quatro comandos abaixo na raiz, em sequência, e a saída real no diário.

**Commands:**
- `npm run lint` -- expected: exit 0
- `npm run typecheck` -- expected: exit 0
- `npm test` -- expected: exit 0 (linha de base shared 121, api 386, web 372; só sobem)
- `npm run build` -- expected: exit 0 (shared → api → web; rota `/lotes/[id]/auditoria`)

**Manual checks:**
- Chrome real (playwright-core do cache do npx, banco descartável próprio, API compilada e `next start` em portas livres, `localhost`, texto sem `<script>`/`<style>`): AC-8.23 a 8.35; adulterar pelo psql (seq 3 → "Adulterado", banner "Linha 03: …", linha 03 "NÃO CONFERE", 04 e 05 "ELO QUEBRADO"; apagar os dois últimos de outro lote → banner de selo, "NA CORRENTE 3"/"NO SELO 5" em ferrugem); "Verificar de novo" duas vezes = uma chamada; API derrubada → "DESATUALIZADO"; claro e noite; 390 px sem rolagem lateral; reduced-motion.
- Produção: CI verde, Railway web e API `SUCCESS` no mesmo SHA, smoke só de leitura (auditoria de cada lote do seed = Íntegro; DTO sem `token`; cartão Encerrado leva à auditoria).
