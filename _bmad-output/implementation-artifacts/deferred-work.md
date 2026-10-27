# Trabalho adiado

- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Testar o `useOnReach` (dispara uma vez ao cruzar o alvo, não dispara se o alvo já passou, rearma quando o alvo muda).
  evidence: Nenhum teste cobre o hook; exige extrair a lógica para função pura. AC-2.44 é manual; S03/S04 mexem nesse fluxo.
  resolved: S03, lógica extraída para `reachStep` e testada (commit 8396f74, spec-s03-lances-sala.md).
- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Testar `POST /lots` de leiloeiro apagado (P2003/P2025 → 401) e o `readFixtureImage` do seed com uma imagem real.
  evidence: Nenhum teste contém P2003/P2025; o fixture atual tem `image: null` em todos os carros (fotos do seed só na S09).
  alvo: S09 (junto das fotos do seed; o `placeBid` da S03 tem o mesmo ramo P2003 sem teste)
  resolved: S09, teste do 401 em `POST /lots` (lots.test.ts) e do `readFixtureImage` com arquivo real (showcase.test.ts). O ramo P2003 do `placeBid` segue sem teste próprio (fora do que a fatia pedia).
- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Logar em `warn` o motivo (429, 401/403) quando a FIPE falha, antes de virar 503.
  evidence: `read()` em `infra/fipe.ts` mapeia tudo para `fipeUnavailable()` sem log; a cota esgotada não aparece em produção.
  alvo: S09 (observabilidade)
  resolved: S09, `makeFipeCatalog` recebe o logger e loga `source`, rota, `reason` e `status` antes do 503 (external.test.ts).
- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Limitar `POST /lots` por usuário, como o `/catalog`.
  evidence: Cada POST pode baixar até 4 MB e gravar em BYTEA; só leiloeiro chama e a fatia não pede limite.
  alvo: S09 (o `POST` de lance já tem 30/min desde a S03)
  resolved: S09, 10 por minuto por leiloeiro depois da checagem de papel (lots.rate-limit.test.ts).
- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Tirar da produção o lote 003 criado pelo smoke da S02.
  evidence: Aparece em Agendados e abre sozinho em 28/10; o cancelamento só existe na S06 e o seed final (S09) recria os lotes.
  alvo: S06 (cancelar) ou S09 (o seed final recria os lotes); abre sozinho ao vivo em 28/10, durante a S04
  segue adiado: a S06 entrega a ação de cancelar, mas cancelar o lote em produção é uma escrita no dado do Felipe que não pedi nem fiz (o smoke da S06 usou lote novo). Hoje a numeração em produção já passou do 003 (o lote que o item cita pode ter outro número): o Felipe cancela pelo Painel quando quiser, ou o seed final da S09 recria os lotes.
  segue adiado: escrita em produção sem aval. O seed final (R-9.4) ignora bancos com usuários, então ele não recria nada lá; o Felipe cancela pelo Painel ou decide recriar o banco.
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
  segue adiado (S09 avaliou e recusou): a Sala conta os lances por `bids.length` e `computeMyStanding` calcula a posição no navegador com o histórico inteiro; limitar exigiria `bidCount` e posição no contrato (mudança de produto). Mover só o rank para `groupBy` somaria uma consulta sem tirar a leitura dos lances. Lotes reais têm dezenas de lances.
- source_spec: `_bmad-output/implementation-artifacts/spec-s03-lances-sala.md` (revisão da S03)
  summary: Semear o embaralhamento de `round()` nos testes de concorrência (AC-3.39/3.40) e imprimir a semente na falha; tornar o AC-3.43 determinístico.
  evidence: `bids.test.ts` usa `Math.random` sem semente e o AC-3.43 depende de corrida de tempo; uma falha não se reproduz.
  alvo: S09
  resolved: S09, `seededShuffle` com `TEST_SEED` e semente impressa na falha; AC-3.43 ganhou versão sequencial determinística e a concorrente virou AC-3.43b (bids.test.ts).
