---
id: S04
titulo: Tempo real (salas, eventos, relógio, reconexão)
depende_de: [S00, S01, S02, S03]
cobre: [RT, R10, E4, AC6, AC7, CLK]
parcial: [T1, T3, T4, T7, UX-RECON]
fontes_de_origem: [PRD Arquitetura/Tempo real, PRD AC6 e AC7, AD-1, AD-10, Eventos Socket.IO, EXPERIENCE Interaction Primitives/Tempo real e relógio, EXPERIENCE State Patterns/Sala, triagem P16 P33 P34]
---
# S04 — Tempo real

## 1. Objetivo e demonstração

Tudo que a S03 só mostrava depois de recarregar passa a chegar sozinho: um lance, a prorrogação, o saldo, o cartão da vitrine. Quando o socket cai, a tela avisa, trava o envio de lance e, na volta, se reconcilia pelo HTTP sem duplicar nada.

Roteiro de demonstração (dois navegadores, seed da S03):
1. Navegador 1: licitante A logado na Sala do lote ao vivo. Navegador 2: licitante B logado na mesma Sala. Navegador 3: visitante na mesma Sala. Navegador 4: Vitrine aberta.
2. B dá um lance no mínimo. Em até 2 s, sem recarregar, A e o visitante veem a placa virar, a linha nova no topo do histórico e o contador de lances subir; o cartão do lote na Vitrine mostra o novo lance; A passa a "Você foi superado" e o chip de saldo de A volta a "DISPONÍVEL" cheio.
3. Em um lote com menos de 2 min, B dá lance: o cronômetro de todos recebe o selo "+2 MIN" e o aviso "Novo fim às hh:mm:ss".
4. Derrube a rede do navegador 1 (DevTools → Offline): aparece "Sem sinal com o pátio. Tentando reconectar." e o botão "Dar lance" fica inerte, o valor digitado permanece.
5. Com o navegador 1 offline, B dá mais um lance. Volte a rede do navegador 1: a faixa vira "De volta ao pátio. Estado do lote atualizado.", o lance perdido aparece uma única vez e o botão volta.
6. Licitante A deposita R$ 10.000 numa segunda aba: o chip de saldo da primeira aba atualiza sozinho.

## 2. Fora desta fatia

| Item | Fatia |
| --- | --- |
| Rotina de fechamento, `lot:closed` sendo emitido, Sala em todos os estados de encerramento, "Apurando o resultado…" | S05 |
| `lot:cancelled` sendo emitido, Sala cancelada, Painel "Cancelar" | S06 |
| `GET /me/bids` e atualização de Meus arremates por evento | S07 |
| Auditoria ao vivo (é retrato com "Verificar de novo", sem stream) | S08 |
| Adapter Redis / mais de uma instância da API | fora de escopo (Deferred) |
| Replay de eventos perdidos (a reconciliação é snapshot, não replay) | fora de escopo |
| Chave de idempotência de lance (reenvio idêntico cai em `BELOW_MINIMUM`/`OWN_LEAD` pela ordem da S03; a UI previne com o botão inerte durante o envio) | fora de escopo |

## 3. Ponto de partida

Já existe (S00–S03; confirmar nomes no código):
- API: `DomainEvent` e `Publisher` com `NoopPublisher` (S00); Socket.IO montado no mesmo servidor aceitando `auth.token` opcional (S00) e validando o JWT para entrar em `user:{id}` (S01); services que devolvem `DomainEvent[]` (bid, depósito, criação de lote) e rotas que os entregam ao `Publisher` depois do commit (S01–S03); `Clock`/`FakeClock`.
- Shared: nomes de eventos (S00), `LotCard`, `LotState`, `lotStatus` (S02), DTO de lance (S03).
- Web: `socket` singleton sem salas (S00), `apiClient`, TanStack Query, `useServerClock` alimentado só por respostas HTTP (S02), `Cronometro` com `SeloProrrogacao` (S02), Sala com painel de lance, `PlacarPosicao`, `FaixaStatus`, histórico (S03), Vitrine/Painel/Carteira/BalanceChip lendo por HTTP (S01–S03).
- `LotState` carrega `bids[]` públicos, `entryCount`, `endsAt`, `originalEndsAt`, `serverTime`, e se logado `myPseudonym/myRank/myBestBidCents`. **Nome único:** `LotState`, `LotSummary` (S03) e `LotCard` expõem `version` (= `entryCount` depois da operação) e mantêm `entryCount` como alias de compatibilidade. O reducer e o cache do cliente leem **só `version`**; os eventos usam só `version`. Se `version` ainda não está em `packages/shared`, adicionar agora (retrofit na S03: nomear o campo `version` na resposta do lance, no `GET /lots/:id` e no `bid:placed`).

Invariantes que valem aqui:
- INV-1 Servidor é fonte de verdade de tempo, saldo e valores. Sem atualização otimista; relógio da tela = `Date.now()+offset` (offset = serverTime − Date.now(), recalculado só em respostas HTTP e acks, ver R-4.10).
- INV-4 Toda mutação por REST via service; Socket.IO só transmite (exceto `lot:join`/`showcase:join` que respondem snapshot). Service devolve `DomainEvent[]`; a rota entrega ao `Publisher` DEPOIS do commit.
- INV-3 Datas ISO UTC com `Z` (ms). `new Date()`/`Date.now()` proibidos em `apps/api/src` fora de `infra/clock.ts`. No web, `Date.now()` só dentro de `serverClock` (e `Date` nos formatadores de data). UI mostra America/Sao_Paulo.
- INV-9 Prorrogação: lance aceito com `endsAt − now <= 2 min` ⇒ `endsAt = now + 2 min`; sem teto; `originalEndsAt` nunca muda.
- INV-13 Privacidade: DTO público NUNCA contém userId, nome ou e-mail. Eventos de sala só levam pseudônimo; saldo só vai para `user:{id}`.
- INV-14 Telas públicas leem só o banco; nenhum evento depende de FIPE/Wikipedia.
- INV-16 Toda resposta de estado de lote traz `serverTime`.
- INV-17 Contratos de evento vivem em `packages/shared`.

