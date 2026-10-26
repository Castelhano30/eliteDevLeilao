# Trabalho adiado

- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Testar o `useOnReach` (dispara uma vez ao cruzar o alvo, não dispara se o alvo já passou, rearma quando o alvo muda).
  evidence: Nenhum teste cobre o hook; exige extrair a lógica para função pura. AC-2.44 é manual; S03/S04 mexem nesse fluxo.
  resolved: S03, lógica extraída para `reachStep` e testada (commit 8396f74, spec-s03-lances-sala.md).
- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Testar `POST /lots` de leiloeiro apagado (P2003/P2025 → 401) e o `readFixtureImage` do seed com uma imagem real.
  evidence: Nenhum teste contém P2003/P2025; o fixture atual tem `image: null` em todos os carros (fotos do seed só na S09).
  alvo: S09 (junto das fotos do seed; o `placeBid` da S03 tem o mesmo ramo P2003 sem teste)
- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Logar em `warn` o motivo (429, 401/403) quando a FIPE falha, antes de virar 503.
  evidence: `read()` em `infra/fipe.ts` mapeia tudo para `fipeUnavailable()` sem log; a cota esgotada não aparece em produção.
  alvo: S09 (observabilidade)
- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Limitar `POST /lots` por usuário, como o `/catalog`.
  evidence: Cada POST pode baixar até 4 MB e gravar em BYTEA; só leiloeiro chama e a fatia não pede limite.
  alvo: S09 (o `POST` de lance já tem 30/min desde a S03)
- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Tirar da produção o lote 003 criado pelo smoke da S02.
  evidence: Aparece em Agendados e abre sozinho em 28/10; o cancelamento só existe na S06 e o seed final (S09) recria os lotes.
  alvo: S06 (cancelar) ou S09 (o seed final recria os lotes); abre sozinho ao vivo em 28/10, durante a S04
  segue adiado: a S06 entrega a ação de cancelar, mas cancelar o lote em produção é uma escrita no dado do Felipe que não pedi nem fiz (o smoke da S06 usou lote novo). Hoje a numeração em produção já passou do 003 (o lote que o item cita pode ter outro número): o Felipe cancela pelo Painel quando quiser, ou o seed final da S09 recria os lotes.
- source_spec: `_bmad-output/specs/spec-lanceauto/slice-03-lances-sala.md` (revisão geral antes da S03, grupo 1)
  summary: Gravar `Wallet.updatedAt` explicitamente (`clock.now()`) nos `INSERT`/`UPDATE` crus da S03.
  evidence: `Wallet.updatedAt` é NOT NULL sem `DEFAULT` na migração `contas_e_carteira`; só o `@updatedAt` do Prisma Client o preenche, então um `UPDATE` cru não o renova e um `INSERT` cru falha.
  resolved: S03, `tx.wallet.update` com `updatedAt: now`, sem UPDATE/INSERT cru de carteira (commit 87ec1d0, spec-s03-lances-sala.md).
- source_spec: `_bmad-output/specs/spec-lanceauto/slice-03-lances-sala.md` (revisão geral antes da S03, grupo 1)
  summary: Acrescentar CHECKs em `Lot` na migração da S03: `bidCount >= 0`, `entryCount >= 0` e `currentBidCents IS NULL OR currentBidCents >= startingBidCents`.
  evidence: A migração `lots_and_items` só cobre lance inicial, incremento e datas; nada impede o contador ou o lance atual de ficar inválido quando a S03 passar a escrevê-los.
  resolved: S03, migração `add_bid` (commit a95efee, spec-s03-lances-sala.md).
- source_spec: `_bmad-output/specs/spec-lanceauto/slice-03-lances-sala.md` (revisão geral antes da S03, grupo 1)
  summary: Fazer o join com `Lot` no extrato para preencher `LedgerEntryDto.lotNumber`.
  evidence: O slice-01 (linhas 113 e 348) atribuiu o join à S02, mas `apps/api/src/services/mappers.ts:29` ainda devolve `lotNumber: null`; a S03 cria HOLD/RELEASE com `lotId` e o extrato mostraria "lote null".
  resolved: S03, `lotNumber` por `lot.findMany({id in})` em `wallet.service` (commit 87ec1d0, spec-s03-lances-sala.md).
- source_spec: `_bmad-output/implementation-artifacts/spec-s03-lances-sala.md` (revisão da S03)
  summary: Proteger `publisher.publish(events)` com `try/catch` e log em `POST /lots/:id/bids`, e testar com um publisher que lança.
  evidence: `routes/lots.ts:118` publica depois do commit sem guarda; se o publisher lançar, o lance entrou e o cliente recebe 500. Hoje o publisher é `NoopPublisher`; decidir junto do publisher do Socket.IO (S04).
  alvo: S04 (obrigatório: entra com o `Publisher` do Socket.IO)
  resolved: S04, `guardPublisher` envolve o publisher em `composeApp` (um ponto só protege `POST /lots/:id/bids`, o depósito e `POST /lots`); teste com publisher que lança: 201, lance no banco e erro logado; mutação feita, sem o guarda a resposta vira 500 (spec-s04-tempo-real.md).
