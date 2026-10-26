---
id: S06
titulo: Cancelamento de lote e estorno ao líder
depende_de: [S00, S01, S02, S03, S04, S05]
cobre: [R14, R15, O2, AC10, E9, T7, T3, S6]
parcial: [PERM-A, M6, T4, T9, UX-A11Y, UX-RECON]
fontes_de_origem: [PRD Regras 14–15 e Ciclo de vida, AC "Lote cancelado", Painel; AD-2, AD-4, AD-6, AD-8; EXPERIENCE Painel/Component Patterns/Mensagens de sistema novas, P9–P11, P36; DESIGN diálogo-cancelamento, carimbo]
---
# S06 — Cancelamento de lote e estorno ao líder

## 1. Objetivo e demonstração

O leiloeiro cancela qualquer lote seu agendado ou ao vivo, com ou sem lances. Se havia líder, o saldo comprometido dele volta na mesma transação (estorno) e o cancelamento entra como linha própria da cadeia de auditoria. O lote some da Vitrine, vira "Cancelado" na Sala e no Painel, e quem estava na Sala vê sem recarregar.

Roteiro de demonstração:
1. Licitante A e B têm lances no lote ao vivo X; B lidera com R$ 20.500,00 (chip de B: disponível reduzido em R$ 20.500,00).
2. Leiloeiro abre o Painel, clica "Cancelar" na linha do lote X. O diálogo diz "Cancelar o lote 0NN com 2 lances?" e avisa do estorno.
3. Em outra janela, B está na Sala de X. Leiloeiro confirma.
4. A Sala de B vira "Cancelado" na hora (carimbo, aviso, sem formulário); o chip de B volta ao disponível anterior; a Carteira de B mostra "Saldo liberado · lote 0NN cancelado".
5. No Painel a linha sai de "Ao vivo" e entra em "Cancelados"; a Vitrine perde o cartão sem recarregar.
6. Leiloeiro cancela um lote agendado sem lances: diálogo simples "Ninguém deu lance ainda."
7. Prova de corrida: leiloeiro confirma com contagem velha (entrou lance no meio) → o diálogo atualiza a contagem e pede confirmar de novo.

## 2. Fora desta fatia

| Item | Fatia |
|---|---|
| Página de Auditoria e sua linha "Cancelado pelo leiloeiro" renderizada | S08 (esta fatia só grava a linha CANCEL e atualiza o selo) |
| Link "Auditar este lote"/"Auditoria do lote" na Sala cancelada e no Painel | S08 (antes, oculto) |
| Estado `CANCELLED` em Meus arremates | S07 (esta fatia só garante `leadingLots` sem cancelados) |
| Editar lote agendado | Nunca (decisão do usuário); depois de agendado só existe "Cancelar" |
| Liquidar/fechar | S05 (já existe; o job ignora `cancelledAt` não nulo) |

## 3. Ponto de partida

Já existe: tabelas `Lot` (com `cancelledAt`, `entryCount`, `lastHash`, `seal`, `leaderId`, `currentBidCents`), `Bid` (com `kind`, colunas `bidderId/pseudonym/amountCents` anuláveis e trigger append-only), `Wallet`, `LedgerEntry` (enum com `REFUND` desde a S01), `Receipt`; `domain/audit-chain` com `genesis`, `entryHash`, `sealHash` (S02/S03); `modules/lots` (service que abre transação, `Clock`); `Publisher` real (S04) com `lot:cancelled`, `showcase:lot`, `wallet:updated`; `GET /my/lots` já devolve cancelados; `lotStatus` devolve `CANCELLED` quando há `cancelledAt`; componentes `Dialog`, `Stamp` (variante Cancelado), `DataTable`, `Button`, `RefusalMessage`, `FeedbackState`, `Perforation`; Painel base (S02) e resultados (S05).

Invariantes que valem aqui:
- INV-1 Servidor é fonte de verdade; sem atualização otimista: a linha só muda de seção quando o servidor confirma.
- INV-2 Dinheiro em centavos (`…Cents`); UI `R$ 20.500,00`.
- INV-3 `cancelledAt` vem de `clock.now()`.
- INV-4 O service devolve `DomainEvent[]`; a rota publica depois do commit.
- INV-5 Lock: lote primeiro (`FOR UPDATE`), depois a carteira do líder; nunca o inverso.
- INV-6 `REFUND` reduz `committedCents` e insere `LedgerEntry` na mesma tx; `total` não muda.
- INV-7 `Bid` só recebe INSERT (a linha CANCEL é um INSERT).
- INV-11 `lotStatus` devolve `CANCELLED` quando `cancelledAt` existe, antes de qualquer outra checagem.
- INV-12 Cadeia HMAC v1; `kind=CANCEL` é linha própria e conta no veredito.
- INV-13 DTOs públicos nunca trazem userId/nome/e-mail (a resposta do cancelamento não identifica o líder).
- INV-15 Um papel por conta; dono conferido no service.
- INV-16 Envelope de erro.

## 4. Regras de negócio

| # | Regra | Origem |
|---|---|---|
| R-6.1 | Só o leiloeiro dono cancela o próprio lote. Licitante → `ROLE_NOT_ALLOWED`; leiloeiro de outro lote → `FORBIDDEN`; visitante → `UNAUTHENTICATED`. | PRD Papéis, R14 |
| R-6.2 | Só lotes `SCHEDULED` ou `LIVE` cancelam: `cancelledAt` nulo e `now < endsAt` (e `settledAt` nulo). Lote com `now >= endsAt` (apurando ou encerrado) → `LOT_ENDED`. Lote já cancelado → `LOT_CANCELLED`. | R14, AD-6 |
| R-6.3 | Com ou sem lances o cancelamento é permitido (decisão do usuário; substitui "Lote com lance não se cancela"). | R14, R15, progresso.md |
| R-6.4 | Estorno: se há líder, `committedCents -= currentBidCents` na carteira dele; `totalCents` não muda; entra `LedgerEntry` `REFUND` (`amountCents = currentBidCents`, `lotId`, `totalAfter`, `committedAfter`). Sem líder, não há `REFUND`. Só o líder tem saldo comprometido neste lote (quem foi superado já foi liberado por `RELEASE`). | R15, AD-4 |
| R-6.5 | O cancelamento é registrado no histórico: nova linha na cadeia (`kind=CANCEL`, `seq = entryCount+1`, sem pseudônimo nem valor, `at = now`) e `Lot.entryCount`, `lastHash`, `seal` atualizados. A linha é gravada SEMPRE (com ou sem lances). | R15, AD-8 |
| R-6.6 | `bidCount` não muda; `currentBidCents` e `leaderId` permanecem gravados (histórico), mas lote cancelado nunca conta como "lote que o usuário lidera" (carteira, Meus arremates). | AD-8, P10 |
| R-6.7 | Guarda de corrida: o corpo traz `confirmEntryCount` = nº de linhas da cadeia que o leiloeiro viu. Se `confirmEntryCount != Lot.entryCount` sob lock → `LOT_CHANGED` e NADA muda. (Antes do cancelamento `entryCount == bidCount`.) | AD-8/EXP P36 |
| R-6.8 | Lote cancelado nunca aparece na Vitrine; a URL da Sala continua respondendo (cancelado e agendado respondem). Lances novos → `LOT_CANCELLED`. | R14, M6 |
| R-6.9 | Cancelamento não é editável nem reversível. Não existe "reabrir". | PRD (sem edição) |
| R-6.10 | O job de fechamento nunca liquida lote cancelado (`cancelledAt IS NULL` no filtro). | AD-6 |

