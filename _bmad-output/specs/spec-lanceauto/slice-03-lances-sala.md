---
id: S03
titulo: Lances e Sala (transação do lance, saldo comprometido, painel de lance)
depende_de: [S00, S01, S02]
cobre: [R1, R2, R3, R4, R5, R6, R8, E6, M1, M2, M3, M4, M5, M6, M7, M8, TX, DM-Bid, H1, H2, H3, P2, P3, AC1, AC2, AC3, AC4, AC5, S2]
parcial: [R7, R10, E4, T3, AC6, AC7, H5, E5, UX-A11Y, UX-VOICE, UX-RESP, UX-THEME, UX-RECON]
fontes_de_origem: [PRD Regras de negócio 1–10, Mensagens de feedback, Exemplo de saldo, Arquitetura e pontos técnicos (Transação do lance), Critérios de aceite; AD-2, AD-3, AD-4, AD-5, AD-8, AD-9, AD-10; EXPERIENCE State Patterns/Sala, Interaction Primitives/Lance, Mensagens de recusa, Accessibility Floor; DESIGN Components (placa-lance, placar-posicao, faixa-status, campo, chip-licitante, botao-atalho, mensagem-recusa)]
---

# S03 — Lances e Sala

## 1. Objetivo e demonstração

Coração do teste. Um licitante logado entra na Sala de um lote ao vivo, dá lance; o servidor valida tudo numa única transação (lote travado, carteiras travadas em ordem fixa), compromete o saldo de quem lidera, libera o de quem foi superado, grava o lance com hash encadeado, prorroga o fim se for nos 2 últimos minutos e devolve o estado novo. Recusas voltam com código, motivo e texto exato. Esta fatia **não** tem tempo real: o segundo navegador só enxerga o lance ao recarregar (S04).

Roteiro de demonstração (avaliador):
1. Entra como `ana@…` (licitante com saldo, seed S01) e abre a Sala do lote ao vivo do seed (S02). Vê o histórico de lances do seed, a placa com o lance atual e a faixa "Você foi superado" (ou "Você ainda não deu lance").
2. Digita um valor abaixo do mínimo e clica "Dar lance": recusa colada ao botão com o mínimo exato (`BELOW_MINIMUM`).
3. Digita um valor acima do saldo disponível: "Saldo insuficiente: você tem R$ … disponíveis." + "Depositar na carteira →".
4. Dá um lance válido: a placa vira, a faixa vira "Você está ganhando · 1º de N", a linha nova aparece no topo do histórico com "VOCÊ", o chip "DISPONÍVEL" cai pelo valor travado.
5. Clica de novo em "Dar lance": `ALREADY_WINNING`.
6. Em outra janela, loga como `bruno@…`, cobre o lance. Na janela da Ana (após recarregar) vê "Você foi superado" e o disponível de volta.
7. Entra como leiloeiro: Sala sem formulário, "Leiloeiros não podem dar lances". Como visitante: botão "Entre para dar lances".
8. Abre `/carteira`: "Travado onde você lidera" lista o lote.

## 2. Fora desta fatia

| Item | Vai para |
| --- | --- |
| Entrega de eventos `bid:placed`/`wallet:updated`/`showcase:lot` por Socket.IO, salas, reconexão, bloqueio de envio sem socket, Vitrine/Painel/chip atualizando sozinhos | S04 |
| Resultado do fechamento (vencedor, comprovante, carimbo "Arrematado", "Você arrematou", sem lances), débito/crédito de liquidação | S05 |
| Cancelar lote, `REFUND`, linha `CANCEL` na cadeia, Sala cancelado completa | S06 |
| "Meus arremates", links do bloco "Travado onde você lidera" para Meus arremates | S07 |
| `verifyChain`, página/endpoint de auditoria, link "Auditar este lote" na Sala | S08 |
| Varredura final de acessibilidade/responsivo/404 | S09 |

## 3. Ponto de partida

Já existe (não recriar):
- **S00:** `Clock`/`FakeClock` (`infra/clock.ts`), `AppError` + handler de erro com o envelope `{error:{code,message,details?}}`, `ErrorCode` e `money` (`formatBRL`, `MAX_DEPOSIT_CENTS`) em `packages/shared`, `DomainEvent`/`Publisher`/`NoopPublisher`, `env.ts` com `AUDIT_HMAC_KEY` (≥32 bytes), rate-limit utilitário, Vitest, primitivos de UI (Button, Field, RefusalMessage, FeedbackState, Stamp, LotTag, Dialog, DataTable…).
- **S01:** `User`, `Wallet`, `LedgerEntry` (enum `LedgerKind` com os 6 valores), CHECKs de carteira, `requireAuth`/`requireRole`, JWT (claims `sub`, `role`), `GET /wallet` (com `leadingLots: []` fixo), `POST /wallet/deposits`, Header por papel, `BalanceChip` (lê `/wallet`), `apiClient`, guardas de rota, seed de 1 leiloeiro + 2 licitantes com saldo.
- **S02:** `Item`, `Lot` (todas as colunas, `lastHash=seal(genesis)` no lote novo), `domain/audit-chain.genesis` e `sealHash`-base, `lotStatus`/`LotCard`/`LotState` em `shared`, `GET /lots/:id` (sem lances), `toLotCard`, Sala somente leitura (`/lotes/[id]`: ficha do carro, `CarPhoto`, `LotTag`, estados Agendado/Ao vivo sem formulário/Cancelado), `Cronometro` (normal / últimos 2 min / prorrogado com `SeloProrrogacao` / encerrado) + `useServerClock`, seed de lote agendado e lote ao vivo (30 dias, sem lances).

Invariantes que valem aqui (cópia curta):
- **INV-1** servidor é a verdade de tempo/saldo/valor; sem atualização otimista; relógio da tela = `Date.now()+offset`.
- **INV-2** centavos inteiros (`BigInt` no banco, `number` nas bordas com assert ≤ `MAX_SAFE_INTEGER`); UI em reais inteiros `R$ 31.000,00`, Plex Mono.
- **INV-3** datas ISO UTC `Z`; `new Date()`/`Date.now()` proibidos em `apps/api/src` fora de `infra/clock.ts` (no web, `Date.now()` só dentro de `serverClock`); UI em America/Sao_Paulo.
- **INV-4** mutação só por REST via service; service devolve `DomainEvent[]`; a rota entrega ao `Publisher` depois do commit.
- **INV-5** lock: `Lot FOR UPDATE` → carteiras `WHERE userId IN (…) ORDER BY userId FOR UPDATE`; ReadCommitted; nunca carteira antes do lote.
- **INV-6** `Wallet` é cache; cada mudança insere `LedgerEntry` na mesma tx; disponível = total − comprometido, sempre calculado.
- **INV-7** `Bid` só recebe inserção (trigger).
- **INV-8** ordem de validação (ver §4.2). **INV-9** prorrogação `endsAt − now <= 2 min ⇒ endsAt = now + 2 min`, sem teto, `originalEndsAt` imutável.
- **INV-12** cadeia HMAC v1 (§4.5). **INV-13** DTO público nunca contém `userId`/nome/e-mail; pseudônimo por lote.
- **INV-15** um papel por conta. **INV-16** envelope de erro. **INV-18** voz do pátio.

## 4. Regras de negócio

### 4.1 Pré-requisitos do lance
- **R-3.1** Só lote **ao vivo** aceita lance: `startsAt <= now < endsAt` e sem `cancelledAt`. (PRD R1)
- **R-3.2** Primeiro lance (`currentBidCents` nulo) deve ser `>= startingBidCents`; os seguintes `>= currentBidCents + minIncrementCents`. Esse piso é o **mínimo aceito** (`minimumBidCents`). (PRD R2)
- **R-3.3** O licitante líder (`leaderId == userId`) não pode cobrir o próprio lance. (PRD R3)
- **R-3.4** Só `BIDDER` dá lance; `AUCTIONEER` nunca. (PRD R4)
- **R-3.5** O lance só é aceito se `amountCents <= totalCents − committedCents` do licitante (valor exato igual ao disponível é aceito). (PRD R5)
- **R-3.6** Lance é irrevogável: não há rota de edição/remoção e o banco rejeita `UPDATE`/`DELETE` em `Bid`. (PRD R6)

### 4.2 Ordem de validação (INV-8, conflito C1 resolvido pelo PRD)
Sem token válido → `UNAUTHENTICATED` 401 antes da transação. Validação do corpo (zod) → `VALIDATION` 400 antes da transação. Dentro da transação, com o lote travado e `now = clock.now()` (lido **depois** de obter o lock), para na primeira falha:

| # | Checagem | Código |
| --- | --- | --- |
| 1 | lote inexistente | `NOT_FOUND` 404 |
| 2 | `cancelledAt` não nulo | `LOT_CANCELLED` |
| 3 | `now < startsAt` | `LOT_NOT_STARTED` |
| 4 | `now >= endsAt` | `LOT_ENDED` |
| 5 | `amount < minimumBidCents` | `BELOW_MINIMUM` (`reason` por R-3.7) |
| 6 | `leaderId == userId` | `ALREADY_WINNING` |
| 7 | papel `AUCTIONEER` | `ROLE_NOT_ALLOWED` |
| 8 | (só aqui trava carteiras) `amount > available` | `INSUFFICIENT_BALANCE` |

Consequências aceitas desta ordem (documentar no README): líder que dá lance **abaixo** do mínimo recebe `BELOW_MINIMUM` (com `reason: OWN_LEAD`, R-3.7), não `ALREADY_WINNING`; leiloeiro em lote encerrado/cancelado/abaixo do mínimo recebe o código da checagem anterior, e só `ROLE_NOT_ALLOWED` se o lance passaria nas checagens 2–5; reenvio idêntico do líder cai em `BELOW_MINIMUM`/`OWN_LEAD` (ver §13 e §16).

- **R-3.7** `BELOW_MINIMUM.details.reason`, avaliado nesta ordem: `OWN_LEAD` se `leaderId == userId` (o autor do lance atual reenvia valor abaixo do mínimo; evita dizer "alguém levantou a mão antes de você" a quem é o próprio líder); `OUTDATED` se `expectedCurrentCents` (o que o cliente viu; `null` = sem lances) for diferente do `currentBidCents` real (comparação null-safe); senão `MINIMUM`. `details = { minimumCents, currentBidCents (number|null), reason }`. `expectedCurrentCents` é obrigatório no corpo (pode ser `null`). O código continua `BELOW_MINIMUM` nos três casos; só o texto muda (§8).
- **R-3.8** Carteira inexistente (não deveria ocorrer) conta como disponível 0 ⇒ `INSUFFICIENT_BALANCE` com `availableCents: 0`; nunca cria carteira no lance.

### 4.3 Efeitos do lance aceito (tudo na mesma transação, nesta ordem)
1. Trava carteiras: uma query `SELECT * FROM "Wallet" WHERE "userId" IN (:bidder, :prevLeader?) ORDER BY "userId" FOR UPDATE`. **Ler os saldos desta query** (não de leitura anterior): no ReadCommitted é ela que enxerga o último commit.
2. Se havia líder anterior: `committed -= lot.currentBidCents` na carteira dele + `LedgerEntry(RELEASE, amount=lot.currentBidCents, lotId)` com `totalAfter`/`committedAfter`. (PRD R8: liberado na mesma tx do lance que superou)
3. Licitante novo: `committed += amount` + `LedgerEntry(HOLD, amount, lotId)`.
4. Insere `Bid`: `seq = lot.entryCount + 1`, `kind=BID`, `bidderId`, `pseudonym` (§4.6), `amountCents`, `at = now`, `prevHash = lot.lastHash` (no lote novo `lastHash = genesis`), `hash = entryHash(...)`.
5. Atualiza `Lot`: `currentBidCents = amount`, `leaderId = bidder`, `bidCount += 1`, `entryCount = seq`, `lastHash = hash`, `seal = sealHash(key, lotId, seq, hash)`. O `bidderCount` do evento `bid:placed` sai da query de §4.7 (licitantes distintos com `kind=BID`, já contando este lance), dentro da mesma transação.
6. Prorrogação (R-3.9) atualiza `endsAt`.
7. Commit. Só então a rota entrega os eventos (§7) ao `Publisher`.

- **R-3.9 (PRD R10 / INV-9)** Se `lot.endsAt − now <= 2 min` (inclusive): `newEndsAt = now + 2 min`; `extended = newEndsAt > lot.endsAt`. Sem teto de prorrogações. `originalEndsAt` nunca muda. `newEndsAt` nunca é menor que `endsAt`.
- **R-3.10 (PRD R8/R7)** Quem lidera tem exatamente `currentBidCents` comprometido naquele lote; quem foi superado tem 0 comprometido naquele lote. Soma do comprometido de todas as carteiras causado por um lote = `currentBidCents` (ou 0 sem lances).
- **R-3.11** A rota **nunca** publica evento se a transação falhou ou deu rollback.

### 4.4 Funções puras (`apps/api/src/domain/`, sem Prisma/Express/Date.now)
- `bid-rules.ts`: `minimumBid(lot): number`; `validateBidPreWallet({lot, userId, role, amountCents, expectedCurrentCents, now}): {ok:true, minimumCents} | {ok:false, code, details?}` (checagens 2–7 da tabela); `validateBalance(availableCents, amountCents): ok | INSUFFICIENT_BALANCE`; `nextEndsAt(endsAt, now): {endsAt, extended}`.
- `audit-chain.ts` (S02 já tem `genesisHash(key, lot)`): acrescentar `entryHash(key, p)` com `p = { lotId, seq, kind, pseudonym, amountCents, at, prevHash }` (objeto, **chave sempre primeiro**) e `sealHash(key, lotId, entryCount, lastHash)`. Assinatura única: S06 (`CANCEL`) e S08 (`verifyChain`) chamam exatamente assim.
- `pseudonym.ts`: `pseudonymFor(key, userId, lotId): string`.
- `rank.ts`: `rankFrom(bestByBidder: Map<id, number>, me): {rank, bidderCount, myBest} | null`.
Todas recebem `now: Date` e a chave por parâmetro.

### 4.5 Cadeia HMAC v1 (INV-12, formato exato)
Chave `AUDIT_HMAC_KEY`; saída hex minúsculo; nulos viram `""`; `at` em ISO UTC com ms (`2026-10-22T14:00:00.123Z`); valores em centavos inteiros; separador `|`.
- `genesis = HMAC(key, "v1|genesis|{lotId}|{startsAt}|{startingBidCents}|{minIncrementCents}")` (S02)
- `hash = HMAC(key, "v1|entry|{lotId}|{seq}|{kind}|{pseudonym}|{amountCents}|{at}|{prevHash}")` com `kind=BID`
- `seal = HMAC(key, "v1|seal|{lotId}|{entryCount}|{lastHash}")`
Teste de vetor fixo: chave de 32 bytes `0x00…`, lote `lot-1`, seq 1, `Licitante 7F3A`, 3000000, `2026-10-22T14:00:00.123Z`, prevHash `genesis-x` ⇒ gravar o hex esperado calculado por uma implementação independente (script `crypto.createHmac` no próprio teste) e comparar.

### 4.6 Pseudônimo e privacidade (INV-13)
`pseudonym = "Licitante " + HMAC(key, "v1|pseudo|{userId}|{lotId}")[0:4].toUpperCase()` (4 hex). Gravado no `Bid`. Muda de lote para lote. Colisão de 4 hex no mesmo lote é aceita (README). DTOs públicos (`bids[]`, eventos, resposta do lance) **nunca** carregam `userId`, nome ou e-mail. Logado como `BIDDER`, `GET /lots/:id` devolve `myPseudonym` (calculado pela mesma função, mesmo sem ter dado lance), `myRank`, `myBestBidCents`; o front compara pseudônimos para marcar "VOCÊ".

### 4.7 Posição (`myRank`)
Posição = colocação do **maior lance de cada licitante**: `myRank = 1 + nº de licitantes distintos cujo maior lance > o meu maior lance`; `bidderCount` = nº de licitantes distintos com lance `kind=BID` no lote. Sem lance meu: `myRank = null`, `myBestBidCents = null`. Query: `SELECT "bidderId", MAX("amountCents") FROM "Bid" WHERE "lotId"=$1 AND kind='BID' GROUP BY "bidderId"`. Quem deu 2 lances conta uma vez.

### 4.8 Limite de requisições
`POST /lots/:id/bids`: `express-rate-limit` por usuário (fallback IP), **sugestão 30 req/min**, criado pela fábrica `makeRateLimiter({ windowMs, max, keyGenerator?, skip?, message? })` da S00 (a chave por usuário usa `req.user.id`; o `handler` lança `AppError(RATE_LIMITED)` para sair no envelope padrão, nunca texto puro). Atrás do Render o limite por IP só funciona com `app.set("trust proxy", 1)` (S00). Testes definem `RATE_LIMIT_DISABLED=1` (o `skip` da fábrica). Estouro ⇒ `RATE_LIMITED` 429. O código **já existe** em `ErrorCode` desde a S00; a mensagem é por rota (a do lance está em §8) e a tabela da S00 traz só o padrão.

## 5. Modelo de dados

Migração desta fatia (`add_bid`). Criar `Bid` e o enum `ChainKind` (os dois valores já agora; `CANCEL` só é usado na S06).

