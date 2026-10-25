---
title: 'S04 — Tempo real (Socket.IO: salas, eventos pós-commit, relógio, reconexão)'
type: 'feature'
created: '2026-10-24'
status: 'done'
baseline_commit: 'e7749a847163c3e61ac13245a2668e80c0181b80'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/specs/spec-lanceauto/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-lanceauto/slice-04-tempo-real.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hoje o `Publisher` é um `NoopPublisher`: um lance só aparece em outro navegador depois de recarregar, a prorrogação não chega a quem está olhando, o saldo de quem foi superado não se atualiza e a Vitrine não se mexe. Se o socket cair, nada avisa nem trava o botão.

**Approach:** Implementar a S04 inteira como está na fatia (contrato canônico, §1–§17): `Publisher` do Socket.IO que carimba `serverTime`, salas `lot:{id}`/`showcase`/`user:{id}`, `lot:join`/`lot:leave`/`showcase:join`, `wallet:updated` no depósito e `showcase:lot` no `POST /lots`, e no web o reducer único `applyLotEvent`, os hooks `useLotRoom`, `useShowcaseLive`, `useWalletLive`, `useConnectionStatus` e o `ConnectionBanner`. Mais os três itens do `deferred-work.md` com `alvo: S04`. Deploy no Railway.

## Boundaries & Constraints

**Always:** a fatia vence a arquitetura; T1–T13 do SPEC.md valem sobre a fatia. INV-4: Socket.IO só transmite; evento sai depois do commit e nunca em recusa/erro. INV-1: sem atualização otimista; o relógio é `Date.now() + offset` e `Date.now()` no web só em `lib/server-clock.ts`. `Date`/`Date.now()` proibidos em `apps/api/src` fora de `infra/clock.ts`. O `Publisher` é o único carimbo de `serverTime` (`clock.now()`). Payload de evento sem `userId`/nome/e-mail (INV-13); `wallet:updated` só em `user:{id}`. Contratos em `packages/shared`; `web` não importa `apps/api`. `version` = `entryCount`. Erros do envelope em pt-BR. Dúvida que a fatia não resolve vai para "Perguntas abertas" da fatia, com a sugestão marcada seguida. Deploy no Railway (onde a fatia diz Vercel/Render/Neon, ler Railway; sem hibernação). Os `railway.json` não são lidos pelo Railway: build, start e Watch Paths ficam no painel/API do serviço.

**Never:** emitir `lot:closed` ou `lot:cancelled` (S05/S06; só definir tipos e tratar no cliente); replay de eventos, Redis/adapter, mais de uma instância; reenvio automático de lance; migração de banco; chamar FIPE/Wikipedia em conexão, join ou evento (INV-14); `position: fixed` no `ConnectionBanner`; `Co-Authored-By` ou marca de IA em commits; mexer nos dados de produção além do smoke (e dizer o que criou).

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Saída esperada |
|---|---|---|
| Lance aceito | `POST /lots/L/bids` válido, 2 clientes em `lot:L` | cada um recebe 1 × `bid:placed` (`version == entryCount`, `minimumBidCents`, `serverTime` ISO); `showcase:lot` em `showcase`; `wallet:updated` ao novo líder e ao anterior, ninguém mais |
| Lance recusado | `BELOW_MINIMUM` 422 | nenhum evento de nenhum tipo |
| Publisher lança | publisher que lança em `POST` válido | 201, lance no banco, erro logado |
| Depósito / lote criado | `POST /wallet/deposits`, `POST /lots` | `wallet:updated` só ao dono; `showcase:lot` com o `LotCard` |
| Token ruim no handshake | inválido ou expirado | conecta como visitante, recebe público, nunca `user:*` |
| `lot:join` | existente (qualquer status) / inexistente ou `lotId` inválido | `{ok:true, lot}` igual ao `GET` do mesmo viewer / `{ok:false,error:{code:"NOT_FOUND"}}` e nenhuma sala |
| Cliente em `version` 5 | `bid:placed` 6 / 6 de novo ou 5 / 8 | applied / ignored / refetch sem mexer no estado |
| `lot:closed` | v 5 com estado 5 / v 7 / repetido | applied / refetch / idêntico |
| `lot:cancelled` | v 6 com estado 5 ou 4 / com estado ≥ 6 | refetch / ignored |
| Socket cai (Sala `live`) | rede de A cai | banner em até ~20 s, botão `disabled`, valor digitado e cronômetro preservados |
| Volta | `connect` | `lot:join` + `GET`; histórico sem duplicata; banner "De volta…" por 4 s; botão volta |
| Socket nunca conecta | 1ª visita | banner após 3 s; após 10 s em `connecting` o botão habilita e o lance vai por HTTP |
| Falha ambígua do POST | rede sem resposta | mensagem de §8, sem reenvio, `GET` quando a conexão voltar |