Conflitos que decidem esta fatia: ver §16.

## 5. Modelo de dados

Nenhuma tabela nova. Nenhuma migração. Usa colunas existentes:

```prisma
model Lot {
  // …
  cancelledAt DateTime?          // preenchido aqui
  entryCount  Int @default(0)    // +1 pela linha CANCEL
  lastHash    String             // hash da linha CANCEL
  seal        String             // HMAC("v1|seal|{lotId}|{entryCount}|{lastHash}")
}
model Bid { // linha CANCEL: bidderId=null, pseudonym=null, amountCents=null
  id String @id @default(uuid()); lotId String; seq Int; kind ChainKind
  bidderId String?; pseudonym String?; amountCents BigInt?; at DateTime
  prevHash String; hash String
  @@unique([lotId, seq])
}
```

Hash da linha CANCEL (campos nulos viram string vazia):
`hash = HMAC(key, "v1|entry|{lotId}|{seq}|CANCEL|||{at}|{prevHash}")` com `at` ISO UTC em ms (`2026-10-22T14:00:00.123Z`) e `prevHash = Lot.lastHash` atual (genesis se `seq = 1`). `seal = HMAC(key, "v1|seal|{lotId}|{entryCount}|{lastHash}")` com o `entryCount` novo (inclui a linha CANCEL).

Consultas que mudam:
- `GET /wallet` → `leadingLots`: lotes com `leaderId = eu AND cancelledAt IS NULL AND settledAt IS NULL`. **Já implementado na S03 (e reforçado na S05); aqui só se acrescenta o teste (AC-6.23).**
- `GET /wallet` → `entries[]`: cada entrada traz `lotId` e `lotNumber` (nulo se não houver lote). Se a S01/S03 não expuseram `lotNumber`, adicione agora em `packages/shared`.
- `GET /my/lots` (S02): a linha de cancelado ganha `cancelledAt` (ISO UTC) e `refundedCents` (`number | null`: `currentBidCents` se havia líder, senão `null`). Acrescente os dois campos ao DTO `MyLotRow` em `packages/shared` (aditivo).
- `LotState` (S02) precisa expor `cancelledAt`; se ainda não expõe, adicione.
- `LotState.bids[]` (S03) lista só `kind=BID`; a linha CANCEL nunca vai para a Sala (ela aparece na Auditoria, S08).

## 6. Contratos REST

### `POST /lots/:id/cancel`

| Campo | Valor |
|---|---|
| Papel | `AUCTIONEER` dono do lote |
| Corpo | `{ "confirmEntryCount": number }` (zod `.int().min(0).max(Number.MAX_SAFE_INTEGER)`; acima disso é `VALIDATION`) |
| Sucesso | `200 LotState` com `status: "CANCELLED"`, `cancelledAt`, `serverTime`, `bidCount`, `currentBidCents` (último), sem dados do líder |
| Ordem de checagem | token → papel → corpo → lote existe → dono → já cancelado → já passou do fim → contagem → efeitos |

| Erro | HTTP | `details` | Quando |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | — | sem token válido |
| `ROLE_NOT_ALLOWED` | 403 | — | conta é licitante |
| `VALIDATION` | 400 | `{ fields: { confirmEntryCount: msg } }` | ausente, negativo, não inteiro |
| `NOT_FOUND` | 404 | — | id inexistente |
| `FORBIDDEN` | 403 | — | lote de outro leiloeiro |
| `LOT_CANCELLED` | 409 | — | já cancelado (cliques repetidos, duas abas) |
| `LOT_ENDED` | 409 | — | `now >= endsAt` ou `settledAt` preenchido (apurando ou encerrado) |
| `LOT_CHANGED` | 409 | `{ entryCount }` | `confirmEntryCount` ≠ `Lot.entryCount` real |

Transação, passo a passo (`modules/lots`, `cancelLot(userId, lotId, confirmEntryCount, clock)`):
1. Fora da tx: valida corpo (zod). Papel é conferido pelo middleware `requireRole(AUCTIONEER)` (licitante recebe `ROLE_NOT_ALLOWED`).
2. Abre tx `ReadCommitted`. `now = clock.now()` (uma vez, usado em tudo).
3. `SELECT … FROM "Lot" WHERE id=$1 FOR UPDATE`. Zero linhas → `NOT_FOUND`.
4. `lot.auctioneerId !== userId` → `FORBIDDEN`.
5. `lot.cancelledAt != null` → `LOT_CANCELLED`.
6. `now >= lot.endsAt` ou `lot.settledAt != null` → `LOT_ENDED`.
7. `lot.entryCount !== confirmEntryCount` → `LOT_CHANGED` com `details.entryCount = lot.entryCount`.
8. Se `lot.leaderId`: `SELECT … FROM "Wallet" WHERE "userId" IN ($leaderId) ORDER BY "userId" FOR UPDATE`. **Ler `total` e `committed` da linha devolvida por este `FOR UPDATE`** (nunca de leitura anterior; mesma regra da S03 §4.3): `committedAfter = committed − lot.currentBidCents`, `totalAfter = total`. Se `committed < lot.currentBidCents`, lançar erro interno (500) **sem alterar nada** (rollback total). Atualiza a carteira (a CHECK `committed >= 0` é a rede de segurança); insere `LedgerEntry { kind: REFUND, amountCents: currentBidCents, lotId, totalAfter, committedAfter }`.
9. Insere `Bid { kind: CANCEL, seq: lot.entryCount + 1, bidderId: null, pseudonym: null, amountCents: null, at: now, prevHash: lot.lastHash, hash }` com `hash = entryHash(key, { lotId, seq, kind: 'CANCEL', pseudonym: null, amountCents: null, at: now, prevHash: lot.lastHash })` (chave sempre primeiro; nulos viram `""`).
10. `UPDATE "Lot" SET "cancelledAt"=now, "entryCount"=entryCount+1, "lastHash"=hash, "seal"=sealHash(key, lotId, entryCount+1, hash)`.
11. Commit. O service devolve os eventos; a rota publica depois do commit.