```prisma
enum ChainKind { BID CANCEL }

model Bid {
  id          String    @id @default(uuid())
  lotId       String
  seq         Int
  kind        ChainKind
  bidderId    String?
  pseudonym   String?
  amountCents BigInt?
  at          DateTime  @db.Timestamp(3)
  prevHash    String
  hash        String
  lot         Lot       @relation(fields: [lotId], references: [id])
  bidder      User?     @relation(fields: [bidderId], references: [id])
  @@unique([lotId, seq])
  @@index([lotId, bidderId])
}
// Em Lot: bids Bid[]; em User: bids Bid[]
```

SQL anexado à migração (`migration.sql`, escrito à mão após o `prisma migrate dev --create-only`):
```sql
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_shape_chk" CHECK (
  (kind = 'BID'    AND "bidderId" IS NOT NULL AND pseudonym IS NOT NULL AND "amountCents" IS NOT NULL AND "amountCents" > 0)
  OR
  (kind = 'CANCEL' AND "bidderId" IS NULL     AND pseudonym IS NULL     AND "amountCents" IS NULL)
);
CREATE FUNCTION bid_block_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Bid é append-only (UPDATE/DELETE proibido)'; END $$;
CREATE TRIGGER bid_no_update_delete BEFORE UPDATE OR DELETE ON "Bid"
  FOR EACH ROW EXECUTE FUNCTION bid_block_mutation();
```
- Sem trigger de `TRUNCATE` de propósito: a limpeza de testes usa `TRUNCATE … CASCADE`. O teste de adulteração (S08) desativa o trigger com `ALTER TABLE "Bid" DISABLE TRIGGER bid_no_update_delete`.
- `Lot` já tem `currentBidCents`, `leaderId`, `bidCount`, `entryCount`, `lastHash`, `seal`, `endsAt`, `originalEndsAt` (S02). Se faltar índice, `@@index([leaderId])` em `Lot` (usado por `leadingLots`).
- **Não criar ainda:** `Receipt` (S05).
- Dinheiro sempre `BigInt`; `$queryRaw` devolve `bigint` — converter nos mappers (assert ≤ `Number.MAX_SAFE_INTEGER`).

## 6. Contratos REST

Todos os erros usam o envelope; toda resposta de estado de lote traz `serverTime` (ISO UTC).

### `POST /lots/:id/bids`
| Campo | Valor |
| --- | --- |
| Papel | logado (`requireAuth`); `AUCTIONEER` chega ao service e é barrado na checagem 7 |
| Corpo | `{ "amountCents": inteiro ≥ 1 e ≤ MAX_SAFE_INTEGER, "expectedCurrentCents": inteiro ≥ 0 \| null }` (zod; ambas as chaves obrigatórias) |
| 201 | `{ bid: {seq, pseudonym, amountCents, at}, lot: LotSummary, wallet: {totalCents, committedCents, availableCents}, serverTime }` |
| Erros | `UNAUTHENTICATED` 401 · `VALIDATION` 400 `{fields:{amountCents\|expectedCurrentCents: msg}}` · `NOT_FOUND` 404 · `LOT_CANCELLED` 409 · `LOT_NOT_STARTED` 409 `{startsAt}` · `LOT_ENDED` 409 · `BELOW_MINIMUM` 422 `{minimumCents, currentBidCents, reason}` · `ALREADY_WINNING` 409 · `ROLE_NOT_ALLOWED` 403 · `INSUFFICIENT_BALANCE` 422 `{availableCents}` · `RATE_LIMITED` 429 |

`LotSummary` = `{ id, status, currentBidCents, minimumBidCents, bidCount, bidderCount, version, entryCount (alias de version), endsAt, originalEndsAt, extended: endsAt > originalEndsAt, myRank, myBestBidCents, myPseudonym }`.
`extended` do resumo é derivado do lote (prorrogado em qualquer momento), diferente do `extended` do evento (que diz se **este** lance prorrogou).

### `GET /lots/:id` (já existe na S02; acrescentar)
Público; token Bearer opcional (token inválido/expirado em `GET` público ⇒ trata como visitante, **sem 401**). Novos campos no `LotState`:
| Campo | Tipo | Nota |
| --- | --- | --- |
| `currentBidCents` | number\|null | |
| `minimumBidCents` | number | mínimo aceito agora (`startingBidCents` sem lances; senão atual + incremento). O cliente usa este valor; não recalcula |
| `bidCount`, `bidderCount` | number | `bidderCount` = licitantes distintos |
| `version` | number | = `entryCount` depois da última operação. **Nome que o cliente lê** (reducer, cache, eventos). `entryCount` segue como alias de compatibilidade |
| `originalEndsAt` | ISO | para o selo "+2 MIN" |
| `bids[]` | `{seq, kind:"BID", pseudonym, amountCents, at}` | do mais novo para o mais antigo (`seq` desc), só `kind=BID`, sem paginação |
| `myPseudonym` | string\|null | só `BIDDER` logado |
| `myRank`, `myBestBidCents` | number\|null | só `BIDDER` logado que já deu lance |
Nunca expor `bidderId`, `leaderId`, nome, e-mail.

### `GET /wallet` (já existe na S01; passa a preencher)
`leadingLots: [{ lotId, number, title, committedCents }]` = lotes com `leaderId = eu`, `cancelledAt IS NULL` e `settledAt IS NULL` (ao vivo ou apurando), ordenados por `endsAt` asc. `committedCents = currentBidCents`. Ledger: o extrato passa a trazer linhas `HOLD` e `RELEASE` (S01 já formata todos os tipos; ver §9.4).

## 7. Contratos Socket.IO

Nenhum nesta fatia (o `Publisher` é `NoopPublisher` até a S04). O service **já produz** os eventos, para a S04 só trocar o publisher:

| Evento | Sala | Payload (sempre com `serverTime`) |
| --- | --- | --- |
| `bid:placed` | `lot:{id}` | `{lotId, version: entryCount, bid:{seq, pseudonym, amountCents, at}, currentBidCents, bidCount, bidderCount, endsAt, extended}` (`extended` = este lance prorrogou; `bidderCount` calculado no servidor, §4.3) |
| `showcase:lot` | `showcase` | `LotCard` do lote atualizado (`toLotCard`), com `version` |
| `wallet:updated` | `user:{bidderId}` | `{totalCents, committedCents, availableCents}` |
| `wallet:updated` | `user:{prevLeaderId}` (se houve) | idem, com o saldo liberado |

Teste: com um `Publisher` falso, a rota recebe exatamente esses eventos depois do commit e nenhum quando a tx falha.

## 8. Mensagens

O servidor compõe `error.message`; a tela mostra o texto **do servidor** em `RefusalMessage` (role="alert", ícone + texto) e usa `details` só para efeitos colaterais (atualizar mínimo, link). Formato de valor: `R$ 31.000,00` (`formatBRL`). Horários em America/Sao_Paulo.

| Código | HTTP | Texto exato | Origem | Onde / ação |
| --- | --- | --- | --- | --- |
| `BELOW_MINIMUM` (`MINIMUM`) | 422 | `Seu lance precisa ser de pelo menos R$ {minimumCents},00.` → ex. "Seu lance precisa ser de pelo menos R$ 31.000,00." | design/PRD | Sala; borda do campo ferrugem; usuário corrige |
| `BELOW_MINIMUM` (`OUTDATED`) | 422 | `Alguém levantou a mão antes de você. O mínimo agora é R$ {minimumCents},00.` (texto a revisar) | EXPERIENCE | Sala; campo mantém o digitado; regra e lance atual atualizam |
| `BELOW_MINIMUM` (`OWN_LEAD`) | 422 | `Você já está na frente. Para cobrir o próprio lance, o mínimo é R$ {minimumCents},00.` (texto a revisar) | novo (efeito de C1, ver §16) | Sala; borda do campo ferrugem; o líder que reenvia valor abaixo do mínimo nunca lê "alguém levantou a mão" |
| `INSUFFICIENT_BALANCE` | 422 | `Saldo insuficiente: você tem R$ {availableCents},00 disponíveis.` + link `Depositar na carteira →` (para `/carteira`) | design | Sala; borda do campo ferrugem; `aria-invalid` |
| `ALREADY_WINNING` | 409 | `Você já está na frente. Cobrir o próprio lance só gasta saldo.` | design | Sala; sem borda de erro |
| `LOT_ENDED` | 409 | `Martelo batido às {HH:mm}. Este lote não aceita mais lances.` ({HH:mm} = `endsAt` em Brasília) | design | Sala; botão vira "Lote fechado" |
| `LOT_NOT_STARTED` | 409 | `O lote abre {dia-da-semana}, {dd/mm}, às {H}h{mm se ≠ 00}. Até lá o martelo fica na gaveta.` → ex. "O lote abre sexta-feira, 24/10, às 14h. Até lá o martelo fica na gaveta." (texto a revisar; base no PRD "Este lote abre em 24/10 às 14:00.") | EXPERIENCE | só via API/corrida (a Sala agendada não tem formulário) |
| `LOT_CANCELLED` | 409 | `Este lote foi cancelado pelo leiloeiro.` | PRD (vence o EXPERIENCE, ver §16) | corrida/API; Sala vira cancelado. O texto longo "O leiloeiro cancelou este lote. Nada foi vendido e todo saldo travado voltou." é só o **aviso da Sala cancelada** (S06), não o `RefusalMessage` |
| `ROLE_NOT_ALLOWED` | 403 | `Leiloeiro vende, não compra. Lance é coisa de licitante.` (texto a revisar) | EXPERIENCE | API (a Sala do leiloeiro não mostra formulário) |
| `UNAUTHENTICATED` | 401 | `Entre para dar lances.` | novo | sessão expirada: S01 já limpa o token e leva a `/entrar?next=` |
| `VALIDATION` | 400 | `Informe um valor de lance válido.` (campo `amountCents`) (texto a revisar) | novo | só por API; a UI valida antes |
| `RATE_LIMITED` | 429 | `Calma: lances demais em pouco tempo. Tente de novo em instantes.` (texto a revisar; mensagem desta rota, o padrão da S00 vale nas demais) | novo | Sala |
| `NOT_FOUND` | 404 | `Lote não encontrado.` | novo | Sala já trata (S02) |