- source_spec: `_bmad-output/implementation-artifacts/spec-s03-lances-sala.md` (revisão da S03)
  summary: `seedLiveBids` checar `cancelledAt` e `endsAt` antes de dar os lances (e pular com log), ou corrigir o docstring que diz "ao vivo".
  evidence: `seed/showcase.ts:160-166` só checa que o lote existe e tem `bidCount == 0`; lote cancelado ou encerrado sem lance faz o `placeBid` recusar e o seed lançar. Em produção o lote 001 já tem lances e o `startCommand` ignora falha do seed; o seed final da S09 recria os lotes.
  alvo: S09 (seed final)
  resolved: S06, `seedLiveBids` pula lote cancelado (`cancelledAt`) ou vencido (`endsAt <= agora`) com log, em vez de falhar; teste "pula o lote cancelado ou encerrado sem lance" (spec-s06-cancelamento-estorno.md). O resto do seed final (001 arrematado … 005 ao vivo, fotos) segue com a S09.
  resolved: S09, o seed final (001 arrematado … 005 ao vivo) reescreveu `showcase.ts` sem as quatro funções provisórias (commit e3665fa).
- source_spec: `_bmad-output/progresso.md` (revisão geral S00–S03, item 57)
  summary: Responder 413/400 no envelope quando o corpo passa de 100 KB, em vez de 500 `INTERNAL`.
  evidence: `errors.ts` só trata `entity.parse.failed`; o `entity.too.large` do `express.json()` cai no ramo de erro não tratado (500 e log de erro). Nenhum cliente real manda corpo desse tamanho.
  alvo: S09
  resolved: S09, código `PAYLOAD_TOO_LARGE` (413) no shared e no `errorHandler` (errors.test.ts).
- source_spec: `_bmad-output/progresso.md` (revisão geral S00–S03, item 57)
  summary: Decidir sobre o Prisma 7 (ou `overrides` do `deepmerge-ts`) por causa do `npm audit`.
  evidence: `npm audit --omit=dev` aponta 3 altas na cadeia `prisma` → `@prisma/config` → `deepmerge-ts` (esgotar a pilha ao mesclar objetos recursivos). É o CLI na hora do build, não o servidor; o Prisma 7 foi recusado no T13 porque tira `url`/`directUrl` do schema.
  alvo: S09 (checar de novo antes da entrega)
  segue adiado: `npm audit --omit=dev` em 27/10/2026 repete as mesmas 3 altas (`deepmerge-ts` < 8 via `prisma` → `@prisma/config`), só no CLI do Prisma no build; a correção é o Prisma 7.10.1, que tira `url`/`directUrl` do schema (T13). A exposição é esgotar a pilha ao mesclar o objeto de configuração, que é nosso e não vem de usuário.
- source_spec: `_bmad-output/implementation-artifacts/spec-s04-tempo-real.md`
  summary: `visibilitychange` e `online` do navegador (§9.5): reconectar o socket e refazer o snapshot da página quando a aba volta a ficar visível ou a rede volta.
  evidence: Cortado pela T12 ("se sobrar tempo"). Hoje o socket reconecta sozinho pelo backoff do Socket.IO; aba dormindo no celular pode demorar até o próximo ping para notar a queda.
  alvo: S09 (se sobrar tempo)
  segue adiado: T12 manda cortar primeiro os itens "se sobrar tempo"; o socket já reconecta pelo backoff do Socket.IO.
- source_spec: `_bmad-output/implementation-artifacts/spec-s04-tempo-real.md`
  summary: Flip do Total e do Disponível na Carteira quando o valor muda por evento.
  evidence: Cortado pela T12 ("se sobrar tempo"). O valor e a linha nova do extrato já chegam por `wallet:updated`; só falta a animação.
  alvo: S09 (se sobrar tempo)
  segue adiado: T12, animação decorativa; o valor e a linha já chegam por `wallet:updated`.
- source_spec: `_bmad-output/implementation-artifacts/spec-s04-tempo-real.md`
  summary: Limitar `lot:join` por socket (ou por IP).
  evidence: Cada `lot:join` lê o lote e o histórico inteiro no banco; um cliente pode repetir à vontade. `GET /lots/:id` também não tem limite. Nenhuma fatia pede.
  alvo: S09 (junto do limite de `GET /lots/:id` e do histórico paginado)
  segue adiado: nenhuma fatia pede e depende do item do histórico de `GET /lots/:id`; sem relato de lentidão.