Eventos devolvidos pelo service (ordem de publicação):
| # | Evento | Sala | Payload |
|---|---|---|---|
| 1 | `lot:cancelled` | `lot:{id}` | `{ lotId, version: entryCount novo, serverTime }` |
| 2 | `showcase:lot` | `showcase` | `LotCard` com `status: "CANCELLED"` e `version` (= `entryCount` novo). A Vitrine remove o cartão; o Painel **refaz `GET /my/lots`** (o `LotCard` não traz `refundedCents`/`cancelledAt`; a linha de "Cancelados" vem da resposta) |
| 3 | `wallet:updated` | `user:{leaderId}` (só se houve estorno) | `{ totalCents, committedCents, availableCents, serverTime }` |

## 7. Contratos Socket.IO

Nenhum evento novo: os três acima já estão definidos na S04; esta fatia passa a EMITI-los. Consumo no cliente:
- `lot:cancelled`: o payload não traz `cancelledAt`; o reducer único `applyLotEvent` (S04) devolve `'refetch'` e a Sala refaz `GET /lots/:id` (traz `cancelledAt`) e troca para o estado Cancelado; descarta qualquer campo de lance em edição. `version <= atual` é descartado (regra S04).
- `showcase:lot` com `status: "CANCELLED"`: Vitrine remove o cartão; ao receber de **lote próprio**, o Painel refaz `GET /my/lots` e a linha só entra em "Cancelados" com os dados da resposta (inclui `refundedCents` e `cancelledAt`); diálogo aberto para esse lote fecha com aviso (ver §9).
- `wallet:updated`: chip e Carteira atualizam (já ligados na S04).

## 8. Mensagens

| Código/uso | HTTP | Texto pt-BR | Onde aparece |
|---|---|---|---|
| `LOT_CANCELLED` (resposta a lance, de S03) | 409 | "Este lote foi cancelado pelo leiloeiro." (texto do PRD; ver §16 item 7) | `RefusalMessage` colada ao botão de lance, se o lance chegou depois do cancelamento |
| `ROLE_NOT_ALLOWED` no cancelar | 403 | "Só leiloeiros cancelam lotes." (texto a revisar) | erro genérico; a UI não oferece o botão |
| `FORBIDDEN` | 403 | "Este lote é de outro leiloeiro. Só o dono pode cancelar." (texto a revisar) | `FeedbackState` no Painel |
| `NOT_FOUND` | 404 | "Esse lote não existe mais." (texto a revisar) | `FeedbackState` no Painel |
| `LOT_CANCELLED` no cancelar | 409 | "Este lote já foi cancelado." (texto a revisar) | fecha o diálogo; aviso no Painel |
| `LOT_ENDED` no cancelar | 409 | "Martelo já bateu. Este lote não pode mais ser cancelado." (texto a revisar) | fecha o diálogo; aviso no Painel |
| `LOT_CHANGED` | 409 | "Entrou lance enquanto você decidia. Agora são {N} lances. Confirme de novo." (texto a revisar; `{N}` com plural: "1 lance") | `RefusalMessage` dentro do diálogo, que permanece aberto |
| Falha de rede ambígua | — | "Não deu para falar com o pátio. Confira o lote antes de tentar de novo." (texto a revisar) | `RefusalMessage` no diálogo; sem reenvio automático |
| Título do diálogo, com lances | — | "Cancelar o lote {NNN} com {N} lances?" ("com 1 lance") | `CancelDialog` |
| Texto do diálogo, com lances | — | "O saldo comprometido de quem lidera volta para ele, e o cancelamento fica registrado no histórico da auditoria." | `CancelDialog` |
| Título do diálogo, sem lances | — | "Cancelar o lote {NNN}?" | `CancelDialog` |
| Texto do diálogo, sem lances | — | "Ninguém deu lance ainda." | `CancelDialog` |
| Aviso de irreversível | — | "Não dá para desfazer." (texto a revisar) | `CancelDialog`, abaixo do texto |
| Aviso de lance novo | — | "Lance novo pode entrar até você confirmar. A contagem acompanha." (texto a revisar) | `CancelDialog`, `aria-live="polite"` |
| Botões | — | "Voltar" (secundário) · "Cancelar o lote" (primário ocre) · em envio "Cancelando…" | `CancelDialog` |
| Confirmação no Painel | — | "Lote {NNN} cancelado." + se houve estorno " Estorno de R$ X,00 devolvido a quem liderava." (texto a revisar) | live region do Painel |
| Sala cancelada | — | "O leiloeiro cancelou este lote. Nada foi vendido e todo saldo travado voltou." | aviso na Sala |
| Extrato, estorno | — | "Estorno · lote cancelado" (+ número do lote) e nota "TOTAL NÃO MUDA" | linha do extrato (`REFUND`); texto canônico da S01, constante em `packages/shared` |
| Extrato, superado | — | "Saldo liberado · lance superado" e nota "TOTAL NÃO MUDA" | linha do extrato (`RELEASE`); texto canônico da S03, mesma constante |

Voz: sem exclamação, sem emoji, valores e códigos em Plex Mono; o dinheiro do estorno é simulado mas o texto nunca brinca com o saldo (INV-18).

## 9. Telas e estados

### 9.1 Painel (T7) — rota `/painel`, só `AUCTIONEER`

