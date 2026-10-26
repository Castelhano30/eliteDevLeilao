---
title: 'S05 — Fechamento, liquidação e comprovante'
type: 'feature'
created: '2026-10-26'
status: 'in-progress'
baseline_commit: '3ec052b6763d50ad4006c2411ddf387ca4c654d8'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-lanceauto/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-lanceauto/slice-05-fechamento-comprovante.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Um lote que chega ao fim fica em `CLOSING` para sempre: ninguém o liquida, o vencedor não paga, o leiloeiro não recebe, não existe comprovante e a Sala, a Vitrine e o Painel não mostram resultado. A Vitrine ainda consulta a cada 3 s sem teto por causa disso, e o `live` da conexão vale para o app inteiro.

**Approach:** Implementar a S05 inteira como está na fatia (§1–§17): rotina de fechamento (`start()` no boot + varredura inicial + `setInterval` de 5 s) que liquida cada lote numa transação (`settleLot`), `Receipt` com token público, `GET /receipts/:token`, `result`/`myReceiptToken` no `GET /lots/:id`, `resultado`/`totalReceivedCents` no `GET /my/lots`, eventos `lot:closed`/`showcase:lot`/`wallet:updated` depois do commit, e no web a Sala encerrada nos 4 estados, o Comprovante `/c/[token]`, o Painel, a Vitrine e a Carteira. Mais os dois itens do `deferred-work.md` com `alvo: S05` e o seed estendido via services com `FakeClock`. Deploy no Railway.

## Boundaries & Constraints

**Always:** a fatia vence a arquitetura e o EXPERIENCE; T1–T13 valem sobre a fatia. Servidor é a verdade de tempo, saldo e valor (sem atualização otimista). `Date`/`Date.now()` proibidos em `apps/api/src` fora de `infra/clock.ts`; `createdAt`/`at`/`settledAt` com `clock.now()` lido **depois** do lock. Ordem de locks: lote (`FOR UPDATE`, aqui `SKIP LOCKED`) → carteiras por `userId` ascendente. Mutação só por service; eventos devolvidos pelo service e entregues ao `Publisher` depois do commit de cada lote. `GET` nunca liquida. `Bid` append-only; a liquidação não escreve na cadeia (`finalHash = lastHash`). Ids são TEXT (nunca `::uuid`). Token do comprovante: 24 bytes `base64url`, só no `GET /lots/:id` do vencedor e na URL do comprovante; nenhum DTO, evento ou resposta pública o carrega; DTO público sem `userId`, nome ou e-mail. Dinheiro em centavos (`BigInt` no banco, `number` nas bordas). Erro no envelope pt-BR. Contratos em `packages/shared`; `web` não importa `api`. Onde a fatia diz Neon/Render/Vercel, ler Railway (sem hibernação). Seed idempotente (roda em todo deploy; falha dele não derruba o start). `DomainEvent` é `{ type, room, payload }`. Commits atômicos em português, sem `Co-Authored-By` nem marca de IA; push ao fim de cada etapa; diário `progresso.md` do item 66 em diante.