## 4. Regras de negócio

| # | Regra | Origem |
| --- | --- | --- |
| R-4.1 | Evento só sai depois do commit da transação que o gerou. Se a transação falha ou a recusa ocorre, nada é publicado. | PRD Tempo real · AD-1 |
| R-4.2 | Falha ao publicar (socket, serialização) é logada e NÃO derruba a requisição HTTP já confirmada. | AD-1 |
| R-4.3 | O `Publisher` é o único lugar que carimba `serverTime` nos payloads (`clock.now()` em ISO UTC). | AD-10 |
| R-4.4 | Uma sala por lote (`lot:{id}`), uma sala `showcase` pública, uma sala privada `user:{id}` atribuída só pelo servidor a partir do JWT. O cliente não pode pedir `user:*`. | AD (Eventos) |
| R-4.5 | `version` de eventos de lote = `entryCount` do lote DEPOIS da operação. Lance e cancelamento incrementam `entryCount` (cancelamento grava a linha CANCEL na cadeia); fechamento não incrementa. | AD-8 · AD-5 |
| R-4.6 | Regra do cliente para `bid:placed` e `lot:cancelled`: aplicar se `version == atual + 1`; ignorar se `version <= atual`; se `version > atual + 1` há salto: não aplicar, refazer `GET /lots/:id`. Exceção: `lot:cancelled` não traz `cancelledAt` no payload, então mesmo com `version == atual + 1` o reducer devolve `refetch` (o estado só fecha depois do `GET`; o cliente não presume). | AD (Eventos) |
| R-4.7 | `lot:closed` é terminal e idempotente: aplicar se `version >= atual` (não descartar quando igual, porque o fechamento não incrementa `entryCount`); se `version > atual` fazer também `GET` (houve salto). | Esclarecimento de AD (Eventos) — ver §16 |
| R-4.8 | A reconciliação ao (re)conectar é um `GET /lots/:id` por HTTP, feito DEPOIS de emitir `lot:join` (entrar na sala primeiro evita buraco entre snapshot e eventos). O snapshot só substitui o cache se `snapshot.version >= cache.version`. | PRD Tempo real (“recarrega o estado por HTTP”) · AD (`lot:join`) |
| R-4.9 | A Sala NÃO envia lance em dois casos: (a) `reconnecting` (já esteve `live` e caiu) e (b) refetch em andamento por salto de `version`. Em `connecting` (primeira conexão) o lance fica bloqueado só nos primeiros 10 s; passado esse prazo, o botão é habilitado mesmo sem socket, porque o servidor valida tudo (`expectedCurrentCents`) e o requisito central do PRD (dar lance) não pode depender do WebSocket (CORS/transport falhando no deploy). Nunca há reenvio automático de lance após falha ambígua (sem resposta/timeout). | EXPERIENCE P16 (ajustada) · ARCHITECTURE-SPINE (páginas aceitam ficar sem socket) |
| R-4.10 | O relógio exibido é `endsAt − (Date.now() + offset)`. O offset é recalculado **só em respostas HTTP e acks**, guardando a medição de menor latência observada (o atraso de rede de cada evento não entra no offset, senão o cronômetro dá saltos). Um evento só ajusta o offset se o seu `serverTime` for maior que o último `serverTime` aceito (evento atrasado ou fora de ordem não mexe no relógio). O relógio do aparelho nunca decide nada. | AD-10 · AC6 |
| R-4.11 | Prorrogação é percebida por todos: o evento traz `endsAt` novo e `extended: true`; cronômetro, selo "+2 MIN" e aviso atualizam em todas as telas abertas do lote, não só na de quem deu o lance. | PRD R10 · AC6 |
| R-4.12 | Cada licitante só recebe `wallet:updated` da própria carteira: o novo líder (HOLD) e o líder anterior (RELEASE). | PRD R8 · AD (Eventos) |
| R-4.13 | `showcase:lot` carrega `version` (= `entryCount`). O upsert do cartão descarta o evento se `version < card.version` (dois lances quase simultâneos podem publicar fora de ordem e o cartão ficaria com o valor antigo); em `lot:closed`/`SOLD`/`UNSOLD` aplica com `>=` (fechamento não incrementa `entryCount`). | Decisão desta fatia (derivada de AD (Eventos)) |
| R-4.14 | **Um único reducer**: `applyLotEvent` (§10) substitui o `applyBid` da S03 para todos os eventos de lote; a resposta do `POST` de lance também passa por ele. | Decisão desta fatia |

## 5. Modelo de dados

Nenhuma mudança de banco, nenhuma migração.

## 6. Contratos REST

Nenhuma rota nova. Mudanças de comportamento (ver §15): as rotas de S01–S03 passam a entregar eventos reais ao `Publisher` (hoje `NoopPublisher`). `GET /lots/:id` devolve `version` (= `entryCount`; `entryCount` segue como alias).

## 7. Contratos Socket.IO

Conexão (cliente): `io(API_URL, { autoConnect: false, auth: (cb) => cb({ token: getToken() }) })` — `auth` como **função**, para que cada (re)conexão leia o token atual; no login/logout/cadastro faz `socket.disconnect(); socket.connect()`. Token válido ⇒ servidor entra o socket em `user:{userId}`. Token ausente, inválido ou expirado ⇒ conecta como visitante (sem erro). Reconexão automática do cliente: padrão do Socket.IO (atraso 1 s crescendo até 5 s, tentativas infinitas). Servidor: `new Server(http, { pingInterval: 10000, pingTimeout: 10000, cors })` — a queda é detectada em até ~20 s (os padrões 25 s + 20 s deixam a Sala parecendo viva por até 45 s).