Estrutura já existente (S02/S05): resumo (Total recebido, placares AO VIVO / AGENDADOS / ENCERRADOS), tabelas "Ao vivo" e "Agendados", cartões "Encerrados". Esta fatia adiciona:
- Coluna de ação com botão "Cancelar" (`Button` secundário com texto `ferrugem`) em TODA linha de lote ao vivo ou agendado, tenha ou não lances. Nome acessível: `Cancelar lote 019, Hilux SRX 2020` (único por linha). Alvo ≥ 44px. Remover qualquer texto "Com lances · fica" ou "Lote com lance não se cancela. Regra da casa." se existir.
- Seção "Cancelados" abaixo de "Encerrados" (`DataTable` com `caption` "Lotes cancelados"). Colunas: Lote (etiqueta + número), Carro, Lances, Último lance (mono), Estorno (mono, "R$ X,00" ou "—"), Cancelado em (dd/mm HH:mm, Brasília). Sem botão de ação. Link "Auditoria do lote" só a partir da S08.
- Cancelados não entram nos placares AO VIVO/AGENDADOS/ENCERRADOS nem em Total recebido.

| Estado | Tratamento |
|---|---|
| Padrão | Linhas ao vivo/agendadas com "Cancelar"; "Cancelados" com linhas ou ausente |
| Sem cancelados | A seção "Cancelados" não aparece (nenhuma caixa vazia) |
| Diálogo aberto | Conteúdo sob o diálogo inerte (ver §10) |
| Enviando | Botão de confirmar inerte "Cancelando…"; `Esc` e "Voltar" ignorados até a resposta |
| Sucesso | Diálogo fecha; a linha sai de Ao vivo/Agendados e entra em Cancelados quando o servidor confirmou (resposta `200` ou `showcase:lot` `CANCELLED`); foco vai ao título da seção "Cancelados" (`tabindex="-1"`); live region (polite) anuncia "Lote 019 cancelado. …" |
| `LOT_CHANGED` | Diálogo permanece aberto; contagem do título atualizada para `details.entryCount`; `RefusalMessage` com o texto de §8; botão "Cancelar o lote" volta a ficar ativo; foco no botão confirmar não é movido à força (foco permanece onde estava; a mensagem é `role="alert"`) |
| `LOT_ENDED` / `LOT_CANCELLED` | Diálogo fecha; foco volta ao botão de origem se a linha ainda existir (senão ao título da seção); `FeedbackState` de aviso (borda `ferrugem` para erro) acima das tabelas com o texto de §8; a lista é refeita por `GET /my/lots` |
| `FORBIDDEN` / `NOT_FOUND` | Diálogo fecha; aviso como acima; lista refeita |
| Falha de rede | Diálogo permanece; mensagem ambígua de §8; ao tentar de novo, o cliente primeiro refaz `GET /my/lots`; se o lote já está cancelado, trata como sucesso |
| Evento de lance com diálogo aberto | `showcase:lot` do mesmo lote atualiza a contagem exibida; aviso "Chegou lance novo: agora são {N}." (texto a revisar) em `aria-live="polite"` — **se sobrar tempo**; o mínimo obrigatório é o `LOT_CHANGED` |
| Evento de fechamento/cancelamento do mesmo lote com diálogo aberto | Diálogo fecha; aviso conforme `LOT_ENDED` ou `LOT_CANCELLED` |
| Carregando/erro de lista | `FeedbackState` (S00) com "Tentar novamente"; dados anteriores mantidos e marcados como desatualizados |

O cliente guarda `confirmEntryCount` = último `bidCount` visto para o lote (equivale a `entryCount` antes do cancelamento). Sempre envia o valor que o diálogo está mostrando.

### 9.2 Sala do lote cancelado (T3) — rota `/lotes/[id]`, todos

| Elemento | Tratamento |
|---|---|
| Ficha do carro, foto/crédito, histórico de lances | Mantidos (lê só o banco) |
| Etiqueta de lote | `papel` (não ocre), como encerrado |
| Carimbo | `Stamp` variante **Cancelado**: texto "CANCELADO", cor `tinta2`, borda 4px sólida + outline 2px offset 3px, rotação −4° (dentro da faixa −7°…+4°); "bate" ao aparecer, sem animação em reduced-motion |
| Aviso | Parágrafo no lugar do painel de lance: "O leiloeiro cancelou este lote. Nada foi vendido e todo saldo travado voltou." e linha mono "Cancelado em dd/mm às HH:mm:ss" (Brasília, de `cancelledAt`) |
| Formulário/CTA de lance | Ausente para todos (sem botão "Dar lance", sem "Entre para dar lances", sem desabilitado) |
| Cronômetro | Encerrado ("00:00", rótulo "ENCERRADO", sem animação); selo "Ao vivo" ausente |
| Ação | Link secundário "Voltar à vitrine" |
| Auditoria | Link "Auditar este lote" só a partir da S08 |
| Quem estava dentro | Ao chegar `lot:cancelled`: formulário some, o valor digitado é descartado, a faixa de status vira neutra (`tinta`/`fundo`) com "Lote cancelado"; chip de saldo atualiza pelo `wallet:updated` |
| Lance em voo | Se o lance chegar depois do cancelamento, a resposta `LOT_CANCELLED` aparece em `RefusalMessage` com o texto de §8 e a Sala muda para Cancelado |
| Acesso por URL direta | Responde 200 com o estado cancelado (nunca 404) |
| a11y | Carimbo tem o texto "Cancelado" (não depende de cor/rotação); aviso anunciado por live region na transição ao vivo → cancelado; `main` e headings preservados |

### 9.3 Carteira (T4) — extrato

Os textos do extrato são **canônicos e únicos**, definidos em constantes de `packages/shared` (S01/S03 já os usam; esta fatia **não os altera**): `REFUND` = tipo **ESTORNO**, descrição "Estorno · lote cancelado" com o número do lote `{NNN}` na linha; `RELEASE` = tipo **LIBERADO**, descrição "Saldo liberado · lance superado"; ambos com a nota mono "TOTAL NÃO MUDA". Valor `R$ X,00` em mono, sem sinal de entrada de dinheiro; coluna de Total depois igual à anterior. Cores: nenhuma cor de sucesso (verde é só "ganhando"/"íntegro"); texto `tinta`. Esta fatia só confere que a linha `REFUND` existe e usa a constante; não renomeia nada na S01/S03.

### 9.4 Vitrine (T1)

