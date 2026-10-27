---
id: S07
titulo: Meus arremates
depende_de: [S00, S01, S02, S03, S04, S05, S06]
cobre: [E8, T5]
parcial: [T4, E5, UX-A11Y, UX-RECON, P3]
fontes_de_origem: [PRD Telas (Meus arremates), Papéis (PERM-B); AD-7, AD-9, contrato GET /me/bids; EXPERIENCE Meus arremates/Component Patterns/Interaction Primitives/Link do comprovante, P10, P27, P39; DESIGN cartao-canhoto, aba-filtro, carimbo, picote]
---
# S07 — Meus arremates

## 1. Objetivo e demonstração

O licitante vê todos os lotes em que deu lance, cada um num "ingresso" com seu estado pessoal (Ganhando, Superado, Arrematado, Perdido ou Cancelado), os valores e a ação certa. Os estados mudam sozinhos conforme o leilão anda. A Carteira passa a ligar cada lote travado à tela.

Roteiro:
1. Licitante 1 (seed) entra, clica "Meus arremates" no cabeçalho.
2. Vê abas "Todos 03 · Em disputa 01 · Arrematados 01 · Perdidos 00" (contadores de 2 dígitos) e um ingresso por lote.
3. No lote ao vivo em que foi superado: selo "Você foi superado", "Seu lance (R$ X,00) é o 2º maior de 2", botão ocre "Cobrir lance" leva à Sala.
4. Em outro navegador, licitante 2 cobre de novo: sem recarregar, o ingresso atualiza e a posição muda.
5. No lote arrematado: "Ver comprovante" abre `/c/{token}`; "Copiar link" copia e o botão vira "Link copiado".
6. Troca para a aba "Em disputa": só ganhando e superado. O lote cancelado só aparece em "Todos".
7. Na Carteira, "Travado onde você lidera" lista o lote com link para este ingresso.
8. Conta nova, sem lances: "Nada aqui. Ou você é muito prudente, ou ainda não chegou a hora."

## 2. Fora desta fatia

| Item | Fatia |
|---|---|
| Botão "Conferir na auditoria" (Perdido e Cancelado) | S08 (até lá, oculto; não há botão vazio nem link quebrado) |
| Comprovante (página e `GET /receipts/:token`) | S05 (esta fatia só liga o link) |
| Cancelamento e estorno | S06 (esta fatia só mostra o estado) |
| Estado dos lotes do leiloeiro / Painel | S02/S05/S06 |
| Paginação (não existe em nenhuma fonte) | Fora de escopo |
| Responsivo/tema/a11y de varredura final | S09 (aqui já nasce fluido e acessível) |

## 3. Ponto de partida

Já existe: tabelas `Lot`, `Bid`, `Receipt`, `Wallet`, `LedgerEntry`; `lotStatus` e `LotCard` em `packages/shared`; `GET /lots/:id` com `myPseudonym/myRank/myBestBidCents`; `GET /wallet` com `leadingLots` (S03, sem cancelados desde a S06); `Receipt.token`; `Publisher` real com `showcase:lot` e `wallet:updated` (S04); `Header` por papel e guardas de rota (S01); componentes `FilterTabs`, `Stamp`, `Perforation`, `Button`, `FeedbackState`, `LotTag`, `CarPhoto`; `CopyLinkButton` do Comprovante (S05; se estiver inline lá, extraia para componente compartilhado agora); `useSocket`/`showcase:join` e o `apiClient`.

Invariantes que valem aqui:
- INV-1 Servidor é fonte de verdade: os estados vêm prontos do servidor e a tela não os deriva; mudanças chegam por refetch. Única exceção: o **rótulo** "Apurando" (R-7.3) é derivado no cliente com `lotStatus(lot, serverClock.now())`, porque nenhum evento sinaliza a passagem `LIVE → CLOSING`; o estado de negócio (`state`) continua vindo do servidor.
- INV-2 Dinheiro em centavos; UI `R$ 33.500,00` em Plex Mono.
- R-7.0 (antes "INV-11" desta fatia; o INV-11 da SPEC é `lotStatus`) Estado do licitante por lote: `LEADING | OUTBID | WON | LOST | CANCELLED`; vocabulário de UX Ganhando, Superado, Arrematado, Perdido, Cancelado.
- INV-13 Nenhum `userId`, nome ou e-mail em DTO; o pseudônimo é do lote ("Licitante XXXX · você").
- INV-15 Só `BIDDER` acessa; autorização no back.
- INV-16 Envelope de erro.
- INV-18 Voz do pátio, plurais corretos.

## 4. Regras de negócio