**Cliente → servidor**

| Evento | Payload | Ack |
| --- | --- | --- |
| `lot:join` | `{ lotId: uuid }` | `{ ok: true, lot: LotState }` (snapshot atual, personalizado se há token: `myPseudonym/myRank/myBestBidCents`) ou `{ ok: false, error: { code: "NOT_FOUND" } }` (lote inexistente ou `lotId` inválido). Entra o socket em `lot:{lotId}` ANTES de montar o snapshot. Lote agendado, cancelado e encerrado também aceitam join. |
| `lot:leave` | `{ lotId: uuid }` | nenhum. Sai da sala. Adição técnica mínima à lista da arquitetura (ver §16). |
| `showcase:join` | — | nenhum. Entra em `showcase`. |

O `SocketProvider` é um singleton no layout raiz: a Sala monta **depois** de o socket já estar conectado, então o evento `connect` não dispara de novo. Por isso o hook `useLotRoom(lotId)` emite `lot:join` **no mount, se `socket.connected`, e também a cada evento `connect`** (reconexões), e `lot:leave` no unmount; `useShowcaseLive()` faz o mesmo com `showcase:join` (Vitrine e Painel). Sem isso a Sala nunca entra em `lot:{id}`. Qualquer outro evento enviado pelo cliente é ignorado.

**Servidor → cliente** (todo payload carrega `serverTime` ISO UTC, carimbado pelo `Publisher`)

| Evento | Sala | Payload | Quando é emitido |
| --- | --- | --- | --- |
| `bid:placed` | `lot:{id}` | `{ lotId, version, bid: { seq, pseudonym, amountCents, at }, currentBidCents, bidCount, bidderCount, endsAt, extended, serverTime }` | Lance aceito (S03). `extended` = este lance prorrogou o fim. `version` = `entryCount` novo (= `bid.seq`). `bidderCount` = licitantes distintos (o servidor calcula; o cliente não deduz por pseudônimo). |
| `lot:closed` | `lot:{id}` | `{ lotId, version, outcome: "SOLD"\|"UNSOLD", finalBidCents?, winnerPseudonym?, finalHash?, serverTime }` | Definido aqui, emitido na S05. |
| `lot:cancelled` | `lot:{id}` | `{ lotId, version, serverTime }` | Definido aqui, emitido na S06. |
| `showcase:lot` | `showcase` | `LotCard` (com `version`) + `serverTime` | Lote criado (S02, retrofit), lance/prorrogação (S03), fechamento (S05), cancelamento (S06). |
| `wallet:updated` | `user:{id}` | `{ totalCents, committedCents, availableCents, serverTime }` | Depósito (S01, retrofit); lance aceito: ao novo líder e ao líder anterior (se houver); fechamento: vencedor e leiloeiro (S05); cancelamento: líder estornado (S06). |

Ordem de emissão de um lance: `bid:placed` (sala do lote) → `showcase:lot` → `wallet:updated` do novo líder → `wallet:updated` do líder anterior. Todos pós-commit.

Forma do `DomainEvent` (definida na S00): `{ room, event, payload }`; o `Publisher` faz `io.to(room).emit(event, { ...payload, serverTime })`.

## 8. Mensagens

Textos novos desta fatia (todos "texto a revisar"; a voz é a do pátio, sem exclamação):

| Situação | Onde | Texto |
| --- | --- | --- |
| Conexão perdida / reconectando | ConnectionBanner | "Sem sinal com o pátio. Tentando reconectar." |
| Segunda linha do banner, com dados antigos na tela | ConnectionBanner | "Última atualização às {hh:mm:ss}." |
| Reconectado e snapshot aplicado (some em 4 s, sugestão de tempo) | ConnectionBanner | "De volta ao pátio. Estado do lote atualizado." |
| Lance bloqueado por falta de conexão | Sala, ao lado do botão | "Sem sinal com o pátio. O lance volta a ficar disponível quando a conexão voltar." |
| Falha ambígua do envio (rede caiu sem resposta) | Sala, `mensagem-recusa` | "Não deu para confirmar o lance. Confira o histórico antes de tentar de novo." |
| Prorrogação | Sala, parágrafo de aviso | "Lance nos 2 minutos finais: o relógio ganhou +2 min. Novo fim às {hh:mm:ss}. Ninguém leva no susto." |
| Anúncio único dos últimos 2 min (região viva oculta) | Sala | "Últimos 2 minutos." |
| Anúncio a cada prorrogação (região viva oculta) | Sala | "Prorrogado. Novo fim às {hh:mm:ss}." |
| Falha de carga com a rede (lista da Vitrine/Painel/Carteira) | FeedbackState | "Não deu para atualizar. Mostrando o que tínhamos." + botão "Tentar novamente" |

Códigos: ack de `lot:join` usa `NOT_FOUND` do envelope padrão; não há códigos novos.

## 9. Telas e estados

### 9.1 Sala (`/lotes/[id]`)

Estados novos de conexão (somam-se aos de lance da S03; ficam em cima do painel de lance, no fluxo normal da página, nunca `position: fixed`):

