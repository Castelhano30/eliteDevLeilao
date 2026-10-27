---
id: S08
titulo: Auditoria pública e verificação da cadeia HMAC
depende_de: [S00, S01, S02, S03, S04, S05, S06, S07]
cobre: [E10, E11, T9, H5, A1, A2, A3, A4, A5, AC11, AC12, P1, L1]
parcial: [D7, TST, UX-A11Y, UX-THEME, UX-RESP, UX-RECON]
fontes_de_origem: [PRD "Histórico à prova de adulteração e privacidade", PRD AC11/AC12, AD-8, AD-9, EXPERIENCE "Auditoria" (State Patterns, Flow 3, P11/P12/P30/P31), DESIGN "tabela", "carimbo", "Foco e contraste", triagem P10/P11/P30/P31]
---

# S08 — Auditoria pública e verificação da cadeia HMAC

## 1. Objetivo e demonstração

A cadeia HMAC já é escrita desde a S02 (genesis), S03 (cada lance) e S06 (linha CANCEL). Esta fatia a **verifica** e a mostra para qualquer pessoa, sem login, e prova com testes que adulterar direto no banco é detectado.

Roteiro de demonstração (avaliador):

1. Sem login, abrir o lote encerrado e arrematado do seed pelo cartão da Vitrine (agora vai para a Auditoria). Aparece "Refazendo a conta, elo por elo…" e em seguida o carimbo **Íntegro**, a frase "N de N lances conferem e o hash final é o mesmo do comprovante…" e todas as linhas "CONFERE".
2. Clicar "ver inteiro" num hash: aparecem os 64 caracteres; clicar "recolher".
3. No comprovante (S05) clicar "Verificar na auditoria": mesma página.
4. Abrir a auditoria do lote ao vivo: Íntegro, sem comparação com comprovante ("Lote ainda aberto…").
5. Abrir a auditoria do lote cancelado do seed: aparecem os lances e a linha "Cancelado pelo leiloeiro"; Íntegro.
6. No psql (local ou `docker compose exec db psql -U … -d …`): `ALTER TABLE "Bid" DISABLE TRIGGER bid_no_update_delete`, `UPDATE "Bid" SET "amountCents"=… WHERE seq=3`, reativar. Recarregar a auditoria: carimbo **Adulterado**, banner `role="alert"` "Linha 03: …", linha 03 "NÃO CONFERE" e as seguintes "ELO QUEBRADO".
7. Apagar os dois últimos lances de outro lote: carimbo Adulterado, banner de selo ("O selo do lote registra N lances, mas só M foram encontrados"), todas as linhas restantes "CONFERE", sem apontar linha inexistente.
8. "Verificar de novo": o servidor repete o veredito e a hora da verificação muda.

## 2. Fora desta fatia

| Item | Vai para |
| --- | --- |
| Texto final do README (esta fatia só entrega o texto da técnica, §15) | S09 |
| Assinatura Ed25519 / verificação no navegador | Fora de escopo (evolução citada no README) |
| Auditoria atualizando por socket enquanto a página está aberta | Fora de escopo (P30: retrato verificado + "Verificar de novo") |
| Escrever a linha CANCEL e atualizar o selo no cancelamento | S06 (já pronto; aqui só se verifica) |
| Página do comprovante e token | S05 |
| Varredura final de acessibilidade/responsivo de todas as telas | S09 |

## 3. Ponto de partida

Já existe (não reimplementar; usar):

- `apps/api/src/domain/audit-chain.ts` com `genesisHash(key, lot)`, `entryHash(key, {lotId, seq, kind, pseudonym, amountCents, at, prevHash})` e `sealHash(key, lotId, entryCount, lastHash)` (S02/S03; **chave sempre primeiro**), mesmos formatos de INV-12. Esta fatia **adiciona** `verifyChain` ao mesmo arquivo. Se alguma fatia anterior mostrar assinatura diferente, vale esta (T5).
- Rate limiter da S00/S01 (`makeRateLimiter({windowMs,max,keyGenerator,skip})`, handler que lança `AppError(RATE_LIMITED)`), `trust proxy = 1` em produção e `RATE_LIMIT_DISABLED=1` nos testes.
- Tabelas `Lot` (`entryCount`, `lastHash`, `seal`, `startsAt`, `startingBidCents`, `minIncrementCents`), `Bid` (com `kind BID|CANCEL`, `bidderId?`, `pseudonym?`, `amountCents?`, `at`, `prevHash`, `hash`; trigger append-only da S03), `Receipt` (`finalHash`, `amountCents`, `token`; o token nunca vai para o DTO da auditoria) e `User`.
- `env.AUDIT_HMAC_KEY`, `Clock`, `AppError`/envelope, `optionalAuth` (decodifica token se houver; token inválido vira visitante).
- Web: `apiClient`, TanStack Query, `Stamp`, `DataTable`, `FeedbackState`, `Button`, `LotTag`, `PageShell`, `lotCardHref` (S02), `useTheme`.
- `packages/shared`: `ErrorCode`, `lotStatus`, `money`.

Invariantes que valem aqui:

- INV-3 Datas ISO UTC `Z` com ms; UI em America/Sao_Paulo.
- INV-7 `Bid` é append-only (trigger).
- INV-12 Cadeia HMAC v1: `genesis = HMAC(key,"v1|genesis|{lotId}|{startsAt}|{startingBidCents}|{minIncrementCents}")`; `hash = HMAC(key,"v1|entry|{lotId}|{seq}|{kind}|{pseudonym}|{amountCents}|{at}|{prevHash}")` (prevHash da seq 1 = genesis); `seal = HMAC(key,"v1|seal|{lotId}|{entryCount}|{lastHash}")`. Hex minúsculo, nulos → "", `kind ∈ {BID, CANCEL}`, CANCEL é linha própria e conta no veredito.
- INV-13 DTO público nunca contém `userId`, `bidderId`, nome ou e-mail.
- INV-14 A auditoria lê só o banco.
- INV-16 Envelope de erro; resposta com `serverTime`.
- INV-17 DTO e zod em `packages/shared`.
- INV-18 Voz do pátio; plurais corretos.

## 4. Regras de negócio