Sem mudança de layout. O cartão do lote cancelado some por `showcase:lot` `CANCELLED` (sem recarregar) e nunca vem em `GET /lots`. Rodapé mantém "Lotes cancelados não aparecem aqui. Nem em sonho."

## 10. Componentes criados

### CancelDialog
Compõe o `Dialog` da S00. Props: `lot { number, title, bidCount }`, `onConfirm(confirmEntryCount)`, `onClose`, `state: idle | submitting | changed | error`.

| Propriedade | Valor |
|---|---|
| Fundo / texto | `papel` / `tinta` |
| Borda | 3px sólida `linha`; canto reto (0) |
| Sombra | `8px 8px 0 sombra` |
| Padding | 24px |
| Largura | máx. 560px; margem lateral mínima 16px |
| Backdrop | `rgba(30,28,25,.65)` |
| Título | Big Shoulders 800 26px (`cartaz-subtitulo`) caixa-alta, `id` referenciado por `aria-labelledby` |
| Texto | Newsreader 17px (`body`), `aria-describedby` |
| Linha de meta | IBM Plex Mono 14px: `{título do carro} · {N lances} · lance atual R$ X,00` (omitir "lance atual" sem lances) |
| Aviso de estorno/irreversível | Newsreader 15px; o trecho de estorno em `ferrugem` (ferrugem fica reservada ao aviso) |
| Botões | "Voltar" `botao-secundario`; "Cancelar o lote" `botao-primario` (ocre, única ação primária da camada); quebram de linha em telas estreitas; altura ≥ 52px |
| `role` | `dialog`, `aria-modal="true"` |

Comportamento:
- Ao abrir, foco no título (`tabindex="-1"`); `Tab` circula só dentro do diálogo; o resto da página fica `inert`.
- `Esc` e "Voltar" fecham sem cancelar; ignorados enquanto `submitting`.
- Ao fechar sem cancelar, o foco volta ao botão "Cancelar" que o abriu; se o lote foi cancelado/encerrado, ao título da seção correspondente.
- Contagem e título acompanham `bidCount` em tempo real; singular/plural corretos ("1 lance", "2 lances"). A troca da variante "0 lances" para "com lances" com o diálogo aberto (aviso polite "Chegou lance novo…") é **opcional / se sobrar tempo**; sem ela, o `LOT_CHANGED` do servidor já cobre a corrida e o diálogo atualiza a contagem na resposta.
- `submitting`: confirmar mostra "Cancelando…" e fica inerte (evita envio duplo).
- Não mostra nome, e-mail nem pseudônimo do líder.

### Estado Cancelado da Sala
Não é componente novo: usa `Stamp` (Cancelado), `FeedbackState`/parágrafo de aviso e `Button` secundário. Definido em §9.2.

## 11. Seed desta fatia

Acrescente ao `prisma/seed.ts`, criando tudo pelos services com `FakeClock` (nunca insert direto):
1. Em `T = agora − 2 h`: leiloeiro do seed cria um lote ao vivo "cancelado de demonstração" (carro do `fipe-fixture.json`, lance inicial R$ 20.000,00, incremento R$ 500,00, `startsAt = T`, `endsAt = T + 10 d`).
2. Em `T + 20 min`: licitante 1 dá R$ 20.000,00. Em `T + 30 min`: licitante 2 dá R$ 20.500,00 e lidera (se o saldo do seed não cobrir, deposite antes pelo service de depósito).
3. Em `T + 60 min`: leiloeiro cancela passando `confirmEntryCount = 2`. Resultado: estorno ao licitante 2 (`REFUND` de R$ 20.500,00), `RELEASE` ao licitante 1 já ocorrido no lance 2, linha CANCEL `seq = 3` na cadeia.
4. Invariante de seed: ao final, `committedCents` de cada licitante = soma dos lances dos lotes AO VIVO que ele lidera (o lote cancelado não conta).
O lote cancelado não aparece na Vitrine e aparece em "Cancelados" do Painel.

## 12. Critérios de aceite