| Estado de conexão | Tratamento |
| --- | --- |
| `connecting` (primeira conexão, antes do 1º snapshot) | Dados do SSR/HTTP visíveis. Botão de lance desabilitado com o texto de bloqueio. Sem banner até 3 s; passados 3 s, banner "Sem sinal com o pátio. Tentando reconectar." (cobre cold start do Render, que pode levar dezenas de segundos). **Passados 10 s em `connecting`, o botão de lance é habilitado** (R-4.9): o servidor valida com `expectedCurrentCents`, e o lance não pode ficar inerte se o WebSocket falhar no deploy. |
| `live` | Sem banner. Botão de lance habilitado pelas regras da S03. |
| `reconnecting` (caiu depois de estar `live`) | ConnectionBanner com as duas linhas. Cronômetro continua contando com o último offset. Dados antigos permanecem visíveis. Botão "Dar lance" desabilitado (`disabled` real) + texto de bloqueio em `aria-describedby`. Valor digitado e atalhos preservados. |
| Reconectou, snapshot HTTP aplicado | Banner "De volta ao pátio. Estado do lote atualizado." por 4 s e some; botão volta. |
| Desatualizado (salto de `version` detectado, refetch em andamento) | Trata como `reconnecting` sem banner: botão desabilitado até o `GET` aplicar. |

Comportamento ao vivo:
- **Novo lance de outro licitante:** placa vira (`la-vira`), linha nova entra no topo do histórico (`la-entra` + `la-marca`), contador de lances sobe, `PlacarPosicao` recalcula, campo de lance sobe para o novo mínimo SE o usuário não editou o campo (se editou, o valor fica e a regra "Mínimo aceito agora" passa a mostrar o novo mínimo). Para o licitante superado a faixa troca para "Você foi superado" e o rodapé do campo vira "Nada travado neste lote".
- **Lance do próprio usuário:** a resposta HTTP aplica o estado; o `bid:placed` que chega depois com o mesmo `version` é descartado (R-4.6). Sem duplicar linha.
- **Posição:** o servidor é a verdade (`myRank`, `myBestBidCents` e `bidderCount` no snapshot do `GET`/ack e `bidderCount` no `bid:placed`). Entre snapshots, o cliente usa `computeMyStanding(bids, myPseudonym)` (função pura em `packages/shared`) **só como aproximação**: `myBestBidCents` = maior lance com `pseudonym == myPseudonym`; `myRank = 1 + nº de pseudônimos distintos cujo maior lance > myBestBidCents`; N = `bidderCount` do evento quando houver. Com colisão de 4 hex no pseudônimo o valor local pode divergir; o próximo snapshot (incluindo o `GET` após o lance e após reconectar) o substitui. Sem `myPseudonym` (visitante, leiloeiro, nunca deu lance) retorna `null`.
- **Prorrogação (`extended: true` ou `endsAt > originalEndsAt`):** `SeloProrrogacao` "+2 MIN" no `Cronometro` (animação `la-mais` a cada nova prorrogação, estática em reduced-motion) e parágrafo de aviso com o novo fim. O aviso e o selo ficam até o encerramento. Vale para todo espectador.
- **Últimos 2 min:** `Cronometro` na variante alerta quando `restante <= 120 000 ms` (inclusive, alinhado a INV-9; se a S02 usou `<`, trocar para `<=`). Após uma prorrogação o restante fica ≈ 2:00 e o cronômetro permanece em "ÚLTIMOS 2 MIN" (não volta ao normal).
- **00:00 local:** o botão de lance fica desabilitado assim que o relógio chega a 0; o resultado só aparece pelo servidor (S05). Aqui basta o bloqueio.
- **Eventos de outro lote** (ex.: o usuário navegou de uma Sala para outra) são ignorados pelo `lotId`.

Acessibilidade: ConnectionBanner `role="status"` `aria-live="polite"`. Parágrafo de aviso de prorrogação e a região oculta de "Últimos 2 minutos"/"Prorrogado…" são `aria-live="polite"` e visualmente ocultas só a região de anúncio. O cronômetro NÃO anuncia a cada segundo. A lista do histórico NÃO é live (o `PlacarPosicao`/`FaixaStatus` anuncia a mudança de situação). Recusas seguem `role="alert"`.

### 9.2 Vitrine (`/`)

- Entra em `showcase` a cada `connect`. `showcase:lot` faz upsert do `LotCard` no cache da lista (por `id`; descarta o evento se `version < card.version`, R-4.13), reordena (ao vivo por `endsAt↑`, agendado por `startsAt↑`, encerrado por `endsAt↓`) e recalcula a barra "Pátio aberto" (N ao vivo, N agendados).
- Card com `status = CANCELLED` é removido da lista.
- Lote NOVO (id desconhecido) com filtro/busca ativos (`q` ou marca ou aba ≠ Todos): não decidir no cliente; `invalidate` da consulta com debounce de 500 ms para o servidor aplicar o filtro. Sem filtro: inserir direto. (**Se sobrar tempo:** o debounce com filtro; o mínimo é ignorar o lote novo e deixar a próxima consulta resolver.)
- Migração de seção por tempo: agendado→ao vivo em `startsAt` é calculado no cliente com `lotStatus(card, now)` e o relógio do servidor (sem evento). Ao vivo→encerrado só quando o servidor confirmar: um card com `endsAt` passado e status ainda `LIVE/CLOSING` fica em "Ao vivo" com cronômetro "00:00" e rótulo "Apurando o resultado…" e a consulta da lista é refeita a cada 3 s enquanto existir card assim (a S05 emite o evento que o tira de lá).
- Cronômetro do card ao vivo usa o mesmo offset e reflete prorrogação (novo `endsAt` do evento).
- Aviso de conexão: o mesmo ConnectionBanner no topo da área de conteúdo quando `reconnecting`; as listas seguem navegáveis. Ao reconectar: `showcase:join` + `GET /lots` (mesmos filtros atuais).

### 9.3 Painel (`/painel`)