Mensagens só do cliente (sem requisição, texto a revisar):
| Situação | Texto |
| --- | --- |
| Campo vazio ao enviar | `Informe o valor do lance.` (sem request; `aria-invalid`) |
| Falha de rede / timeout no envio (resultado ambíguo) | `Sem resposta do pátio. Seu lance pode ou não ter entrado: confira o histórico antes de tentar de novo.` (não reenvia sozinho; refaz `GET` do lote) |
| Enviando | botão `Enviando…` |

## 9. Telas e estados

### 9.1 Sala do lote (`/lotes/[id]`) — acréscimos da S03
Acesso: todos veem; só `BIDDER` dá lance. Estrutura desktop (≥ ~1000 px): duas colunas fluidas — ficha do carro à esquerda (`flex: 1 1 520px`, já existe, S02) e **painel de lance + histórico** à direita (`flex: 1 1 440px`, máx. 560 px), gap 36. Mobile (390 px): colunas empilham, **ficha primeiro, depois o painel** (ordem do DOM; sem barra fixa nem atalho novo). Sem media queries de largura (`flex-wrap`, `clamp()`).

Ordem do painel (de cima para baixo), dentro de um cartão `papel`, borda 3px `linha`, sombra dura 8px, padding 24px:
1. `Cronometro` (S02) e, se `extended`, o parágrafo de prorrogação (§9.3).
2. `PlacaLance` com rótulo "LANCE ATUAL" (ou "LANCE INICIAL" sem lances) e contador "NN LANCES".
3. **Faixa de situação** (`PlacarPosicao` ou `FaixaStatus`, conforme o estado) dentro de uma região `aria-live="polite"`.
4. Formulário de lance (só `BIDDER` logado, lote ao vivo).
5. Histórico de lances.

### 9.2 Estados da Sala (viewer × lote)
Em todos, `Cronometro` e ficha seguem as regras da S02. "Faixa" = `FaixaStatus`; "Placar" = `PlacarPosicao`.

| Estado | Condição | Tratamento |
| --- | --- | --- |
| **Ganhando** | `BIDDER`, lote LIVE, `myRank == 1` (sou o líder) | Placar verde: `Você está ganhando` + contador `1º de {N}` (N = `bidderCount`). Rodapé do campo: `R$ {meuLance},00 travados neste lote`. Formulário visível; enviar ⇒ `ALREADY_WINNING` ou `BELOW_MINIMUM` (§4.2). Topo do histórico com marca VOCÊ |
| **Superado** | `BIDDER`, LIVE, `myBestBidCents != null` e não sou o líder | Placar ferrugem: `Você foi superado` + `Seu lance (R$ {meuMaior},00) é o {rank}º maior de {N}`. Rodapé do campo: `Nada travado neste lote`. Saldo já liberado (chip). Formulário visível com o mínimo atual |
| **Nunca deu lance** | `BIDDER`, LIVE, `myBestBidCents == null` | Faixa neutra (`tinta`): título `Você ainda não deu lance`, sub `Mínimo aceito R$ {min},00.` Formulário visível. Nunca renderizar "0º maior" |
| **Ao vivo sem lances** | LIVE, `bidCount == 0` | Placa com rótulo `LANCE INICIAL` e o `startingBidCents`; contador `00 LANCES`; histórico vazio: `Nenhum lance ainda. O mínimo é o lance inicial.`; campo inicia no `startingBidCents` |
| **Visitante** | sem sessão, LIVE | Faixa neutra: título `Você está assistindo`, sub `Sem conta você vê tudo, só não pode levantar a mão.` No lugar do formulário: botão primário grande **"Entre para dar lances"** (link `/entrar?next=/lotes/{id}`) + texto `Assistir é de graça e sem cadastro. Para disputar, crie uma conta e deposite saldo simulado. Mínimo aceito agora: R$ {min},00.` Histórico sem "VOCÊ". Nav principal/chips ausentes (S01) |
| **Leiloeiro** | `AUCTIONEER`, LIVE | Faixa neutra: título `Leiloeiros não podem dar lances`, sub `Você vê a Sala como espectador.` (sub: texto a revisar). **Sem formulário** |
| **Agendado** | SCHEDULED | Herdado da S02 (sem formulário, sem painel de lance, contagem para abrir). Quando o cronômetro local chega a 00:00, **não** liberar o formulário por conta própria: refazer `GET /lots/:id` (e repetir a cada 2 s, até 10 vezes) e só renderizar o painel quando o servidor devolver `LIVE` |
| **Cancelado** | CANCELLED | Herdado da S02 (carimbo Cancelado, sem formulário). Sala aberta que recebe `LOT_CANCELLED` num lance refaz o `GET` e cai neste estado. Estorno/histórico: S06 |
| **00:00 / apurando** | cronômetro local em 00:00 ou `LOT_ENDED`, `status` CLOSING | Antes de bloquear: refazer `GET` (a prorrogação pode ter empurrado o fim). Se `LIVE` ⇒ segue ao vivo. Se `CLOSING` ⇒ formulário some; faixa neutra `Martelo batido. Apurando o resultado…`; botão `botao-desabilitado` **"Lote fechado"**; `GET` a cada 3 s até mudar. O resultado (vencedor, carimbo, comprovante) é da S05 |

Estados do formulário:
| Estado | Tratamento |
| --- | --- |
| Padrão | Campo = `minimumBidCents`; botão "Dar lance" |
| Digitando | Máscara (§9.3); valor digitado = "sujo" (`dirty`) |
| Enviando | Botão `aria-disabled="true"` + `aria-busy`, texto `Enviando…`; envio ignorado (sem double submit); foco não sai do campo |
| Recusa | `RefusalMessage` colada ao botão, uma por vez; o valor digitado permanece; some ao editar o campo ou usar atalho; borda do campo ferrugem só em `BELOW_MINIMUM` e `INSUFFICIENT_BALANCE`; `aria-invalid="true"` + `aria-describedby` apontando para a recusa |
| Sucesso | Sem toast. Placa vira, faixa muda para "Você está ganhando", linha nova no topo do histórico (animações `la-entra` + `la-marca`), campo volta a `minimumBidCents` novo e `dirty=false`, foco permanece no campo |
| Carregando a Sala | `FeedbackState` "Carregando…" com o espaço do painel preservado (sem skeleton animado) |
| Erro ao carregar | `FeedbackState` erro + botão "Tentar novamente" (secundário) |

