---
title: 'S02 — Catálogo, criação de lote, vitrine e painel base'
type: 'feature'
created: '2026-10-23'
status: 'done'
baseline_commit: '02e8ee80ca4077b2593e5aebdbdfc35384145b94'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-lanceauto/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-lanceauto/slice-02-catalogo-lotes-vitrine.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O LanceAuto ainda não tem lotes: o leiloeiro não monta leilão e o visitante abre uma página diagnóstica em `/`.

**Approach:** Implementar a S02 inteira como está na fatia (contrato canônico, §1–§17): adaptadores FIPE/Wikipedia com cache, `POST /lots` com snapshot e genesis/seal, listagens públicas, Vitrine, Sala só leitura, Criar lote e Painel base, seed provisório pelo fixture, deploy no Railway.

## Boundaries & Constraints

**Always:** a fatia vence a arquitetura; T1–T13 do SPEC.md valem sobre a fatia. Dinheiro em centavos `BigInt`/`number`; `Date` só em `infra/clock.ts` na API; services gravam datas com `clock.now()`; contratos em `packages/shared`; erro no envelope pt-BR; nenhuma chamada externa dentro de transação; listas sem `Item.imageData`. Perguntas Q1–Q7 da §16 seguem a sugestão marcada. Deploy no Railway (onde a fatia diz Neon/Render, ler Railway).

**Never:** filtro de preço (Q1), edição de lote, `Bid`/`Receipt`, eventos Socket.IO, cancelamento, auditoria; front chamando FIPE/Wikipedia; cachear `UNAVAILABLE`; repetir 429 da FIPE; marca de IA em commits.

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Saída esperada | Erro |
|---|---|---|---|
| Catálogo com cache vencido | FIPE cai depois da 1ª chamada | 200 com a entrada vencida, `warn` no log | — |
| Catálogo sem cache | FIPE fora | 503 `EXTERNAL_UNAVAILABLE {source:"FIPE"}` em ≤ ~8 s | não cacheia |
| Criar lote com data inválida | início 61 s no passado | 400 `fields.startsAt` antes de qualquer chamada externa | — |
| Imagem em IP privado | `imageUrl` → 127.0.0.1, `[::1]`, `2130706433`, DNS privado, redirect | lote criado, `imageStatus:"FAILED"`, nenhuma conexão | — |
| Busca com curinga | `q=%`, `_`, `\` | 200, sem casar tudo | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/app.ts` -- composição: injeta `clock`, registra routers; acrescentar catálogo, lotes, itens e as portas FIPE/Wikipedia/image-store (injetáveis para teste).
- `apps/api/src/env.ts` -- `FIPE_BASE_URL`, `FIPE_TOKEN?`, `WIKI_USER_AGENT`, `WIKIPEDIA_BASE_URL` já existem (S00); `AppDeps.env` passa a incluí-los mais `AUDIT_HMAC_KEY`.
- `apps/api/src/middleware/auth.ts` -- `requireAuth`, `requireRole(role, msg)`, `optionalAuth` prontos; reusar.
- `apps/api/src/middleware/rate-limit.ts` -- `makeRateLimiter` para `/catalog` (120/min por usuário).
- `apps/api/src/routes/auth.ts` -- `parseBody(schema, body)` para validação com `details.fields`.
- `apps/api/src/services/mappers.ts` -- `toNumber` (BigInt → number seguro); mappers de lote vão aqui.
- `apps/api/src/errors.ts` -- `AppError(code, details, message)`.
- `apps/api/prisma/schema.prisma` + nova migração `lots_and_items` -- `Item`, `Lot`, inversos em `User`, CHECKs da §5.1, `timestamp(3)`.
- `apps/api/prisma/seed.ts` -- já idempotente por e-mail; estende com os 2 lotes do fixture via `createLot({allowPast:true})`.
- `apps/api/test/helpers/{app,db}.ts` -- `makeTestApp` (FakeClock `2026-10-23T12:00:00Z`), `truncateAll`, `registerUser`, `tokenFor`; estender `makeTestApp` com portas falsas.
- `packages/shared/src/*` -- `lotStatus`, DTOs `LotCard`/`LotState`, zod de `POST /lots`, `normalizeSearch`, `cleanBrand`, `parseBRL`, mês de referência, Brasília↔UTC; exportar no `index.ts`.
- `apps/web/src/lib/api-client.ts` -- `apiGet`/`apiPost`; retrofit `syncServerTime` em toda resposta com `serverTime`.
- `apps/web/src/app/page.tsx` -- hoje diagnóstico; vira a Vitrine (SSR + hidratação).
- `apps/web/src/app/painel/page.tsx` -- stub; vira o Painel base. `RequireAuth role="AUCTIONEER"` continua.
- `apps/web/src/components/site-header.tsx` -- leiloeiro ganha "Meus lotes · Criar lote · Vitrine"; visitante ganha "Como funciona".
- `apps/web/src/components/ui/{lot-tag,stamp,feedback-state,filter-tabs,data-table,field,button}.tsx` -- reusar; `LotTag` passa a aceitar texto ("NOVO").
- `apps/web/src/lib/{format,money-mask}.ts` -- `formatWhen`, `lotNumberLabel`, máscara de reais; reusar.