| Id | Regra | Origem |
| --- | --- | --- |
| R-8.1 | A auditoria é pública para **qualquer** lote (agendado, ao vivo, em apuração, encerrado, sem lances, cancelado). Sem login. Token Bearer é opcional e serve só para marcar as linhas do próprio usuário (`mine`). Token inválido/expirado vale como visitante (nunca 401 nesta rota). | PRD Papéis; EXP Auditoria |
| R-8.2 | A verificação é **recalculada a cada chamada**. Nada é gravado (sem coluna "veredito", sem cache). `Cache-Control: no-store`. | AD-8; P30 |
| R-8.3 | Lote, linhas e comprovante são lidos numa **única transação de leitura `RepeatableRead`**, para que um lance que entre durante a verificação não gere falso `SEAL_MISMATCH`. | (decisão desta fatia, derivada de AD-2/AD-8) |
| R-8.4 | O veredito é calculado por `verifyChain` (pseudocódigo abaixo). Comparações de hash usam `crypto.timingSafeEqual` sobre buffers do mesmo tamanho (tamanhos diferentes = diferente). | PRD H5; AD-8 |
| R-8.5 | Precedência do veredito: `BROKEN_AT` → `SEAL_MISMATCH` → `RECEIPT_MISMATCH` → `OK`. | AD-8 |
| R-8.6 | Status por linha: antes da primeira linha ruim `OK`; a primeira ruim `MISMATCH`; todas as seguintes `BROKEN_LINK`. Se não há linha ruim, todas `OK` (inclusive quando o veredito é `SEAL_MISMATCH` ou `RECEIPT_MISMATCH`). | EXP Auditoria |
| R-8.7 | O servidor **nunca** devolve valor "original" ou "esperado" de um registro adulterado, nem o hash recalculado, nem a chave. O hash devolvido por linha é o **gravado**. A página nunca diz "este lance valia R$ X". | EXP/triagem (alerta do mock "corresponde a R$ 25.700") |
| R-8.8 | Remoção dos últimos lances: nenhuma linha existe para apontar. O veredito é `SEAL_MISMATCH` com contagem registrada × encontrada. A tela **não inventa** linha ausente. | PRD A4; P31 |
| R-8.9 | Lote sem linhas e íntegro = `OK` com 0 linhas ("Sem lances, sem corrente para conferir."). "Íntegro" só vale **depois** de conferir estado inicial: `lot.lastHash == genesis recalculado`, `lot.entryCount == 0`, selo confere. | P31 |
| R-8.10 | A linha `CANCEL` entra na cadeia, no veredito e na contagem de linhas. `bidCount` do lote não a conta; `entryCount` sim. Lote cancelado sem nenhuma linha também é válido (veredito `OK`, 0 linhas). | AD-8; C8 |
| R-8.11 | A comparação com o comprovante só existe se há `Receipt`: `receiptOk = receipt.finalHash == lot.lastHash`. Lote sem `Receipt` (ao vivo, sem lances, cancelado, em apuração): `receiptChecked=false`, `receiptOk=null`. | PRD H5 |
| R-8.12 | A frase "o hash final não bate com o comprovante" só aparece quando `receiptOk === false`. Adulterar o conteúdo de uma linha **sem** mexer no hash gravado deixa o hash final igual ao do comprovante; a frase deve dizer isso. | EXP (inconsistência do protótipo) |
| R-8.13 | Marca "você": quando há token válido e a linha `BID` pertence ao usuário (`Bid.bidderId = sub`), `mine=true`. `bidderId` nunca sai do servidor. Fora disso `mine=false`. | PRD P3; AD-9 |
| R-8.14 | A tela é um **retrato**: mostra o instante da verificação (`verifiedAt`) e não atualiza sozinha. "Verificar de novo" refaz a chamada. | P30 |
| R-8.15 | Sem paginação. O custo é O(n) em HMACs sobre as linhas do lote. | AD-8 |
| R-8.16 | **Consistência fora da cadeia** (`consistencyIssue`): (a) lote com `settledAt` e `bidCount > 0` e sem `cancelledAt` exige `Receipt`, e `receipt.amountCents` deve ser igual ao `amountCents` da última linha `BID`; (b) lote sem lances e `settledAt` não pode ter `Receipt`; (c) `cancelledAt` preenchido ⇔ a última linha da cadeia é `CANCEL` (e `CANCEL` só pode ser a última linha). Falha em (a)/(b) vira `RECEIPT_MISMATCH`; falha em (c) vira `SEAL_MISMATCH`. Só vale depois da cadeia: `BROKEN_AT` continua com precedência. Se a S06 decidir não gravar `CANCEL` em lote sem lances (Q3 do SPEC.md), relaxar (c) para "linha `CANCEL` ⇒ `cancelledAt` preenchido". | Revisão: tira o "OK" de lote vendido sem comprovante ou cancelado só no campo |
| R-8.17 | **Rate limit:** `GET /lots/:id/audit` limita a 60 req/min por IP (chave por IP; `trust proxy = 1` em produção). Estouro ⇒ `RATE_LIMITED` 429 no envelope. `RATE_LIMIT_DISABLED=1` desliga nos testes, exceto no AC-8.40, que instancia o limiter ligado. | Decisão: o endpoint é público e recalcula HMAC a cada chamada |

### `verifyChain` (em `domain/audit-chain.ts`, puro; recebe `key` e dados, sem Prisma, sem `Date.now`)

```ts
export type AuditRow = {
  seq: number; kind: 'BID' | 'CANCEL';
  pseudonym: string | null; amountCents: number | null;
  at: Date; prevHash: string; hash: string;
};
export type AuditLot = {
  id: string; startsAt: Date; startingBidCents: number; minIncrementCents: number;
  entryCount: number; lastHash: string; seal: string;
  bidCount: number; settledAt: Date | null; cancelledAt: Date | null;   // só para consistencyIssue (R-8.16)
};
export type RowStatus = 'OK' | 'MISMATCH' | 'BROKEN_LINK';
export type BreakReason = 'SEQ_GAP' | 'PREV_LINK' | 'HASH';
export type ConsistencyIssue =
  | 'RECEIPT_MISSING' | 'RECEIPT_AMOUNT' | 'RECEIPT_UNEXPECTED' | 'CANCEL_FLAG';
export type ChainResult = {
  verdict: 'OK' | 'BROKEN_AT' | 'SEAL_MISMATCH' | 'RECEIPT_MISMATCH';
  firstBad: { seq: number; expectedSeq: number; reason: BreakReason } | null;
  rowStatus: RowStatus[];            // mesmo tamanho e ordem de rows
  foundCount: number;                // rows.length
  registeredCount: number;           // lot.entryCount
  sealOk: boolean;
  receiptOk: boolean | null;         // null = sem comprovante; compara só o hash final
  consistencyIssue: ConsistencyIssue | null;   // R-8.16
};

export function verifyChain(
  key: string,
  lot: AuditLot,
  rows: AuditRow[],                  // já ORDER BY seq ASC
  receipt: { finalHash: string; amountCents: number } | null,
): ChainResult {
  const genesis = genesisHash(key, lot);
  let expectedPrev = genesis;
  let firstBad: ChainResult['firstBad'] = null;
  const rowStatus: RowStatus[] = [];

  // for…of (não forEach): o TS estreitaria firstBad para null depois de um callback
  for (const [i, r] of rows.entries()) {
    if (firstBad) { rowStatus.push('BROKEN_LINK'); continue; }
    const expectedSeq = i + 1;
    let reason: BreakReason | null = null;
    if (r.seq !== expectedSeq) reason = 'SEQ_GAP';
    else if (!eq(r.prevHash, expectedPrev)) reason = 'PREV_LINK';
    else if (!eq(r.hash, entryHash(key, {
      lotId: lot.id, seq: r.seq, kind: r.kind,
      pseudonym: r.pseudonym ?? '', amountCents: r.amountCents ?? '',
      at: r.at.toISOString(), prevHash: r.prevHash,
    }))) reason = 'HASH';
    if (reason) { firstBad = { seq: r.seq, expectedSeq, reason }; rowStatus.push('MISMATCH'); }
    else { expectedPrev = r.hash; rowStatus.push('OK'); }
  }

  const tip = rows.length ? rows[rows.length - 1].hash : genesis;      // hash GRAVADO da última linha
  const sealOk =
    eq(lot.seal, sealHash(key, lot.id, lot.entryCount, lot.lastHash)) &&
    lot.entryCount === rows.length &&
    eq(lot.lastHash, tip);
  const receiptOk = receipt ? eq(receipt.finalHash, lot.lastHash) : null;

  // R-8.16: consistência fora da cadeia (não depende de hash)
  const last = rows[rows.length - 1];
  const lastBid = [...rows].reverse().find((r) => r.kind === 'BID');
  const cancelRowsOk = rows.every((r, i) => r.kind !== 'CANCEL' || i === rows.length - 1);
  const cancelFlagOk = cancelRowsOk && ((lot.cancelledAt !== null) === (last?.kind === 'CANCEL'));
  let consistencyIssue: ConsistencyIssue | null = null;
  if (!cancelFlagOk) consistencyIssue = 'CANCEL_FLAG';
  else if (lot.settledAt && !lot.cancelledAt) {
    if (lot.bidCount > 0 && !receipt) consistencyIssue = 'RECEIPT_MISSING';
    else if (lot.bidCount > 0 && receipt && receipt.amountCents !== lastBid?.amountCents) consistencyIssue = 'RECEIPT_AMOUNT';
    else if (lot.bidCount === 0 && receipt) consistencyIssue = 'RECEIPT_UNEXPECTED';
  }

  const verdict = firstBad ? 'BROKEN_AT'
    : !sealOk || consistencyIssue === 'CANCEL_FLAG' ? 'SEAL_MISMATCH'
    : receiptOk === false || (consistencyIssue !== null) ? 'RECEIPT_MISMATCH'
    : 'OK';
  return { verdict, firstBad, rowStatus, foundCount: rows.length,
           registeredCount: lot.entryCount, sealOk, receiptOk, consistencyIssue };
}
// eq(a,b): comprimentos iguais && timingSafeEqual(Buffer.from(a,'utf8'), Buffer.from(b,'utf8'))
```

Observações do algoritmo:

- A linha seguinte a uma remoção no meio acusa `SEQ_GAP` (sequência pulou) e vira a "primeira ruim".
- Adulterar `startsAt`, `startingBidCents` ou `minIncrementCents` do lote muda o genesis: a linha 1 acusa `PREV_LINK`; com 0 linhas, `lot.lastHash ≠ genesis` e dá `SEAL_MISMATCH`.
- `sealOk`, `receiptOk` e `foundCount` são calculados **mesmo quando há `BROKEN_AT`**, só para a frase ser honesta (R-8.12).
- Inserir uma linha com `seq` repetido é impossível (`@@unique([lotId, seq])`); inserir com `seq` novo falha em `HASH` (sem a chave não há hash válido).
- `consistencyIssue` cobre o que o hash não alcança: `Receipt` apagado de lote vendido, `Receipt.amountCents` trocado e `Lot.cancelledAt` limpo/preenchido sem a linha `CANCEL` correspondente. **Ainda não coberto** (vira limitação no README, §15): `Bid.bidderId` (fora do hash; trocar o dono de um lance passa despercebido, mas o pseudônimo, que está no hash, continua o mesmo), `Lot.leaderId`, `Lot.currentBidCents` e os saldos/ledger (a auditoria cobre o histórico de lances, não a contabilidade).