- source_spec: `_bmad-output/implementation-artifacts/spec-s04-tempo-real.md`
  summary: Teste de componente para `useLotRoom`, `useShowcaseLive`, `useWalletLive` e para a fiação da Sala com o banner.
  evidence: O web não tem ambiente de DOM (Vitest em node): a lógica está em funções puras testadas e os hooks foram conferidos só no Chrome real (roteiro do item 62 do diário). Uma regressão na fiação não derrubaria nenhum teste automático.
  alvo: S09 (se decidirem adicionar jsdom ou Playwright)
  segue adiado: a S09 §2 mantém "Vitest + checklist manual" (sem jsdom nem Playwright); o fluxo foi conferido no Chrome real.
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
- source_spec: `_bmad-output/implementation-artifacts/spec-s07-meus-arremates.md`
  summary: Teste de componente para `useMyBids` e para a fiação de `MyBidsScreen` (âncora, anúncio, erro com dados anteriores).
  evidence: O web não tem ambiente de DOM (Vitest em node). A lógica está em funções puras (`my-bid-view`, `my-bids-tabs`, `my-bids-events`) e nos componentes renderizados como HTML estático; o hook, a âncora com foco, a região viva e a faixa de lista desatualizada foram conferidos só no Chrome real (item 83 do diário). Tirar o `useShowcaseLive(MY_BIDS_KEY)` ou o ouvinte de `wallet:updated` não derruba teste automático.
  alvo: S09 (com jsdom ou Playwright, junto dos hooks da S04)
  segue adiado: mesmo motivo (sem ambiente de DOM no repositório).
- source_spec: `_bmad-output/implementation-artifacts/spec-s07-meus-arremates.md`
  summary: Sem polling enquanto há ingresso "apurando": se o `showcase:lot` do fechamento se perder, o selo fica em "APURANDO" até o próximo evento, `wallet:updated` ou reconexão.
  evidence: Decisão do build 6 (a §7 da fatia manda evento, `wallet:updated` e reconexão; o fechamento publica `showcase:lot`). No Chrome real a liquidação trocou o ingresso em segundos, e a queda do socket refez a lista na volta. Se faltar na prática, o caminho é um `refetchInterval` com teto, como o da Vitrine.
  alvo: S09 (só se aparecer na prática)
  segue adiado: não apareceu na prática (Chrome real e link público trocaram o ingresso em segundos).
- source_spec: `_bmad-output/implementation-artifacts/spec-s07-meus-arremates.md`
  summary: Botão "Conferir na auditoria" nos ingressos Perdido e Cancelado (`/lotes/{id}/auditoria`).
  evidence: Oculto de propósito até a S08 (sem botão vazio nem link quebrado); `myBidView` devolve `actions: []` nesses estados e há teste que impede qualquer ação com "auditoria" antes da hora.
  alvo: S08
  resolved: S08, `myBidView` devolve `Conferir na auditoria` nos ingressos Perdido e Cancelado e os testes foram atualizados (spec-s08-auditoria.md).
- source_spec: `_bmad-output/implementation-artifacts/spec-s07-meus-arremates.md`
  summary: Revisão de voz dos textos "(a revisar)" da §8 (frases de Ganhando, Arrematado, Perdido, Cancelado, aba vazia, faixa de desatualizado, anúncios) e picote (`Perforation`) do ingresso.
  evidence: Escritos na fatia por falta de texto nas fontes; o ingresso nasceu com a linha tracejada simples, como a §9 manda ("o picote é acabamento se sobrar tempo"). O ingresso também não usa `CarPhoto`: a §9 não põe foto no ingresso.
  alvo: S09
  resolved: S09, revisão feita sobre todas as frases do `MY_BIDS_TEXT`; sem alteração de texto: ficam curtas, com valor e sem exclamação. A frase "é o 2º maior de N" fica igual à da Sala (texto canônico da S03). O teste de varredura de voz (voice.test.ts) guarda a regra.