| # | Regra | Origem |
|---|---|---|
| R-7.1 | A lista contém só lotes em que o usuário tem ao menos um `Bid` com `kind=BID`. Sem lance, o lote não entra (ver o lote não basta). | PRD Telas |
| R-7.2 | Estado por lote (função pura sobre colunas do banco, sem usar o relógio): se `cancelledAt` ≠ nulo → `CANCELLED`; senão, se `leaderId = eu`: `settledAt` ≠ nulo → `WON`, senão `LEADING`; senão (não sou líder): `settledAt` ≠ nulo → `LOST`, senão `OUTBID`. | AD-7, P27 |
| R-7.3 | `LOST` = participei, o lote encerrou e outro venceu. `CANCELLED` nunca é `LOST`. Lote passou do fim mas ainda não liquidado (apurando, `lotStatus(...) === 'CLOSING'`): o `state` continua `LEADING`/`OUTBID`, **mas a UI não mostra mais "ganhando/superado" nem o botão ocre "Cobrir lance"** (o lance já está bloqueado): selo neutro "APURANDO" (sem `Nº de N`), frase "Martelo batido. Apurando o resultado…" e só a ação "Ir para a sala". | P27, AD-6 |
| R-7.4 | "Em disputa" = `LEADING` + `OUTBID`. "Arrematados" = `WON`. "Perdidos" = `LOST`. "Todos" = tudo, incluindo `CANCELLED`, que não pertence a nenhuma outra aba. | EXP Meus arremates, P10 |
| R-7.5 | `myBestBidCents` = maior lance do usuário naquele lote. Posição (`myRank`) = `1 +` número de licitantes distintos cujo maior lance é maior que o meu; `bidderCount` = licitantes distintos com lance no lote. Posição só é enviada nos estados `LEADING`/`OUTBID`. | AD-9, decisão do usuário |
| R-7.6 | `receiptToken` só no estado `WON` (o `Receipt` do lote, cujo `winnerId` sou eu). Nenhuma outra pessoa recebe esse token por esta rota. | PRD Comprovante |
| R-7.7 | `winnerPseudonym` só quando o lote foi liquidado com lances (`WON` ou `LOST`); é o pseudônimo do vencedor NAQUELE lote, nunca identidade. | AD-9 |
| R-7.8 | `refundedCents` só no estado `CANCELLED` quando eu era o líder no cancelamento (`leaderId = eu`): igual a `currentBidCents`. | S06 |
| R-7.9 | Ordenação (decisão desta spec, sem fonte): estados ativos primeiro, `OUTBID` antes de `LEADING`, cada um por `endsAt` crescente (o mais urgente primeiro); depois `WON`, `LOST`, `CANCELLED` por `endsAt` decrescente. | spec |
| R-7.10 | Só licitante acessa. Leiloeiro recebe `ROLE_NOT_ALLOWED`; visitante `UNAUTHENTICATED`. | PRD Papéis |
| R-7.11 | Sem paginação (sem fonte). Todos os lotes do usuário vêm de uma vez. | AD (contrato) |

## 5. Modelo de dados

Sem tabelas novas. **Criar sempre** o índice (decisão tomada, é barato; o `@@index([lotId, bidderId])` da S03 começa por `lotId` e não serve à consulta 1): `@@index([bidderId])` em `Bid` no schema Prisma (ou `CREATE INDEX "Bid_bidderId_idx" ON "Bid"("bidderId") WHERE "kind"='BID'` em SQL), com migração própria `add_bid_bidder_index` aplicada no deploy.

**Atenção aos tipos:** os ids (`Lot.id`, `Bid.lotId` etc.) são `String @id @default(uuid())` **sem** `@db.Uuid`, ou seja, colunas **TEXT**. Nunca usar `::uuid` nas consultas (`operator does not exist: text = uuid`); use `::text[]`.

Consulta sugerida (Prisma `$queryRaw` + `findMany`):

```sql
-- 1) lotes onde tenho lance e meu maior lance
SELECT b."lotId", MAX(b."amountCents") AS "myBest"
FROM "Bid" b
WHERE b."bidderId" = $1 AND b."kind" = 'BID'
GROUP BY b."lotId";

-- 2) melhor lance de cada licitante nesses lotes (para posição e nº de licitantes)
SELECT b."lotId", b."bidderId", MAX(b."amountCents") AS "best"
FROM "Bid" b
WHERE b."kind" = 'BID' AND b."lotId" = ANY($2::text[])
GROUP BY b."lotId", b."bidderId";
```
Se a consulta 1 voltar vazia, **pular a consulta 2** (e o `findMany`) e devolver `items: []`.

Depois: `prisma.lot.findMany({ where: { id: { in: lotIds } }, include: { item: true, receipt: true } })`. Calcule em TS, **reusando `rankFrom` de `apps/api/src/domain/rank.ts` (S03)** para todo lote da consulta 2 (não reimplemente a regra): `bidderCount = nº de linhas do lote em (2)`; `myRank = 1 + nº de linhas do lote com best > myBest`; pseudônimo do vencedor via `Receipt.pseudonym` (lote liquidado) e o meu via `Bid.pseudonym` de qualquer linha minha no lote. Mantenha a função de estado pura em `packages/shared`:

```ts
export type BidderLotState = 'LEADING' | 'OUTBID' | 'WON' | 'LOST' | 'CANCELLED';
export function bidderLotState(l: { cancelledAt: Date|null; settledAt: Date|null; leaderId: string|null }, me: string): BidderLotState
```
(`shared` só depende de `zod`; use tipos primitivos/ISO no contrato e a função com datas como `string|null` ou `boolean`.)

## 6. Contratos REST

### `GET /me/bids`