## 5. Modelo de dados

Nenhuma tabela ou coluna nova. Nenhuma migração.

Índice usado pela leitura: `@@unique([lotId, seq])` do `Bid` (S03). A consulta é `SELECT … FROM "Bid" WHERE "lotId"=$1 ORDER BY seq ASC`.

Não criar: coluna de veredito, tabela de verificações, cache.

## 6. Contratos REST

### `GET /lots/:id/audit`

| Campo | Valor |
| --- | --- |
| Papel | Público. `Authorization: Bearer` opcional (só para `mine`) |
| 200 | `AuditView` abaixo |
| Erros | `NOT_FOUND` 404 se o lote não existe ou o `id` não é UUID válido (nunca `VALIDATION`) · `RATE_LIMITED` 429 (R-8.17: 60 req/min por IP; mensagem do limiter da S00) |
| Headers | `Cache-Control: no-store` |
| Corpo da requisição | Nenhum |

```ts
// packages/shared
type AuditRowDto = {
  seq: number;                              // posição na cadeia; a UI exibe 2 dígitos ("09")
  kind: 'BID' | 'CANCEL';
  pseudonym: string | null;                 // "Licitante 7F3A"; null em CANCEL
  mine: boolean;                            // true só com token do dono da linha
  amountCents: number | null;               // null em CANCEL
  at: string;                               // ISO UTC com ms
  hash: string;                             // 64 hex GRAVADO
  status: 'OK' | 'MISMATCH' | 'BROKEN_LINK';
};
type AuditView = {
  lot: {
    id: string; number: number; title: string; brand: string; model: string; year: number;
    status: 'SCHEDULED' | 'LIVE' | 'CLOSING' | 'SOLD' | 'UNSOLD' | 'CANCELLED';
    startsAt: string; endsAt: string; originalEndsAt: string;
    bidCount: number;                       // só lances
    imageUrl: string | null;
  };
  entries: AuditRowDto[];                   // todas, ORDER BY seq
  verdict: {
    code: 'OK' | 'BROKEN_AT' | 'SEAL_MISMATCH' | 'RECEIPT_MISMATCH';
    firstBad: { seq: number; expectedSeq: number; reason: 'SEQ_GAP' | 'PREV_LINK' | 'HASH' } | null;
    okCount: number;                        // linhas com status OK
    foundCount: number;                     // entries.length
    registeredCount: number;                // lot.entryCount (o que o selo registra)
    sealOk: boolean;
    receiptChecked: boolean;                // true se há Receipt ou se o lote vendido deveria ter um (R-8.16)
    receiptOk: boolean | null;
    consistencyIssue: 'RECEIPT_MISSING' | 'RECEIPT_AMOUNT' | 'RECEIPT_UNEXPECTED' | 'CANCEL_FLAG' | null;
  };
  finalHash: string;                        // lot.lastHash gravado (hash final do lote)
  receipt: { finalHash: string; receiptCode: string } | null;   // SEM token (T9)
  verifiedAt: string;                       // ISO UTC, vem do Clock
  serverTime: string;
};
```

Regras do DTO:

- `entries[].hash` e `finalHash` são sempre os valores **gravados**. Não existe campo "expectedHash" nem "originalAmount".
- `receipt` só existe se há `Receipt` (lote arrematado). **O token do comprovante nunca sai desta rota** (S05 R-5.12: só o vencedor logado o recebe, em `myReceiptToken` do `GET /lots/:id`). Quem sabe o `lotId` não pode, pela auditoria, abrir o comprovante de ninguém. `receiptCode` (`NNN-XXXX`) expõe só 4 caracteres do token e é aceito. O link "Ver comprovante do lote" da tela só aparece se o `GET /lots/:id` autenticado do mesmo lote trouxer `myReceiptToken` (a página faz essa chamada extra apenas com sessão de licitante).
- Sem `userId`, `bidderId`, nome, e-mail, `leaderId`.
- `lot.status` vem de `lotStatus(lot, clock.now())` (INV-11).

Teste de privacidade (obrigatório): a resposta serializada não contém nenhum `id`, `email`, `name` dos usuários do seed nem as chaves `userId`, `bidderId`, `leaderId`, `passwordHash`, e **não contém o `token` do `Receipt`** (busca por substring do token completo e da chave `token`).

## 7. Contratos Socket.IO

Nenhum. A auditoria não escuta eventos (R-8.14).

## 8. Mensagens

Frases do veredito (`{N}` e `{X}` com dois dígitos não; use número simples; "lance(s)" vira "registro(s)" quando existe linha CANCEL na cadeia):

| Situação | Carimbo | Frase (pt-BR exata) |
| --- | --- | --- |
| `OK`, N>0, com comprovante | Íntegro | "{N} de {N} lances conferem e o hash final é o mesmo do comprovante. Ninguém mexeu em nada depois do martelo." |
| `OK`, N>0, sem comprovante (ao vivo, em apuração) | Íntegro | "{N} de {N} lances conferem e o hash final bate com o selo do lote. O lote ainda não fechou: a conta vale para este instante." |
| `OK`, com linha CANCEL | Íntegro | "{N} de {N} registros conferem e o hash final bate com o selo do lote. O lote foi cancelado e o cancelamento está na corrente." |
| `OK`, N=0 (sem lances, qualquer status) | Íntegro | "Sem lances, sem corrente para conferir. O estado inicial do lote e o selo conferem." |
| `OK`, N=0, lote cancelado | Íntegro | "Sem lances, sem corrente para conferir. O lote foi cancelado antes do primeiro lance." (texto a revisar) |
| `BROKEN_AT` | Adulterado | "{X} de {N} lances conferem. A corrente quebra na linha {NN}." + (se `receiptOk === false`) " O hash final também não bate com o comprovante." + (se `receiptOk === true`) " O hash final continua igual ao do comprovante, mas a linha {NN} não gera o hash guardado para ela." |
| `SEAL_MISMATCH` com contagem diferente | Adulterado | "As {N} linhas encontradas conferem entre si, mas o selo do lote registra {M}. Faltam {M−N} no fim da corrente." (se M>N) / "Há {N−M} linhas além do que o selo registra." (se M<N) |
| `SEAL_MISMATCH` com contagem igual | Adulterado | "As {N} linhas conferem entre si, mas o selo do lote não bate com a contagem e o hash final gravados." |
| `RECEIPT_MISMATCH` | Adulterado | "A corrente e o selo conferem, mas o hash final do comprovante é outro. O comprovante foi alterado ou não pertence a este lote." |
| `RECEIPT_MISMATCH` com `RECEIPT_MISSING` | Adulterado | "A corrente e o selo conferem, mas este lote consta como arrematado e o comprovante não existe." (texto a revisar) |
| `RECEIPT_MISMATCH` com `RECEIPT_AMOUNT` | Adulterado | "A corrente e o selo conferem, mas o valor do comprovante não é o do último lance." (texto a revisar) |
| `RECEIPT_MISMATCH` com `RECEIPT_UNEXPECTED` | Adulterado | "A corrente e o selo conferem, mas existe um comprovante para um lote que fechou sem lances." (texto a revisar) |
| `SEAL_MISMATCH` com `CANCEL_FLAG` | Adulterado | "As {N} linhas conferem entre si, mas o cancelamento do lote e a corrente não concordam." (texto a revisar) |

Banners de problema (`role="alert"`, só em veredito ≠ OK):

| Código / motivo | Texto |
| --- | --- |
| `BROKEN_AT` + `HASH` | "Linha {NN}: o {lance\|registro} gravado não gera o hash guardado para ele." |
| `BROKEN_AT` + `SEQ_GAP` | "Linha {NN}: a sequência pulou. Era esperada a linha {MM}." |
| `BROKEN_AT` + `PREV_LINK` | "Linha {NN}: o elo com a linha anterior não fecha." |
| `SEAL_MISMATCH` | "O selo do lote não fecha com a corrente. Nenhuma linha existente está errada, mas faltam ou sobram registros." (texto a revisar) |
| `RECEIPT_MISMATCH` | "O hash do comprovante não é o hash final deste lote." (com `consistencyIssue`: usar a frase correspondente da tabela anterior) |
| `RATE_LIMITED` (429) | Tela de erro de rede com a mensagem do servidor + "Tentar novamente" (texto a revisar) |

Estados e sistema:

| Situação | Texto |
| --- | --- |
| Verificando | "Refazendo a conta, elo por elo…" |
| Verificado em | "Verificado em {dd/mm/aaaa HH:mm:ss} (Brasília)" |
| Botão | "Verificar de novo" / durante a verificação "Verificando…" (inerte) |
| Lote ou id inexistente (404) | Título "Lote não encontrado" + "Esse papel não existe, ou já foi para a gaveta." + "Voltar à vitrine" |
| Falha de rede | "Não deu para conferir agora." + "Tentar novamente"; se há resultado anterior, mantê-lo com o selo "DESATUALIZADO" |
| Legenda do cabeçalho | "AUDITORIA PÚBLICA · NÃO PRECISA DE LOGIN" |
| Linha CANCEL | "Cancelado pelo leiloeiro" (+ "Saldo comprometido do líder estornado" quando o lote tinha ao menos um lance) |
| Status de linha (rótulos) | `OK` → "CONFERE" · `MISMATCH` → "NÃO CONFERE" · `BROKEN_LINK` → "ELO QUEBRADO" |
| Marca de linha própria | "VOCÊ" (chip-licitante com fundo ocre, peso 600) |
| Live region | "Verificando." / "Veredito: íntegro. {N} de {N} lances conferem." / "Veredito: adulterado. {frase}" |

Todos os textos desta tabela são "texto a revisar", exceto "Refazendo a conta, elo por elo…", "Sem lances, sem corrente para conferir." e a primeira frase do `OK` (vêm do design/EXPERIENCE).

## 9. Telas e estados

### T9 — Auditoria (`/lotes/[id]/auditoria`)

Quem acessa: todos, inclusive logado. Cabeçalho **mínimo**: `Logo` + legenda "AUDITORIA PÚBLICA · NÃO PRECISA DE LOGIN" (sem nav, sem chip de saldo). Título da página (`<title>`): "Auditoria do lote {NNN} · LanceAuto". Renderização no cliente (a verificação é uma chamada; o estado "Verificando" é real).

Estrutura (desktop 1440; max 1320; gutter `clamp(16px,4vw,56px)`):

1. Cabeçalho do lote: `LotTag` (número, 3 dígitos), título do carro (display-titulo), meta mono ("ano · lances: N · status em texto: AO VIVO / AGENDADO / EM APURAÇÃO / ARREMATADO / SEM LANCES / CANCELADO"), links "Ver sala do lote" (`/lotes/[id]`) e, **somente para o vencedor logado** (o `GET /lots/:id` autenticado do mesmo lote devolve `myReceiptToken`), "Ver comprovante do lote" (`/c/{myReceiptToken}`). Visitante e demais usuários não veem esse link; o `receipt` da auditoria não traz token (T9).
2. Caixa de veredito (papel, borda 3px, sombra 6px): carimbo à esquerda; à direita a frase; abaixo "Verificado em …" e o botão secundário "Verificar de novo". Contadores mono: "LINHAS NA CORRENTE {N}" · "REGISTRADAS NO SELO {M}" · "HASH FINAL" (abreviado + ver inteiro) · "HASH DO COMPROVANTE" (abreviado + ver inteiro; só se há comprovante).
3. Banner de problema (só se ≠ OK), `role="alert"`, borda `ferrugem`.
4. Tabela da corrente (`DataTable`, caption oculta "Histórico de lances do lote {NNN}") — colunas: **Nº** · **Licitante** · **Valor** · **Horário** · **Hash** · **Situação**.
5. Aside "Como a gente confere" (3 passos, abaixo da tabela no mobile; ao lado ≥ ~1000px):
   1. "Cada lance guarda o hash do lance anterior. Mexeu num, o elo seguinte deixa de fechar."
   2. "O hash é um HMAC-SHA256: uma conta que só se refaz com uma chave secreta guardada no servidor, nunca no banco."
   3. "Quem confere é o servidor, não o seu navegador. Ao abrir esta página ele refaz a conta do primeiro ao último lance e compara com o selo do lote e com o comprovante." (textos a revisar; o design dizia "calculadora de SHA-256", que sai)

Conteúdo das células:

| Coluna | Conteúdo |
| --- | --- |
| Nº | `seq` com 2 dígitos (`09`), Plex Mono |
| Licitante | `BID`: pseudônimo "Licitante 7F3A" em Plex Mono + chip "VOCÊ" se `mine`. `CANCEL`: "Cancelado pelo leiloeiro" (Big Shoulders caixa-alta) |
| Valor | `BID`: `R$ 31.000,00` mono 600. `CANCEL`: "—" |
| Horário | `dd/mm HH:mm:ss` (Brasília), mono; `title`/`<time dateTime>` com ISO |
| Hash | abreviado `6 primeiros…4 últimos` (ex.: `a1b2c3…9f0e`) em mono + botão "ver inteiro" / "recolher" (abaixo) |
| Situação | texto + ícone: "CONFERE" (verde `verde`, ícone check), "NÃO CONFERE" (`ferrugem`, ícone X), "ELO QUEBRADO" (`tinta2`/`ferrugem`, ícone corrente partida). Nunca só cor |

Hash inteiro: o botão alterna a célula para os 64 hex em mono com `word-break: break-all`. Atributos: `aria-expanded`, `aria-controls="hash-{seq}"`; nome acessível "ver hash inteiro da linha 09" / "recolher hash da linha 09"; alvo mínimo 44px. O estado de expansão é por linha e independente. Mesma mecânica nos hashes da caixa de veredito.

Estilo da tabela (tokens do design system): fundo `papel`, borda 3px `linha`, sombra `6px 6px 0 sombra`, `min-width: 780px` em região rolável; separador de linha `2px dashed tracejado`; cabeçalho Plex Mono 11px peso 500, tracking .12em, cor `tinta2`, padding `12px 8px` (20px nas extremidades), borda inferior 3px `linha`; células `14px 8px` (20px nas extremidades). **Cada linha tem borda esquerda de 6px na cor do veredito da linha:** `OK` → `verde`; `MISMATCH` → `ferrugem`; `BROKEN_LINK` → `ferrugem`. Linha `MISMATCH` com fundo `falha`. Linha `BROKEN_LINK` com `opacity: .85` (o protótipo usava .62; o piso de acessibilidade exige contraste 4,5:1, então a opacidade sobe; verificar nos dois temas).

Estados:

| Estado | Tratamento |
| --- | --- |
| Verificando (carga inicial e "Verificar de novo") | Carimbo e frase somem; aparece "Refazendo a conta, elo por elo…" com ponto pulsante `ocre` (parado em reduced-motion); colunas Situação mostram "…"; botão "Verificando…" inerte (`aria-disabled`, `aria-busy`); clique repetido é ignorado (sem 2ª chamada). A tela mantém o estado "Verificando" por **no mínimo 400 ms** para ser perceptível (sugestão desta fatia, ver §16) |
| Íntegro | Carimbo Íntegro (`verde`, −7°, "bate" ao aparecer); frase conforme §8; todas as linhas "CONFERE" |
| Adulterado `BROKEN_AT` | Carimbo Adulterado (`ferrugem`, +4°); frase + banner `role="alert"` apontando a linha; linha ruim sobre `falha` com "NÃO CONFERE"; seguintes "ELO QUEBRADO" |
| Adulterado `SEAL_MISMATCH` | Carimbo Adulterado; frase de selo + banner de selo; **todas** as linhas "CONFERE"; nenhuma linha destacada; contadores "NA CORRENTE {N}" e "NO SELO {M}" em `ferrugem` |
| Adulterado `RECEIPT_MISMATCH` | Carimbo Adulterado; frase de comprovante + banner; linhas "CONFERE"; "HASH DO COMPROVANTE" em `ferrugem` |
| Lote ao vivo | Sem "HASH DO COMPROVANTE"; frase sem comprovante; etiqueta "AO VIVO" em mono na meta |
| Lote agendado | 0 linhas, Íntegro, frase de N=0; sem comprovante |
| Lote encerrado sem lances | 0 linhas, Íntegro, "Sem lances, sem corrente para conferir…"; tabela substituída por `FeedbackState` vazio "Sem lances, sem corrente para conferir." |
| Lote cancelado | Linhas dos lances + linha `CANCEL` no fim; Íntegro; sem comprovante. Se 0 linhas, frase específica |
| Lote em apuração (CLOSING) | Como ao vivo; meta "EM APURAÇÃO" |
| 404 | `FeedbackState` "Lote não encontrado" + botão "Voltar à vitrine"; sem dados internos |
| Falha de rede / erro 5xx | `FeedbackState` erro + "Tentar novamente"; se havia resultado, mantê-lo com selo "DESATUALIZADO" |
| Tema claro/noite | Mesmos tokens; confirmar contraste das linhas "ELO QUEBRADO" e dos rótulos nos dois |
| `prefers-reduced-motion` | Sem pulso, sem "bate": o carimbo e a frase aparecem direto |