### 9.3 Comportamento do painel de lance
1. **Campo** (`campo` composto): rótulo visível "Seu lance"; prefixo "R$" (Plex Mono 600 18px); input texto numérico (`inputmode="numeric"`, Plex Mono 600 28px, `min-height: 56px`); sufixo fixo ",00". `aria-describedby` → texto de regra `Mínimo aceito R$ {min},00 · incremento R$ {inc},00` (valores do lote; nunca fixos) e, se houver, a recusa. O **nome acessível** do campo é só "Seu lance" (a regra não entra no nome). Alvo mínimo 44 px em tudo que clica.
2. **Valor inicial** = `minimumBidCents / 100`. Enquanto `dirty == false`, o campo **acompanha** o `minimumBidCents` quando ele muda (ex.: refetch após `OUTDATED`). Depois que o usuário edita, o campo mantém o que ele digitou e só o texto de regra muda.
3. **Máscara:** ao digitar ou colar, manter só dígitos (máx. 13 dígitos, limite técnico para caber em `MAX_SAFE_INTEGER` em centavos), reaplicar o separador de milhar `.` a cada tecla preservando a posição do cursor. Valor enviado = `Number(dígitos) * 100`. Função pura testada (`maskReais`, `parseReais`).
4. **Atalhos** `+ R$ 500`, `+ R$ 1.000`, `+ R$ 5.000` (`botao-atalho`: borda 2px `linha`, min-height 44px, Plex Mono 14px, tipo `button`): **somam ao valor atual do campo** (não ao lance atual); **campo vazio parte do `minimumBidCents`**. Fixos para todos os lotes, independentes do incremento. Limpam a recusa; marcam `dirty`.
5. **Enviar:** `<form>`; botão "Dar lance" (`botao-primario`, na Sala: Big Shoulders 900 30px, `min-height: 64px`, sombra 6px) e **Enter** no campo enviam. Campo vazio ⇒ mensagem local `Informe o valor do lance.` sem request.
6. Corpo enviado: `{ amountCents, expectedCurrentCents: lot.currentBidCents }` — o `currentBidCents` do **último estado que a tela mostra** (`null` sem lances).
7. **Sem atualização otimista.** Após 201: aplicar a resposta ao cache da Sala (`applyLotEvent`, ver §15), atualizar `wallet` no cache (`["wallet","summary"]`, chave definida na S01) (chip "DISPONÍVEL"), e refazer `GET /lots/:id` para reconciliar histórico de terceiros.
8. **Efeitos por erro:** `BELOW_MINIMUM` ⇒ aplicar `details.minimumCents` ao texto de regra e refazer `GET` (se `OUTDATED`, o lance atual mudou); `INSUFFICIENT_BALANCE` ⇒ link para `/carteira`; `LOT_ENDED` ⇒ refaz `GET` e vai para "apurando"; `LOT_CANCELLED`/`LOT_NOT_STARTED` ⇒ refaz `GET`; `ALREADY_WINNING` ⇒ nada; `UNAUTHENTICATED` ⇒ comportamento da S01; falha de rede ⇒ mensagem ambígua (§8), **nunca** reenviar automaticamente.
9. **Prorrogação visível (derivada do estado):** se `endsAt > originalEndsAt`, `Cronometro` mostra o selo `+2 MIN` (S02) e abaixo dele o parágrafo: `Lance nos 2 minutos finais: o relógio ganhou +2 min. Novo fim às {HH:mm:ss}. Ninguém leva no susto.` (HH:mm:ss em Brasília), que fica até o encerramento. Nesta fatia ele aparece para quem recarrega ou deu o lance; a propagação ao vivo para os demais é S04.
10. **Rodapé do campo:** `R$ {meuLance},00 travados neste lote` (ganhando) / `Nada travado neste lote` (superado e nunca deu lance).
11. **Live regions:** só a região da faixa/placar (`aria-live="polite"`) anuncia mudança de situação (ganhando, superado, apurando); **o histórico não é live**; recusas por `role="alert"`; o cronômetro não anuncia por segundo (S02).

### 9.4 Carteira (`/carteira`) — acréscimos
- Bloco "Comprometido": `Travado onde você lidera: {lista}. Volta se alguém cobrir.` Cada item `Lote {NNN} · {título} · R$ {committedCents},00`, link para `/lotes/{lotId}` (a S07 troca para Meus arremates). Sem itens: `Nada travado no momento.` (texto a revisar).
- Extrato: `HOLD` = `Lance · R$ travados` (comprometido +, total não muda); `RELEASE` = `Saldo liberado · lance superado` (comprometido −, total não muda); o texto deixa claro `TOTAL NÃO MUDA`. Linhas com número do lote. (`REFUND` é S06.)

### 9.5 Histórico de lances (dentro da Sala)
Título "Histórico de lances" + contador `NN LANCES` / `01 LANCE` (Plex Mono, 2 dígitos; singular quando 1). Lista ordenada (`ol`, mais novo primeiro). Cada linha: `Nº {seq}` (mono) · `chip-licitante` com `Licitante XXXX` (+ marca **VOCÊ** quando o pseudônimo é o meu) · valor `R$ X,00` (mono 600) · horário `HH:mm:ss` (Brasília, mono). Linha nova entra com `la-entra` (desce de −16px, .4s) e flash `la-marca` (ocre `rgba(226,165,20,.55)`→0, ~1.7s). Sem paginação (volume do seed é pequeno). Não é live region. Vazio: `Nenhum lance ainda. O mínimo é o lance inicial.`

## 10. Componentes criados

Tokens por nome (os valores já estão em `globals`/Tailwind desde a S00, nos dois temas): `fundo, papel, suave, tinta, tinta2, linha, sombra, ocre, sobreOcre, ferrugem, verde, sobreCor, painel` e fixas `digitoPlaca (#F5EEDF), linhaCentralPlaca (#000)`. Usar sempre a chave do tema ativo.

### PlacaLance (já criado na S02 §10.5)
Reutilize o componente da S02 sem recriá-lo. Esta fatia só passa o valor real e o rótulo ("LANCE ATUAL" com lances, "LANCE INICIAL" sem), de modo que o flip `la-vira` (.5s, atraso .06s por dígito, desligado em `prefers-reduced-motion`) dispare quando o valor **muda** (nunca na primeira pintura). Garanta `aria-label="Lance atual R$ 31.000,00"` (ou "Lance inicial R$ …") no container e `aria-hidden` nas placas.

### PlacarPosicao
Faixa de posição. Borda 3px `tinta`, padding `12px 16px 10px`, texto `sobreCor`, título Big Shoulders 900 30px caixa-alta (`typography.placar`), contador Plex Mono 13px. Fundo `verde` (ganhando) ou `ferrugem` (superado). Texto: ver §9.2. Dentro da região live.

### FaixaStatus
Faixa de situação sem ação. Título Big Shoulders 900 `clamp(30px, 5vw, 42px)` caixa-alta (o miolo do clamp é sugestão), subtítulo Plex Mono 13px. Variantes nesta fatia: **neutro** (fundo `tinta`, texto `fundo`). (As variantes verde/ferrugem de "arrematou"/"martelo batido" chegam na S05.) Dentro da região live.

### ChipLicitante
Plex Mono 14px, borda 2px `tinta`, padding `3px 8px`. Marca "VOCÊ": fundo `ocre`, texto `sobreOcre`, peso 600 (anexada ao chip, nunca só cor).

### BidForm / BidPanel / BidHistory
Composição da §9. O campo reutiliza `Field` (S00) com variante composta (prefixo/sufixo). Atalhos reutilizam `Button` variante `atalho` (S00). Recusa reutiliza `RefusalMessage` (S00): `2px dashed ferrugem`, texto `ferrugem`, ícone SVG 18×18 (círculo cortado, traço 2px, `aria-hidden`), `padding 8px 10px`, Newsreader 15px, `role="alert"`; cor + ícone + texto.

### Utilitários testáveis (web)
`maskReais(raw): string`, `parseReais(masked): number|null`, `ordinal(n): "2º"`, `plural(n, "lance")`, `applyLotEvent(state, event)` (puro; **reducer único**, lê só `version`: a S03 já o cria para a resposta do lance e a S04 acrescenta `lot:closed`/`lot:cancelled`/`showcase:lot`).

## 11. Seed desta fatia

Estende `prisma/seed.ts`: no **lote ao vivo** do seed (S02, 30 dias, sem lances), registrar **5 lances alternados** entre os 2 licitantes **pelo mesmo service** `placeBid` (nunca insert direto; a cadeia nasce válida), cada um no `minimumBid` corrente, terminando com o **segundo licitante** liderando (o primeiro fica "superado", demonstrando "Cobrir lance"). Usar o `Clock` real (o lote fica 30 dias aberto, longe da janela de 2 min). O seed falha com mensagem clara se algum lance for recusado (ex.: depósitos da S01 insuficientes — então elevar os depósitos do seed para cobrir). Os pseudônimos resultantes são por lote (HMAC), portanto diferentes dos de outros lotes.

## 12. Critérios de aceite

Convenção de unidades: valores em reais nos enunciados; no teste, centavos. Lote de referência **L**: lance inicial R$ 25.000, incremento R$ 1.000, ao vivo, sem lances, `endsAt` longe. Usuários: Ana, Bruno, Carla (`BIDDER`), João (`AUCTIONEER`).

**Período do lote (AC1 · R1 · M4 M5 M6)**
- AC-3.1 [auto] Dado lote agendado (`startsAt` = agora + 1h), quando Ana dá lance, então 409 `LOT_NOT_STARTED` com `details.startsAt` e o texto "O lote abre …, às …h. Até lá o martelo fica na gaveta."; nenhuma linha em `Bid`, carteira inalterada, `entryCount = 0`.
- AC-3.2 [auto] Dado `now == startsAt` exato (FakeClock), quando Ana dá lance válido, então 201 (início inclusivo).
- AC-3.3 [auto] Dado `now == endsAt` exato, quando Ana dá lance válido, então 409 `LOT_ENDED` ("Martelo batido às HH:mm. Este lote não aceita mais lances."); com `now = endsAt − 1 ms`, 201 (fim exclusivo).
- AC-3.4 [auto] Dado lote com `cancelledAt` preenchido, quando Ana dá lance, então 409 `LOT_CANCELLED` com o texto "Este lote foi cancelado pelo leiloeiro." (PRD).
- AC-3.5 [auto] Dado lote encerrado **e** cancelado, então `LOT_CANCELLED` (checagem 2 vem antes da 4).
- AC-3.6 [auto] Dado id de lote inexistente, então 404 `NOT_FOUND`.