</frozen-after-approval>

## Code Map

- `packages/shared/src/events.ts` -- `EVENTS.LOT_LEAVE`; tipos `LotClosedPayload`, `LotCancelledPayload`, `ShowcaseLotPayload` (= `LotCard` + `serverTime`), `WalletUpdatedPayload`, `LotJoinAck`, `LotEvent` (união dos três de lote). `DomainEvent` **mantém `{ type, room, payload }`** (decisão abaixo).
- `packages/shared/src/bids.ts` -- `BidPlacedPayload` ganha `minimumBidCents`; `computeMyStanding(bids, myPseudonym)` (aproximação; `null` sem pseudônimo ou sem lance); `BID_TEXT.networkAmbiguous` passa ao texto da §8 da fatia.
- `apps/api/src/socket.ts` -- `createSocketServer({webOrigin})` (`Server` sem http, `pingInterval`/`pingTimeout` 10 s, cors) e `registerSocketHandlers(io, {jwtSecret, lots, logger})`: token → `user:{id}` e `socket.data.user`; `lot:join` (entra na sala **antes** do snapshot; `NOT_FOUND` sai da sala), `lot:leave`, `showcase:join`; ack opcional; qualquer outro evento do cliente é ignorado. Salas `lotRoom`/`SHOWCASE_ROOM`/`userRoom` ficam aqui (hoje duplicadas em `bid.service.ts`).
- `apps/api/src/infra/publisher.ts` -- `SocketPublisher(io, clock)` (`io.to(room).emit(type, {...payload, serverTime})`, falha por evento é logada e não interrompe os outros) e `guardPublisher(publisher, logger)`: `try/catch` único com log (deferred S03). `NoopPublisher` continua para testes e seed.
- `apps/api/src/app.ts` -- `composeApp(deps)` devolve `{app, lots}`; `createApp` segue igual (`composeApp(deps).app`) para não mexer nos testes. A composição envolve o publisher recebido com `guardPublisher`. Novo `apps/api/src/realtime.ts`: `createRealtimeServer(deps)` monta `io` → publisher → app → `http.createServer(app)` → `io.attach` (o `io` existe antes do app, sem o buraco do ciclo) e devolve `{httpServer, io, app}`. `server.ts` usa essa função; `shutdown` fecha `io`.
- `apps/api/src/services/{bid,wallet,lot}.service.ts` + `routes/{lots,account}.ts` -- `placeBid` põe `minimumBidCents` no `bid:placed` e deixa de carimbar `serverTime` (o publisher carimba); `deposit` e `createLot` passam a devolver `{response, events}` como o `placeBid` (`wallet:updated` do dono; `showcase:lot` com `toLotCard`); rotas entregam os eventos depois do service. `seed/showcase.ts` e `prisma/seed.ts` ajustam o retorno.
- `apps/web/src/lib/server-clock.ts` -- `syncServerTime(iso, sample?)`: com `{sentAt, receivedAt}` guarda a medição de menor latência (a amostra mais velha que 60 s perde o posto); `clockMark()` é o único `Date.now()` que `api-client.ts` usa. Eventos **não** mexem no offset. Acks do `lot:join` sincronizam.
- `apps/web/src/lib/realtime/` (novo, puro e testado): `lot-reducer.ts` (`applyLotEvent` → `{state, action}`, `applyBidResponse`, `mergeSnapshot` com `snapshot.version >= cache.version`; sai de `lot-state.ts`), `showcase-cache.ts` (`upsertShowcaseCard`, `sortShowcase`, `cardStatusAt`, `upsertMyLot`), `connection-status.ts` (`deriveConnectionStatus`, `connectingPhase`, `bidBlocked`, `nextBanner`, store + `useConnectionStatus`), `panel-decisions.ts` (`isHammered`, `panelSituation`, `lotRefetchInterval`, `createSubmitGuard`; deferred S03).
- `apps/web/src/lib/realtime/{use-lot-room,use-showcase-live,use-wallet-live}.ts` -- `useLotRoom(id)`: `lot:join` no mount (se conectado) e a cada `connect`, depois `GET`, só então "sincronizado"; `lot:leave` no unmount; eventos de outro `lotId` ignorados; `refetch` do reducer marca "desatualizado" (botão inerte) até o `GET` aplicar; falha de ack/GET tenta de novo em 3 s enquanto conectado. `useShowcaseLive()`: `showcase:join` a cada `connect`, `showcase:lot` aplicado em todas as consultas `["lots", …]` e em `["my-lots"]`; lote novo com filtro ativo → `invalidate` com debounce de 500 ms. `useWalletLive()`: `setQueryData(["wallet","summary"])` e `invalidate(["wallet","ledger"])` com debounce de 300 ms; no `connect` invalida `["wallet"]`.
- `apps/web/src/components/connection-banner.tsx` (novo) -- `role="status"` `aria-live="polite"`, no fluxo, sem botão; duas linhas ("Sem sinal…", "Última atualização às hh:mm:ss.") ou uma ("De volta ao pátio. Estado do lote atualizado.", 4 s).
- `apps/web/src/components/{sala,lots/bid-panel,lots/bid-form,lots/cronometro,vitrine,painel-screen}.tsx`, `app/providers.tsx` -- Sala usa `useLotRoom` e `lotRefetchInterval`; `BidPanel`/`BidForm` recebem `blocked` (+ texto em `aria-describedby`) e usam as decisões puras; região oculta "Prorrogado. Novo fim às …" e `key={endsAt}` no selo; Vitrine e Painel com banner e `useShowcaseLive`, consulta a cada 3 s enquanto houver card apurando; `Providers` monta `useWalletLive` e o rastreio de conexão. `lib/use-socket-connected.ts` (sem uso) sai se nada o importar.
- `README.md`, `slice-04-tempo-real.md` (§16, §17), `progresso.md`, `deferred-work.md` -- seção de tempo real (sem hibernação no Railway; deploy reinicia e o socket reconecta), perguntas abertas, DoD, linha `resolved:` nos três itens.