Comportamento:

- Ao montar, chama `GET /lots/:id/audit` (com Bearer se houver). `staleTime: 0`, `gcTime: 0`, sem `refetchOnWindowFocus`.
- "Verificar de novo" refaz a chamada e substitui tudo (veredito, linhas, `verifiedAt`).
- Live region (`role="status"`, `aria-live="polite"`) anuncia "Verificando." e depois o veredito; o banner de problema usa `role="alert"`.
- Teclado: ordem de tab = cabeçalho → links do lote → botão "Verificar de novo" → região rolável da tabela (`tabindex="0"`, `role="region"`, `aria-label="Histórico de lances do lote {NNN}"`) → botões "ver inteiro" → aside.

Responsivo (fluido, sem breakpoints):

- 390px: caixa de veredito empilha (carimbo, frase, hora, botão); contadores quebram em 1 coluna; a tabela rola na horizontal dentro da região focável (`min-width: 780px`); o aside vai para baixo da tabela; cabeçalho mínimo quebra em linhas.
- 1440px: caixa de veredito em duas colunas; aside à direita da tabela (`flex: 1 1 320px`).

## 10. Componentes criados

| Componente | Uso | Spec |
| --- | --- | --- |
| `AuditView` (página) | `/lotes/[id]/auditoria` | Composição acima |
| `VerdictBox` | Caixa de veredito | Fundo `papel`, borda 3px `linha`, sombra `6px 6px 0`, padding 24px. Carimbo `Stamp` (variante Íntegro/Adulterado: Big Shoulders 900 26px, tracking .08em, caixa-alta, borda 4px + outline 2px offset 3px; Íntegro `verde` −7°; Adulterado `ferrugem` +4°). Frase em Newsreader 17px; hora em Plex Mono 13px `tinta2` |
| `AuditTable` | Tabela da corrente | Via `DataTable` (S00) com as bordas de linha de 6px e fundos por status acima |
| `HashCell` | Hash abreviado/inteiro | `abbreviateHash(h) = h.slice(0,6) + '…' + h.slice(-4)` (função pura em `packages/shared`, com teste); botão `Button` secundário compacto, altura mínima 44px, Plex Mono 12px; `aria-expanded`/`aria-controls` |
| `RowStatus` | Situação | Texto Plex Mono 12px caixa-alta tracking .12em + ícone SVG 16px (`aria-hidden`) |
| `HowWeCheck` | Aside "Como a gente confere" | Cartão `papel`, borda 3px, 3 passos numerados em Big Shoulders 900 (número) e Newsreader 15px |
| `VerifyingIndicator` | "Refazendo a conta…" | Ponto 10px `ocre` com `la-pulsa 1.2s` + texto Newsreader 17px |

Tokens usados: `fundo`, `papel`, `suave`, `tinta`, `tinta2`, `linha`, `sombra`, `tracejado`, `ocre`, `ferrugem`, `verde`, `falha`, `sobreCor`; tipografias `display-titulo`, `carimbo`, `mono`, `mono-dado`, `mono-rotulo`, `body`, `body-nota`; borda 3px/4px/6px (linha lateral); sombra `6px 6px 0`; alvo 44px.

## 11. Seed desta fatia

Nenhuma criação. Verificação: todos os lotes do seed (ao vivo, agendado, arrematado, sem lances, cancelado) devolvem `verdict.code = OK` (AC-8.14).

## 12. Critérios de aceite

**Veredito e algoritmo**

- AC-8.1 [auto] Dado o lote arrematado do seed (5 lances + comprovante), quando `GET /lots/:id/audit` sem token, então 200, `verdict.code=OK`, `okCount=foundCount=registeredCount`, `receiptChecked=true`, `receiptOk=true`, todas as linhas `OK`.
- AC-8.2 [auto] Dado um lote com 5 lances onde se altera `amountCents` da seq 3 direto no banco (trigger desativado), quando a auditoria roda, então `BROKEN_AT`, `firstBad={seq:3, reason:'HASH'}`, status `[OK,OK,MISMATCH,BROKEN_LINK,BROKEN_LINK]`, `okCount=2`. (AC11 / A1)
- AC-8.3 [auto] Dado o mesmo lote, quando se altera `pseudonym` da seq 2, ou `at` da seq 4, ou `hash` da seq 3, então `BROKEN_AT` na própria seq alterada (2, 4, 3). (A1)
- AC-8.4 [auto] Dado o lote com a seq 3 apagada, quando audita, então `BROKEN_AT`, `firstBad={seq:4, expectedSeq:3, reason:'SEQ_GAP'}`; a linha 4 `MISMATCH`, a 5 `BROKEN_LINK`. (A2)
- AC-8.5 [auto] Dado o lote com uma linha inserida na seq 6 com `hash`/`prevHash` forjados (hex qualquer), quando audita, então `BROKEN_AT` seq 6 (`HASH` ou `PREV_LINK`); e, abrindo espaço na seq 3 sem violar o `@@unique([lotId, seq])` (que não é deferível: `UPDATE … SET seq = seq + 1` falharia linha a linha) com `UPDATE "Bid" SET seq = seq + 1000 WHERE "lotId"=$1 AND seq >= 3` seguido de `UPDATE … SET seq = seq - 999 WHERE seq >= 1003`, dentro da mesma transação, e INSERT de uma linha forjada na seq 3, `BROKEN_AT` seq 3. (A3)
- AC-8.6 [auto] Dado o lote com as duas últimas linhas apagadas (3 restantes; `entryCount=5`), quando audita, então `SEAL_MISMATCH`, `foundCount=3`, `registeredCount=5`, `firstBad=null`, as 3 linhas `OK`; nenhuma linha extra no DTO. (A4)
- AC-8.7 [auto] Dado o mesmo cenário em que o atacante também reduz `lot.entryCount` para 3 e `lot.lastHash` para o hash da seq 3 (sem recalcular o selo), quando audita, então `SEAL_MISMATCH`. Se também troca `lot.seal` por 64 hex quaisquer, continua `SEAL_MISMATCH`. (A4)
- AC-8.8 [auto] Dado uma cadeia inteira recalculada com uma chave **errada** (atacante sem a chave) gravada no lugar da original, quando audita com a chave verdadeira, então `BROKEN_AT` seq 1. (A5; ver §13 para o que não é testável)
- AC-8.9 [auto] Dado o lote arrematado com `Receipt.finalHash` trocado direto no banco, quando audita, então `RECEIPT_MISMATCH`, linhas todas `OK`, `receiptOk=false`.
- AC-8.10 [auto] Dado o lote com `startingBidCents` alterado no banco, quando audita, então `BROKEN_AT` seq 1 (`PREV_LINK`) se há linhas; se há 0 linhas, `SEAL_MISMATCH`.
- AC-8.11 [auto] Dado lote sem lances íntegro, quando audita, então `OK`, `foundCount=0`, `registeredCount=0`, `entries=[]` (e jamais `OK` sem ter comparado genesis, contagem e selo).
- AC-8.12 [auto] Dado o lote cancelado com 3 lances e a linha `CANCEL` (seq 4), quando audita, então `OK`, 4 entradas, a última `kind=CANCEL` com `pseudonym=null`, `amountCents=null`; se `at` da linha CANCEL é alterado, `BROKEN_AT` seq 4. (R15)
- AC-8.13 [auto] Dado lote ao vivo com lances, quando audita, então `OK`, `receipt=null`, `receiptChecked=false`, `receiptOk=null`.
- AC-8.14 [auto] Dado o seed completo, quando se audita cada lote, então todos `OK`.
- AC-8.15 [auto] Dado um lote ao vivo em que Ana e Bruno **alternam** 20 lances válidos em sequência (cada um cobrindo o outro; o líder não cobre o próprio lance e lances do mesmo valor seriam recusados, então não são concorrentes entre si) enquanto 20 chamadas de auditoria rodam em paralelo (`Promise.all`, limiter desligado por `RATE_LIMIT_DISABLED=1`), então nenhuma auditoria devolve outro veredito além de `OK` (leitura `RepeatableRead`) e cada `foundCount` coincide com o `registeredCount` da mesma resposta.

**Privacidade**