**Valor mínimo (AC2 · R2 · M1 M8)**
- AC-3.7 [auto] Dado L sem lances, quando Ana dá lance de R$ 24.999,99 (2.499.999 centavos), então 422 `BELOW_MINIMUM` `{minimumCents: 2500000, currentBidCents: null, reason: "MINIMUM"}`; carteira intacta.
- AC-3.8 [auto] Dado L sem lances, quando Ana dá exatamente R$ 25.000, então 201 (primeiro lance `>=` inicial).
- AC-3.9 [auto] Dado L com lance atual R$ 30.000, quando Bruno (com `expectedCurrentCents = 3000000`) dá R$ 30.999,99, então 422 `BELOW_MINIMUM` com `minimumCents 3100000` e `reason MINIMUM` (esperado == atual); texto "Seu lance precisa ser de pelo menos R$ 31.000,00."
- AC-3.10 [auto] Idem, quando Bruno dá exatamente R$ 31.000, então 201.
- AC-3.11 [auto] Dado lance atual 30.000 e Bruno enviando `expectedCurrentCents = 2900000` (viu 29.000, mas já é 30.000) com valor R$ 30.500, então 422 `BELOW_MINIMUM` `reason: "OUTDATED"`, `minimumCents 3100000`, texto "Alguém levantou a mão antes de você. O mínimo agora é R$ 31.000,00."
- AC-3.12 [auto] Dado `expectedCurrentCents` ≠ atual mas `amount >= minimumCents`, então 201 (o desatualizado só importa na recusa).
- AC-3.13 [auto] Corpo sem `expectedCurrentCents` ou `amountCents` ≤ 0 / fracionário / string ⇒ 400 `VALIDATION` com `fields`.

**Liderança (AC3 · R3 · M3)**
- AC-3.14 [auto] Dado Ana líder com R$ 30.000, quando Ana envia R$ 31.000, então 409 `ALREADY_WINNING` ("Você já está na frente. Cobrir o próprio lance só gasta saldo."); nada muda.
- AC-3.15 [auto] Dado Ana líder, quando Ana envia R$ 30.500 (abaixo do mínimo), então 422 `BELOW_MINIMUM` (C1: valor antes de liderança) com `details.reason: "OWN_LEAD"` e texto "Você já está na frente. Para cobrir o próprio lance, o mínimo é R$ 31.000,00.", **não** `ALREADY_WINNING`.
- AC-3.16 [auto] Dado Ana líder sem saldo para o valor, quando envia R$ 1.000.000, então 409 `ALREADY_WINNING` (liderança antes de saldo).

**Papel (R4 · M7)**
- AC-3.17 [auto] Dado João (`AUCTIONEER`), L ao vivo, quando envia R$ 25.000, então 403 `ROLE_NOT_ALLOWED` ("Leiloeiro vende, não compra. Lance é coisa de licitante."); nenhuma linha em `Bid`.
- AC-3.18 [auto] Dado João e lote encerrado, então `LOT_ENDED` (C1). Dado João e valor R$ 1, então `BELOW_MINIMUM`.
- AC-3.19 [auto] Sem header Authorization ⇒ 401 `UNAUTHENTICATED` antes de abrir transação.

**Saldo (AC4 · R5 R7 R8 R9 · M2)**
- AC-3.20 [auto] Dado Ana com total R$ 50.000 e disponível R$ 20.000 (lidera outro lote com R$ 30.000), quando dá R$ 25.000 no lote B, então 422 `INSUFFICIENT_BALANCE` `{availableCents: 2000000}`, texto "Saldo insuficiente: você tem R$ 20.000,00 disponíveis."; carteira e ledger inalterados.
- AC-3.21 [auto] Dado disponível exatamente R$ 25.000 e lance de R$ 25.000, então 201 e disponível 0; com lance de R$ 25.000,01 ⇒ `INSUFFICIENT_BALANCE`.
- AC-3.22 [auto] **Exemplo do PRD.** Ana deposita R$ 50.000 (total 5.000.000 · comp 0 · disp 5.000.000). Lote A (inicial R$ 25.000, incremento R$ 1.000): Ana dá R$ 30.000 ⇒ comp 3.000.000, disp 2.000.000, ledger `HOLD 3000000`. Lote B: Ana tenta R$ 25.000 ⇒ `INSUFFICIENT_BALANCE`. Bruno (depositou R$ 40.000) cobre A com R$ 31.000 ⇒ Ana comp 0, disp 5.000.000, ledger Ana `RELEASE 3000000` (lotId A) na mesma transação do lance do Bruno; Bruno comp 3.100.000. Ana volta a liderar A com R$ 32.000 ⇒ Ana comp 3.200.000 e disp 1.800.000; Bruno comp 0 (`RELEASE 3100000`). O `total` de ambos não mudou em nenhum passo (liquidação é S05).
- AC-3.23 [auto] Dado qualquer sequência de lances, então para toda carteira: `committed >= 0`, `total >= committed`, e `totalAfter/committedAfter` do último `LedgerEntry` = valores da carteira.
- AC-3.24 [auto] Dado usuário sem linha em `Wallet`, quando dá lance, então 422 `INSUFFICIENT_BALANCE` com `availableCents: 0` e nenhuma carteira criada.
- AC-3.25 [auto] Dado um lance aceito e uma falha forçada ao inserir `Bid` (ex.: violação de `@@unique` simulada), então rollback total: carteiras, ledger e lote iguais ao estado anterior, e nenhum evento publicado.

**Efeitos, hash e privacidade (R6 R8 · H1 H2 H3 · P2 P3)**
- AC-3.26 [auto] Dado primeiro lance de Ana em L, então `Bid.seq = 1`, `kind BID`, `prevHash == lot.genesis` (= `lastHash` anterior), `hash` bate com o recálculo independente (`v1|entry|…`), `lot.entryCount = 1`, `lot.bidCount = 1`, `lot.lastHash == hash`, `lot.seal == HMAC("v1|seal|{lotId}|1|{hash}")`, `currentBidCents` e `leaderId` atualizados.
- AC-3.27 [auto] Dado segundo lance, então `seq = 2`, `prevHash == hash do seq 1`, seal recalculado com `entryCount = 2`.
- AC-3.28 [auto] Vetor fixo de HMAC (§4.5) confere; `at` serializado com ms (`.123Z`).
- AC-3.29 [auto] Dado `UPDATE "Bid" …` ou `DELETE FROM "Bid" …` por SQL cru, então o Postgres rejeita com "Bid é append-only" (R6).
- AC-3.30 [auto] O pseudônimo de Ana em L difere do de Ana em outro lote (HMAC com `lotId`); é `"Licitante "` + 4 hex maiúsculos; o mesmo em todos os lances dela no mesmo lote.
- AC-3.31 [auto] `GET /lots/:id` e a resposta do `POST` não contêm as chaves `userId`, `bidderId`, `leaderId`, `email`, `name` em nenhum nível (teste por varredura de chaves do JSON).

**Prorrogação (AC6 · R10)** — fim `E`
- AC-3.32 [auto] Dado `E − now = 2 min 0,001 s` (2:00.001), quando lance válido, então `endsAt` inalterado, `extended = false`.
- AC-3.33 [auto] Dado `E − now = 2:00.000` exato, quando lance válido, então `endsAt = now + 2 min` (= E) e `extended = false`.
- AC-3.34 [auto] Dado `E − now = 1:59.999`, então `endsAt = now + 2 min` (= E + 1 ms), `extended = true`, `originalEndsAt` inalterado.
- AC-3.35 [auto] Dado `E − now = 1 ms`, então aceito, `endsAt = now + 2 min`.
- AC-3.36 [auto] Dado lances sucessivos nos 2 min finais, cada um empurra o fim para `now + 2 min`, sem teto (10 prorrogações seguidas ⇒ `endsAt` = último `now + 2 min`; `originalEndsAt` constante).
- AC-3.37 [manual] Dado lance feito no último minuto, quando a Sala de quem deu o lance atualiza, então o `Cronometro` mostra o selo "+2 MIN" e o parágrafo "Lance nos 2 minutos finais: o relógio ganhou +2 min. Novo fim às HH:mm:ss. Ninguém leva no susto." (propagação a outros navegadores sem recarregar: S04).

