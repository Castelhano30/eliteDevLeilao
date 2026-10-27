---
title: 'S09 — Polimento, responsivo, seed final, README e entrega'
type: 'feature'
created: '2026-10-27'
status: 'done'
baseline_commit: '1a412d34d9ccb2e81eb3366dca4da585df16c2ab'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-lanceauto/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-lanceauto/slice-09-polimento-entrega.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** S00–S08 estão no ar, mas falta fechar a entrega: o seed ainda é o provisório das fatias (ordem 001 ao vivo … 005 cancelado, idempotente por item, com `--demo` por flag), não há `not-found.tsx` nem `error.tsx` globais, as varreduras de acessibilidade, responsivo e temas nunca foram feitas em todas as telas, o README não segue D1–D8 nem fala do Railway por inteiro, o `deferred-work.md` tem itens com alvo S09 e ninguém rodou AC1–AC15.

**Approach:** Executar a S09 como está na fatia (§1–§17), sem produto novo: seed final só por services (R-9.1 a R-9.5, R-9.12), resiliência provada, 404/erro globais, varreduras no Chrome real com correção no componente dono, README e `.env.example` finais, triagem do `deferred-work.md`, e AC1–AC15 anotados no `progresso.md`. As perguntas abertas da §16 seguem as decisões do Felipe abaixo.

**Decisões do Felipe (registrar na §16 da fatia):**
- **Q1/Q6:** credenciais e valor-base de `seed:demo` como a fatia sugere (`leiloeiro@`, `ana@`, `bruno@lanceauto.test`, senha `lance1234`; saldos R$ 500.000 e R$ 300.000; base R$ 100.000).
- **Q2:** NÃO fazer "Acordando o pátio…". O Railway não hiberna. Ajustar D8 item 2, AC-9.22 e a checklist de deploy.
- **Q3:** NÃO fazer `seed:demo --relampago`.
- **Q4:** ping externo só citado no README.
- **Q5:** o repositório não vira público por minha conta; ao final listo o que checar (segredos no histórico) e peço a decisão. **Fato achado:** `gh repo view` já reporta visibilidade `PUBLIC`; relatar isso ao Felipe, não alterar.
- **Q7:** resolvida (cartão Encerrado abre a Sala; auditoria pelo link "Auditar este lote").
- **Q8:** reler §4, §11, §13, §15 e D8 contra o Railway (sem Render, Vercel, Neon). O seed fica no start da API, ao lado do `migrate deploy`.

## Boundaries & Constraints

**Always:** a fatia vence a arquitetura e o EXPERIENCE; T1–T13 e INV-1..18 valem. O seed cria dados só pelos services (`createLot` com `allowPast: true` só nele, `placeBid`, `settleLot`, `cancelLot`, depósito), com `FakeClock` local ao passado, sem rede e sem `INSERT` direto. `pg_advisory_lock` antes de checar usuários. Usuários existentes: sai com código 0 e "seed ignorado: já existem usuários"; nunca apaga. Correção achada nas varreduras vai no componente dono, com teste quando houver lógica pura. Commits atômicos em pt-BR, sem marca de IA, `git push` ao fim de cada etapa, `progresso.md` atualizado a cada passo. Feito = DoD da §17, menos o que é do Felipe.