- Entra em `showcase`. `showcase:lot` de um `id` que já está na lista do leiloeiro atualiza a linha (lance atual, nº de lances, `endsAt`, cronômetro, status). Id desconhecido é ignorado (pode ser lote de outro leiloeiro; o lote que o próprio leiloeiro cria entra pela invalidação da criação).
- Se o evento muda um lote próprio para `SOLD/UNSOLD/CANCELLED`, refazer `GET /my/lots` (traz resultado e total recebido; S05/S06 completam).
- Placares AO VIVO/AGENDADOS/ENCERRADOS recalculados da lista.
- ConnectionBanner igual à Vitrine.

### 9.4 Carteira, BalanceChip e Header

- `SocketProvider` no layout raiz: conecta ao montar (`auth` como função que lê o token atual, §7); quando o token muda (login, logout, cadastro) faz `socket.disconnect(); socket.connect()` para trocar de sala privada (o handshake relê o token novo). Logout reconecta como visitante.
- Chaves do TanStack Query (definidas na S01): `["wallet","summary"]` (o `WalletDto` que o BalanceChip lê) e `["wallet","ledger"]` (extrato paginado + `leadingLots`). `wallet:updated`: aplica `totalCents/committedCents/availableCents` com `setQueryData(["wallet","summary"], …)` (chip e Carteira atualizam juntos) e dispara `invalidate(["wallet","ledger"])` com debounce de 300 ms para trazer as linhas novas do extrato e `leadingLots`. Nunca escrever o formato do `summary` em `["wallet"]` solto. Na Carteira, Total e Disponível "viram" (flip, **se sobrar tempo**) quando o valor muda e há linha nova no topo do extrato; anúncio por região viva (a da S01).
- Ao reconectar: `invalidate(["wallet"])` (prefixo: invalida `summary` e `ledger`).
- Duas abas do mesmo usuário recebem o mesmo evento (cada socket entra em `user:{id}`).

### 9.5 Visibilidade da aba e rede do navegador (**se sobrar tempo**; cortável sem ferir o PRD)

- `visibilitychange` para visível e `online` do navegador: se o socket está desconectado, `socket.connect()`; se está conectado, refaz o snapshot da página atual (Sala: `GET /lots/:id`; Vitrine: `GET /lots`; Carteira: `GET /wallet`). Cobre aba dormindo no celular.

## 10. Componentes criados

### ConnectionBanner
Uso: Sala, Vitrine, Painel (topo da área de conteúdo, no fluxo).
- Variante única neutra (sucesso genérico não usa verde). Fundo `tinta`, texto `fundo`, borda 3px sólida `linha`, canto 0, padding `10px 16px`. Tipografia IBM Plex Mono 14px peso 600 (`mono-dado`) para a primeira linha; segunda linha IBM Plex Mono 12px (`mono-rotulo`) em `fundo`.
- Ponto de 10px à esquerda com `la-pulsa 1.2s` enquanto reconectando; estático em reduced-motion e ausente na linha "De volta ao pátio".
- `role="status"` `aria-live="polite"`; sem botão. Alvo de toque não se aplica (não interativo).
- Estados: oculto · reconectando (2 linhas) · reconectado (1 linha, 4 s) · oculto.

### Hook `useConnectionStatus()`
Retorna `'connecting' | 'live' | 'reconnecting'`, `lastSyncedAt`. `live` só depois do join + snapshot HTTP aplicado. Fonte única para o banner e para desabilitar o botão de lance.

### Helpers sem UI (testáveis)
- `serverClock.sync(serverTime, sentAt?)` / `useServerClock()`: recalcula `offset = Date.parse(serverTime) − Date.now()` em cada resposta HTTP e ack, mantendo a medição de menor latência (R-4.10); evento só ajusta se `serverTime` > último aceito. Único lugar do web que chama `Date.now()`. (Alimentação por HTTP já existe da S02; aqui entram acks e a regra do evento.)
- `applyLotEvent(state, event)`: reducer puro que devolve `{ state, action: 'applied' | 'ignored' | 'refetch' }` seguindo R-4.6/R-4.7; lê só `version`. **Substitui o `applyBid` da S03** (R-4.14): a resposta do `POST` de lance e o `bid:placed` passam por ele. `lot:cancelled` devolve `refetch` (R-4.6). Caminho sugerido: `apps/web/src/lib/realtime/lot-reducer.ts`.
- `upsertShowcaseCard(list, card)` e `sortShowcase(list)`: puros; o upsert descarta `card.version < atual.version` (R-4.13).
- `computeMyStanding(bids, myPseudonym)`: em `packages/shared`; só aproximação, o servidor manda `myRank`/`bidderCount` (§9.1).

Caminhos sugeridos (confirmar com o código): API `apps/api/src/infra/realtime.ts`; Web `apps/web/src/lib/realtime/{socket.ts, SocketProvider.tsx, use-lot-room.ts, use-showcase-live.ts, use-wallet-live.ts, connection-status.ts}` e `components/ConnectionBanner.tsx`.

## 11. Seed desta fatia

Nenhum dado novo. O roteiro manual usa o lote ao vivo (30 dias, com lances dos dois licitantes) e os usuários da S01/S03. Para demonstrar a prorrogação sem esperar 30 dias, o roteiro cria pelo Criar lote (S02) um lote com início agora e fim em 5 min e espera chegar a <2 min (duração mínima do lote é 5 min).

## 12. Critérios de aceite