**Concorrência (AC5 · TX)**
- AC-3.38 [auto] Dado L e 10 licitantes com saldo, quando `Promise.all` de 10 lances de R$ 25.000 (todos `expected = null`), então exatamente 1 retorna 201 e 9 retornam 422 `BELOW_MINIMUM`/`OUTDATED`; `bidCount = 1`; um único líder; soma de `committed` de todas as carteiras = R$ 25.000.
- AC-3.39 [auto] Dado 10 licitantes com saldos diferentes (alguns abaixo do valor que ofertam) e `Promise.all` de 10 lances com valores distintos e crescentes (R$ 25.000, 26.000 … 34.000), então: `seq` contíguos `1..k`, `amountCents` estritamente crescente, `currentBidCents` = último aceito, líder = autor do último aceito; soma de `committed` de todas as carteiras = `currentBidCents`; cada superado com `committed` 0 neste lote; nenhum `committed > total`; ledger `HOLD − RELEASE` líquido de cada usuário = seu `committed`; cadeia recomputada confere ponta a ponta; todas as recusas são `BELOW_MINIMUM` ou `INSUFFICIENT_BALANCE`.
- AC-3.40 [auto] Dado 20 rodadas do AC-3.39 com ordens aleatórias, então as invariantes valem em todas e nenhum teste trava (timeout 10 s por rodada ⇒ sem deadlock).
- AC-3.41 [auto] **Deadlock cruzado:** Ana lidera L1, Bruno lidera L2 (ambos com saldo). Em `Promise.all`: Ana cobre Bruno em L2 e Bruno cobre Ana em L1. Então ambas as transações terminam (sem deadlock/timeout), ambos os lances aceitos, saldos coerentes (cada um com 1 lote travado), ledger consistente.
- AC-3.42 [auto] Duplo envio idêntico do mesmo usuário em paralelo (mesmo valor, `expected` igual): 1 aceito, 1 recusado com `BELOW_MINIMUM` e `details.reason: "OWN_LEAD"` (o segundo envio chega com o próprio usuário já líder; texto "Você já está na frente. Para cobrir o próprio lance, o mínimo é R$ …"), um único `HOLD`.
- AC-3.65 [auto] Dado Ana líder com R$ 30.000, quando Bruno cobre com R$ 31.000 e Ana (com `expected = 3000000`, desatualizado) envia R$ 30.500, então `BELOW_MINIMUM` com `reason: "OUTDATED"` (Ana já não é líder); e quando Bruno (líder) reenvia R$ 31.500 com `expected` correto, então `reason: "OWN_LEAD"`.
- AC-3.43 [auto] Lance concorrente contra o mesmo lote por usuários diferentes + um `GET` do lote: o `GET` nunca devolve `currentBidCents` sem o `bid` correspondente em `bids[]` (consistência de leitura).

**Posição e privacidade na leitura**
- AC-3.44 [auto] Dado lances Ana 30.000, Bruno 31.000, Carla 32.000, Ana 33.000: `GET` como Ana ⇒ `myRank 1`, `bidderCount 3`; como Bruno ⇒ `myRank 3`, `myBestBidCents 3100000` ("Seu lance (R$ 31.000,00) é o 3º maior de 3"); Ana contada uma vez.
- AC-3.45 [auto] `GET` como visitante ou `AUCTIONEER`: `myPseudonym/myRank/myBestBidCents` nulos; `bids[]` presente; token inválido não causa 401.
- AC-3.46 [auto] `GET /wallet` de Ana líder em L e L2: `leadingLots` lista os 2 com `committedCents` = lance atual de cada um; depois de ser superada em L, L sai da lista.

**Telas [manual], dado/quando/então**
- AC-3.47 [manual] Dado Ana logada em L ao vivo, quando abre a Sala, então vê placa "LANCE ATUAL", histórico com marca "VOCÊ" nos lances dela, formulário com campo = mínimo aceito e texto "Mínimo aceito R$ …,00 · incremento R$ …,00" do lote (não R$ 500 fixo).
- AC-3.48 [manual] Dado campo com "31000", quando clica "+ R$ 1.000", então campo mostra "32.000"; com campo vazio e mínimo 31.000, "+ R$ 500" ⇒ "31.500".
- AC-3.49 [manual] Dado digitar "1234567" ⇒ campo mostra "1.234.567" com cursor preservado; colar "R$ 12.500,00" ⇒ só dígitos "1250000" ⇒ "1.250.000" (o ",00" colado vira dígitos; comportamento fixado em teste de `maskReais`).
- AC-3.50 [manual] Dado foco no campo, quando pressiona Enter, então envia; durante o envio o botão mostra "Enviando…" e um segundo Enter/clique não gera segunda requisição.
- AC-3.51 [manual] Dado lance abaixo do mínimo, então `RefusalMessage` aparece logo abaixo/colada ao botão, borda do campo ferrugem, valor digitado permanece; ao editar o campo, a recusa some.
- AC-3.52 [manual] Dado saldo insuficiente, então a recusa mostra o disponível exato e o link "Depositar na carteira →" abre `/carteira`.
- AC-3.53 [manual] Dado lance aceito, então placa vira, faixa "Você está ganhando · 1º de N" em verde, linha nova no topo do histórico, chip "DISPONÍVEL" reduz pelo valor, rodapé "R$ X,00 travados neste lote", sem toast.
- AC-3.54 [manual] Dado Bruno cobre (e Ana recarrega a Sala), então Ana vê "Você foi superado · Seu lance (R$ …,00) é o 2º maior de 2", rodapé "Nada travado neste lote" e chip com o saldo devolvido.
- AC-3.55 [manual] Dado Ana sem lances no lote, então vê faixa "Você ainda não deu lance" (nunca "0º maior") e formulário.
- AC-3.56 [manual] Dado L sem lances, então placa "LANCE INICIAL", "00 LANCES", "Nenhum lance ainda. O mínimo é o lance inicial.".
- AC-3.57 [manual] Dado visitante, então botão "Entre para dar lances" → `/entrar?next=/lotes/{id}`; sem campo de lance; histórico sem "VOCÊ".
- AC-3.58 [manual] Dado João (leiloeiro), então faixa "Leiloeiros não podem dar lances" e nenhum formulário.
- AC-3.59 [manual] Dado cronômetro local em 00:00, então o formulário é bloqueado, a tela refaz `GET`; se o lote foi prorrogado volta ao vivo; se `CLOSING` mostra "Martelo batido. Apurando o resultado…" e o botão desabilitado "Lote fechado".
- AC-3.60 [manual] Dado Sala agendada que chega a 00:00, então o formulário só aparece depois do `GET` devolver `LIVE`.
- AC-3.61 [manual] Dado falha de rede no envio, então aparece "Sem resposta do pátio. Seu lance pode ou não ter entrado: confira o histórico antes de tentar de novo.", nenhum reenvio automático, e o histórico é refeito.
- AC-3.62 [manual] Dado leitor de tela, então o campo se chama "Seu lance", a regra de mínimo é lida como descrição, a mudança Ganhando/Superado é anunciada uma vez (histórico não é live), a recusa é anunciada por `role="alert"`.
- AC-3.63 [manual] Dado 390 px, então a ficha vem antes do painel, a placa quebra de linha e não há rolagem horizontal da página; tema claro e noite legíveis.
- AC-3.64 [manual] Dado `/carteira` com Ana líder, então "Travado onde você lidera" lista o lote com link e valor; extrato mostra HOLD/RELEASE com "TOTAL NÃO MUDA".

## 13. Casos de borda e concorrência

| Caso | Resultado esperado |
| --- | --- |
| `now == startsAt` | aceito |
| `now == endsAt` | `LOT_ENDED`; `endsAt − 1 ms` aceito |
| `endsAt − now` = 2:00.001 / 2:00.000 / 1:59.999 / 1 ms | sem mudança / `endsAt` igual, `extended=false` / prorroga / prorroga |
| lance == mínimo (primeiro e seguintes) | aceito |
| lance == mínimo − 1 centavo | `BELOW_MINIMUM` |
| líder abaixo do mínimo | `BELOW_MINIMUM` com `reason: OWN_LEAD` (C1) |
| líder ≥ mínimo | `ALREADY_WINNING` |
| líder sem saldo | `ALREADY_WINNING` |
| leiloeiro: encerrado/cancelado/abaixo do mínimo/ok | `LOT_ENDED`/`LOT_CANCELLED`/`BELOW_MINIMUM`/`ROLE_NOT_ALLOWED` |
| saldo disponível == valor | aceito; +1 centavo ⇒ `INSUFFICIENT_BALANCE` |
| superado que volta a liderar no mesmo lote | RELEASE do rival + HOLD novo; seu comprometido = novo lance (não acumula o antigo, que foi liberado antes) |
| usuário sem carteira | `INSUFFICIENT_BALANCE` com `availableCents 0` |
| token expirado em `POST` | 401 `UNAUTHENTICATED`; em `GET` público ⇒ visitante |
| duplo clique (UI) | segundo envio ignorado pela UI; se chegar ao servidor: `BELOW_MINIMUM` com `reason: OWN_LEAD` (ver §16) |
| 10 lances simultâneos mesmo valor | 1 aceito, 9 `BELOW_MINIMUM` |
| 10 lances simultâneos crescentes, saldos diferentes | invariantes do AC-3.39 |
| lances cruzados em dois lotes (A↔B) | sem deadlock |
| processo cai após o INSERT e antes do COMMIT | rollback; sem evento |
| `GET` durante lances | nunca vê `currentBidCents` sem o `bid` correspondente |
| valor ≥ 10^13 reais | máscara limita a 13 dígitos; servidor valida `<= MAX_SAFE_INTEGER` ⇒ `VALIDATION` |
| lote ao vivo no momento em que o fechamento (S05) roda | `LOT_ENDED` ou aceito, nunca os dois (mesmo lock); testado na S05 |