| Campo | Valor |
|---|---|
| Papel | `BIDDER` (token obrigatório) |
| Resposta `200` | `{ items: MyBidItem[], serverTime }` |
| Erros | `UNAUTHENTICATED` 401 · `ROLE_NOT_ALLOWED` 403 (conta de leiloeiro; texto: "Meus arremates é coisa de licitante." — a revisar) |

```ts
type MyBidItem = {
  lot: LotCard;                 // id, number, title, brand, year, status, currentBidCents, startingBidCents, bidCount, startsAt, endsAt, imageUrl
  state: 'LEADING'|'OUTBID'|'WON'|'LOST'|'CANCELLED';
  myBestBidCents: number;
  myPseudonym: string;          // "Licitante C3E8" (deste lote)
  myRank: number | null;        // só LEADING/OUTBID
  bidderCount: number;
  winnerPseudonym: string | null; // só WON/LOST
  receiptToken: string | null;    // só WON
  refundedCents: number | null;   // só CANCELLED em que eu liderava
};
```
Adições em relação ao contrato original `[{lot, state, myBestBidCents, receiptToken?}]`: `myPseudonym`, `myRank`, `bidderCount`, `winnerPseudonym`, `refundedCents` e o envelope `{items, serverTime}`. Atualize `MyBidItem` e o schema de resposta em `packages/shared` primeiro (INV-17). `LotCard.currentBidCents` é o valor final quando o lote está liquidado.

## 7. Contratos Socket.IO

Nenhum evento novo. A tela entra em `showcase` (`showcase:join`) e escuta:
- `showcase:lot` (qualquer lote): **só se `card.id` está na lista atual** invalida a consulta `['me','bids']` e refaz o `GET /me/bids` (debounce de 300 ms). Evento de lote que não está na lista é ignorado (a lista só contém lotes onde o usuário deu lance; um lance dele em outra aba chega por `wallet:updated`). Descartar evento com `version < card.version` já visto (regra S04).
- `wallet:updated`: invalida a consulta (cobre lance dado em outra aba, estorno, liquidação).
- Reconexão (`connect` depois de queda): refaz o `GET`.
O cliente não deriva estado de payloads de evento; a lista só muda com a resposta do servidor (INV-1).

## 8. Mensagens

| Situação | Texto pt-BR | Onde |
|---|---|---|
| Título da página | "MEUS ARREMATES" | `h1` (display-titulo) |
| Lista vazia (usuário sem lances) | "Nada aqui. Ou você é muito prudente, ou ainda não chegou a hora." | `FeedbackState` vazio, com link "Ver a vitrine" |
| Aba sem itens (usuário tem lances em outras abas) | "Nenhum lote nesta aba. Troque de aba para ver o resto." (a revisar) | `FeedbackState` vazio |
| Carregando | "Carregando…" | `FeedbackState` |
| Erro de carga | "Não deu para carregar seus arremates." + botão "Tentar novamente" | `FeedbackState` (borda `ferrugem`) |
| Erro com dados anteriores | "Lista possivelmente desatualizada." (a revisar) + "Tentar novamente" | faixa acima da lista |
| `LEADING` | "Você está ganhando · 1º de {N}" (placar) + "Seu lance de R$ X,00 está na frente. Esse valor está travado neste lote." (a revisar) | ingresso |
| `OUTBID` | "Você foi superado · Seu lance (R$ X,00) é o {r}º maior de {N}" | ingresso |
| Apurando (passou do fim, `LEADING`/`OUTBID`) | Selo neutro "APURANDO" + "Martelo batido. Apurando o resultado…" (sem "ganhando/superado", sem `Nº de N`) | no lugar do selo e da frase, ingresso |
| `WON` | "Você arrematou por R$ X,00." | ingresso |
| `LOST` | "Licitante {XXXX} levou por R$ X,00. Seu maior lance foi R$ Y,00." | ingresso |
| `CANCELLED` | "O leiloeiro cancelou este lote. Nada foi vendido." + se `refundedCents`: " O saldo que estava travado voltou para você." | ingresso |
| Pseudônimo próprio | "Neste lote você é Licitante {XXXX}." (a revisar) | linha mono pequena |
| Copiar link: sucesso | "Link copiado" (2,2 s) | botão + live region |
| Copiar link: falha | "Não deu para copiar. Selecione o link e copie à mão." (a revisar) | botão mostra a falha; o link fica selecionável (campo `readonly`) |
| Anúncio de transição (live region, polite) | "Lote {NNN}: você foi superado." / "Lote {NNN}: você arrematou." / "Lote {NNN}: não foi desta vez." / "Lote {NNN}: cancelado." (a revisar) | região invisível da página |

Frases com plural correto ("1 lance", "{N} licitantes"). Nome real jamais aparece.

## 9. Telas e estados

### Meus arremates (T5) — rota `/arremates`, só `BIDDER`

Guardas (S01): visitante → `/entrar?next=/arremates`; leiloeiro → aviso com link ao Painel.