- **AC-6.1 [auto]** Dado lote agendado sem lances do leiloeiro L; Quando L chama `POST /lots/:id/cancel` com `confirmEntryCount: 0`; Então `200`, `status: "CANCELLED"`, `cancelledAt = clock.now()`, uma linha `Bid` `kind=CANCEL seq=1` com `prevHash = genesis`, `entryCount = 1`, `seal` correspondente, nenhum `LedgerEntry`.
- **AC-6.2 [auto]** Dado lote ao vivo com 2 lances e B líder com R$ 20.500,00 comprometidos (total R$ 100.000,00); Quando L cancela com `confirmEntryCount: 2`; Então B: `committedCents` cai em 2.050.000, `totalCents` igual, disponível volta ao valor pré-lance; existe `LedgerEntry REFUND` de 2.050.000 com `lotId`; linha CANCEL `seq=3`; `bidCount` continua 2. (AC10, R15)
- **AC-6.3 [auto]** Dado o AC-6.2 concluído; Quando `GET /lots` (Vitrine); Então o lote não está na lista, mesmo com `status`/`q`/`brand` que o casariam. (R14, AC10)
- **AC-6.4 [auto]** Dado lote cancelado; Quando `GET /lots/:id` (visitante); Então `200` com `status: "CANCELLED"`, `cancelledAt`, `bids[]` só com linhas `BID` e nenhum campo `userId`/nome/e-mail.
- **AC-6.5 [auto]** Dado lote cancelado; Quando licitante C envia lance válido; Então `409 LOT_CANCELLED` com o texto de §8, sem `HOLD`, sem `Bid` novo, saldo de C intacto. (M6, R1)
- **AC-6.6 [auto]** Dado licitante B (BIDDER); Quando chama `POST /lots/:id/cancel`; Então `403 ROLE_NOT_ALLOWED` e nada muda. Dado visitante sem token; Então `401 UNAUTHENTICATED`.
- **AC-6.7 [auto]** Dado leiloeiro L2 que não é dono; Quando cancela o lote de L; Então `403 FORBIDDEN` e nada muda.
- **AC-6.8 [auto]** Dado id inexistente; Quando L cancela; Então `404 NOT_FOUND`. Dado corpo sem `confirmEntryCount` ou com `-1`/`1.5`; Então `400 VALIDATION` com `fields.confirmEntryCount`.
- **AC-6.9 [auto]** Dado lote ao vivo com `entryCount = 2`; Quando L cancela com `confirmEntryCount: 1`; Então `409 LOT_CHANGED` com `details.entryCount = 2`, e NADA muda (sem `cancelledAt`, sem `REFUND`, sem linha CANCEL).
- **AC-6.10 [auto]** Dado lote já cancelado; Quando L cancela de novo; Então `409 LOT_CANCELLED`, sem segundo `REFUND`, sem segunda linha CANCEL.
- **AC-6.11 [auto]** Dado lote com `now == endsAt` (FakeClock) ou `now > endsAt` ainda não liquidado, ou já liquidado; Quando L cancela; Então `409 LOT_ENDED` e nada muda.
- **AC-6.12 [auto]** Dado lote ao vivo com `endsAt − now = 1 s`; Quando L cancela com contagem correta; Então cancela (`now < endsAt`).
- **AC-6.13 [auto]** Dado lote cancelado cujo `endsAt` já passou; Quando o job de fechamento roda; Então não liquida (sem `SALE_*`, sem `Receipt`, `settledAt` continua nulo).
- **AC-6.14 [auto]** Dado cancelamento concluído; Quando o service retorna; Então devolve 3 eventos nesta ordem: `lot:cancelled` (`version = entryCount` novo), `showcase:lot` (`CANCELLED`, com `version`), `wallet:updated` ao líder; a rota só publica depois do commit; sem líder, não há `wallet:updated`.
- **AC-6.15 [manual]** Dado B na Sala do lote em outro navegador; Quando L confirma o cancelamento; Então, sem recarregar, a Sala de B mostra carimbo "CANCELADO" (`tinta2`), o aviso "O leiloeiro cancelou este lote. Nada foi vendido e todo saldo travado voltou.", sem formulário, e o chip de B volta ao disponível anterior. (AC7-estilo, AC10)
- **AC-6.16 [manual]** Dado a Vitrine aberta em outro navegador; Quando o lote é cancelado; Então o cartão some sem recarregar.
- **AC-6.17 [manual]** Dado Painel com lote de 2 lances; Quando L clica "Cancelar"; Então o diálogo exibe o título "Cancelar o lote 0NN com 2 lances?", o texto de estorno, "Não dá para desfazer.", foco no título, fundo inerte, `Esc` fecha sem cancelar e devolve o foco ao botão de origem.
- **AC-6.18 [manual]** Dado Painel com lote sem lances; Quando L clica "Cancelar"; Então título "Cancelar o lote 0NN?" e texto "Ninguém deu lance ainda." (sem frase de estorno).
- **AC-6.19 [auto]** Dado lote com 2 lances e L com `confirmEntryCount: 2` em mãos; Quando um terceiro lance entra e depois L envia o cancelamento com 2; Então `409 LOT_CHANGED` com `details.entryCount = 3`, nada muda, e um novo `POST` com `confirmEntryCount: 3` cancela e estorna o NOVO líder (mesma cobertura do AC-6.9, com o novo líder). Manual (só o que é reproduzível à mão): com o diálogo aberto, quando a contagem muda por evento, o título passa a mostrar a nova contagem; e, ao receber `LOT_CHANGED`, o diálogo continua aberto com "Entrou lance enquanto você decidia. Agora são {N} lances. Confirme de novo."
- **AC-6.20 [manual]** Dado "Cancelar" em lote do Painel; Quando cancela com sucesso; Então a linha sai de Ao vivo/Agendados e entra em "Cancelados" (com Estorno `R$ X,00`), a live region anuncia "Lote 0NN cancelado.", e o foco vai ao título da seção "Cancelados".
- **AC-6.21 [manual]** Dado extrato de B após cancelamento; Então aparece "ESTORNO · Estorno · lote cancelado (lote 0NN) · TOTAL NÃO MUDA"; e uma linha de lance superado aparece como "LIBERADO · Saldo liberado · lance superado · TOTAL NÃO MUDA" (textos canônicos da S01/S03; esta fatia não os altera).
- **AC-6.22 [manual]** Dado botões "Cancelar" de várias linhas; Então cada um tem nome acessível único (`Cancelar lote 019, Hilux SRX 2020`), alvo ≥ 44px, e os controles do diálogo são alcançáveis só por teclado.
- **AC-6.23 [auto]** (só teste; a consulta já é da S03) Dado `GET /wallet` do líder estornado; Então `leadingLots` não contém o lote cancelado e `committedCents` = soma dos lances dos lotes ao vivo que ele lidera.
- **AC-6.24 [manual]** Dado `prefers-reduced-motion`; Então o carimbo Cancelado aparece direto no estado final.

## 13. Casos de borda e concorrência

| Caso | Resultado esperado |
|---|---|
| Cancelar × lance simultâneo (`Promise.all`), contagem confirmada = N | Os dois travam o lote primeiro, então serializam. (a) Lance entra antes: `entryCount = N+1`, o cancelamento com `confirm = N` recebe `LOT_CHANGED` e nada muda; refeito com `N+1` estorna o NOVO líder. (b) Cancelamento entra antes: o lance recebe `LOT_CANCELLED`, nenhum `HOLD`. Nunca fica saldo comprometido de lote cancelado. |
| Dois cancelamentos simultâneos (duas abas, duplo clique) | Um vence; o outro recebe `LOT_CANCELLED`. Exatamente um `REFUND` e uma linha CANCEL. |
| Cancelar × job de fechamento no mesmo instante | Ambos travam o lote. Se `now >= endsAt` o cancelamento recebe `LOT_ENDED`; se o cancelamento entrou antes, o job vê `cancelledAt` e pula. Nunca `SALE_*` e `REFUND` no mesmo lote. |
| Cancelar × depósito do líder | Depósito trava só a carteira dele; o cancelamento trava lote e depois a carteira. Não há deadlock (ordem fixa). Total e comprometido ficam consistentes (`total >= committed`). |
| Lote sem lances | Cancela sem `REFUND`; linha CANCEL `seq=1`. |
| Líder superado e que voltou a liderar | Só o líder atual (`lot.leaderId`) recebe estorno; carteiras de quem foi superado não são tocadas. |
| Líder sem carteira ou carteira inconsistente | Não deve ocorrer (carteira nasce no cadastro); se `committed < currentBid` a CHECK derruba a tx e devolve erro 500 sem alterar nada (nenhum cancelamento parcial). |
| Cancelar lote agendado cujo `startsAt` é daqui a segundos | Permitido. |
| Cliente sem socket | Painel confia na resposta `200`; a lista é refeita por `GET /my/lots`. |
| Cancelamento com líder que já tem vários lotes | Só o `currentBidCents` deste lote é liberado. |
| Servidor reinicia após commit, antes de publicar | Eventos perdidos; clientes reconciliam por `lot:join` ao reconectar e `GET` (sem replay). |