## Tasks & Acceptance

**Execution (ordem; um commit atômico por bloco; `git push` ao fim de cada etapa):**
- [x] `packages/shared` -- eventos, payloads, `minimumBidCents`, `computeMyStanding`, texto ambíguo; testes.
- [x] `apps/api` socket + publisher + composição -- `socket.ts`, `publisher.ts`, `app.ts`, `realtime.ts`, `server.ts`; `socket.test.ts` na nova assinatura; testes de `guardPublisher` e `SocketPublisher`.
- [x] `apps/api` services e rotas -- eventos de depósito e `POST /lots`, `bid:placed` sem `serverTime` próprio e com `minimumBidCents`; ajuste de seed e dos testes existentes.
- [x] `apps/api` integração do tempo real (§14, itens 1–9) -- `socket.io-client` em porta efêmera com Postgres real; AC-4.2, 4.3, 4.5 a 4.12, 4.18, 4.19, 4.28, 4.32; paridade `computeMyStanding` × `myRank` do servidor.
- [x] `apps/web` libs puras + testes -- relógio, reducer, `mergeSnapshot`, cache da Vitrine/Painel, status de conexão, decisões do painel (AC-4.13 a 4.15, 4.29 e os adiados do S03).
- [x] `apps/web` hooks, banner e telas -- Sala, painel de lance, Vitrine, Painel, Carteira/chip, `Providers`.
- [x] Documentação -- README, fatia (§16, §17), `deferred-work.md`, diário.
- [x] Verificação -- `lint`, `typecheck`, `test`, `build` com exit 0; Chrome real com 2+ clientes e queda de rede; deploy Railway, CI verde, smoke público.

**Acceptance Criteria:** AC-4.2 a 4.3, 4.5 a 4.15, 4.18, 4.19, 4.28, 4.29, 4.32 [auto]; AC-4.1, 4.4, 4.16, 4.17, 4.20 a 4.27, 4.30, 4.31 [manual] (conferidos no Chrome local; o que não for possível fica como pendência do Felipe, sem marcar como feito); §17 adaptada ao Railway.

**Fora desta rodada, por ordem de corte da T12:** §9.5 (`visibilitychange` e `online`) e o flip da Carteira ("se sobrar tempo").

## Decisões do build (a registrar em "Perguntas abertas" da fatia)