- **AC-4.1 [manual] (AC7)** Dado licitante A na Sala do lote ao vivo (R$ 33.000,00 atuais) no navegador 1 e um visitante na mesma Sala no navegador 2, quando B dá lance de R$ 34.000,00 em outro navegador, então em até 2 s, sem recarregar, ambos veem a placa "34.000", uma linha nova no topo do histórico e contador de lances +1.
- **AC-4.2 [auto]** Dado dois clientes socket na sala `lot:L`, quando um `POST /lots/L/bids` válido é confirmado, então ambos recebem exatamente um `bid:placed` com `version == entryCount` do banco e `serverTime` ISO; e no momento do recebimento o `Bid` já existe no banco (publicação pós-commit).
- **AC-4.3 [auto]** Dado um `POST /lots/L/bids` recusado (`BELOW_MINIMUM`), quando a resposta volta 422, então nenhum cliente da sala recebeu `bid:placed`, `showcase:lot` ou `wallet:updated`.
- **AC-4.4 [manual] (AC6)** Dado lote ao vivo com `endsAt` daqui a 90 s e dois navegadores na Sala, quando B dá lance às 18:58:49, então os dois navegadores mostram novo fim 19:00:49, selo "+2 MIN" e o aviso "Lance nos 2 minutos finais: o relógio ganhou +2 min. Novo fim às 19:00:49. Ninguém leva no susto.", e o cronômetro continua na variante "ÚLTIMOS 2 MIN".
- **AC-4.5 [auto] (AC6)** Dado `FakeClock` em `endsAt − 90 s`, quando um lance é aceito, então o `bid:placed` traz `extended: true` e `endsAt == now + 2 min`; dado `FakeClock` em `endsAt − 150 s`, então `extended: false` e `endsAt` inalterado.
- **AC-4.6 [auto]** Dado `wallet:updated` por lance, quando B supera A, então B recebe `committedCents` aumentado, A recebe `committedCents` reduzido (liberado), e um terceiro licitante C e um visitante não recebem nenhum `wallet:updated`.
- **AC-4.7 [auto]** Dado um cliente conectado com token inválido ou expirado, quando conecta, então a conexão é aceita como visitante, recebe eventos públicos e nunca eventos `user:*`.
- **AC-4.8 [auto]** Dado `lot:join` de um lote existente por usuário logado com lances, então o ack é `{ ok: true, lot }` com `myPseudonym/myRank/myBestBidCents` iguais aos de `GET /lots/:id` para o mesmo usuário; dado lote inexistente ou `lotId` inválido, então `{ ok: false, error: { code: "NOT_FOUND" } }` e o socket NÃO entra em nenhuma sala.
- **AC-4.9 [auto]** Dado lote agendado e lote cancelado, quando `lot:join`, então o ack é `ok: true` com o `LotState` correspondente.
- **AC-4.10 [auto]** Dado `Publisher` que lança exceção, quando `POST /lots/L/bids` válido é feito, então a resposta é 201, o lance está no banco e o erro foi logado.
- **AC-4.11 [auto]** Dado `POST /wallet/deposits` de R$ 10.000,00 por A, então o socket de A em `user:A` recebe `wallet:updated` com os totais novos; um socket de B não recebe.
- **AC-4.12 [auto]** Dado `POST /lots` válido, então a sala `showcase` recebe `showcase:lot` com o `LotCard` do lote novo (status `SCHEDULED` ou `LIVE`).
- **AC-4.13 [auto]** Dado `applyLotEvent` com estado em `version 5`, quando chega `bid:placed` `version 6`, então `applied`; `version 6` de novo ⇒ `ignored`; `version 5` ⇒ `ignored`; `version 8` ⇒ `refetch` sem alterar o estado.
- **AC-4.14 [auto]** Dado estado em `version 5`, quando chega `lot:closed` `version 5`, então `applied` (terminal); `lot:closed` `version 7` ⇒ `refetch`; `lot:closed` repetido ⇒ resultado idêntico (idempotente).
- **AC-4.15 [auto]** Dado `lot:cancelled` `version 6` com estado em `version 5`, então o reducer devolve `refetch` (o payload não traz `cancelledAt`; o estado só fecha depois do `GET`); com estado em `version 4` ⇒ `refetch`; com estado em `version 6` ou maior ⇒ `ignored`.
- **AC-4.16 [manual]** Dado A na Sala (`live`), quando a rede de A cai, então em até 20 s (`pingInterval` 10 s + `pingTimeout` 10 s; o modo Offline do DevTools costuma fechar o WebSocket antes) aparece "Sem sinal com o pátio. Tentando reconectar." com "Última atualização às hh:mm:ss.", o botão "Dar lance" fica `disabled`, o valor digitado permanece e o cronômetro continua contando.
- **AC-4.17 [manual]** Dado A offline e B tendo dado 2 lances nesse intervalo, quando a rede de A volta, então o cliente reemite `lot:join`, faz `GET /lots/:id`, o histórico mostra os 2 lances uma única vez e na ordem certa, o banner exibe "De volta ao pátio. Estado do lote atualizado." e some em 4 s, e o botão volta.
- **AC-4.18 [auto]** Dado cliente que sai da sala (`disconnect`), perde um `bid:placed`, e reconecta, quando o fluxo de reconexão termina, então o cache do lote equivale a `GET /lots/:id` do mesmo instante (mesmo `version`, mesmos `bids`, mesmo `endsAt`) sem linhas duplicadas.
- **AC-4.19 [auto]** Dado que o lance perdido na desconexão era uma prorrogação, quando o cliente reconcilia, então `endsAt` e o estado `extended` (`endsAt > originalEndsAt`) estão corretos sem ter recebido o evento.
- **AC-4.20 [manual]** Dado A com valor 35.500 digitado e botão desabilitado por falta de conexão, quando a conexão volta, então o campo ainda mostra 35.500 e a regra de mínimo reflete o lance atual real.
- **AC-4.21 [manual]** Dado que o POST de lance falha por queda de rede sem resposta, então a Sala mostra "Não deu para confirmar o lance. Confira o histórico antes de tentar de novo.", NÃO reenvia sozinha, e refaz o snapshot quando a conexão voltar.
- **AC-4.22 [manual]** Dado Vitrine aberta com o cartão do lote ao vivo em R$ 33.000,00 e "12 lances", quando B dá lance de R$ 34.000,00, então o cartão mostra R$ 34.000,00 e "13 lances" sem recarregar; se o lance prorrogou, o cronômetro do cartão reflete o novo fim.
- **AC-4.23 [manual]** Dado Vitrine com filtro "VW" ativo, quando um lote novo de outra marca é criado, então ele não aparece; quando é criado um lote VW, aparece após a nova consulta.
- **AC-4.24 [manual]** Dado lote agendado para 14:00 com Vitrine aberta às 13:59:58, então às 14:00:00 (relógio do servidor) o cartão passa de "Agendados" para "Ao vivo" sem evento e sem recarregar.
- **AC-4.25 [manual]** Dado A com duas abas, quando deposita R$ 10.000,00 em uma, então o chip "DISPONÍVEL" e a Carteira da outra atualizam em até 2 s e a linha de depósito aparece no topo do extrato.
- **AC-4.26 [manual]** Dado A logado e depois "Sair", então o socket reconecta como visitante e A deixa de receber `wallet:updated`; ao logar como B, o chip mostra o saldo de B sem recarregar.
- **AC-4.27 [manual]** Dado reduced-motion ativo, então nenhuma animação (`la-vira`, `la-mais`, pulso do banner) roda, e todos os estados (selo, aviso, placa) aparecem direto no estado final.
- **AC-4.28 [auto]** Dado API sem nenhuma chamada a FIPE/Wikipedia durante conexão, join e eventos, então eventos e snapshots funcionam com as APIs externas bloqueadas (AC13 permanece válido).
- **AC-4.29 [auto]** Dado `upsertShowcaseCard` com o cartão em `version 7`, quando chega `showcase:lot` `version 6`, então é descartado e o cartão segue em `version 7`; `version 8` ⇒ aplicado; `showcase:lot` `SOLD/UNSOLD` com `version` igual ao atual ⇒ aplicado (`>=`).
- **AC-4.30 [manual]** Dado o socket já conectado (usuário veio da Vitrine) e a Sala montando em seguida, quando B dá lance, então a Sala recebe o `bid:placed` sem recarregar (o `lot:join` saiu no mount, não só no `connect`); ao navegar para outra Sala, a anterior sai com `lot:leave`.
- **AC-4.31 [manual]** Dado o WebSocket bloqueado (ex.: origem sem CORS no Socket.IO) na primeira visita, então a Sala mostra o banner após 3 s e, passados 10 s em `connecting`, o botão "Dar lance" é habilitado e um lance válido é aceito pelo HTTP.
- **AC-4.32 [auto]** Dado `bid:placed` com `bidderCount`, então o payload traz o mesmo `bidderCount` que `GET /lots/:id` para o mesmo instante e nenhum campo com `userId`.