## Tasks & Acceptance

**Execution (ordem):**
- [x] `packages/shared` -- funções puras e DTOs da §5.2/§5.4/§6.0 com testes (itens 1–2 da §14).
- [x] `apps/api/prisma` -- schema + migração `lots_and_items` com CHECKs; aplicar local.
- [x] `apps/api/src/domain/audit-chain.ts` -- `genesisHash`/`sealHash` (chave primeiro, T5) com vetores fixos.
- [x] `apps/api/src/infra/{external-cache,fipe,wikipedia,image-store}.ts` -- cache TTL/teto/single-flight, retry, SSRF; testes 4–5 da §14 com servidores HTTP locais.
- [x] `apps/api/src/{services,routes}` -- catálogo, `POST /lots`, `GET /lots`, `GET /lots/:id`, `GET /my/lots`, `GET /items/:id/image`; integração AC-2.1 a AC-2.29.
- [x] `apps/api/prisma/{fipe-fixture.json,seed.ts}` -- lote ao vivo (30 dias) e agendado, sem rede; `seed:demo`.
- [x] `apps/web` -- `useServerClock`, `Cronometro`, `PlacaLance`, `CarPhoto`, `LotCard`, Vitrine, Sala, Criar lote, Painel, header; testes do item 8.
- [x] `.env.example`, README, `progresso.md` -- variáveis, limite da FIPE (1000/dia observado), cache em memória.

**Acceptance Criteria:** os AC-2.1 a AC-2.50 da §12 da fatia, mais a §17 inteira (migração em produção, CI verde, teste de resiliência com host morto, smoke público).

## Implementation Notes

Verificações do dia 1 (23/10/2026, chamadas reais): FIPE v2 `/cars/brands` → `[{code,name}]`, `x-ratelimit-limit: 1000`; marcas reais "VW - VolksWagen", "GM - Chevrolet"; anos `[{code:"2015-5",name:"2015 Flex"}]` com "Zero Km" como `{code:"32000-5",name:"32000 Flex"}`; detalhe `{vehicleType,price:"R$ 80.061,00",brand,model,modelYear,fuel,codeFipe,referenceMonth:"outubro de 2026",fuelAcronym}`; id inexistente → 404 `{"error":"…não encontrado…"}`. Wikipedia `page/summary`: `type` (`standard`/`disambiguation`), `thumbnail.source` em `thumb.wikimedia.org/…/330px-…?utm_source=…` (remover a query; reescrever para `1280px-` funcionou: 200 `image/jpeg` 290 KB), `originalimage.width` 1797–6587, `content_urls.desktop.page`; artigo inexistente → 404; "Gol" → gol de futebol (extract sem "automóvel": rejeitado pela regra), "Uno" → desambiguação.

## Review Triage Log