**Never:** escrever em produção (seed, `seed:demo`, lances, lotes, cancelamentos) sem perguntar ao Felipe; smoke no link público é só leitura até ele autorizar escrita. Trocar `AUDIT_HMAC_KEY` ou `JWT_SECRET`. Migração ou coluna nova. Nova funcionalidade de produto (lacuna vira correção na fatia dona ou entra na §16). `seed:demo --relampago`, "Acordando o pátio…", Playwright no repositório, jsdom. Versionar `apps/web/AGENTS.md`. Tornar o repositório público (ou privado) por conta própria. `Date.now()`/`new Date()` em `apps/api/src` fora de `infra/clock.ts`. Marcar como feito o que exige leitor de tela ou aparelho real: fica "não feito, do Felipe".

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Saída esperada | Erro |
|---|---|---|---|
| Seed em banco vazio | `runSeed` | 1 leiloeiro, Ana R$ 500.000 e Bruno R$ 300.000 com depósito no extrato, lotes 001 arrematado (Ana, 1 prorrogação), 002 sem lances, 003 cancelado (Bruno líder, `REFUND`, CANCEL), 004 agendado, 005 ao vivo (30 dias, 5 lances, líder Bruno); auditoria `OK` em todos | N/A |
| Seed repetido | usuários já existem | nada muda; "seed ignorado: já existem usuários"; exit 0 | N/A |
| Duas execuções juntas | dois `runSeed` com conexões distintas | o segundo espera o lock, vê os usuários e sai 0; 3 usuários e 5 lotes | sem `EMAIL_TAKEN` vazando |
| `seed:demo` | seed rodado | lote 006 ao vivo (`endsAt ≈ +30 dias`), lances de Ana e Bruno, auditoria `OK`, 001–005 intactos; de novo cria 007 | sem usuários: erro claro "rode o seed antes" |
| `seed:demo` com saldo baixo | Ana disponível R$ 20.000 | depósito de R$ 80.000 no extrato antes dos lances | N/A |
| FIPE e Wikipedia fora | `FIPE_BASE_URL`/`WIKIPEDIA_BASE_URL` mortas | `GET /lots`, `/lots/:id`, `/lots/:id/audit`, `/receipts/:token`, `/items/:id/image` = 200 | `/catalog/brands` sem cache: 503 `EXTERNAL_UNAVAILABLE` `{source:'FIPE'}` em ≤ 2 tentativas |
| Wikipedia fora, FIPE ok | `POST /lots` sem `imageUrl` | 201, `imageData` nulo, ilustração padrão | N/A |
| Corpo > 100 KB | qualquer `POST` | envelope com 413, mensagem pt-BR | nunca 500 `INTERNAL` |
| `POST /lots` em rajada | 11º pedido do mesmo leiloeiro em 1 min | 429 `RATE_LIMITED` no envelope | N/A |
| Rota inexistente / erro de render | `/rota-qualquer`; exceção em tela | `not-found.tsx` "Página não encontrada" + "Voltar à vitrine"; `error.tsx` "Algo travou no pátio." + "Tentar novamente" | N/A |
| `/kit` em produção | `NODE_ENV=production` | 404 | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/seed.ts` -- CLI atual (idempotente por item, `--demo`). Vira casca fina: lê env, `new PrismaClient()`, chama `runSeed`/`runSeedDemo`, código de saída 0/1.
- `apps/api/src/seed/showcase.ts` -- reaproveitar `makeFixtureCatalog`, `FixtureCar`, `readFixtureImage`. Os quatro seeds provisórios (`seedShowcaseLots`, `seedLiveBids`, `seedClosedLots`, `seedCancelledLot`) e o `PLAN` saem (R-9.12). Entra o plano 001–005 e `buildLiveDemoLot` (usada pelo 005 e pelo `seed:demo`). Valores atuais (Civic 50.000/+2.500, Gol GTI 40.000/+1.000, Onix 20.000/+500, Corolla 60.000/+1.000, Uno 15.000/+500) servem de base. 003 inverte os papéis: Ana abre, Bruno cobre e é estornado.
- `apps/api/src/seed/*.test.ts` -- `showcase.test.ts` (só o teste do fixture sobrevive) e `my-bids.seed.test.ts` testam as funções antigas: reescrever contra o seed final. Novo `seed/seed.test.ts` (AC-9.1 a 9.8) com `createTestPrisma` (duas instâncias para o AC-9.8) e `vi.stubGlobal("fetch")` que falha se chamado.
- `apps/api/src/infra/clock.ts` -- `FakeClock`, `toDate`. `apps/api/src/services/{lot,bid,cancel,settlement,wallet,auth}.service.ts` -- únicos caminhos de escrita do seed; `createLot(…, {allowPast, image})` já existe (`lot.service.ts:66,112`).
- `apps/api/railway.json`, `apps/api/Dockerfile` (CMD) -- start já roda `migrate deploy` + seed tolerante a falha + servidor; só conferir/ajustar comentário e README.
- `apps/api/src/errors.ts` -- `errorHandler` só trata `entity.parse.failed`: acrescentar `entity.too.large` → 413 no envelope. Código novo em `packages/shared/src/errors.ts` (`ERROR_HTTP_STATUS`, texto pt-BR), com teste.
- `apps/api/src/routes/lots.ts:90` -- `POST /lots`: acrescentar `makeRateLimiter` por usuário (10/min, `keyGenerator: lots:${id}`) depois de `requireRole`; teste no molde de `audit.rate-limit.test.ts`.
- `apps/api/src/infra/fipe.ts:68-86` -- `read()` converte tudo em `fipeUnavailable()`; acrescentar `logger?` em `FipeOptions` e `warn` com `reason` (`RATE_LIMITED`/`UNAVAILABLE`), ligado em `app.ts:106`. `external-cache.ts` já loga o cache vencido.
- `apps/api/src/services/lot.service.ts` `getLotState` (~l.250-290) -- lê todos os `BID` e calcula rank em memória; trocar `bestByBidder`/`bidderCount` por `bid.groupBy({by:['bidderId'], _max})` e limitar `bids[]` (verificar antes, em `components/lots/bid-history.tsx` e `lib/realtime/lot-reducer.ts`, se a Sala precisa do histórico inteiro; se precisar, só o `groupBy`). Preservar a regra `seq <= entryCount` (AC-3.43).
- `apps/api/src/routes/bids.test.ts:532-535,613` -- `Math.random` sem semente em `round()` e AC-3.43 dependente de corrida: semente fixa/impressa na falha, AC-3.43 determinístico.
- `apps/api/test/helpers/app.ts` -- `makeTestApp(prisma, overrides, external)`: o teste de resiliência (novo `routes/resilience.test.ts`) usa `FIPE_BASE_URL`/`WIKIPEDIA_BASE_URL` em porta fechada (`127.0.0.1:9`, já o padrão) e `test/helpers/fake-server.ts` para o 503 e a Wikipedia fora.
- `apps/web/src/app/layout.tsx`, `app/(publico)/c/[token]/not-found.tsx`, `components/comprovante/comprovante-nao-encontrado.tsx`, `components/ui/feedback-state.tsx`, `components/public-header.tsx`, `components/ui/button.tsx` (`buttonClasses`) -- molde do 404 global. Novos `app/not-found.tsx` e `app/error.tsx` (`"use client"`, `reset`), textos em constante nova em `packages/shared` (T8). `(site)/kit/page.tsx` já faz `notFound()` em produção.
- `packages/shared/src/{audit,cancel,my-bids,texts,errors}.ts` -- textos "(a revisar)" da S07/S08/S06; revisão de voz (INV-18) e teste de varredura (sem `!`, sem emoji) sobre as constantes `*_TEXT`.
- `README.md`, `.env.example`, `docker-compose.yml` -- README reorganizado em D1–D8 (hoje por fatia, 236 linhas; preservar D7 e as seções técnicas); `.env.example` com `WEB_PORT`, `INTERNAL_API_URL` já comentados; conferir tudo contra `env.ts`.
- `_bmad-output/implementation-artifacts/spec-s03-lances-sala.md` ('in-review') e `spec-s05-fechamento-comprovante.md` ('in-progress') -- frontmatter a corrigir só depois de confirmar no código e no diário (itens 56/58–61 e 66–71).
- `_bmad-output/implementation-artifacts/deferred-work.md` -- triagem dos itens com alvo S09; `_bmad-output/specs/spec-lanceauto/slice-09-polimento-entrega.md` §16 e `SPEC.md` -- registrar decisões e Q8.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/seed/showcase.ts`, `apps/api/prisma/seed.ts` -- seed final 001–005, `buildLiveDemoLot`, `runSeed`/`runSeedDemo`, advisory lock em transação interativa de longa duração, `seed:demo` com recomposição de saldo -- R-9.1 a R-9.5, R-9.12
- [x] `apps/api/src/seed/seed.test.ts`, `my-bids.seed.test.ts`, `showcase.test.ts` -- AC-9.1 a 9.8; varredura de privacidade da S08 sobre o banco semeado -- §14.1 e §14.4
- [x] `apps/api/src/errors.ts`, `packages/shared/src/errors.ts` (+ testes) -- 413 no envelope
- [x] `apps/api/src/routes/lots.ts` (+ teste) -- limite de `POST /lots`
- [x] `apps/api/src/infra/fipe.ts`, `app.ts` (+ teste) -- log `warn` do motivo da falha da FIPE
- [x] (avaliado e recusado, ver Implementation Notes) `apps/api/src/services/lot.service.ts` (+ teste) -- histórico/rank do `GET /lots/:id`
- [x] `apps/api/src/routes/bids.test.ts` -- semente nos testes de concorrência
- [x] `apps/api/src/routes/resilience.test.ts` (novo) -- AC-9.10 a 9.12
- [x] `apps/web/src/app/not-found.tsx`, `error.tsx`, `packages/shared` -- 404 e erro globais (R-9.8); conferir estados §9.4 por tela e `/kit`
- [x] `packages/shared/src/*.ts` (+ teste de varredura) -- revisão de voz dos "(a revisar)", AC-9.21
- [x] Chrome real (banco descartável, API e web locais) -- varreduras §9.1, §9.2 (320, 390, 1440, zoom 200%), §9.3 em todas as telas; axe-core fora do repositório; correções nos componentes donos; B1 e B2 da S06 se couberem
- [x] `README.md`, `.env.example`, `slice-09` §16, `SPEC.md`, `rastreabilidade.md` -- D1–D8 relidos para Railway; Q1–Q8 registradas
- [x] `deferred-work.md` -- triagem (feitos com `resolved:`, os demais "segue adiado" com motivo); `npm audit --omit=dev` de novo
- [x] frontmatter de `spec-s03-…` e `spec-s05-…` -- 'done' depois de confirmar
- [x] `progresso.md`, rascunho do relato de IA (D10) só com fatos do diário
- [ ] Deploy e AC1–AC15 (§15) -- local/Compose completos; link público só leitura até o Felipe autorizar escrita e decidir os dados de produção

**Acceptance Criteria:**
- Given banco vazio e `DATABASE_URL_TEST`, when `runSeed`, then AC-9.1 a 9.8 passam (estados e números de §11, auditoria `OK`, saldos coerentes, sem rede, idempotência, lock).
- Given FIPE e Wikipedia fora, when percorro as rotas públicas, then 200 do banco (AC-9.10 a 9.12); AC-9.13/9.14 conferidos no Chrome local.
- Given as varreduras, when termino, then §9.1 a §9.4 registrados no diário com o que passou, o que corrigi e o que ficou para o Felipe (NVDA, aparelho real).
- Given `npm run lint`, `typecheck`, `test` e `build` na raiz, then verdes, e o CI do último commit verde.
- Given produção, when termino, then nada foi escrito sem aval; o Felipe recebe a decisão dos dados (manter ou recriar) e a lista do Q5.

## Implementation Notes

- **Implementado direto** (sem subagent), na ordem do spec, em commits atômicos. Base verde → final verde: shared 150 → 154, api 495 → 501, web 416 → 418; lint, typecheck e build exit 0.
- **Histórico/rank de `GET /lots/:id` não foi feito** (decisão do build): a Sala conta lances por `bids.length` e `computeMyStanding` calcula a posição no navegador com o histórico inteiro; limitar mudaria o contrato, e o `groupBy` sozinho soma uma consulta. "Segue adiado" no `deferred-work.md`.
- **Achado fora do spec, corrigido:** com a API parada a Vitrine dizia "Não consegui trazer os lotes." em vez do texto canônico da §8 ("Não deu para carregar agora."). Textos de erro de carga agora vêm de `GLOBAL_TEXT` em Vitrine, Painel, Sala e na sessão.
- **Achados da varredura corrigidos:** carimbo "Arrematado" da Sala (rolagem lateral a 320/390 px), "88:88" do cronômetro como pseudo-elemento (axe), recibo a 320 px, alvos de toque de 44 px. Exceção documentada (A14): "BRASIL" sobre a faixa da placa.
- **AC1–AC15 no ambiente local** (banco descartável + Chrome real): AC1 a AC4, AC6 a AC10, AC12 a AC14 por roteiro de API contra o servidor local; AC7 por três navegadores; AC11 com o SQL do README e a auditoria no Chrome; AC5 pelo teste (`bids.test.ts`). Os verificadores de AC1a e AC2 acusaram falha por defeito do meu regex (a mensagem de AC1a traz minutos, "14h23", como a slice-03 permite; a de AC2 é a esperada); o texto foi conferido à mão.
- **Pendente de aval do Felipe:** AC1–AC15 no link público (exigem escrita em produção) e a decisão de manter ou recriar os dados de produção.

## Spec Change Log

## Review Triage Log

Revisão feita por mim sobre o diff `1a412d3..cd8b533` (os três revisores independentes do BMad exigem subagentes e o Felipe não os autorizou nesta sessão; **não houve revisão cega nem de casos de borda por terceiros**). Uma linha por achado:

| # | Achado | Veredito | Evidência |
|---|---|---|---|
| 1 | Os verificadores de AC1a e AC2 falharam | false | A mensagem de AC1a traz minutos ("14h23"), permitido por `slice-03` §8 ("{H}h{mm se ≠ 00}"); a de AC2 é exatamente "Seu lance precisa ser de pelo menos R$ 14.500,00."; o defeito era meu regex |
| 2 | Primeira tentativa de "melhorar" o fantasma do cronômetro (nowrap + tabular-nums) criou 18 px de rolagem a 320 px | high (corrigido) | Medido no Chrome local; desfeito antes do commit (`git checkout` dos dois arquivos, que só tinham essa edição) |
| 3 | O "88:88:88" apagado do cronômetro quebra de linha e aparece sob os dígitos em ≤ 390 px com lote de 30 dias | low (adiado) | Visto no link público (10% de opacidade); a geometria do original (span absoluto com o mesmo texto) é a mesma, então é anterior à S09, mas não medi a versão antiga. Registrado no `deferred-work.md` |
| 4 | O seed segura uma transação de até 300 s com o lock; se travasse, o start da API esperaria | low (aceito) | O start tolera falha do seed, o Prisma derruba a transação no timeout e o seed leva ~20 s; em produção só faz `COUNT` e sai |
| 5 | AC-9.17b: com a API de volta, o botão "Tentar novamente" já tinha sumido | false | A Vitrine recarregou sozinha quando o socket reconectou (melhor que clicar); o caminho do clique foi provado em 9.14 (Criar lote) e o texto/botão de erro em 9.17a |
| 6 | O seed final não recria nada em produção | medium (informação) | R-9.4 manda ignorar bancos com usuários; decisão de manter ou recriar os dados de produção é do Felipe |

## Design Notes

**Lock do seed.** Sessão do Prisma é um pool: `pg_advisory_lock` solto pode travar e destravar em conexões diferentes. Por isso o seed roda dentro de `db.$transaction(async tx => { await tx.$executeRaw\`SELECT pg_advisory_xact_lock(\${KEY})\`; … }, { timeout })`; os services usam o `db` normal em outras conexões e a liberação sai no fim da transação, mesmo se o processo morrer.

**Produção.** Com R-9.4, o start da API passa a ignorar o seed porque a produção já tem usuários: os lotes atuais ficam como estão. Recriar 001–005 exigiria zerar o banco (e o Felipe decide). O seed final é provado em banco vazio (testes, Compose, descartável).

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` (raiz, `DATABASE_URL_TEST` definido) -- expected: exit 0; base: shared 150, api 495, web 416
- `docker compose config -q` -- expected: sem erro
- `npm run seed` duas vezes em banco descartável -- expected: 1ª cria, 2ª imprime "seed ignorado: já existem usuários", exit 0
- `npm audit --omit=dev` -- expected: resultado registrado (Prisma/deepmerge-ts)

**Manual checks (se não há CLI):**
- Chrome real a 320, 390, 1440 e zoom 200%, claro e noite; axe-core sem violação crítica/séria nos fluxos centrais.
- `docker compose up --build` numa pasta limpa até o login da Ana e um lance.
- Smoke público somente de leitura: Vitrine, Sala, comprovante, auditoria, `/health`, 404, `/kit` 404.