1. **`DomainEvent` fica `{ type, room, payload }`.** A S00 (slice e código) define `type`; a §7 da S04 diz que a forma é "definida na S00" e escreve `event`, uma citação errada. Renomear não muda comportamento e quebraria a S00 sem ganho.
2. **R-4.10 tem duas frases em tensão** (só HTTP e acks ajustam o offset × "evento só ajusta se `serverTime` for maior"). Fica a primeira, a mais segura: evento nunca mexe no offset; o `serverTime` do estado só avança.
3. **Texto de falha ambígua:** S03 ("Sem resposta do pátio. Seu lance pode ou não ter entrado…") × S04 §8 ("Não deu para confirmar o lance…"). A S04 é posterior e o AC-4.21 a nomeia: vale a da S04; o teste da S03 acompanha.
4. **Aviso de prorrogação:** só a região oculta anuncia ("Prorrogado. Novo fim às …"); o parágrafo visível não é `aria-live`, para o leitor não ler duas vezes.
5. **Render/Vercel/Neon → Railway:** cold start e nota de hibernação viram "deploy reinicia a API e os sockets reconectam"; a DoD de dois navegadores roda no domínio público do Railway.

## Implementation Notes

Implementado direto, sem subagente de implementação (o pedido não os autorizava). A camada de revisão (step-04) **não rodou**: ela exige revisores em paralelo; fica para o `bmad-code-review` se o Felipe pedir, como na S03. O que fiz no lugar: reli o diff inteiro, três mutações nos testes do web (o salto de `version`, o bloqueio por `reconnecting` e o descarte de cartão velho: todas derrubaram testes) e uma mutação na API (tirar o `guardPublisher`: os testes do AC-4.10 viraram 500). Um erro meu no caminho: um `git checkout` que usei para desfazer a mutação também descartou as edições ainda não commitadas de `app.ts`; refiz as cinco e conferi com typecheck e testes.

Verificação, saída real e roteiros do navegador: itens 61 a 63 do `progresso.md`. Decisões do build: perguntas 4 a 12 da §16 da fatia.

Não conferido: leitor de tela real; Firefox e Safari; Tab pelos controles novos; `visibilitychange` (não implementado, T12); a queda de rede no Railway com corte de verdade (só a emulação do Chrome); teste automático dos hooks (`useLotRoom` e cia. só foram exercitados no Chrome).

## Spec Change Log

## Review Triage Log

### Revisão de 25/10/2026 (`bmad-code-review`, diff `e7749a8..4732436`)

Quatro revisores em paralelo (Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor). Cada achado foi conferido no código antes do veredito. Nenhuma violação de INV/T: Socket.IO só transmite; eventos saem depois do commit e nunca em recusa; sem atualização otimista; nada de `Date` fora de `infra/clock.ts` na API; payloads sem `userId`, nome, e-mail ou token; `web` não importa `api`; ordem de locks e `Bid` append-only intocados. Resultado: 11 corrigidos, 3 adiados, 15 descartados.

### Review Findings

- [x] [Review][Patch] Bloqueio "desatualizado" se soltava com o `GET` do salto falho e sem nova tentativa; trocar de lote com o `GET` em voo deixava o botão inerte para sempre (§9.1, R-4.9 b) [apps/web/src/lib/realtime/use-lot-room.ts] — `6fac29d`, `createGapResync` + 5 testes; a mutação "solta na falha" derruba 2.
- [x] [Review][Patch] `GET` do join que volta depois da queda marcava a conexão como sincronizada; na volta a página ficava `live` antes do novo join [apps/web/src/lib/realtime/connection-status.ts] — `749f529`; a mutação derruba 2 testes.
- [x] [Review][Patch] Login e logout (`disconnect()` do próprio cliente) apareciam como queda: "Sem sinal" e "De volta ao pátio" por 4 s e lance travado [apps/web/src/lib/realtime/connection-status.ts] — `28ad7cf`; a mutação derruba 1 teste.
- [x] [Review][Patch] Medição de offset velha não expirava quando o relógio do aparelho voltava (R-4.10) [apps/web/src/lib/server-clock.ts] — `b5dc0c5`; a mutação derruba 1 teste.
- [x] [Review][Patch] AC-4.28 só vigiava a FIPE; a Wikipedia falhava calada numa porta morta [apps/api/src/realtime.test.ts] — `cd54c9f`; uma chamada indevida no `getLotState` agora derruba o teste.
- [x] [Review][Patch] Teste do AC-4.10 prometia `POST /lots` e só chamava o depósito [apps/api/src/realtime.test.ts] — `004a62b`; sem o guarda no `lotsRouter`, cai.
- [x] [Review][Patch] Nenhum teste de isolamento entre salas de lote [apps/api/src/realtime.test.ts] — `692826f`; um publisher que emite para todos derruba o teste.
- [x] [Review][Patch] Recuo quebrado no depósito do seed [apps/api/prisma/seed.ts] — `d1abc87`.
- [x] [Review][Patch] `FORBIDDEN_KEYS` sem `auctioneerId` e `token` (T9) [apps/api/test/helpers/bids.ts] — `ccc05cd`.
- [x] [Review][Patch] Testes do `apiClient` com `Date.now` congelado não provavam a medição de menor latência [apps/web/src/lib/api-client.test.ts] — `3e7aada`; voltar a `syncServerTime(serverTime)` derruba o teste.
- [x] [Review][Patch] DoD da fatia com dois itens `[x]` que o próprio texto diz pendentes (leitor de tela, dois aparelhos, Tab) [_bmad-output/specs/spec-lanceauto/slice-04-tempo-real.md] — `650c0c0`, reabertos como pendência do Felipe.
- [x] [Review][Defer] `live` vale para o app todo, não por página: vindo da Vitrine, a Sala libera o lance antes do próprio join + `GET` (§10) [apps/web/src/lib/realtime/connection-status.ts] — deferred: janela curta, servidor valida; zerar ao montar traria banner a cada navegação; sugestão marcada no `deferred-work.md` (alvo S05).
- [x] [Review][Defer] AC-4.18 e AC-4.19 provados só pela metade: o fluxo de reconexão do cliente (`useLotRoom`, `queryFn` da Sala) e a fiação do `BidForm` não têm teste [apps/web/src/lib/realtime/use-lot-room.ts] — deferred: sem DOM no Vitest do web; já era adiado; a parte estática cabe em `renderToStaticMarkup` (alvo S09).
- [x] [Review][Defer] Vitrine consulta a cada 3 s sem teto enquanto houver cartão "apurando", e sem a S05 o lote vencido fica apurando para sempre [apps/web/src/components/vitrine.tsx] — deferred: é o que a §9.2 pede; a S05 tira o cartão de lá (alvo S05).