Estrutura (de cima para baixo):
1. Cabeçalho do licitante (nav com "Meus arremates" ativo: sublinhado 3px `tinta`, `aria-current="page"`; `BalanceChip`; `IdentityChip` "VOCÊ · Licitante"; "Sair").
2. `h1` "MEUS ARREMATES" e subtítulo curto.
3. `FilterTabs` (grupo com `aria-pressed`): "Todos", "Em disputa", "Arrematados", "Perdidos", cada uma com contador mono de 2 dígitos ("03").
4. Lista de ingressos (`<ul>`; um `<li id="lote-{NNN}" tabindex="-1">` por lote).
5. Região `aria-live="polite"` oculta visualmente para os anúncios de transição.

Estados da página:
| Estado | Tratamento |
|---|---|
| Carregando | `FeedbackState` "Carregando…", espaço preservado |
| Erro | `FeedbackState` com "Tentar novamente"; se havia dados, mantê-los com a faixa "desatualizada" |
| Vazio total | `FeedbackState` vazio com a frase de §8 e link "Ver a vitrine" (botão secundário; sem botão ocre) |
| Vazio por aba | Frase de §8; abas continuam utilizáveis |
| Padrão | Ingressos ordenados por R-7.9 |
| Atualização | Troca de estado/posição sem recarregar; o scroll e a aba escolhida não mudam; o foco não é movido |
| Reduced motion | Nenhum flip/pulso é necessário; o estado final aparece direto |

Ingresso (`cartao-canhoto` em Meus arremates), da esquerda para a direita (empilha em telas estreitas):
- **Stub (112px):** rótulo "LOTE" (Plex Mono 11px, tracking .14em) + número em Big Shoulders 900 52px; separado do resto por borda tracejada de 3px (`tracejado`).
- **Bloco central:** `LotTag` do número é o stub (sem repetir); título do carro (Big Shoulders 800 32px, caixa-alta, é um `<a>` para `/lotes/{id}`; nome acessível = título), meta mono 13px (`ano · combustível`), selo de status, frase de §8, linha do pseudônimo próprio (mono 13px, `chip-licitante`: borda 2px, padding 3px 8px; "VOCÊ" com fundo `ocre`, peso 600).
- **Bloco de valores (borda esquerda tracejada 2px):** "SEU MAIOR LANCE" `R$ X,00`; e, conforme o estado, "LANCE ATUAL" (`LEADING`/`OUTBID`) ou "VALOR FINAL" (`WON`/`LOST`) ou "ÚLTIMO LANCE" (`CANCELLED`), todos em Plex Mono 600 22px.
- **Rodapé de ações** (abaixo do divisor): botões por estado. **Versão simples primeiro** (linha tracejada 2px entre o corpo e as ações); o picote com semicírculos (`Perforation`) é acabamento "se sobrar tempo" / S09.

Selo de status e ações por estado:
| Estado | Selo (texto + forma) | Ações |
|---|---|---|
| `LEADING` | `placar-posicao` verde "VOCÊ ESTÁ GANHANDO · 1º de {N}" | "Ir para a sala" (secundário) |
| `OUTBID` | `placar-posicao` `ferrugem` "VOCÊ FOI SUPERADO · {r}º de {N}" | "Cobrir lance" (**primário ocre**) → `/lotes/{id}` |
| `LEADING`/`OUTBID` em apuração (`lotStatus` = `CLOSING`) | Selo neutro `tinta`/`fundo` "APURANDO" (sem posição) | só "Ir para a sala" (secundário); **sem** "Cobrir lance" |
| `WON` | Carimbo **Arrematado** (`tinta`, +3°) | "Ver comprovante" (secundário, → `/c/{receiptToken}`) + "Copiar link" (secundário) |
| `LOST` | Carimbo pequeno **Perdido** (`tinta2`, borda tracejada 4px, sem outline, −2°) | nenhuma até a S08; S08 acrescenta "Conferir na auditoria" |
| `CANCELLED` | Carimbo **Cancelado** (`tinta2`, borda 4px sólida + outline, −4°) | nenhuma até a S08; S08 acrescenta "Conferir na auditoria" |

Nomes acessíveis únicos por lote (INV de a11y): `Ir para a sala do lote 018, Gol GTI 2.0 1996`; `Cobrir lance no lote 018, Gol GTI 2.0 1996`; `Ver comprovante do lote 018, Gol GTI 2.0 1996`; `Copiar link do comprovante do lote 018, Gol GTI 2.0 1996`. Alvos ≥ 44px.

Comportamento:
- **Copiar link:** copia `{origem}/c/{receiptToken}` (token aleatório; nunca número do lote). Sucesso: botão vira "Link copiado" por 2,2 s, anunciado por live region. Falha da área de transferência: mostra o texto de falha e um campo `readonly` selecionável com o link.
- **Cobrir lance** é o único ocre do ingresso; vários ingressos `OUTBID` podem existir (decisão: o ocre é "a ação que pede clique" por cartão; ver §16).
- **Contadores** das abas calculados no cliente sobre a lista já recebida (nada é derivado do relógio).
- **Âncora vinda da Carteira:** abrir `/arremates#lote-018` rola até o ingresso e foca o `<li>` (`tabindex="-1"`), na aba "Todos"; se o ingresso estiver em outra aba filtrada, a aba volta a "Todos".
- **Tema/responsivo:** fluido, sem breakpoints; ingresso empilha (stub em cima, valores abaixo) em 390px; claro e noite pelos tokens.
- **Foco:** anel `3px solid tinta`, afastamento 3px, halo de `papel`; sem sombras borradas.