| # | Achado | Veredito | Rota | Evidência |
|---|---|---|---|---|
| 1 | `q=%`/`_`/`\` devolvem todos os lotes (AC-2.18d) | medium | patch | Produção: `GET /lots?q=%25` → 3 lotes; `searchTerms` remove o curinga e a busca fica vazia. |
| 2 | Teste AC-2.18d só confere status 200 | medium | patch (junto do 1) | lots.test.ts:364 não afirma o resultado de `%`, `_`, `\`. |
| 3 | Vitrine/Painel nunca refazem o GET ao zerar | medium | patch | `filter(t > now)` tira o prazo vencido; `useOnReach` reseta antes de `t+1000`. |
| 4 | Aviso "agendado" para lote que nasce LIVE; "Lote NaN" | low | patch | `useCreatedNotice` não olha o status; `Number(created)` sem validação. |
| 5 | SSR quebra com 200 e corpo não JSON | low | patch | page.tsx e lotes/[id]/page.tsx leem `result.data.*` sem checar nulo. |
| 6 | Sala faz 2 GET por render no SSR | low | patch | `generateMetadata` e página chamam `serverGet` sem memoização. |
| 7 | `serverTime` do SSR não acerta o offset | medium | patch | Só `apiRequest` chama `syncServerTime`; hidratação usa offset 0 até o 1º fetch. |
| 8 | Ids de models/years sem validação (`..`) | low | patch | Só o preview valida; `encodeURIComponent` mantém `..`. |
| 9 | yearId `32000-*` aceito direto | low | patch | `years()` filtra, `detail()` não. |
| 10 | Modelo sem token sugere foto da marca | low | patch | `wikiTitleCandidates` devolve `[marca]`. |
| 11 | Crédito/link de crédito arbitrários mantidos | low | patch | `keepCredit` compara só `imageUrl` e o prefixo do texto. |
| 12 | Imagem: lê blob e faz SHA-256 até no 304; `W/` não aceito | medium | patch | `getItemImage` seleciona `imageData` antes do If-None-Match. |
| 13 | NAT64 local, Teredo e IPv4-translated fora da lista | low | patch | ip-policy.ts não tem 64:ff9b:1::/48, 2001::/32, ::ffff:0:0:0/96. |
| 14 | Ordem de `GET /my/lots` sem teste | medium | patch | AC-2.29 só afirma o último id. |
| 15 | Timeout do download de imagem sem teste | medium | patch | Nenhum servidor de teste trava. |
| 16 | apiClient → syncServerTime sem teste | medium | patch | Não há api-client.test. |
| 17 | Fatia ainda contradiz Q8/Q9 | low | patch | AC-2.19, §13, §14 item 4. |
| 18 | `useOnReach` sem teste | medium | defer | Exige extrair função pura; AC-2.44 é manual. |
| 19 | P2003 em `POST /lots` e `readFixtureImage` sem teste | low | defer | Fora do fluxo principal; fotos do seed só na S09. |
| 20 | 429/401 da FIPE sem log | low | defer | `read()` mapeia para 503 sem `warn`; observabilidade. |
| 21 | `POST /lots` sem rate limit | low | defer | Só leiloeiro; fatia não pede. |
| 22 | Lote 003 do smoke público em produção | low | defer | Some com o seed final da S09. |
| 23 | Content-Type confiado sem checar assinatura | false | rejeitado | Servido com `nosniff` e MIME de imagem; o navegador não executa. |
| 24 | Cache descarta por inserção, não LRU | false | rejeitado | R-2.1 manda "descarta a mais antiga". |
| 25 | Polling de 3 s em CLOSING sem teto; listas não olham CLOSING | false | rejeitado | §9.2 manda 3 s; §9.1 pede um GET ao zerar. |
| 26 | Limite da FIPE 500 × 1000 | false | rejeitado | Docs usam o menor observado (500); a nota do spec registra os dois. |
| 27 | `maxLength=160` no título | false | rejeitado | Deixa o usuário ver a mensagem "até 120 caracteres". |
| 28 | Sem teto de dinheiro/datas; centavos não múltiplos de 100 | false | rejeitado | Assumption do SPEC: API aceita centavos positivos, a UI só produz múltiplos de 100. |
| 29 | Tetos 200/500 escondem grupos | false | rejeitado | Teto defensivo pedido pela fatia (§6.2). |
| 30 | Sala presa se o refetch da fronteira chegar cedo | false | rejeitado | O offset é medido na chegada da resposta; o cliente nunca está à frente do servidor e há +500 ms. |
| 31 | `originalimage.width` ausente gera thumb ampliada | low | rejeitado | Campo presente em todas as respostas reais conferidas. |
| 32 | Segundos > 59 em `brasiliaLocalToUtcIso` | low | rejeitado | `datetime-local` não gera; improvável. |
| 33 | Seed parcial / leiloeiro com papel errado | low | rejeitado | Improvável; o seed final é da S09. |
| 34 | Textos fixos fora do shared; telas sem teste de componente | low | rejeitado | Textos não canônicos; aceite de UI é manual (Assumptions do SPEC). |

## Verification

**Commands:**
- `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` -- exit 0.
- CI do GitHub verde no push.
- Smoke HTTP na API pública: `GET /lots`, `GET /lots/:id`, `GET /my/lots`, `GET /items/:id/image`, `POST /lots` com FIPE real.

**Manual checks:**
- AC-2.30 a AC-2.50 no navegador (local e link público); FIPE/Wikipedia em host morto: Vitrine/Sala/Painel normais, Criar lote com o banner.