## 14. Testes exigidos

Unitários (`domain/`):
- `entryHash(key, {lotId, seq, kind:'CANCEL', pseudonym:null, amountCents:null, at, prevHash})` da linha CANCEL: string canônica exata `v1|entry|{lotId}|{seq}|CANCEL|||{at}|{prevHash}`; mudar `seq`/`at`/`prevHash` muda o hash.
- `sealHash(key, lotId, entryCount, lastHash)` com `entryCount` incluindo a linha CANCEL.

Integração (Postgres real, `FakeClock`):
- Cancelamento sem lances; com lances; estorno ao líder correto; `LedgerEntry REFUND`; `total` inalterado; CHECKs preservadas.
- Todos os erros de §6, um por caso (`UNAUTHENTICATED`, `ROLE_NOT_ALLOWED`, `VALIDATION`, `NOT_FOUND`, `FORBIDDEN`, `LOT_CANCELLED`, `LOT_ENDED` em `now == endsAt`, `LOT_CHANGED`) e prova de que nada muda em cada falha.
- Cadeia: depois do cancelamento, recalcular `hash`/`seal` de ponta a ponta com a chave de teste bate (linha CANCEL participa).
- Concorrência: `Promise.all([cancel, bid])` repetido 20 vezes com ordens aleatórias; sempre uma das duas saídas da §13; asserção final: `committedCents` de cada carteira = soma dos lances de lotes ao vivo que ela lidera; `Σ ledger` coerente com `Wallet`; sem deadlock (timeout do teste).
- `Promise.all` de 5 cancelamentos do mesmo lote: um sucesso, quatro `LOT_CANCELLED`, um `REFUND`.
- Job de fechamento ignora lote cancelado vencido.
- `GET /lots` exclui cancelado; `GET /lots/:id` responde cancelado; `GET /my/lots` inclui cancelado com `cancelledAt` e `refundedCents`; `GET /wallet.leadingLots` exclui cancelado.
- Eventos devolvidos pelo service (tipos, ordem, ausência de `wallet:updated` sem líder) com `Publisher` falso.
- Privacidade: resposta do cancelamento e `lot:cancelled` não contêm `userId`, nome ou e-mail.

Web (Vitest, lógica pura): reducer/estado do diálogo (idle → submitting → changed → idle; atualização da contagem por evento; plural), mapeamento de erro do cancelar → mensagem de §8.

## 15. Retrofits e integrações

| Onde | Mudança |
|---|---|
| S01/S03 Carteira/extrato | Textos de `REFUND`/`RELEASE` ficam **como na S01/S03** (constantes em `packages/shared`; nenhum AC delas muda); só garantir que as entradas tragam `lotNumber` |
| S02 Painel | Botão "Cancelar" nas linhas; seção "Cancelados"; `MyLotRow` ganha `cancelledAt` e `refundedCents` |
| S02 Sala | Estado Cancelado (§9.2) |
| S03 `GET /wallet` | `leadingLots` exclui cancelados e liquidados |
| S03 `bids[]` | Só `kind=BID` |
| S04 | A S04 define os eventos e o reducer `applyLotEvent` (`version` = `entryCount`); esta fatia emite `lot:cancelled`, `showcase:lot` (CANCELLED, com `version`) e `wallet:updated`. `lot:cancelled` sem `cancelledAt` ⇒ `'refetch'` |
| S07 | Usa `refundedCents`/`cancelledAt` para o estado Cancelado de Meus arremates |
| S08 | Mostra a linha CANCEL na Auditoria e liga os links "Auditoria do lote" (Painel) e "Auditar este lote" (Sala cancelada) |
| S09 | Varredura final de a11y do diálogo e do estado Cancelado nos dois temas |

## 16. Conflitos resolvidos e perguntas abertas

Conflitos resolvidos (precedência progresso.md > PRD > arquitetura > EXPERIENCE > DESIGN):
1. **Cancelar com lances**: o PRD marcava como opcional e o design dizia "Com lances · fica"; decisão do usuário vence: cancela e estorna. Textos antigos removidos.
2. **Corrida do diálogo (P36)**: a arquitetura exige `confirmEntryCount` e `LOT_CHANGED`; a triagem sugeria "cancelar o estado atual atomicamente". Vence a arquitetura. O "sem segundo diálogo" da triagem é respeitado: o mesmo diálogo atualiza a contagem e pede nova confirmação.
3. **Cor do botão de confirmar**: EXPERIENCE diz "destrutivo, ferrugem"; DESIGN e a recomendação autorizada de P9 dizem ocre (única ação primária da camada) com ferrugem só no aviso. A pergunta P9 estava aberta no EXPERIENCE; vale a recomendação autorizada. O botão "Cancelar" da linha usa texto `ferrugem` (EXPERIENCE).
4. **Linha CANCEL em lote sem lances**: a arquitetura só cita linha CANCEL "com lances"; o PRD pede registrar o cancelamento no histórico e a auditoria é aberta para qualquer lote. Decisão da spec: a linha CANCEL é sempre gravada, para ter regra única e histórico completo. Ver pergunta 1.
5. **Linha CANCEL na cadeia (P11)**: a triagem sugeria não cobrir o cancelamento no HMAC; a arquitetura (AD-8) o inclui e conta no veredito. Vence a arquitetura.
6. **Mensagem de `ROLE_NOT_ALLOWED`**: o texto de EXPERIENCE ("Leiloeiro vende, não compra…") é de lance; no cancelar a mensagem é outra (§8).
7. **Texto de `LOT_CANCELLED` na recusa de lance**: o PRD diz "Este lote foi cancelado pelo leiloeiro."; o EXPERIENCE e a primeira versão da S03/S06 usavam o texto longo ("O leiloeiro cancelou este lote. Nada foi vendido e todo saldo travado voltou."). Vence o PRD: o `RefusalMessage` usa o texto do PRD; o texto longo fica só no aviso da Sala cancelada (§9.2). A S03 deve alinhar a tabela de mensagens e o AC-3.4 ao texto do PRD.
8. **Textos do extrato (`REFUND`/`RELEASE`)**: a versão anterior desta fatia reescrevia os rótulos já fixados nos AC da S01/S03. Vencem os textos da S01/S03, como constantes únicas em `packages/shared`; a S06 não os altera.

