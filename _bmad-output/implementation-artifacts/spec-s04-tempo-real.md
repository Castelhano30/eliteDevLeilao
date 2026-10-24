---
title: 'S04 — Tempo real (Socket.IO: salas, eventos pós-commit, relógio, reconexão)'
type: 'feature'
created: '2026-10-24'
status: 'ready-for-dev'
baseline_commit: 'pendente'
route: 'dispatch'
review_loop_iteration: 0
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
- [ ] `packages/shared` -- eventos, payloads, `minimumBidCents`, `computeMyStanding`, texto ambíguo; testes.
- [ ] `apps/api` socket + publisher + composição -- `socket.ts`, `publisher.ts`, `app.ts`, `realtime.ts`, `server.ts`; `socket.test.ts` na nova assinatura; testes de `guardPublisher` e `SocketPublisher`.
- [ ] `apps/api` services e rotas -- eventos de depósito e `POST /lots`, `bid:placed` sem `serverTime` próprio e com `minimumBidCents`; ajuste de seed e dos testes existentes.
- [ ] `apps/api` integração do tempo real (§14, itens 1–9) -- `socket.io-client` em porta efêmera com Postgres real; AC-4.2, 4.3, 4.5 a 4.12, 4.18, 4.19, 4.28, 4.32; paridade `computeMyStanding` × `myRank` do servidor.
- [ ] `apps/web` libs puras + testes -- relógio, reducer, `mergeSnapshot`, cache da Vitrine/Painel, status de conexão, decisões do painel (AC-4.13 a 4.15, 4.29 e os adiados do S03).
- [ ] `apps/web` hooks, banner e telas -- Sala, painel de lance, Vitrine, Painel, Carteira/chip, `Providers`.
- [ ] Documentação -- README, fatia (§16, §17), `deferred-work.md`, diário.
- [ ] Verificação -- `lint`, `typecheck`, `test`, `build` com exit 0; Chrome real com 2+ clientes e queda de rede; deploy Railway, CI verde, smoke público.

**Acceptance Criteria:** AC-4.2 a 4.3, 4.5 a 4.15, 4.18, 4.19, 4.28, 4.29, 4.32 [auto]; AC-4.1, 4.4, 4.16, 4.17, 4.20 a 4.27, 4.30, 4.31 [manual] (conferidos no Chrome local; o que não for possível fica como pendência do Felipe, sem marcar como feito); §17 adaptada ao Railway.

**Fora desta rodada, por ordem de corte da T12:** §9.5 (`visibilitychange` e `online`) e o flip da Carteira ("se sobrar tempo").

## Decisões do build (a registrar em "Perguntas abertas" da fatia)

1. **`DomainEvent` fica `{ type, room, payload }`.** A S00 (slice e código) define `type`; a §7 da S04 diz que a forma é "definida na S00" e escreve `event`, uma citação errada. Renomear não muda comportamento e quebraria a S00 sem ganho.
2. **R-4.10 tem duas frases em tensão** (só HTTP e acks ajustam o offset × "evento só ajusta se `serverTime` for maior"). Fica a primeira, a mais segura: evento nunca mexe no offset; o `serverTime` do estado só avança.
3. **Texto de falha ambígua:** S03 ("Sem resposta do pátio. Seu lance pode ou não ter entrado…") × S04 §8 ("Não deu para confirmar o lance…"). A S04 é posterior e o AC-4.21 a nomeia: vale a da S04; o teste da S03 acompanha.
4. **Aviso de prorrogação:** só a região oculta anuncia ("Prorrogado. Novo fim às …"); o parágrafo visível não é `aria-live`, para o leitor não ler duas vezes.
5. **Render/Vercel/Neon → Railway:** cold start e nota de hibernação viram "deploy reinicia a API e os sockets reconectam"; a DoD de dois navegadores roda no domínio público do Railway.

## Implementation Notes

## Spec Change Log

## Review Triage Log