## 13. Casos de borda e concorrência

- **Dois lances quase simultâneos:** A e B confirmam em sequência e as rotas publicam fora de ordem (B antes de A). O cliente recebe `version 7` com estado em 5 ⇒ salto ⇒ `GET`; o `version 6` que chega depois é descartado (`<= atual`). Estado final correto. O cartão da Vitrine segue a mesma regra por `showcase:lot` (descarta `version < card.version`).
- **Mesmo `version` duas vezes:** (resposta HTTP + evento do próprio lance) ⇒ o segundo é descartado.
- **Evento chega entre `lot:join` e a resposta do `GET`:** o evento é aplicado sobre o cache antigo; o `GET` só substitui se `snapshot.version >= cache.version`; se o evento já levou o cache além do snapshot, o snapshot é descartado.
- **Servidor reinicia ou hiberna (Render):** todos os sockets caem; o cliente reconecta sozinho com backoff; durante o cold start o banner permanece; na volta cada Sala/Vitrine refaz join + snapshot.
- **Token expira durante a sessão:** o socket já conectado continua; um novo `connect` com token expirado entra como visitante; a próxima chamada HTTP autenticada devolve 401 e o fluxo da S01 leva ao login.
- **`lot:join` repetido** (reconexão): idempotente; entrar duas vezes na mesma sala não duplica entrega (Socket.IO).
- **Navegar de uma Sala para outra:** `lot:leave` da anterior, `lot:join` da nova; eventos da anterior que ainda cheguem são ignorados pelo `lotId`.
- **Usuário logado em duas máquinas:** ambas recebem `wallet:updated`.
- **Lote sem lances:** `bid:placed` com `seq 1`, `version 1`, `bidCount 1`; o cliente que estava em `version 0` aplica.
- **Visitante e leiloeiro:** recebem `bid:placed` e `showcase:lot`; nunca `wallet:updated` de terceiros; leiloeiro recebe `wallet:updated` apenas dele próprio (S05).
- **Relógio do aparelho muito errado:** o countdown continua certo porque usa o offset; se o aparelho muda o relógio no meio, o próximo `serverTime` reajusta.
- **Evento de lote cancelado sem `cancelledAt` no payload:** o cliente faz `GET` (não presume).
- **Rede lenta com muitos eventos:** `setQueryData` imutável por evento; nenhuma ordenação por tempo de chegada, só por `seq`.

## 14. Testes exigidos