- AC-8.16 [auto] Dado a resposta de `GET /lots/:id/audit` de qualquer lote do seed, então o JSON não contém e-mail, nome, `userId`, `bidderId`, `leaderId`, `passwordHash` de nenhum usuário. (AC12)
- AC-8.17 [auto] Dado o mesmo licitante com lances em dois lotes, quando se audita cada um, então os pseudônimos diferem entre os lotes. (P2)
- AC-8.18 [auto] Dado token válido da Ana, quando audita o lote onde ela tem 2 lances, então só essas 2 linhas têm `mine=true`; sem token ou com token expirado, todas `false` e a resposta é 200 (nunca 401). (P3)
- AC-8.19 [auto] Dado a varredura de privacidade em todos os endpoints públicos (`/lots`, `/lots/:id`, `/lots/:id/audit`, `/receipts/:token`), então nenhum devolve e-mail/nome/userId dos usuários do seed. (E11/AC12)
- AC-8.20 [auto] Dado o DTO de um lote adulterado, então nenhum campo contém o valor original do registro nem hash recalculado/esperado (verificar por busca textual dos valores originais e dos hashes recalculados).

**Contrato**

- AC-8.21 [auto] Dado `GET /lots/<uuid inexistente>/audit` e `GET /lots/abc/audit`, então 404 `NOT_FOUND` com envelope `{error:{code,message}}`.
- AC-8.22 [auto] Dado qualquer resposta de sucesso, então `Cache-Control: no-store` e `verifiedAt` vem do `Clock` (com `FakeClock` o valor é o instante fixado).
- AC-8.36 [auto] (T9) Dado o lote arrematado do seed, quando `GET /lots/:id/audit` (sem token, com token da Ana e com token do vencedor), então a resposta serializada **não contém** a chave `token` nem o valor do token do `Receipt`; `receipt` traz só `finalHash` e `receiptCode`.
- AC-8.37 [auto] (R-8.16) Dado o lote arrematado em que o `Receipt` é apagado direto no banco, quando audita, então `RECEIPT_MISMATCH` com `consistencyIssue='RECEIPT_MISSING'` e linhas todas `OK`; com `Receipt.amountCents` trocado, `RECEIPT_AMOUNT`.
- AC-8.38 [auto] (R-8.16) Dado o lote cancelado do seed em que `cancelledAt` é limpo direto no banco (ou, ao contrário, um lote ao vivo ganha `cancelledAt`), quando audita, então `SEAL_MISMATCH` com `consistencyIssue='CANCEL_FLAG'`.
- AC-8.39 [auto] (limitação documentada) Dado `UPDATE "Bid" SET "bidderId"=<outro usuário>` numa linha, quando audita, então `OK` (a limitação está no README; o teste fixa o comportamento para ninguém o tomar por bug).
- AC-8.40 [auto] (R-8.17) Dado o limiter ligado (instância criada pela fábrica, `RATE_LIMIT_DISABLED` ausente), quando 61 chamadas a `GET /lots/:id/audit` partem do mesmo IP em 1 minuto (`FakeClock` ou janela curta injetada), então as 60 primeiras dão 200 e a 61ª dá 429 `RATE_LIMITED` no envelope `{error:{code,message}}`. Este AC roda isolado: os demais ACs (inclusive o AC-8.15, que faz 20 chamadas) usam o limiter desligado.

**Tela**

- AC-8.23 [manual] Dado visitante sem login, quando abre `/lotes/{id}/auditoria` do lote arrematado, então vê o cabeçalho mínimo com a legenda "AUDITORIA PÚBLICA · NÃO PRECISA DE LOGIN", o estado "Refazendo a conta, elo por elo…", depois o carimbo Íntegro, a frase do `OK` com comprovante e todas as linhas "CONFERE".
- AC-8.24 [manual] Dado a verificação em andamento, quando clico "Verificar de novo" duas vezes seguidas, então só uma chamada é feita (aba Network) e o botão fica inerte até terminar.
- AC-8.25 [manual] Dado resultado exibido, quando clico "Verificar de novo", então `Verificado em` muda para o novo horário com segundos (Brasília).
- AC-8.26 [manual] Dado lote adulterado na seq 3 de 5, quando abro a página, então: carimbo Adulterado; frase "2 de 5 lances conferem. A corrente quebra na linha 03." (+ trecho do hash final conforme `receiptOk`); banner `role="alert"` "Linha 03: o lance gravado não gera o hash guardado para ele."; linha 03 sobre `falha` com borda esquerda 6px `ferrugem` e "NÃO CONFERE"; linhas 04 e 05 "ELO QUEBRADO" legíveis; nenhuma menção a valor original.
- AC-8.27 [manual] Dado lote com últimos lances apagados, quando abro a página, então banner e frase de selo, todas as linhas "CONFERE", contadores "NA CORRENTE 3" e "NO SELO 5" em `ferrugem`, e nenhuma linha destacada.
- AC-8.28 [manual] Dado um hash abreviado, quando ativo "ver inteiro" por teclado (Enter), então `aria-expanded="true"`, 64 caracteres aparecem quebrando em qualquer ponto sem estourar a largura, foco permanece no botão que passa a dizer "recolher".
- AC-8.29 [manual] Dado leitor de tela, quando a verificação termina, então é anunciado "Veredito: …" uma única vez; em adulterado, o banner é anunciado como alerta.
- AC-8.30 [manual] Dado 390px de largura, então não há rolagem horizontal da página; só a tabela rola, dentro de região focável rotulada; o aside fica abaixo; nos dois temas.
- AC-8.31 [manual] Dado `/lotes/<inexistente>/auditoria`, então "Lote não encontrado", "Voltar à vitrine" funciona e nada interno é exibido.
- AC-8.32 [manual] Dado a API fora do ar, então "Não deu para conferir agora." + "Tentar novamente"; com resultado anterior, ele permanece marcado "DESATUALIZADO".
- AC-8.33 [manual] Dado `prefers-reduced-motion`, então não há pulso nem "bate" e o veredito está visível.

**Retrofits**

- AC-8.34 [manual] Dado a Vitrine, quando clico num cartão **Encerrado**, então vai para a auditoria daquele lote (e não para o lote 018 nem para a Sala). Ao vivo e agendado continuam indo para a Sala.
- AC-8.35 [manual] Dado a Sala (qualquer status), então existe o link "Auditar este lote" com alvo ≥ 44px apontando para a auditoria do próprio lote; no comprovante, "Verificar na auditoria"/"Auditar lote" aponta para o lote do comprovante; no Painel, "Auditoria do lote" (encerrados e cancelados); em Meus arremates, "Conferir na auditoria" (perdidos).

## 13. Casos de borda e concorrência

- **Lance durante a verificação:** a leitura `RepeatableRead` enxerga um retrato coerente; o resultado vale para o instante `verifiedAt`. O lance novo aparece no "Verificar de novo".
- **Dois cancelamentos/lances simultâneos** nunca geram linhas com `seq` repetido (garantido por S03/S06); a auditoria não precisa tratá-lo.
- **Lote cancelado com 0 linhas** (se a S06 não grava CANCEL sem lances): `OK` com 0 linhas e frase de cancelado.
- **Linha `CANCEL` adulterada** (ex.: `at`): `BROKEN_AT` na seq dela; o texto usa "registro", não "lance".
- **Pseudônimo repetido** (colisão de 4 hex no lote): as linhas continuam distintas por `seq`; sem tratamento especial.
- **Token expirado** na chamada pública: tratado como visitante.
- **Chave `AUDIT_HMAC_KEY` trocada depois do seed:** todas as cadeias passam a falhar em `seq 1` (ou `SEAL_MISMATCH` com 0 linhas). Não é bug da auditoria; documentar no README (S09).
- **A5 (recalcular a cadeia inteira) não é testável de ponta a ponta sem a chave**: só se pode provar o contrário (AC-8.8: recalcular com chave errada não passa). A garantia vem do segredo estar fora do banco.
- **Lote com muitos lances:** O(n); sem paginação (§16).
- **Hash gravado com maiúsculas/tamanho errado:** `eq` retorna falso → `HASH`.

## 14. Testes exigidos

Unit (`domain/audit-chain.test.ts`, Vitest, sem banco; as chamadas usam as assinaturas com chave primeiro, T5):

1. `verifyChain` com cadeia válida de 0, 1 e 5 linhas → `OK`. Inclui os casos de `consistencyIssue` (R-8.16): vendido sem `Receipt`, `amountCents` do `Receipt` diferente, `Receipt` em lote sem lances, `cancelledAt` sem linha `CANCEL` e vice-versa, `CANCEL` fora da última posição.
2. Tabela de adulterações em memória: alterar cada campo (`seq`, `kind`, `pseudonym`, `amountCents`, `at`, `prevHash`, `hash`) de cada linha → `BROKEN_AT` na linha certa, `rowStatus` correto.
3. Remover linha do meio → `SEQ_GAP` na seguinte; remover finais → `SEAL_MISMATCH` com `foundCount<registeredCount`; trocar `lot.seal` / `lot.lastHash` / `lot.entryCount` → `SEAL_MISMATCH`.
4. `receipt.finalHash` diferente → `RECEIPT_MISMATCH`; `receipt=null` → `receiptOk=null`.
5. Precedência: linha ruim + selo ruim + comprovante ruim → `BROKEN_AT`.
6. Chave errada → `BROKEN_AT` seq 1.
7. Linha `CANCEL` com `pseudonym=null`/`amountCents=null` hasheia como "" e verifica.
8. `abbreviateHash` e a função de frase do veredito (`verdictSentence(view)`) para cada linha da tabela de §8, incluindo plural ("1 lance", "2 lances") e "registros".