## 14. Testes exigidos

Unitários (`domain/`, sem banco): `minimumBid` (com/sem lances); `validateBidPreWallet` por checagem e na ordem completa (matriz código × combinações, incluindo C1); `validateBalance` (igual/+1); `nextEndsAt` nos 4 limites; `entryHash`/`sealHash`/`pseudonymFor` com vetor fixo e propriedades (hex minúsculo, separadores, nulos→""); `rankFrom`.
Integração (Postgres real, `DATABASE_URL_TEST`, `FakeClock`): AC-3.1 a AC-3.46 (cada um um `it`); inclui varredura de chaves proibidas no JSON; rollback com falha forçada; publisher falso captura `bid:placed`, `showcase:lot`, `wallet:updated` (2 usuários quando houve líder anterior) depois do commit e nada em caso de erro; trigger bloqueia `UPDATE`/`DELETE`; limpeza entre testes por `TRUNCATE … CASCADE`.
Concorrência: AC-3.38 a AC-3.43 com `Promise.all`; checador de invariantes reutilizável `assertLotInvariants(lotId)` (seq contíguos, cadeia recomputada, soma de comprometido, ledger líquido, CHECKs).
Web (Vitest, lógica pura): `maskReais`/`parseReais` (colar, cursor, limite de 13 dígitos), `plural`, `ordinal`, `applyLotEvent`, derivação da faixa/placar a partir do estado (matriz viewer × estado da §9.2: nunca "0º maior"), regra `dirty` do campo (acompanha mínimo só quando não editado), atalho com campo vazio.

## 15. Retrofits e integrações

Muda em fatias anteriores:
- **S02:** `GET /lots/:id` e o tipo `LotState` em `shared` ganham os campos da §6; a Sala passa a renderizar `BidPanel` na segunda coluna (só quando o `status` permitir, §9.2); `Cronometro` recebe `extended` derivado de `endsAt > originalEndsAt`.
- **S01:** `GET /wallet` passa a preencher `leadingLots`; a Carteira renderiza o bloco da §9.4 e as linhas HOLD/RELEASE; `BalanceChip` é atualizado por `setQueryData` após lance.
- **S00/shared:** `RATE_LIMITED` já está em `ErrorCode` desde a S00 (não acrescentar de novo); adicionar `LotSummary` e `BidDTO` em `shared`, o campo `version` em `LotState`/`LotSummary`/`LotCard`, e o motivo `OWN_LEAD` ao tipo de `details.reason`.
- **Header:** sem item novo de nav nesta fatia.

Para fatias futuras:
- **`applyLotEvent(state, {bid, currentBidCents, bidCount, bidderCount, version, endsAt, serverTime})`** (puro, web; **único reducer**, substitui o antigo `applyBid`): a S04 reutiliza o mesmo reducer para o evento `bid:placed` e acrescenta `lot:closed`/`lot:cancelled`; descarta se `version <= atual` (o campo se chama sempre `version`, nunca `entryCount`).
- **S04:** troca `NoopPublisher` pelo Socket.IO; garante que a prorrogação e o histórico atualizem ao vivo para todos (o texto de prorrogação já existe aqui); bloqueia envio sem socket.
- **S05:** substitui o estado interino "apurando"/"Lote fechado" pelos estados encerrados completos; concorrência lance × fechamento.
- **S06:** `CANCEL` entra na cadeia com `seq = entryCount + 1` e o mesmo `lastHash/seal`; `bids[]` continua só `kind=BID`; `LOT_CANCELLED` já é tratado aqui.
- **S07:** link do bloco "Travado onde você lidera" passa para Meus arremates.
- **S08:** link "Auditar este lote" na Sala; `verifyChain` reutiliza `entryHash`/`sealHash` daqui.

## 16. Conflitos resolvidos e perguntas abertas

Conflitos resolvidos (precedência progresso > PRD > arquitetura > EXPERIENCE > DESIGN):
- **C1 ordem de validação:** PRD (período → valor → liderança → papel → saldo) vence AD-5 (papel antes; ALREADY_WINNING antes de BELOW_MINIMUM). Adotada §4.2. Efeito colateral: o "duplo clique cai em `ALREADY_WINNING`" da arquitetura deixa de valer — cai em `BELOW_MINIMUM`. Para não dizer ao próprio líder que "alguém levantou a mão antes dele", o motivo `OWN_LEAD` (R-3.7) troca o texto (a UI também previne com o botão inerte).
- **LOT_CANCELLED (texto):** PRD "Este lote foi cancelado pelo leiloeiro." vence o EXPERIENCE; o texto longo fica só no aviso da Sala cancelada (S06).
- **Faixa × placar (P40):** `PlacarPosicao` mostra liderança/posição (ganhando/superado); `FaixaStatus` mostra as situações neutras e sem ação (assistindo, ainda não deu lance, leiloeiro, apurando). Não duplicar título nas duas.
- **Mensagem de recusa:** o texto exibido é o `message` do servidor (P34/P32), com o texto do design nas 4 originais (fechado, ganhando, mínimo, saldo) e as 4 novas marcadas "texto a revisar".
- **Marca "VOCÊ":** vai em toda linha do usuário no histórico (o EXPERIENCE só cita o topo "cheio"); decisão de implementação sem custo.
- **Aviso de prorrogação:** o parágrafo é renderizado a partir do estado nesta fatia (era citado como da S04 no brief); a S04 só precisa de atualização ao vivo.

Perguntas abertas:
1. **Duplo envio e líder com lance baixo (consequência de C1) — APLICADO.** Com a ordem do PRD, o líder que reenviava o mesmo valor veria "Alguém levantou a mão antes de você", enganoso porque o autor do lance atual é ele. Resolvido sem mexer na ordem do PRD: `reason: OWN_LEAD` com texto próprio (R-3.7, §8, AC-3.15/3.42/3.65). Texto novo "a revisar".
2. **Rate limit do lance:** 30 req/min por usuário e o código novo `RATE_LIMITED` 429 são sugestão minha; as fontes só mandam limitar.
3. **Textos novos "a revisar":** `LOT_NOT_STARTED` (formato "às 14h"), `OUTDATED`, `LOT_CANCELLED`, `ROLE_NOT_ALLOWED`, `Informe o valor do lance.`, `Sem resposta do pátio…`, `Enviando…`, `Calma: lances demais…`, `Nada travado no momento.`, sub do leiloeiro.
4. **Limite de 13 dígitos no campo de lance** é técnico (cabe em `MAX_SAFE_INTEGER`); o PRD não define teto de lance. Confirmar que não há outro teto de negócio.
5. **Histórico sem paginação/rolagem interna:** ok para o seed; revisar se lotes longos ficarem pesados.
6. **"Cobrir lance" no mobile:** a Sala mantém a ordem ficha → painel (P35); se o usuário reclamar da rolagem, é decisão de UX futura (barra fixa não prevista).

## 17. Definition of Done

- [ ] Migração `add_bid` (tabela, CHECK, trigger) aplicada localmente e no deploy (`prisma migrate deploy` no start da API em produção).
- [ ] `POST /lots/:id/bids` cumpre §4, §6 e §8; `GET /lots/:id` e `GET /wallet` estendidos; `ErrorCode` e `shared` atualizados.
- [ ] Todos os AC [auto] (AC-3.1…3.46) verdes no CI, incluindo concorrência (N=10, 20 rodadas) e deadlock cruzado.
- [ ] Checklist manual AC-3.47…3.64 feito em claro e noite, desktop e 390 px.
- [ ] Seed estendido: lote ao vivo com 5 lances via service; cadeia válida.
- [ ] Deploy atualizado (web + API); smoke no link público: dois navegadores, lance válido, recusa de mínimo, recusa de saldo, `ALREADY_WINNING`, leiloeiro e visitante na Sala.
- [ ] README ganha: regra de prorrogação (lance + 2 min, sem teto), ordem de validação e sua consequência (C1), pseudônimo por lote e colisão de 4 hex, aviso de que o tempo real chega na S04.
- [ ] Commits atômicos em pt-BR (domínio, migração, serviço/rota, UI da Sala, carteira, seed, testes).