API (Vitest + Postgres real + `socket.io-client` em porta efêmera):
1. Autenticação do handshake: token válido entra em `user:{id}`; inválido/expirado vira visitante; cliente não consegue entrar em `user:*` emitindo `lot:join`.
2. `lot:join` ack: snapshot idêntico ao `GET /lots/:id` (visitante e logado); `NOT_FOUND`; agendado e cancelado aceitam join.
3. `bid:placed`: dois clientes recebem 1 vez; `version`; `extended` true/false conforme `FakeClock`; pós-commit (consulta ao banco dentro do handler).
4. Recusa não publica nada.
5. `wallet:updated` só para novo líder e líder anterior; terceiro e visitante não recebem; depósito emite para o próprio usuário.
6. `showcase:lot` em criação e em lance.
7. `Publisher` que falha não derruba a resposta.
8. `serverTime` presente e em ISO UTC em todos os payloads.
9. Reconexão: `disconnect`, lance perdido, `connect`, `lot:join` + `GET` ⇒ estado equivalente, sem duplicata.

Web (Vitest, lógica pura): `applyLotEvent` (ordem, duplicata, salto, terminal idempotente, outro `lotId`), `computeMyStanding` (paridade com `myRank` do servidor em um lote semeado), `serverClock` (offset, countdown), `upsertShowcaseCard`/`sortShowcase` (ordenação das 3 seções, remoção de CANCELLED), regra de desabilitar botão por `useConnectionStatus`.

## 15. Retrofits e integrações

| Onde | Mudança |
| --- | --- |
| S00 | `Publisher` real substitui `NoopPublisher` na composição do servidor. |
| S01 `POST /wallet/deposits` | O service passa a devolver `DomainEvent` `wallet:updated` para `user:{id}`; a rota entrega ao `Publisher`. Carteira ganha o flip e a linha nova por evento. |
| S02 `POST /lots` | Devolve `DomainEvent` `showcase:lot` (`LotCard` do lote novo). |
| S02 `Cronometro` | Variante alerta com `<= 120 000 ms`; `SeloProrrogacao` reanima a cada nova prorrogação. |
| S02/S03 `GET /lots/:id`, `LotCard`, `LotSummary` | Expõem `version` (= `entryCount`, alias mantido); `LotCard` ganha `version`. |
| S03 `POST /lots/:id/bids` | Já devolve eventos: confirmar que são `bid:placed` (com `version` e `bidderCount`), `showcase:lot` (com `version`), `wallet:updated` (novo líder e líder anterior) com os payloads de §7 e que `extended` reflete a regra. |
| S03 Sala | Adiciona leitura de `useConnectionStatus` para desabilitar o botão e `useLotRoom` (join no mount + a cada `connect`) para aplicar eventos. O `applyBid` da S03 passa a ser `applyLotEvent` (R-4.14). |
| S01 Carteira / BalanceChip | Chaves `["wallet","summary"]` e `["wallet","ledger"]` (§9.4). |
| S05 | Emite `lot:closed` + `showcase:lot` + `wallet:updated` (vencedor e leiloeiro); Sala trata 00:00/encerrado. |
| S06 | Emite `lot:cancelled` + `showcase:lot` + `wallet:updated` (líder estornado). |
| S07 | Meus arremates passa a usar `showcase:lot`/`wallet:updated` para refetch. |
| S09 | Verifica banner e bloqueios nos dois temas e no celular; testa cold start do Render. |

## 16. Conflitos resolvidos e perguntas abertas

Conflitos resolvidos:
- **Snapshot por HTTP vs pelo ack do `lot:join`:** PRD diz "ao reconectar, recarrega o estado por HTTP"; a arquitetura usa o ack como snapshot. Resolvido pelo PRD: o cliente entra na sala com `lot:join` e depois faz `GET /lots/:id`; o ack continua no contrato (e é testado) mas o cache usa o `GET`.
- **`lot:closed` e a regra "ignora `version <= atual`":** o fechamento não incrementa `entryCount`, então seu `version` é igual ao atual e seria descartado. Resolvido: eventos terminais (`lot:closed`) aplicam com `>=` (R-4.7). `lot:cancelled` incrementa (linha CANCEL na cadeia) e segue a regra normal.
- **`lot:leave`:** não consta na lista da arquitetura; adicionado como evento mínimo de limpeza (sem ele o socket continua recebendo eventos de salas já fechadas). Se o usuário preferir não ampliar o contrato, o cliente pode só ignorar por `lotId` e deixar as salas até o `disconnect`.
- **Aviso de conexão verde ou colorido:** DESIGN proíbe verde para sucesso genérico; o aviso de reconexão usa o neutro `tinta/fundo`.

Perguntas abertas (sem bloquear a fatia):
- Timeout de "Sem sinal…" de 3 s na primeira conexão e de 4 s para sumir o aviso de volta são sugestões minhas, não vêm das fontes.
- Tolerância "até 2 s" nos AC manuais é tolerância de teste, não requisito do PRD.
- Textos de §8 são todos "texto a revisar".

## 17. Definition of Done

- [ ] Eventos da §7 emitidos por lance, depósito e criação de lote; `lot:closed`/`lot:cancelled` definidos em `packages/shared` e tratados no cliente (emissão fica para S05/S06).
- [ ] Testes de §14 passando no CI, incluindo o de reconexão.
- [ ] ACs [manual] percorridos com 2+ navegadores no deploy público (Vercel + Render + Neon), inclusive a queda e volta da rede.
- [ ] Nenhum `position: fixed` no ConnectionBanner; foco e teclado intactos; reduced-motion verificado.
- [ ] Cold start do Render não deixa a Sala presa: banner aparece e some ao conectar.
- [ ] `.env.example` e README com a nota: o plano gratuito pode hibernar e o socket demora a reconectar.
- [ ] Deploy atualizado e smoke no link público (dois navegadores, um lance).