Integração (`modules/audit/audit.int.test.ts`, Postgres real `DATABASE_URL_TEST`, `FakeClock`):

9. Helper `withAppendOnlyTriggerDisabled(prisma, fn)`: **uma única transação** (`prisma.$transaction`): `ALTER TABLE "Bid" DISABLE TRIGGER bid_no_update_delete` → `fn(tx)` (os `UPDATE`/`DELETE`/`INSERT` de adulteração, todos pelo `tx`) → `ALTER TABLE "Bid" ENABLE TRIGGER bid_no_update_delete` → commit. O DDL do Postgres é transacional: se `fn` lançar, o rollback desfaz também o `DISABLE`, e o trigger nunca fica desligado para outro teste (T2). A suíte de integração da API roda com `fileParallelism: false` (S00), pois o `ALTER TABLE` pega lock exclusivo e o `TRUNCATE … CASCADE` da limpeza também.
10. AC-8.1 a AC-8.14, cada um como caso (monta o lote pelos services: criar lote, depositar, lances, fechar com `FakeClock`, cancelar).
11. AC-8.15 (lances alternados em sequência + 20 auditorias em `Promise.all`).
12. AC-8.16 a AC-8.22 e AC-8.36 a AC-8.39 (privacidade, token fora da auditoria, `mine`, 404, `no-store`, `Clock`, consistência, limitação de `bidderId`); AC-8.40 (rate limit) em arquivo separado com o limiter ligado.
13. Sanidade do trigger: sem desativá-lo, `UPDATE "Bid"` e `DELETE FROM "Bid"` falham (garante que o teste de adulteração está de fato burlando a proteção). Teste extra: depois de qualquer caso de adulteração (inclusive os que lançam), `SELECT tgenabled FROM pg_trigger WHERE tgname='bid_no_update_delete'` devolve `O` (habilitado).

Web (Vitest, lógica pura): `abbreviateHash`, mapeamento `status → rótulo/ícone`, `verdictSentence`.

## 15. Retrofits e integrações

Esta fatia altera código de fatias anteriores:

| Onde | Mudança |
| --- | --- |
| `lotCardHref` (S02) | Cartão `SOLD`/`UNSOLD` (encerrado) → `/lotes/{id}/auditoria`. Ao vivo/agendado/apuração seguem para a Sala |
| Sala (S02/S03/S05) | Link "Auditar este lote" (≥ 44px) visível em todos os estados, inclusive cancelado e agendado |
| Comprovante (S05) | Link "Verificar na auditoria" e botão "Auditar lote" → `/lotes/{id}/auditoria` |
| Painel (S02/S05/S06) | "Auditoria do lote" nos cartões Encerrados e nos Cancelados |
| Meus arremates (S07) | "Conferir na auditoria" (Perdidos) e link nos Cancelados |
| `packages/shared` | `AuditView`, `AuditRowDto`, `abbreviateHash`, `verdictSentence` |
| `apps/api/src/domain/audit-chain.ts` | + `verifyChain` |
| `apps/api/src/modules/audit` | + rota, service e mapper |

Pendurar para a S09: texto do README (abaixo), varredura de a11y/responsivo/tema da T9.

### Texto da técnica, pronto para colar no README (D7 + L1)

````markdown
## Como o histórico de lances é protegido contra adulteração

Cada lote tem uma **cadeia de hashes assinada com HMAC-SHA256**. A chave fica só numa variável de ambiente do servidor (`AUDIT_HMAC_KEY`), nunca no banco.

**Como funciona**

1. Cada lance guarda: número de sequência no lote (1, 2, 3…), pseudônimo do licitante, valor em centavos, horário (UTC), o hash do lance anterior e o próprio hash. O cancelamento de um lote também entra na cadeia como uma linha própria.
2. O hash de cada linha é `HMAC-SHA256(chave, "v1|entry|{lote}|{seq}|{tipo}|{pseudônimo}|{valor}|{horário}|{hash anterior}")`. O primeiro lance usa um hash inicial (genesis) derivado dos dados do lote: `HMAC(chave, "v1|genesis|{lote}|{início}|{lance inicial}|{incremento}")`.
3. O lote guarda a quantidade de linhas e o último hash, com um **selo** `HMAC(chave, "v1|seal|{lote}|{quantidade}|{último hash}")`.
4. Ao fechar o lote, o hash final é gravado também no comprovante.
5. A página de auditoria (pública, sem login) pede ao servidor que **refaça a conta** do primeiro ao último lance e compare com o que está gravado, com o selo do lote e com o hash do comprovante. A verificação roda no servidor porque só ele tem a chave.

| Adulteração feita direto no banco | Como é detectada |
| --- | --- |
| Alterar valor, horário ou licitante de um lance | O hash daquela linha deixa de bater |
| Remover um lance do meio | A sequência pula e o encadeamento da linha seguinte quebra |
| Inserir um lance | A sequência ou o hash da linha inserida não fecha (sem a chave não há hash válido) |
| Remover os últimos lances | A contagem e o último hash deixam de bater com o selo do lote (e, em lotes encerrados, o hash final deixa de bater com o comprovante) |
| Recalcular a cadeia inteira | Não dá sem a chave secreta |

Um SHA-256 simples (sem chave) não bastaria: quem tem acesso ao banco recalcularia a cadeia inteira e ninguém perceberia. O que impede isso é a chave estar fora do banco.

Veredito possível: **íntegro**, **adulterado na linha N** (primeiro registro com problema), **selo do lote não confere** (faltam ou sobram registros no fim) e **comprovante não confere**. A página nunca mostra o valor "original" de um registro adulterado, porque o hash não permite recuperá-lo.

Reforços no código: um trigger do PostgreSQL rejeita `UPDATE` e `DELETE` na tabela de lances (os testes o desativam de propósito para simular quem tem acesso ao banco). Dá para reproduzir a detecção à mão:

Com o Docker Compose, abra o `psql` dentro do serviço do banco (ajuste usuário e banco ao seu `.env`; os valores padrão do `.env.example` estão na seção de variáveis):

```bash
docker compose exec db psql -U <usuario> -d <banco>
```

O `id` do lote é o UUID que aparece na URL da Sala (`/lotes/<id>`), ou sai de `SELECT id, number, title FROM "Lot" ORDER BY number;`. Depois:

```sql
ALTER TABLE "Bid" DISABLE TRIGGER bid_no_update_delete;
UPDATE "Bid" SET "amountCents" = "amountCents" + 100 WHERE "lotId" = '<id>' AND seq = 3;
ALTER TABLE "Bid" ENABLE TRIGGER bid_no_update_delete;
-- agora abra /lotes/<id>/auditoria: "Adulterado", linha 03
```

**Limitações**

- Quem tem a chave (o próprio servidor) poderia forjar uma cadeia nova e consistente.
- Restaurar um backup antigo **e completo** do banco não seria detectado em lotes ainda abertos (o selo do backup também é válido). Em lotes já encerrados, o hash impresso no comprovante compartilhado denuncia a troca.
- Trocar `AUDIT_HMAC_KEY` depois de existirem lotes invalida todas as cadeias (todas passam a aparecer como adulteradas).
- Evolução possível: assinar com Ed25519 e publicar a chave pública, para verificar no próprio navegador.
- Reforço possível: o usuário do banco usado pela aplicação pode ficar sem permissão de `UPDATE`/`DELETE` na tabela de lances.
- O pseudônimo tem 4 caracteres hexadecimais; dois licitantes do mesmo lote podem, raramente, ter o mesmo pseudônimo.
- O dono de um lance (`bidderId`) e o líder atual do lote ficam fora do hash: trocar o dono de um lance direto no banco não é detectado pela cadeia (o pseudônimo, que está no hash, não muda). A auditoria cobre o histórico de lances, não a contabilidade (saldos e extrato).
- A auditoria é pública e recalcula a cadeia a cada chamada, então tem limite de 60 requisições por minuto por IP. Atrás de proxy (Render) o IP vem de `X-Forwarded-For` (`trust proxy` = 1). Quem avalia de uma rede corporativa com IP compartilhado pode, raramente, receber "muitas requisições": basta esperar um minuto.
````