### Carteira (T4) — bloco "Travado onde você lidera"

Cada lote de `GET /wallet` → `leadingLots` vira um link: `Lote {NNN} · {título} · R$ X,00` (mono) apontando para `/arremates#lote-{NNN}` (nome acessível: `Ver o lote 018, Gol GTI 2.0 1996, no Meus arremates`). Texto auxiliar existente da S01: "Volta se alguém cobrir." Lista vazia mantém o texto da S01. Atualiza com `wallet:updated`.

## 10. Componentes criados

| Componente | Uso | Notas |
|---|---|---|
| `BidTicket` | Um ingresso de Meus arremates | `cartao-canhoto`; props: `MyBidItem`. Papel: fundo `papel`, borda 3px `linha`, sombra `6px 6px 0 sombra`, canto 0, padding 24px. Stub 112px; divisor simples com linha `2px dashed tracejado`. **Opcional / se sobrar tempo (S09):** `Perforation` de 24px de altura (`left/right:20px; top:11px`) com dois semicírculos 24×24 de fundo `fundo` nas laterais |
| `StatusSeal` | Selo de status do ingresso | Envolve `Stamp`/`placar-posicao` por estado; texto sempre presente (não depende de cor); `Perdido` é uma variante local do carimbo "Sem lances" (tinta2, tracejado) |
| `BidTicketList` | Lista, abas, vazios, live region | Usa `FilterTabs` da S00 |
| `useMyBids` | Hook de dados | `GET /me/bids`, invalidação por `showcase:lot`/`wallet:updated`/reconexão |
| `bidderLotState` | Função pura em `packages/shared` | R-7.2 |

Tokens usados: cores `papel`, `fundo`, `tinta`, `tinta2`, `linha`, `sombra`, `tracejado`, `ocre`, `sobreOcre`, `ferrugem`, `verde`, `sobreCor`; tipografia `numero-lote` (900 52px), `cartaz-cartao` (800 32px), `mono-dado`, `mono-rotulo`, `body`, `botao`, `botao-primario`, `carimbo`, `placar` (900 30px); bordas 3px padrão, 2px divisórias, 4px carimbos; sombras 6/6/0 cartão, 5/5/0 botão; `alvo-minimo` 44px; aba `min-height` 48px (ativa: fundo `tinta`, texto `fundo`).

## 11. Seed desta fatia

Não cria dados novos; confere (teste de seed) que as duas contas de licitante cobrem os cinco estados:

| Licitante | Estados esperados |
|---|---|
| Licitante 1 | `OUTBID` (lote ao vivo onde o 2 lidera), `WON` (lote encerrado arrematado), `CANCELLED` (lote cancelado de S06) |
| Licitante 2 | `LEADING` (mesmo lote ao vivo), `LOST` (lote encerrado arrematado pelo 1), `CANCELLED` |

Se S03/S05 gerarem outra distribuição (ex.: vencedor oposto), ajuste a ordem dos lances do seed (pelos services, com `FakeClock`) para atingir esta tabela. O lote encerrado sem lances não aparece em nenhuma lista (ninguém deu lance).

## 12. Critérios de aceite