- source_spec: `_bmad-output/implementation-artifacts/spec-s03-lances-sala.md` (revisão da S03)
  summary: No reducer da Sala (`applyLotEvent`): detectar salto de `version` (refaz o GET), atualizar `status` e parar de recalcular `minimumBidCents` (pôr o campo no `BidPlacedPayload`).
  evidence: `lot-state.ts:49-70` soma `currentBidCents + minIncrementCents` e aceita evento com `version > atual + 1`. Sem efeito hoje (só a resposta do próprio lance usa o reducer); aparece com os eventos da S04.
  alvo: S04 (R-4.14 troca o reducer)
  resolved: S04, `applyLotEvent` em `lib/realtime/lot-reducer.ts` pede o GET no salto de `version`, atualiza o `status` e usa o `minimumBidCents` do payload (spec-s04-tempo-real.md).
- source_spec: `_bmad-output/implementation-artifacts/spec-s03-lances-sala.md` (revisão da S03)
  summary: Extrair em funções puras e testar as decisões inline de `BidPanel` (`hammered`, situação), `Sala.refetchInterval` e `BidForm` (`inFlight`).
  evidence: Nenhum teste de componente além de `ui.test.tsx`; inverter `Date.parse(endsAt) <= now` ou tirar o `inFlight.current` mantém tudo verde. Conferido à mão no Chrome (itens 51 e 52).
  alvo: S04 (junto do reducer e do `useLotRoom`)
  resolved: S04, `isHammered`, `panelSituation`, `lotRefetchInterval` e `createSubmitGuard` em `lib/realtime/panel-decisions.ts`, com teste. A ligação dessas funções aos componentes (e o `inFlight` no `BidForm`) segue sem teste de componente: o web não tem ambiente de DOM.
- source_spec: `_bmad-output/implementation-artifacts/spec-s03-lances-sala.md` (revisão da S03)
  summary: Limitar o histórico de `GET /lots/:id` e calcular o rank no banco (`groupBy`) em vez de em memória.
  evidence: `lot.service.ts` (`getLotState`) lê todos os `BID` do lote a cada GET público, e a Sala refaz o GET a cada 2-3 s perto do fim. Já é a pergunta 5 da fatia.
  alvo: S09, ou antes se a Sala ficar lenta com histórico longo
- source_spec: `_bmad-output/implementation-artifacts/spec-s03-lances-sala.md` (revisão da S03)
  summary: Semear o embaralhamento de `round()` nos testes de concorrência (AC-3.39/3.40) e imprimir a semente na falha; tornar o AC-3.43 determinístico.
  evidence: `bids.test.ts` usa `Math.random` sem semente e o AC-3.43 depende de corrida de tempo; uma falha não se reproduz.
  alvo: S09
- source_spec: `_bmad-output/implementation-artifacts/spec-s03-lances-sala.md` (revisão da S03)
  summary: `seedLiveBids` checar `cancelledAt` e `endsAt` antes de dar os lances (e pular com log), ou corrigir o docstring que diz "ao vivo".
  evidence: `seed/showcase.ts:160-166` só checa que o lote existe e tem `bidCount == 0`; lote cancelado ou encerrado sem lance faz o `placeBid` recusar e o seed lançar. Em produção o lote 001 já tem lances e o `startCommand` ignora falha do seed; o seed final da S09 recria os lotes.
  alvo: S09 (seed final)
  resolved: S06, `seedLiveBids` pula lote cancelado (`cancelledAt`) ou vencido (`endsAt <= agora`) com log, em vez de falhar; teste "pula o lote cancelado ou encerrado sem lance" (spec-s06-cancelamento-estorno.md). O resto do seed final (001 arrematado … 005 ao vivo, fotos) segue com a S09.
- source_spec: `_bmad-output/progresso.md` (revisão geral S00–S03, item 57)
  summary: Responder 413/400 no envelope quando o corpo passa de 100 KB, em vez de 500 `INTERNAL`.
  evidence: `errors.ts` só trata `entity.parse.failed`; o `entity.too.large` do `express.json()` cai no ramo de erro não tratado (500 e log de erro). Nenhum cliente real manda corpo desse tamanho.
  alvo: S09
- source_spec: `_bmad-output/progresso.md` (revisão geral S00–S03, item 57)
  summary: Decidir sobre o Prisma 7 (ou `overrides` do `deepmerge-ts`) por causa do `npm audit`.
  evidence: `npm audit --omit=dev` aponta 3 altas na cadeia `prisma` → `@prisma/config` → `deepmerge-ts` (esgotar a pilha ao mesclar objetos recursivos). É o CLI na hora do build, não o servidor; o Prisma 7 foi recusado no T13 porque tira `url`/`directUrl` do schema.
  alvo: S09 (checar de novo antes da entrega)