- source_spec: `_bmad-output/implementation-artifacts/spec-s07-meus-arremates.md`
  summary: Anunciar a volta a "Você está ganhando" na região viva.
  evidence: A §8 lista só quatro anúncios e `transitionAnnouncement` devolve `null` para `LEADING` (decisão do build 7). Quem está com leitor de tela só ouve quando perde, não quando recupera a frente.
  alvo: S09 (decisão do Felipe)
  segue adiado: decisão do Felipe, sem pedido; o leitor de tela não foi conferido.
- source_spec: `_bmad-output/implementation-artifacts/spec-s08-auditoria.md`
  summary: Teste de DOM da `AuditScreen` (clique repetido em "Verificar de novo" = uma chamada; foco e `aria-expanded` do "ver inteiro").
  evidence: Só há SSR estático e lógica pura; `refetch({ cancelRefetch: false })` e a troca de foco só foram provados no Chrome real (AC-8.24, AC-8.28). Sem jsdom nem Playwright no repositório.
  alvo: S09 (junto do teste de DOM dos hooks da S04, S06 e S07)
  segue adiado: mesmo motivo (sem jsdom nem Playwright).
- source_spec: `_bmad-output/implementation-artifacts/spec-s08-auditoria.md`
  summary: Revisão de voz dos textos "(a revisar)" da §8 da S08 (frases de selo, comprovante e cancelamento, banners, "Como a gente confere") e a decisão de contraste do rótulo "NÃO CONFERE".
  evidence: Escritos na fatia por falta de texto nas fontes. Duas frases saíram da tabela da fatia por falta de caso: "Não há linhas na corrente, mas o selo do lote …" (selo fora com 0 linhas) e "A única linha … confere" (1 linha). "NÃO CONFERE" ficou em tinta com ícone e borda em ferrugem, porque ferrugem sobre o fundo `falha` da linha dá 3,8:1 na noite.
  alvo: S09
  resolved: S09, revisão feita sobre `AUDIT_TEXT` e `CANCEL_TEXT`; sem alteração de texto. "NÃO CONFERE" continua em tinta com ícone e borda em ferrugem (contraste de 3,8:1 da ferrugem sobre `falha` na noite); o axe não acusou a linha nos dois temas.
- source_spec: `_bmad-output/implementation-artifacts/spec-s08-auditoria.md`
  summary: Verificar com leitor de tela que a região viva da auditoria anuncia "Veredito: …" uma única vez e que o banner `role="alert"` é anunciado (AC-8.29), e conferir 390 px em aparelho real.
  evidence: O Chrome headless confirma a região viva (um anúncio) e o banner, mas não substitui leitor de tela nem aparelho.
  alvo: Felipe
- source_spec: `_bmad-output/implementation-artifacts/spec-s06-cancelamento-estorno.md`
  summary: Pendências da revisão da S06: M2 (teste do hook `use-cancel-flow`), B1 (a recusa `LOT_CANCELLED` de lance em voo some quando a Sala troca de painel), B2 (foco pendente se o `refetch` falhar depois de cancelar) e B3 (o seed não depositava antes dos lances do cancelado).
  evidence: Registradas no diário (item da revisão da S06). B3 deixou de existir com o seed final, que deposita antes de qualquer lance.
  alvo: S09 (se coubessem)
  resolved: B3, pelo seed final (e3665fa).
  segue adiado: M2 sem ambiente de DOM; B1 e B2 são janelas de tempo de UI que o repositório não consegue reproduzir sem jsdom, e uma correção sem prova arrisca regressão no fluxo de cancelar, que está entregue e conferido no Chrome real.
- source_spec: `_bmad-output/implementation-artifacts/spec-s09-polimento-entrega.md`
  summary: Verificar com leitor de tela (NVDA) a Sala, Carteira, Comprovante, Criar lote e Auditoria (§9.1 A5, A6, A8, A17) e conferir 390 px e toque em aparelho real.
  evidence: O Chrome headless cobriu axe, teclado, foco, 320/390/640/1440 e os dois temas; leitor de tela e aparelho real não se automatizam aqui.
  alvo: Felipe