- **AC-7.1 [auto]** Dado Licitante 1 com lances em 3 lotes do seed; Quando `GET /me/bids`; Então `items` tem 3 entradas com estados `OUTBID`, `WON`, `CANCELLED`, e nenhum item de lote sem lance dele.
- **AC-7.2 [auto]** Dado lote ao vivo onde só dou lance e lidero; Então `state=LEADING`, `myRank=1`, `bidderCount=1`.
- **AC-7.3 [auto]** Dado A e B com lances, B líder; Quando A consulta; Então `OUTBID`, `myRank=2`, `bidderCount=2`, `myBestBidCents` = maior lance de A (não o último de B).
- **AC-7.4 [auto]** Dado três licitantes com melhores lances 30.000 (A), 28.000 (B), 25.000 (C); Quando B consulta; Então `myRank=2` e `bidderCount=3`. Dado B deu vários lances (25.000 e depois 28.000); Então conta só o maior (28.000).
- **AC-7.5 [auto]** Dado lote liquidado em que sou o líder; Então `WON`, `receiptToken` = token do `Receipt`, `winnerPseudonym` = meu pseudônimo, `myRank=null`.
- **AC-7.6 [auto]** Dado lote liquidado em que outro venceu; Então `LOST`, `receiptToken=null`, `winnerPseudonym` = pseudônimo do vencedor naquele lote, `myRank=null`.
- **AC-7.7 [auto]** Dado lote cancelado em que eu era o líder; Então `CANCELLED`, `refundedCents = currentBidCents`. Dado cancelado em que eu tinha sido superado; Então `CANCELLED`, `refundedCents=null`. Em ambos, nunca `LOST`.
- **AC-7.8 [auto]** Dado lote com `endsAt` passado e `settledAt` nulo; Então o estado continua `LEADING`/`OUTBID` e `lot.status = "CLOSING"`. [manual] A tela mostra o selo neutro "APURANDO" e a frase "Martelo batido. Apurando o resultado…", **sem** "Cobrir lance" e sem posição; o rótulo muda sozinho quando o relógio passa de `endsAt` (derivado com `lotStatus` e `serverClock`), sem esperar evento.
- **AC-7.9 [auto]** Dado leiloeiro autenticado; Quando `GET /me/bids`; Então `403 ROLE_NOT_ALLOWED`. Dado sem token; Então `401 UNAUTHENTICATED`.
- **AC-7.10 [auto]** Dado qualquer resposta; Então nenhum campo `userId`, `name`, `email` em lugar algum do JSON (varredura recursiva de chaves).
- **AC-7.11 [auto]** Dado outro licitante que venceu um lote em que não dei lance; Então esse lote não está na minha lista e o `receiptToken` dele nunca aparece nela.
- **AC-7.12 [auto]** `bidderLotState` cobre a tabela completa: (`cancelledAt`×`settledAt`×`leaderId=eu`) → 5 estados, e `cancelledAt` vence todos.
- **AC-7.13 [auto]** Dado A superado, que volta a liderar com lance maior; Então o estado passa de `OUTBID` a `LEADING` e `myBestBidCents` sobe.
- **AC-7.14 [manual]** Dado Meus arremates aberto; Quando B cobre o lance de A em outro navegador; Então, sem recarregar, o ingresso de A passa a "Você foi superado · Seu lance (R$ …) é o 2º maior de 2" com "Cobrir lance" ocre, e a live region anuncia "Lote 018: você foi superado."
- **AC-7.15 [manual]** Dado abas; Então "Em disputa" mostra `LEADING`+`OUTBID`, "Arrematados" só `WON`, "Perdidos" só `LOST`, e o `CANCELLED` só em "Todos"; os contadores têm 2 dígitos e batem com as listas.
- **AC-7.16 [manual]** Dado ingresso `WON`; Quando clico "Copiar link"; Então a área de transferência contém `{origem}/c/{token}` (token aleatório, sem número do lote), o botão diz "Link copiado" por ~2,2 s e vira de novo "Copiar link". Dado clipboard bloqueado; Então aparece a mensagem de falha e o link selecionável.
- **AC-7.17 [manual]** Dado "Ver comprovante" em dois ingressos diferentes; Então cada um abre o comprovante do PRÓPRIO lote (não sempre o mesmo), e todos os botões têm nome acessível único.
- **AC-7.18 [manual]** Dado conta sem lances; Então aparece "Nada aqui. Ou você é muito prudente, ou ainda não chegou a hora." com link "Ver a vitrine"; sem abas quebradas.
- **AC-7.19 [manual]** Dado visitante em `/arremates`; Então vai para `/entrar?next=/arremates` e, após o login, volta para `/arremates`. Dado leiloeiro; Então vê aviso com link ao Painel.
- **AC-7.20 [manual]** Dado Carteira com lote travado; Então o item da lista é link para `/arremates#lote-NNN`, a página rola ao ingresso e foca o `<li>`.
- **AC-7.21 [manual]** Dado 390px e tema noite; Então o ingresso empilha sem rolagem horizontal da página; textos legíveis; foco visível em todos os controles; só "Cobrir lance" é ocre.
- **AC-7.22 [manual]** Dado queda e volta do socket; Então a lista é refeita pelo `GET` e reflete o estado real.

## 13. Casos de borda e concorrência

| Caso | Resultado |
|---|---|
| Lance meu e de outro no mesmo instante | A transação do lance (S03) serializa; `GET /me/bids` lê o estado confirmado; posição nunca duplica 1º |
| Lote liquida enquanto a lista está aberta | `showcase:lot` (fechamento) dispara refetch; `LEADING` vira `WON` com `receiptToken`, `OUTBID` vira `LOST` |
| Evento chega antes da liquidação ser visível na leitura | O refetch devolve ainda `LEADING`/"apurando"; o próximo evento/`wallet:updated` corrige |
| Lote cancelado enquanto olho | Ingresso passa a `CANCELLED`; saldo atualizado pelo `wallet:updated` |
| Usuário com 0 carteira / sem lances | Lista vazia, sem erro |
| Mesmo valor de melhor lance entre dois licitantes | Impossível (lances estritamente crescentes por lote); `myRank` sem empate |
| Evento de lote que não está na lista | Ignorado (sem refetch); lance novo do próprio usuário chega por `wallet:updated` |
| Lote com 1 só licitante | "1º de 1" |
| Token do comprovante vazio em `WON` | Defeito; a UI não mostra "Ver comprovante" e registra erro (não deve ocorrer: liquidação cria `Receipt` na mesma tx) |
| Reconexão com lista em tela | Refetch; sem duplicar ingresso |
| Lista longa | Sem paginação (R-7.11); aceitável para o seed |
| Duplo clique em "Copiar link" | Idempotente; o timer de 2,2 s reinicia |

## 14. Testes exigidos

Unitários: `bidderLotState` (todas as combinações); cálculo de `myRank`/`bidderCount` a partir das linhas de melhor lance (múltiplos lances por licitante, empate impossível, 1 licitante); ordenação R-7.9; contagem das abas.