- source_spec: `_bmad-output/implementation-artifacts/spec-s04-tempo-real.md`
  summary: `visibilitychange` e `online` do navegador (§9.5): reconectar o socket e refazer o snapshot da página quando a aba volta a ficar visível ou a rede volta.
  evidence: Cortado pela T12 ("se sobrar tempo"). Hoje o socket reconecta sozinho pelo backoff do Socket.IO; aba dormindo no celular pode demorar até o próximo ping para notar a queda.
  alvo: S09 (se sobrar tempo)
- source_spec: `_bmad-output/implementation-artifacts/spec-s04-tempo-real.md`
  summary: Flip do Total e do Disponível na Carteira quando o valor muda por evento.
  evidence: Cortado pela T12 ("se sobrar tempo"). O valor e a linha nova do extrato já chegam por `wallet:updated`; só falta a animação.
  alvo: S09 (se sobrar tempo)
- source_spec: `_bmad-output/implementation-artifacts/spec-s04-tempo-real.md`
  summary: Limitar `lot:join` por socket (ou por IP).
  evidence: Cada `lot:join` lê o lote e o histórico inteiro no banco; um cliente pode repetir à vontade. `GET /lots/:id` também não tem limite. Nenhuma fatia pede.
  alvo: S09 (junto do limite de `GET /lots/:id` e do histórico paginado)
- source_spec: `_bmad-output/implementation-artifacts/spec-s04-tempo-real.md`
  summary: Teste de componente para `useLotRoom`, `useShowcaseLive`, `useWalletLive` e para a fiação da Sala com o banner.
  evidence: O web não tem ambiente de DOM (Vitest em node): a lógica está em funções puras testadas e os hooks foram conferidos só no Chrome real (roteiro do item 62 do diário). Uma regressão na fiação não derrubaria nenhum teste automático.
  alvo: S09 (se decidirem adicionar jsdom ou Playwright)
- source_spec: `_bmad-output/implementation-artifacts/spec-s04-tempo-real.md` (revisão da S04)
  summary: Fazer o `live` valer por página: a Sala só libera o lance depois do próprio `lot:join` + `GET`, não pelo `markSynced` que a Vitrine ou o Painel deram antes.
  evidence: `connection-status.ts` guarda um `synced` só para o app todo. Vindo da Vitrine com o socket conectado, a Sala abre `live` (botão liberado) antes do join dela; se o join dela falhar com `INTERNAL` em sequência, segue `live` fora de `lot:{id}`. A §10 diz "`live` só depois do join + snapshot HTTP aplicado". Janela curta e o servidor valida com `expectedCurrentCents`. Zerar o `synced` ao montar faria a Sala mostrar "Sem sinal" e "De volta" a cada navegação, por isso não entrou na revisão. **Sugestão:** `useLotRoom` devolve `syncing = true` enquanto o socket está conectado e esta montagem ainda não fez join + `GET` (bloqueio `stale`, sem banner nem texto de conexão).
  alvo: S05 (mexe na Sala)
  resolved: S05, `useLotRoom` devolve `syncing` por montagem (`pageSyncing` em `connection-status.ts`, commit 55d86a8, spec-s05-fechamento-comprovante.md); mutação feita, sem o `joined` ou sem o `connected` os testes caem; no link público o botão "Dar lance" liberou depois do join + GET nas três jogadas do smoke.
- source_spec: `_bmad-output/implementation-artifacts/spec-s04-tempo-real.md` (revisão da S04)
  summary: AC-4.18 e AC-4.19 só estão provados pela metade: falta o fluxo de reconexão do cliente (`useLotRoom` → `lot:join` → `GET` → `mergeSnapshot` no `queryFn` da Sala).
  evidence: O teste da API compara o ack com o `GET` e o do web chama `mergeSnapshot` à mão; trocar o `queryFn` da Sala por `fetchLot` direto, ou tirar o `if (blockReason !== null) return` do `BidForm`, não derruba nenhum teste. A parte de apresentação já dá para testar sem DOM com `renderToStaticMarkup`, como o `balance-chip.test.tsx` faz (texto de bloqueio e `aria-describedby` do `BidForm`, o `ConnectionBanner`). Complementa a entrada dos testes de componente acima.
  alvo: S09 (com jsdom ou Playwright; a parte estática pode entrar antes)
- source_spec: `_bmad-output/implementation-artifacts/spec-s04-tempo-real.md` (revisão da S04)
  summary: A Vitrine refaz `GET /lots` a cada 3 s, sem teto, enquanto houver cartão "apurando".
  evidence: É o que a §9.2 pede, mas sem a rotina de fechamento (S05) um lote vencido fica `CLOSING` para sempre, e cada visitante da Vitrine aberta faz uma consulta a cada 3 s. A conferência de abertura tem teto (`OPENING_CHECKS`); esta não.
  alvo: S05 (o `showcase:lot` do fechamento tira o cartão de "apurando"; conferir que o polling para em produção)
  resolved: S05, `showcaseRefetchInterval` com teto de 20 respostas novas e zera sem cartão apurando (commit 55d86a8, spec-s05-fechamento-comprovante.md); mutações feitas; no Chrome real local e no link público o `GET /lots` parou depois do `showcase:lot` do fechamento (0 consultas em 14 s e em 15 s).