**Never:** cancelamento e estorno (S06), Meus arremates (S07), qualquer link para a Auditoria e `RECEIPT_MISMATCH` (S08), texto final do README (S09). Teto de liquidação ou retentativa com alarme. Criar lote, conta ou depósito em produção além do smoke pedido (lote novo de 5 min com as contas do seed, sem apagar nada). `git checkout` em arquivo com edição não commitada (copiar antes). `Date.now()` no web fora de `lib/server-clock.ts` e dos formatadores. Remover o texto "SHA-256": o rótulo é HMAC-SHA256.

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Saída esperada | Erro |
|---|---|---|---|
| Com lances | `endsAt <= now`, `settledAt` nulo, Ana líder com R$ 32.000 | Ana: total −32.000 e comprometido −32.000; leiloeiro total +32.000; 1 `Receipt`; `settledAt = now`; `lot:closed` SOLD + `showcase:lot` + `wallet:updated` (Ana e leiloeiro) | N/A |
| Sem lances | vencido, `bidCount = 0` | só `settledAt`; sem `Receipt`/ledger; `lot:closed` UNSOLD sem `finalBidCents` | N/A |
| Corrida | 10 × `settleLot` + 3 × `sweep` | 1 `Receipt`, 1 débito, 1 crédito, 1 `settledAt` | sem deadlock nem unicidade vazando |
| Fronteira | lance de Bruno × `sweep` em `now == endsAt` | lance `LOT_ENDED`, sem HOLD; depois do 2º `sweep` o lote liquida para Ana | N/A |
| Não elegível | `now = endsAt − 1 ms`, lance prorroga | `sweep` pula; avançado o relógio, liquida para Bruno | N/A |
| Cancelado / já liquidado | `cancelledAt` ou `settledAt` | nada acontece; lance com `settledAt` preenchido → `LOT_ENDED` | N/A |
| Falha isolada | 3 vencidos, 1 com CHECK quebrado | 2 liquidam; o 3º sem `settledAt`, erro logado, tentado de novo | `sweep` nunca rejeita |
| Comprovante | `GET /receipts/:token` certo / inexistente, curto ou inválido | 200 `ReceiptDTO` sem dados pessoais, `no-store` / 404 `NOT_FOUND` idêntico | web: 404 só se a API disse 404; timeout 8 s → esqueleto + "Tentar novamente" |
| Sala | `CLOSING` / `SOLD` com e sem `myReceiptToken` / `UNSOLD` | Apurando / "Você arrematou" + "Ver comprovante" / "Licitante XXXX levou" / "Sem lances" | pseudônimo nunca decide quem venceu |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` + nova migração -- `Receipt` (§5) com relações em `Lot` e `User`; SQL pelo `migrate diff` contra o banco real, como a `add_bid`.
- `apps/api/src/services/settlement.service.ts` (novo) -- `settleLot(lotId)`: tx única; `SELECT … FOR UPDATE SKIP LOCKED` do lote elegível, `now` lido depois do lock, carteiras `ORDER BY userId FOR UPDATE`, `tx.wallet.update` com `updatedAt: now`, `SALE_DEBIT`/`SALE_CREDIT` com `totalAfter`/`committedAfter`, `Receipt` (pseudônimo do `Bid` vencedor, `finalHash = lastHash`), eventos. Devolve `SettleOutcome` (tipo na API). Reusa `toNumber`, `toWalletDto`, `toLotCard`, `LOT_SELECT`, `lotRoom`/`SHOWCASE_ROOM`/`userRoom`.
- `apps/api/src/infra/settlement-job.ts` (novo) -- `start()`/`stop()`/`sweep(publisher?)`; flag de não reentrada; listagem de candidatos sem lock (`endsAt <= now AND settledAt IS NULL AND cancelledAt IS NULL`); tudo em `try/catch` com log de erro; `unref()`; `stop()` espera o `sweep` em curso.
- `apps/api/src/app.ts`, `realtime.ts`, `server.ts` -- `composeApp` monta o service e o job (publisher já guardado) e os devolve; `server.ts` chama `start()` depois do `listen` e `stop()` no shutdown antes de fechar o `io`.
- `apps/api/src/domain/bid-rules.ts` + `services/bid.service.ts` -- `settledAt` entra no `SELECT` e nas regras: `LOT_ENDED` também com `settledAt != null` (R-5.11), mantendo a ordem do INV-8.
- `apps/api/src/services/lot.service.ts`, `lot-mappers.ts` -- `getLotState` acrescenta `result` e `myReceiptToken` (lê o `Receipt` só para lote liquidado com lances; compara `winnerId` com o viewer); `myLots` acrescenta `resultado` e `totalReceivedCents` (soma de `SALE_CREDIT` do usuário).
- `apps/api/src/services/receipt.service.ts` + `routes/receipts.ts` (novos) -- `GET /receipts/:token` público, `Cache-Control: no-store`, formato `^[A-Za-z0-9_-]{32}$`; 404 idêntico; `receiptCode`, `hammerAt = endsAt`.
- `packages/shared/src/` -- `receipts.ts` (`ReceiptDTO`, `receiptCode`, padrão do token, textos de §8), `lots.ts` (`LotResult`, `LotState.result`/`myReceiptToken`, `MyLotCard`), `texts.ts` (`SALE_DEBIT` com número do lote e nota), `index.ts`.
- `apps/api/prisma/seed.ts`, `src/seed/showcase.ts` -- `seedClosedLots` pelos services (`createLot` com `allowPast`, `placeBid`, `settleLot`) com `FakeClock` em `agora − 3 dias`: lote arrematado por Ana (4 lances alternados, o último a `fim − 40 s` prorroga +2 min) e lote sem lances; idempotente por título; imprime `/c/{token}`; saldo do seed cobre os lances.
- `apps/web/src/lib/realtime/` -- `use-lot-room.ts` (`syncing` por montagem, `lot:closed` refaz o `GET`), `lot-reducer.ts`, `panel-decisions.ts` (`lotRefetchInterval` com 3 s também para encerrado sem `result`), `showcase-cache.ts`/`vitrine.tsx` (teto do polling de 3 s), `connection-status.ts`; `lib/lot-state.ts` (`closing` em título + subtítulo); novos puros: decisão do estado da Sala, variação sobre a FIPE, copiar link.
- `apps/web/src/components/` -- `sala.tsx` + `resultado-do-lote` (4 estados), `app/c/[token]/` (`page.tsx`, `not-found.tsx`, cliente de erro/retry), `recibo`, `botao-copiar-link`, `codigo-de-barras` (cortável), `painel-screen.tsx` (Total recebido, ARREMATES, cartões com vencedor e FIPE), `lots/lot-card.tsx`, `wallet-screen.tsx`/`lib/format.ts` (`Arremate · lote NNN`); cabeçalho mínimo no `/c/*` sem o `SiteHeader`.
- Docs -- `slice-05` (§16 com Railway, perguntas, §17), `deferred-work.md` (`resolved:` nos dois itens), `README.md` (nota do fechamento e de `settledAt` × `endsAt`, sem hibernação), `progresso.md` (66+).

## Tasks & Acceptance

O build corre em **duas fases**, cada uma numa sessão de contexto próprio. A Fase 1 é só servidor e termina deployável; a Fase 2 é só web e fecha a fatia. Entre as duas o estado fica no diário ("Onde parei") e neste spec, para a Fase 2 começar sem reler a Fase 1. Um commit atômico por bloco; `git push` ao fim de cada etapa; baseline = commit deste spec.

### Fase 1 — Servidor: fechamento, liquidação, comprovante e seed (shared + `apps/api`)

**Execution:**
- [x] Linha de base -- `npm run lint`, `typecheck`, `test` com saída real (esperado shared 77, api 278, web 195).
- [x] `packages/shared` -- tipos, `receiptCode`, textos, `LotResult`/`MyLotCard`; testes.
- [x] Migração `Receipt` + `settleLot` + regra `LOT_ENDED` por `settledAt` -- AC-5.1, 5.2, 5.5, 5.8, 5.9, 5.19.
- [x] Rotina (`settlement-job`) + composição + boot -- AC-5.3, 5.4, 5.6, 5.7, 5.10, 5.11, 5.12; testes de concorrência com **prova de mutação** (tirar `SKIP LOCKED`/releitura/`UNIQUE` derruba o teste; cópia de segurança antes, nunca `git checkout` em edição não commitada).
- [x] Leituras e eventos -- `GET /receipts/:token`, `result`/`myReceiptToken`, `resultado`/`totalReceivedCents`, `lot:closed`/`showcase:lot`/`wallet:updated`; AC-5.13 a 5.18; varredura de privacidade (e-mail, nome, `userId`, token fora do dono) em `/receipts`, `/lots/:id`, `/lots`.
- [x] Seed estendido -- cadeia válida, idempotente; teste do seed.
- [x] Fechamento da fase -- `lint`, `typecheck`, `test`, `build` na raiz com saída real no diário; push; CI verde; deploy da API no Railway `SUCCESS` (o web antigo segue funcionando, a mudança é aditiva); log da API com as liquidações do seed; `GET /receipts/{token do seed}` 200 e sem dados pessoais no link público. Diário (item 66+) e "Onde parei" com o que a Fase 2 precisa saber (contratos finais, token de demonstração, decisões novas).

**Fora da Fase 1:** qualquer arquivo de `apps/web`, README, `resolved:` do `deferred-work.md`, lote de 5 min em produção.

### Fase 2 — Web: Sala, Comprovante, Painel, Vitrine, Carteira, verificação e entrega (`apps/web`)

**Execution:**
- [x] Retomada -- ler o diário, este spec e a §16 da fatia; `lint`, `typecheck`, `test` como linha de base da fase (esperado: os números fechados na Fase 1).
- [x] Web puro -- decisões da Sala, FIPE, copiar link, `syncing` por página, teto do polling; testes.
- [x] Web telas -- Sala, Comprovante, Painel, Vitrine, Carteira; "se sobrar tempo" por último: picote, código de barras, variação decorativa (T12).
- [x] Documentação -- §16 e §17 da fatia, `resolved:` nos dois itens do `deferred-work.md`, README, diário.
- [x] Verificação -- `lint`, `typecheck`, `test`, `build` na raiz; Chrome real (roteiro de 7 passos, Comprovante anônimo nos dois temas, lote de 5 min com dois navegadores, `GET /lots` parando depois do fechamento); deploy Railway `SUCCESS`, CI verde, smoke público com lote novo de 5 min.

**Acceptance Criteria:** AC-5.1 a 5.19 [auto] fecham na Fase 1; AC-5.20 a 5.31 [manual] na Fase 2 (conferidos no Chrome local e no link público; o que não der fica como pendência do Felipe, sem marcar feito); §17 adaptada ao Railway. Pendências do Felipe (S03, S04, S05 e conferência visual do login): conferidas por ele em 26/10/2026.

## Decisões do build (a registrar na §16 da fatia)

1. **Railway no lugar de Neon/Render/Vercel:** a DoD "migração aplicada no deploy" vale para o start da API no Railway; a nota de README sobre hibernação não se aplica. O Railway não lê `railway.json`: o start (migrate deploy, seed, servidor) fica no serviço.
2. **`DomainEvent` é `{ type, room, payload }`** (a fatia escreve `event` em alguns pontos).
3. **`sweep(publisher?)`:** o job recebe o publisher guardado na composição; o argumento é opcional (a fatia mostra os dois usos).
4. **Seed:** Ana vence o lote semeado; ledger e `Wallet.updatedAt` das linhas do seed ficam com data de 3 dias atrás, fora da ordem do `seq` (efeito do `FakeClock`, só cosmético).
5. **`lot:closed` no cliente:** aplica o evento e refaz o `GET`; encerrado sem `result` conta como "apurando" e a Sala consulta a cada 3 s até chegar.
6. **`live` por página:** `useLotRoom` devolve `syncing` enquanto o socket está conectado e a montagem não fez join + `GET` (bloqueio `stale`, sem banner).
7. **Polling da Vitrine:** teto de respostas novas (padrão da conferência de abertura); zera quando não há cartão apurando.

## Implementation Notes

Implementado direto, sem subagente (o pedido não os autorizava e a sessão pediu contexto curto). A camada de revisão (step-04) **não rodou**: ela exige revisores em paralelo; fica para o `bmad-code-review` se o Felipe pedir.

**Fase 1 (servidor), 26/10/2026.** Commits `d9ecbbc` a `da460ea`; saída real e roteiros no diário, itens 66 e 67. Decisões e achados que a Fase 2 precisa saber:

- `result` e `myReceiptToken` ficam dentro de `LotState.lot` (junto de `myPseudonym`); `MyLotsResponse.lots` é `MyLotCard[]` (`LotCard` + `resultado`). O cartão do `showcase:lot` **não** leva `resultado` nem pseudônimo do vencedor: `upsertMyLot` já mantém o `resultado` da linha e o `GET /my/lots` traz o novo quando o lote vira `SOLD`/`UNSOLD`.
- `lot:closed` não traz `result` nem token; o cliente aplica o evento (status e valor) e refaz `GET /lots/:id` para obter `result` e `myReceiptToken`. Um `GET` que ainda volte sem `result` num lote `SOLD`/`UNSOLD` deve ser tratado como "apurando" até chegar.
- `receiptPath(token)`, `copyLinkAriaLabel(n)`, `COPIED_LABEL_MS`, `RECEIPT_TEXT` e `isReceiptToken` estão em `@lanceauto/shared`; `saleDebitLabel(lotNumber)` e `saleDebitNote(cents)` também (a Carteira deve usá-los no lugar de `LEDGER_LABEL.SALE_DEBIT`).
- O seed imprime `Comprovante de demonstração: /c/{token}`; no Railway o token fica no log do start da API.
- Prova de mutação: o que garante a unicidade é a releitura de `settledAt` sob o lock (sem ela, 3 testes caem); o `SKIP LOCKED` sozinho não derruba nenhum teste, porque `FOR UPDATE` simples também relê depois da espera.
- Exceção desta fase em `apps/web`: só `fixtures.ts` e `upsertMyLot` (necessários para o typecheck); nenhuma tela mudou.

**Fase 2 (web), 26/10/2026.** Implementada direto, sem subagente. Commits `8040dae` a `e7f3f52` mais o de documentação; saída real, roteiros e o smoke no diário (itens 69 a 72). Decisões novas, também na §16 da fatia: a Sala encerrada reaproveita o `BidPanel` (região viva estável), `(site)`/`(publico)` como route groups, "Voltar à vitrine" só para visitante e leiloeiro, teto de 20 respostas no polling da Vitrine. A revisão em paralelo (step-04) segue **não rodada**.

## Spec Change Log

## Review Triage Log

## Verification

Cada fase fecha com os quatro comandos abaixo na raiz e a saída real no diário.

**Commands:**
- `npm run lint` -- expected: exit 0
- `npm run typecheck` -- expected: exit 0
- `npm test` -- expected: exit 0 (linha de base shared 77, api 278, web 195; só sobem)
- `npm run build` -- expected: exit 0 (shared → api → web)

**Manual checks:**
- Chrome real (playwright-core do cache do npx, banco descartável, API compilada na 4100, `next start` na 3100, `localhost`, `textContent`): os 7 passos do roteiro da §1 da fatia, Comprovante em janela anônima nos dois temas, lote de 5 min fechando ao vivo com dois navegadores, contagem de `GET /lots` parando depois do fechamento.
- Produção: CI verde, Railway web e API `SUCCESS`, log da API com as liquidações, smoke com lote novo de 5 min (contas do seed, nada apagado).