Integração (Postgres real, `FakeClock`):
- Cenário completo do seed (§11) produz os cinco estados para os dois licitantes.
- Cada AC `[auto]` acima, incluindo 401/403, privacidade (varredura de chaves proibidas) e que o token de recibo de outro nunca vaza.
- Transição por serviço: A superado → `OUTBID`; liquida → `LOST`; cancela → `CANCELLED`.

Web (Vitest, lógica pura): mapeamento estado → selo/ações/frase, plural, nome acessível único, helper que monta `{origem}/c/{token}`, redução de eventos em invalidações com debounce.

## 15. Retrofits e integrações

| Onde | Mudança |
|---|---|
| Banco | Migração `add_bid_bidder_index` (`@@index([bidderId])` em `Bid`) |
| S01 Header | Adiciona o item "Meus arremates" (BIDDER) para `/arremates` |
| S01/S03 Carteira | Itens de "Travado onde você lidera" viram links `/arremates#lote-NNN` |
| S05 Comprovante | `CopyLinkButton` extraído como componente compartilhado, se estava inline |
| S08 | Acrescenta "Conferir na auditoria" aos ingressos `LOST` e `CANCELLED` (→ `/lotes/{id}/auditoria`) |
| S09 | Varredura de a11y/responsivo/tema desta tela |

## 16. Conflitos resolvidos e perguntas abertas

Conflitos resolvidos:
1. **Contrato `GET /me/bids`**: a arquitetura lista `[{lot, state, myBestBidCents, receiptToken?}]`, insuficiente para a frase "é o Nº maior de N" e para "Licitante XXXX levou". Contrato estendido (aditivo) com `myPseudonym`, `myRank`, `bidderCount`, `winnerPseudonym`, `refundedCents`, e envelope `{items, serverTime}` (INV-16).
2. **Cancelado em Meus arremates (P10)**: estado próprio, visível só em "Todos" (as abas do EXPERIENCE são fixas); nunca vira "Perdido".
3. **"Um botão ocre por tela" × "Cobrir lance em ocre"**: o EXPERIENCE manda destaque ocre no "Cobrir lance" e o DESIGN limita a um ocre por tela. Decisão: ocre só no "Cobrir lance"; "Ver comprovante", "Copiar link" e "Ir para a sala" são secundários, para não multiplicar ocres. Vários ingressos `OUTBID` podem ter vários ocres (interpretação por cartão).
4. **Pseudônimo próprio (P39)**: em lote o texto é "Licitante XXXX · você" (chip com VOCÊ em ocre); o cabeçalho continua "VOCÊ · Licitante". O pseudônimo do vencedor em `LOST` é o do lote, nunca identidade.
5. **Ação "Conferir na auditoria"**: só existe a partir da S08 (antes oculta, por instrução do plano de fatias).
6. **"Perdido" sem variante de carimbo no DESIGN**: reaproveita o estilo "Sem lances" (tinta2, tracejado) com texto próprio; derivado, sem mock.

Perguntas abertas:
1. Ordenação da lista (R-7.9) é decisão desta spec, sem fonte; confirmar se prefere a ordem cronológica simples. (Alinhado com a Q10 do SPEC.md: superados primeiro, depois ganhando, ambos por `endsAt` crescente; depois `WON`/`LOST`/`CANCELLED` por `endsAt` decrescente.)
2. Textos marcados "(a revisar)" foram escritos aqui por falta de texto nas fontes (frases de `LEADING`, `WON`, `LOST`, `CANCELLED`, aba vazia, faixa de desatualizado).
3. O PRD pede o status "perdido" mas o estado só aparece depois da liquidação; se preferir mostrar "Perdido" já no fim do relógio (antes de liquidar), pede mudança de regra R-7.3 (sugestão: manter "apurando").