Decisões do build (26/10/2026, sem subagente):
1. **Railway no lugar de Neon/Render/Vercel:** onde a fatia diz Neon/Render/Vercel, leia Railway (a mesma adaptação da S05). Esta fatia **não tem migração**; a DoD "migração aplicada" vale como "sem migração, confirmado" (`migrate deploy` no start da API do Railway disse "No pending migrations to apply").
2. **`DomainEvent` é `{ type, room, payload }`** (a fatia escreve `event` em alguns pontos). `lot:cancelled` leva `{ lotId, version, serverTime }`: o service o produz sem `serverTime` e o `Publisher` carimba.
3. **Texto de `LOT_CANCELLED` na recusa de lance (item 7 acima):** o código (`BID_TEXT.lotCancelled` e a mensagem padrão da API) e a S03 (tabela de mensagens, AC-3.4 e §16) **já usavam o texto do PRD** quando a S06 começou; conferi por busca nos documentos e não havia texto antigo para trocar. O texto longo continua só como aviso da Sala cancelada (`LOT_TEXT.cancelledBody`).
4. **Onde vive o service:** `services/cancel.service.ts` (`makeCancelService`, `cancelLot(userId, lotId, confirmEntryCount)`), não dentro do `lot.service.ts`. A resposta é `LotState` montado na própria transação (`summarizeBids`, extraído do `getLotState`), sem `myPseudonym`, posição nem dado do líder.
5. **Contratos que já existiam** e só foram conferidos: `LotState.lot.cancelledAt`, `LotCard.cancelledAt`, `LedgerEntryDto.lotNumber`, `BID_TEXT.lotCancelled`, `entryHash` com `CANCEL`. **O que entrou:** `MyLotCard.refundedCents` (`bidCount > 0` → `currentBidCents`, sem coluna nova: todo lote com lance tem líder), `cancelLotSchema` e `CANCEL_TEXT` com plural e concordância ("Agora é 1 lance", "Agora não há lances.").
6. **Painel e INV-1:** o `showcase:lot` CANCELLED de lote próprio **não** altera a linha (o cartão não traz estorno nem horário): só pede `GET /my/lots`, e a linha vai para "Cancelados" com os dados da resposta. O aviso opcional "Chegou lance novo: agora são {N}." **entrou** (o mínimo obrigatório, `LOT_CHANGED`, continua sendo a garantia).
7. **Falha de rede ambígua:** o diálogo não reenvia sozinho; na tentativa seguinte refaz `GET /my/lots` antes e trata lote já cancelado como sucesso, sem novo `POST`. Se o cancelamento aconteceu e a resposta se perdeu **mas o `showcase:lot` chegou**, o Painel descobre pelo evento e fecha o diálogo com "Este lote já foi cancelado." (é o comportamento da §9.1 para evento de cancelamento do mesmo lote com o diálogo aberto).
8. **Sala cancelada:** além do carimbo, aviso e horário, mantém o histórico de lances e o cronômetro "ENCERRADO 00:00"; a região viva `aria-live` fica sempre montada e só anuncia o cancelamento visto ao vivo. O carimbo "bate" até a inclinação de repouso por uma variável CSS (`--rot`), então o Cancelado para em −4° e o reduced-motion já o mostra em −4°. `Dialog` ganhou `dismissible` e `describedBy`; os botões dos diálogos passaram a ter altura mínima de 52 px.
9. **Seed:** "Chevrolet Onix 2020", `seedCancelledLot`, idempotente por título e com retomada de lote parcial. Em produção o primeiro deploy com o seed criou o **lote 010** cancelado de demonstração (efeito registrado no diário, item 77). O `seedLiveBids` passou a pular lote cancelado ou vencido.
10. **Revisão em paralelo (step-04):** não rodou; fica para o `bmad-code-review` se o Felipe pedir.

Perguntas abertas, com a sugestão adotada:
1. **Linha CANCEL em lote sem lances:** sim, sempre (como especificado). Regra única, histórico completo e a Auditoria abre para qualquer lote. É a mesma Q3 do SPEC.
2. **Textos "(texto a revisar)" da §8:** mantidos como escritos, com duas concordâncias a mais ("Agora é 1 lance", "Agora não há lances.") e o aviso "Chegou lance novo…". A revisão de voz fica para a S09.
3. **Sala cancelada sem desenho:** carimbo −4° e aviso derivados do DESIGN, sem mock, conferidos no Chrome real nos dois temas e a 390 px. Sem links para a Auditoria até a S08.

## 17. Definition of Done

- [x] Todos os AC `[auto]` passam no CI (Postgres de serviço); `Promise.all` cancelar×lance (20 rodadas, ordens aleatórias com semente impressa) e cancelar×cancelar (5 simultâneos) verdes. CI verde em `9ed7e10`; prova de mutação: 4 mutantes do service mortos (diário, item 76).
- [x] Checklist manual dos AC `[manual]` (6.15 a 6.18, 6.20 a 6.22 e 6.24) percorrido no **Chrome real local**, com dois clientes, nos temas claro e noite e em 390 px, mais a corrida do diálogo (diário, item 78: 64/64). **Não conferido, fica com o Felipe:** leitor de tela e aparelho real (e o Tab em um Chrome com interface), sem marcar feito.
- [x] Sem migração nova (confirmado: `migrate deploy` no Railway disse "No pending migrations to apply").
- [x] Seed estendido roda (`npm run seed`, duas vezes, num banco novo e no deploy do Railway) e deixa o lote cancelado com estorno e a invariante de saldo verdadeira (comprometido de cada carteira = soma dos lances dos lotes ao vivo que ela lidera, conferido em produção).
- [x] DTOs em `packages/shared` atualizados (`MyLotCard.refundedCents`; `LotState.cancelledAt` e o extrato com `lotNumber` já existiam e foram conferidos).
- [x] Smoke no link público: cancelar um lote com lances e ver a Sala, a Vitrine e a Carteira atualizarem (lote 013, 19/19; diário, item 79).
- [x] README ganha a regra "cancelamento com estorno e linha CANCEL na auditoria".