## 16. Conflitos resolvidos e perguntas abertas

Conflitos resolvidos (por precedência):

| Conflito | Resolução |
| --- | --- |
| EXPERIENCE/protótipo: frase "o hash final não bate com o comprovante" sempre que adulterado, e "corresponde a R$ 25.700" | A frase só afirma o que é verdade (R-8.12). Valor original nunca aparece (R-8.7). Arquitetura/PRD vencem o mock |
| Triagem P11 sugeria não afirmar proteção do cancelamento pelo HMAC | Arquitetura AD-8 (vence a triagem): CANCEL é linha da cadeia e conta no veredito (C8) |
| DESIGN: linhas "ELO QUEBRADO" a `opacity .62` | EXPERIENCE (piso de a11y): sobe para `.85` e confere contraste nos dois temas |
| EXPERIENCE: P30 "retrato vs tempo real" | Retrato com `verifiedAt` e "Verificar de novo" (recomendação autorizada) |
| EXPERIENCE: aside "calculadora de SHA-256" | Reescrito para HMAC com chave só do servidor (decisão do usuário) |

Decisões do build (S08, 27/10/2026; `spec-s08-auditoria.md`):

1. **Railway** no lugar de Neon, Render e Vercel; `trust proxy` já vinha ligado em produção. Sem migração.
2. **Layout real do repo** no lugar de `modules/audit/`: `domain/audit-chain.ts` (+ `verifyChain`), `services/audit.service.ts`, `routes/audit.ts`, testes em `routes/audit.test.ts` e `routes/audit.rate-limit.test.ts`, helper em `test/helpers/tamper.ts`.
3. **404 sem validar UUID:** os ids são TEXT; `abc` não encontra lote e cai no mesmo `NOT_FOUND` (nunca `VALIDATION`). `no-store` vale também no 404.
4. **Rate limit** com a chave padrão por IP (o `express-rate-limit` 8 pede o helper de IPv6 para chave própria; cada limitador já tem a sua contagem). O AC-8.40 mora num arquivo só dele, com `RATE_LIMIT_DISABLED` removido durante o arquivo.
5. **`receiptChecked`** = há `Receipt` **ou** `consistencyIssue = RECEIPT_MISSING`; `okCount` = linhas `OK`.
6. **Retrato da leitura provado de forma determinística:** um `prisma.$extends` deixa um lance entrar entre a leitura do lote e a das linhas; sob `RepeatableRead` o veredito segue `OK`, sob `ReadCommitted` vira `SEAL_MISMATCH`. As 20 auditorias paralelas (AC-8.15) não provam isso sozinhas.
7. **Frases que a tabela da §8 não cobria:** selo fora com 0 linhas ("Não há linhas na corrente, mas o selo do lote …") e 1 linha ("A única linha … confere"); verbo no singular com N = 1 ("1 de 1 lance confere"). Todas "(a revisar)".
8. **Rota em grupo `(auditoria)`** com layout próprio (o `(publico)` fixa a legenda do Comprovante). Título da aba "Auditoria do lote NNN · LanceAuto" definido no cliente quando a resposta chega (a página é renderizada no cliente, §9).
9. **"Ver comprovante do lote"** só para licitante logado cujo `GET /lots/:id` devolve `myReceiptToken`.
10. **Mínimo de 400 ms** no "Verificando" (pergunta 2) com a espera correndo junto da chamada, e **clique repetido** = uma chamada só (`refetch({ cancelRefetch: false })`; sem isso o segundo clique cancelaria e refaria a chamada).
11. **Contraste (§9, "verificar nos dois temas"):** o `.85` de opacidade no elo quebrado derrubava o rótulo ferrugem para 4,26:1 no claro e 3,79:1 na noite. Agora o `.85` vale só para os dados da linha e a Situação fica a 100%. "NÃO CONFERE" ficou em tinta (ícone e borda em ferrugem): ferrugem sobre o fundo `falha` dava 3,80:1 na noite. Medidos no Chrome: todos ≥ 4,5:1 nos dois temas.
12. **Ordem do veredito:** carimbo e frase, depois a hora e "Verificar de novo", depois os contadores; o Tab segue a leitura (links do lote → Verificar de novo → hashes do veredito → tabela → "ver inteiro" das linhas → aside). A fatia lista os "ver inteiro" depois da tabela; os dois do veredito vêm antes porque estão antes na tela.
13. **`DataTable`** ganhou `rowAccent` opcional (borda esquerda de 6 px por sombra interna, porque a borda de `<tr>` não é confiável com `border-collapse`, e fundo); os outros usos não mudam.
14. **Texto da técnica no README** já nesta fatia (a §17 permite); a revisão final do README é da S09. O `psql` do exemplo usa `lanceauto`, que é o padrão do `.env.example`.
15. **Cancelado sem lances** também tem a linha CANCEL (a S06 a grava) e audita `OK`; a frase "cancelado antes do primeiro lance" só aparece se a cadeia vier sem nenhuma linha.
16. **Cartão Encerrado → auditoria** por decisão do Felipe (pergunta 5, **SIM**). No Painel, o cartão Encerrado também vai à auditoria e ganhou, ao lado, "Auditoria do lote" e "Ver sala".

Perguntas abertas (sugestão marcada):

1. ~~Rate limit em `GET /lots/:id/audit`~~ **Decidido: entra** (60 req/min/IP, R-8.17, AC-8.40), com `trust proxy` = 1 em produção.
2. **Tempo mínimo de 400 ms no estado "Verificando".** Sugestão para o estado ser perceptível (EXPERIENCE diz "por um instante"). Pode ser removido sem afetar contratos.
3. **S06 grava linha `CANCEL` em cancelamento sem lances?** Esta fatia aceita os dois casos; a frase de "cancelado sem lances" é "texto a revisar". Alinhar com a S06.
4. **Lotes com milhares de lances:** sem requisito; sem paginação. Sugestão: nenhuma ação (o seed e a avaliação têm dezenas de lances).
5. ~~**Cartão Encerrado da Vitrine vai direto para a auditoria (AC-8.34)?**~~ **Decidido pelo Felipe em 27/10/2026: SIM, vai para a auditoria.** Texto original: É coerente com o protótipo, mas o PRD descreve Vitrine → Sala, e a Sala encerrada (S05) mostra resultado e comprovante. Sugestão atual: manter o cartão indo para a auditoria só se o usuário confirmar; senão, o cartão Encerrado vai para a Sala e a Sala já traz "Auditar este lote". **Pergunta para o usuário.** Se a resposta for "Sala", AC-8.34 e a linha `lotCardHref` de §15 deixam de valer.

## 17. Definition of Done

- [x] `verifyChain` com todos os casos de §14 verdes (76 casos); `domain/` continua puro (sem Prisma, Express, `Date.now`). Mutação: 13 de 13 mortas.
- [x] `GET /lots/:id/audit` público, `no-store`, leitura `RepeatableRead` (provada por teste), DTO sem identificadores de usuário **e sem o token do comprovante**, com rate limit de 60/min/IP. Mutação no servidor e na rota: 13 de 13 mortas.
- [x] Testes de adulteração via SQL cru cobrindo A1–A4 e a prova negativa de A5; helper de adulteração numa única transação; teste de sanidade do trigger (inclusive "trigger habilitado depois de cada caso", num `afterEach` do arquivo).
- [x] `consistencyIssue` (R-8.16) implementado e testado (AC-8.37 a AC-8.39).
- [x] Teste de privacidade em todos os endpoints públicos (AC12).
- [x] Tela T9 completa nos dois temas e a 390px; estados de §9 conferidos no Chrome real (85 verificações, ver o diário). Mutação no web: 13 de 13 mortas.
- [x] Retrofits de links de §15 feitos e conferidos (Vitrine, Sala em todos os estados, Comprovante, Painel, Meus arremates).
- [x] Seed inteiro audita `OK` localmente (AC-8.14) e no deploy (os nove lotes da Vitrine = `OK`; cancelado só local).
- [x] Texto da técnica (§15) copiado para o README.
- [x] Sem nova migração; deploy da API e do web feitos (web `SUCCESS` em c4c0e84, API `SUCCESS` em 5ffd270, mesmo código); smoke no link público (só leitura, 14 de 14): auditoria do lote arrematado do seed = Íntegro. CI verde.
- [x] Commits atômicos em pt-BR; entrada no `progresso.md`.
- [ ] **Pendência do Felipe:** leitor de tela (AC-8.29: "Veredito: …" uma vez, banner como alerta, nome acessível dos "ver inteiro").
- [ ] **Pendência do Felipe:** aparelho real (toque e 390px de verdade).