Decisões do build (27/10/2026; o spec de build `spec-s07-meus-arremates.md` tem o contexto):
1. **Railway** no lugar de Neon, Render e Vercel; "migração aplicada no deploy" vale para o `migrate deploy` do start da API.
2. **`BotaoCopiarLink` já era compartilhado** (S05): nada a extrair. Ganhou a prop opcional `ariaLabel`, para o nome acessível levar o título do lote ("Copiar link do comprovante do lote 018, Gol GTI 2.0 1996").
3. **Ordem (R-7.9 e Q10):** o servidor ordena (ativos primeiro, `OUTBID` antes de `LEADING`, por `endsAt` crescente; `WON`, `LOST` e `CANCELLED` juntos por `endsAt` decrescente, desempate pelo número do lote). O cliente nunca reordena; as abas só filtram.
4. **Pseudônimo próprio** vem de `MAX(Bid.pseudonym)` da consulta 1. O chip diz "Neste lote você é Licitante XXXX." sem a marca "VOCÊ" em ocre: o AC-7.21 pede só "Cobrir lance" em ocre e vence o §9.
5. **"Ver comprovante" abre em outra guia** (`target="_blank"`, `rel="noopener noreferrer"`), como o link da Sala. O nome acessível carrega "(abre em outra guia)" dentro do `aria-label` (com `aria-label` o texto escondido seria ignorado).
6. **Sem polling** enquanto há ingresso "apurando": a §7 manda evento, `wallet:updated` e reconexão, e o fechamento publica `showcase:lot`. Foi o que o Chrome real mostrou: a liquidação trocou o ingresso em segundos. Se faltar na prática, entra um `refetchInterval` com teto (item no `deferred-work.md`).
7. **Anúncios** só os quatro da §8 e só entre duas respostas do servidor (nunca na carga inicial, nem para lote que acabou de entrar na lista); voltar a `LEADING` não anuncia. Cada anúncio é um nó novo da região viva (`key` pela sequência), para o leitor de tela repetir mesmo o texto igual.
8. **Evento `showcase:lot`:** lote fora da lista é ignorado; versão menor que a já vista é descartada; versão igual só refaz se o status mudou (o fechamento não sobe `entryCount`, C10). A resposta do `GET` renova o que foi visto e vale em empate, exceto contra versão estritamente maior que um evento já trouxe.
9. **Ocre** só no "Cobrir lance", por cartão (vários `OUTBID` podem ter vários).
10. **"Apurando" derivado:** vale se o cartão já vem `CLOSING` **ou** se `lotStatus(lot, serverClock.now())` dá `CLOSING` (o tempo só anda para a frente, então o status do cartão nunca desmente o relógio). `settledAt` entra como nulo, porque todo `LEADING`/`OUTBID` é não liquidado (R-7.2). Com o relógio ainda sem acertar (`now <= 0`) vale só o status do cartão. Estado final nunca vira "apurando", e a aba "Em disputa" segue contando o ingresso (a aba olha o estado, não o relógio).
11. **Cada visita é uma carga inicial:** a consulta `["me","bids"]` usa `gcTime: 0`, para uma lista guardada de outra visita não virar "transição" anunciada.
12. **Ingresso fluido por container query** (`@container`, 44rem), não por janela: empilha (canhoto, corpo, valores, ações) em 390 px e vira três colunas (192 px · fluida · 200 px, colunas fixas para os divisores alinharem entre ingressos) a partir daí.
13. **Canhoto = `LotTag`** (tom papel, nunca ocre). O ingresso não usa `CarPhoto`: a §9 não põe foto nele. Sem `Perforation` (acabamento da S09).
14. **Vazio total** não desenha abas ("sem abas quebradas"): só a frase e "Ver a vitrine" como botão secundário.
15. **Âncora `#lote-NNN`** é resolvida na primeira resposta do `GET`: a aba volta a "Todos", a página rola até o `<li>` e foca nele (`tabindex="-1"`). Hash de lote que não está na lista é ignorado.
16. **Carimbo Perdido** é o "Sem lances" com texto próprio (`tinta2`, tracejado 4px, sem contorno, −2°), em corpo menor (20 px) como a §9 pede ("carimbo pequeno").
17. **Carteira:** os itens de "Travado onde você lidera" viraram um só link ("Lote 007 · título · R$ X,00", nome acessível "Ver o lote 007, título, no Meus arremates"), apontando para `/arremates#lote-NNN`.

Perguntas abertas, com a sugestão que o build adotou:
1. **Ordenação (R-7.9):** adotada a da fatia (a mesma da Q10 do SPEC.md). Se preferir a ordem cronológica simples, é só o servidor.
2. **Textos "(a revisar)":** adotados como estão em `MY_BIDS_TEXT`; a revisão de voz fica para a S09.
3. **"Perdido" já no fim do relógio, antes de liquidar:** mantido "apurando" (sem mudar a R-7.3).
4. **Anunciar a volta a "Você está ganhando"?** Sugestão adotada: não (a §8 lista só quatro anúncios). Se quiser, é uma linha em `transitionAnnouncement`.
5. **`Em disputa` conta o ingresso apurando?** Sugestão adotada: sim (a aba olha o estado do servidor, não o relógio).

## 17. Definition of Done

- [x] `GET /me/bids` e `MyBidItem` em `packages/shared`; todos os AC `[auto]` verdes no CI (shared 121, api 386, web 372; CI verde em 25f0ac8).
- [x] Tela `/arremates` com guardas, abas, contadores, ingressos, vazios e erros; checklist `[manual]` percorrido no Chrome real (AC-7.8 tela e 7.14 a 7.22; claro/noite, 390px, teclado, foco). Itens 83 e 84 do diário.
- [x] Atualização em tempo real verificada com dois navegadores e após queda do socket.
- [x] Header com "Meus arremates"; Carteira com links.
- [x] Teste de seed confirma os cinco estados nas duas contas; seed roda do zero.
- [x] Migração `add_bid_bidder_index` aplicada no deploy (start da API no Railway, Fase 1).
- [x] Smoke no link público: Ana e Bruno do seed logados, estados conferidos (somente leitura).
- [x] README: nota curta sobre "Meus arremates" e a definição de Perdido.
- [ ] **Pendência do Felipe:** leitor de tela (ordem de leitura, nomes acessíveis, anúncios da região viva, "Link copiado", foco no `<li>`).
- [ ] **Pendência do Felipe:** aparelho real (toque, 390px de verdade).