**Descartados:**

- `false`: texto "Sem sinal…" sob o botão nos 3 s iniciais. A tabela da §9 diz que `connecting` tem "Botão de lance desabilitado com o texto de bloqueio".
- `false`: Painel sem consulta de 3 s. A §9.3 da fatia não pede (a fatia vence a frase do Code Map).
- `false`: `NOT_FOUND` do join tirando a sala de um join posterior. Id inexistente não passa a existir (o servidor gera os ids); o join seguinte também dá `NOT_FOUND`.
- `low`/contrato: falta `showcase:leave`. O contrato da §7 só tem `showcase:join`; o handler sai no unmount, o custo é só banda.
- Spec: o snapshot do ack é descartado e o cliente refaz o `GET`. A §9.1 manda join e depois `GET`; o custo da leitura dupla já está no adiado do limite de `lot:join`.
- `low`: ao montar, a Vitrine cancela o fetch inicial com o `refetchQueries` do join. É inofensivo.
- `low`: bloqueio `stale` sem texto. A §9 diz "trata como `reconnecting` sem banner"; o texto de bloqueio fala de sinal, o que seria errado aqui, e um texto novo seria contrato. Só acontece em salto de `version`.
- `low`: contagens da Vitrine atrás do `cardStatusAt`. O `useRefetchAtNextDeadline` refaz o `GET` 1 s depois do `startsAt`.
- `low`: fases de 3 s e 10 s recomeçam a cada página montada. Só acontece com o WebSocket bloqueado e com navegação; o conserto exige um estado de tempo no módulo.
- Pré-existente (S00): eventos sem zod e `DomainEvent.payload: unknown`. Mudar isso seria mudança de contrato.
- `low`/contrato: `wallet:updated` sem ordem. Não há `version` no contrato; a corrida entre socket e HTTP de operações diferentes é improvável, e o próximo evento ou consulta corrige.
- `low`: o `INTERNAL` do join mantém o socket na sala. É inofensivo, porque o cliente tenta o join de novo em 3 s.
- `low`: `applyBidResponse` perde o `myRank` do servidor quando o evento chega antes. O `BidForm` invalida o lote depois do 201, e o `GET` traz o valor do servidor.
- Spec: INV-1 × "evento não mexe no offset". É uma decisão registrada (pergunta 5 da §16).
- `low`: a prova pós-commit do AC-4.2 é fraca. A garantia é estrutural (o service só devolve os eventos depois da transação) e não há teste confiável que a quebre.

**Fechamento:** `lint`, `typecheck`, `test` (shared 77, api 278, web 195) e `build` com exit 0; deploy do `833468c` no Railway (web e API `SUCCESS`), `/health` ok e smoke público 11/11 (lance sem recarregar, "Você foi superado", queda e volta, logout sem banner). Status `in-review` → `done`: nenhum achado bloqueante sobrou.
