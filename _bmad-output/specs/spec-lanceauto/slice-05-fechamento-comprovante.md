---
id: S05
titulo: Fechamento, liquidação e comprovante
depende_de: [S00, S01, S02, S03, S04]
cobre: [R11, R12, R13, E7, AC8, AC9, SET, DM-Receipt, T6, P4, S4, S5]
parcial: [E9, T1, T3, T7, E11, AC12, S9]
fontes_de_origem: [PRD Regras 11–13, Encerramento, Comprovante, Painel, Seed, Testes, AD-4, AD-6, AD-7, AD-8, AD-9, EXPERIENCE State Patterns (Sala/Comprovante/Painel/Vitrine), Interaction Primitives/Link do comprovante, DESIGN recibo/carimbo/cronômetro, triagem P6 P19 P20 P21 P12]
---
# S05 — Fechamento, liquidação e comprovante

## 1. Objetivo e demonstração

Quando o relógio chega ao fim, o lote fecha sozinho: o maior lance vence, o dinheiro muda de mãos uma única vez, o comprovante nasce com link público e todas as telas mostram o resultado. Sem lances, o lote fecha sem vencedor.

Roteiro:
1. Seed: abra o lote encerrado e arrematado. Visitante vê "Martelo batido · Licitante XXXX levou por R$ …", sem botão de comprovante.
2. Entre como o licitante vencedor do seed: a Sala mostra "Você arrematou", o carimbo "Arrematado" e o botão "Ver comprovante". Abra o comprovante e copie o link ("Link copiado").
3. Abra o link do comprovante em janela anônima (sem login): recibo com lote, carro, valor, martelo com segundos, pseudônimo do lote, hash final HMAC-SHA256. Nenhum nome ou e-mail.
4. Carteira do vencedor: Total caiu pelo valor, Comprometido zerou nesse lote, Disponível não mudou; extrato com a linha "Arremate · lote NNN".
5. Painel do leiloeiro do seed: o lote aparece com o carimbo e "Licitante XXXX levou", comparação com a FIPE, e "Total recebido" somado.
6. Abra o lote encerrado sem lances: carimbo tracejado "Sem lances" e "Ninguém quis. Lote fechado sem vencedor."
7. Ao vivo: crie um lote de 5 min, dê um lance como A com dois navegadores abertos e espere o fim. Em 00:00 a Sala diz "Martelo batido. Apurando o resultado…" e, em segundos, vira "Você arrematou" para A e "Martelo batido · Licitante XXXX levou…" para os outros, sem recarregar. A Vitrine tira o card de "Ao vivo" e o põe em "Encerrados".

## 2. Fora desta fatia

| Item | Fatia |
| --- | --- |
| Cancelamento, estorno, linha CANCEL | S06 |
| Meus arremates (`GET /me/bids`, cartões-ingresso) | S07 |
| Links para a Auditoria (Sala, Comprovante, cartão Encerrado, Painel) e comparação `RECEIPT_MISMATCH` | S08 |
| Texto final do README (hibernação, limitações) | S09 (aqui só as notas técnicas) |
| Teto, prazo máximo de liquidação ou retentativa com alarme | fora de escopo (sem requisito) |

## 3. Ponto de partida

Já existe: User/Wallet/LedgerEntry com `LedgerKind` completo e CHECKs (S01); Item/Lot, `genesis`, `GET /lots`, `GET /lots/:id`, `GET /my/lots`, Vitrine, Painel base, Sala, `Cronometro` com variante "Encerrado", `Stamp`, `FeedbackState`, `Dialog` (S00/S02); Bid, `lastHash/seal/entryCount`, pseudônimo, `leadingLots` (S03); `Publisher` real, `lot:closed` e `showcase:lot` definidos, `useLotRoom` (S04).

Invariantes que valem aqui:
- INV-1 Servidor é fonte de verdade de tempo, saldo e valores.
- INV-2 Dinheiro em centavos inteiros (`BigInt` no banco, `number` nas bordas, assert ≤ MAX_SAFE_INTEGER nos mappers). UI mostra só reais inteiros `R$ 31.000,00` em IBM Plex Mono.
- INV-3 Datas ISO UTC com `Z` (ms). `new Date()`/`Date.now()` proibidos em `apps/api/src` fora de `infra/clock.ts` (no web, `Date.now()` só dentro de `serverClock` e nos formatadores de data). UI mostra America/Sao_Paulo.
- INV-4 Service devolve `DomainEvent[]`; a rota (ou a rotina) entrega ao `Publisher` DEPOIS do commit.
- INV-5 Lock: (1) lote `FOR UPDATE`; (2) carteiras `WHERE "userId" IN (…) ORDER BY "userId" FOR UPDATE`. Nunca carteira antes do lote.
- INV-6 `Wallet` é cache; cada mudança insere `LedgerEntry` na mesma tx; CHECKs `committed >= 0`, `total >= committed`. SALE_DEBIT: total−, committed−; SALE_CREDIT: total+.
- INV-10 Fechamento: `setInterval` de 5 s + varredura no boot; elegível = `endsAt <= now AND settledAt IS NULL AND cancelledAt IS NULL`; por lote uma tx que relê sob lock; liquida uma única vez; `GET` nunca liquida.
- INV-11 `lotStatus(lot, now)`: `CANCELLED` · `SCHEDULED` · `LIVE` · `CLOSING` (settledAt nulo) · `SOLD` (bidCount>0) · `UNSOLD`. Vocabulário de UX: Agendado, Ao vivo, Arrematado, Sem lances, Cancelado; CLOSING = "apurando".
- INV-12 `finalHash` do comprovante = `lastHash` do lote; a liquidação NÃO acrescenta linha à cadeia.
- INV-13 DTO público nunca contém userId, nome ou e-mail; token do comprovante = 24 bytes base64url aleatórios.
- INV-14 Comprovante, Sala e Vitrine leem só o banco.
- INV-16 Erro `{ error: { code, message, details? } }`.
- INV-18 Voz do pátio; dados verificáveis em IBM Plex Mono.

## 4. Regras de negócio

| # | Regra | Origem |
| --- | --- | --- |
| R-5.1 | Um lote é elegível ao fechamento quando `endsAt <= now`, `settledAt IS NULL` e `cancelledAt IS NULL`, com `now = clock.now()` lido já sob o lock do lote. | PRD R11 · AD-6 |
| R-5.2 | Com lances (`bidCount > 0`): o líder vence. Débito do valor do lance (`currentBidCents`) no `total` e no `committed` do vencedor (`SALE_DEBIT`), crédito do mesmo valor no `total` do leiloeiro dono do lote (`SALE_CREDIT`), `Receipt` criado, `settledAt = now`. Tudo numa única transação. | PRD R11 · AD-4 |
| R-5.3 | Sem lances: só `settledAt = now`. Sem `Receipt`, sem ledger, sem vencedor. | PRD R12 |
| R-5.4 | Idempotência: a liquidação ocorre uma única vez por lote; rodar a rotina de novo, em paralelo ou em outra instância não duplica débito, crédito nem comprovante. Garantias em camadas: `settledAt` relido sob `FOR UPDATE`; `FOR UPDATE SKIP LOCKED` (quem encontra o lote travado pula); `Receipt.lotId UNIQUE` (rede de segurança). | PRD R13 · AD-6 |
| R-5.5 | Um `Receipt` por lote arrematado: `pseudonym` = pseudônimo do vencedor NAQUELE lote (o gravado no lance vencedor), `amountCents` = valor do lance vencedor, `finalHash` = `lot.lastHash`, `token` = 24 bytes aleatórios `base64url`, `issuedAt = now`. | PRD Modelo de dados · AD-8/9 |
| R-5.6 | O "martelo" exibido é `lot.endsAt` (incluindo prorrogações), nunca `settledAt`. `settledAt` pode ser bem posterior (servidor hibernado). | Decisão de contrato (ver §16) |
| R-5.7 | Só o leiloeiro dono do lote recebe o crédito. O saldo do leiloeiro é `Wallet.total`; ele não tem tela de carteira (a única superfície é "Total recebido" no Painel). | PRD R11 · EXPERIENCE (fechado) |
| R-5.8 | "Total recebido" do leiloeiro = soma dos `SALE_CREDIT` dele (centavos). Lote cancelado ou sem lances não entra. | Assunção registrada |
| R-5.9 | `GET` de qualquer rota nunca liquida. Entre `endsAt` e `settledAt` o status é `CLOSING` e a UI mostra "apurando". | AD-6 · AD-7 |
| R-5.10 | Falha ao liquidar um lote (ex.: violação de CHECK) desfaz só aquela transação, é logada em nível erro e a rotina segue para o próximo lote; o lote é tentado de novo no próximo ciclo. Falha na própria listagem de candidatos também é logada e o ciclo termina sem rejeitar (§6). | Decisão de implementação (sem requisito) |
| R-5.11 | Defesa em profundidade na transação de lance (S03): se `settledAt IS NOT NULL`, o lance é recusado com `LOT_ENDED`, mesmo que o relógio acuse `now < endsAt`. | PRD R1/R13 |
| R-5.12 | Comprovante é público por token: quem tem o link vê; quem não tem não adivinha. Resposta nunca contém dados pessoais. O token só sai para o vencedor logado (`myReceiptToken`) e fica na URL do comprovante: **nenhuma outra resposta ou evento público o carrega** (nem `lot:closed`, nem `GET /lots` e, na S08, nem a auditoria, que usa só `receiptCode`). | PRD P4 · AD-9 |

## 5. Modelo de dados

Migração desta fatia:

```prisma
model Receipt {
  id          String   @id @default(uuid())
  lotId       String   @unique
  winnerId    String
  pseudonym   String
  amountCents BigInt
  token       String   @unique
  finalHash   String
  issuedAt    DateTime @db.Timestamp(3)
}
```

Se as demais tabelas já usam relações Prisma, declarar FK para `Lot(lotId)` e `User(winnerId)` do mesmo jeito. `winnerId` NUNCA sai em DTO público. Não criar índice extra (os dois `UNIQUE` bastam). Não há mudança em `Lot` (`settledAt` já existe), nem em `LedgerEntry`/`Wallet`.

Fórmulas derivadas (não gravadas): `receiptCode = String(lot.number).padStart(3,"0") + "-" + token.slice(0,4).toUpperCase()`.

## 6. Contratos REST

| Rota | Papel | Corpo → resposta | Erros |
| --- | --- | --- | --- |
| `GET /receipts/:token` | público | → `200 ReceiptDTO` (abaixo). `Cache-Control: no-store`. | `NOT_FOUND` 404 se o token não existe ou não tem o formato (`^[A-Za-z0-9_-]{32}$`); resposta idêntica nos dois casos. |
| `GET /lots/:id` | público (+token opcional) | mesma rota da S02/S03 passa a incluir `result` e `myReceiptToken` (abaixo). | — |
| `GET /my/lots` | leiloeiro | `{ lots: LotCard + resultado, totalReceivedCents }` agora preenchidos (abaixo). | `UNAUTHENTICATED` 401, `ROLE_NOT_ALLOWED` 403 |
| `GET /lots`, `GET /wallet` | — | sem mudança de forma; passam a refletir status `SOLD/UNSOLD` e as linhas `SALE_DEBIT` no extrato. | — |

`ReceiptDTO` (em `packages/shared`):

```ts
{
  lotNumber: number,            // exibido com 3 dígitos
  receiptCode: string,          // "018-7Q2K"
  lotId: string,                // só para montar a futura rota de auditoria
  car: { title: string, brand: string, model: string, year: number, fuel: string,
         referencePriceCents: number, referenceMonth: string,   // "10/2026"
         imageUrl: string | null, imageCredit: string | null },
  amountCents: number,
  bidCount: number,
  extended: boolean,            // endsAt > originalEndsAt
  hammerAt: string,             // lot.endsAt (ISO UTC)
  settledAt: string,            // ISO UTC
  winnerPseudonym: string,      // "Licitante 7F3A", o daquele lote
  finalHash: string,            // 64 hex minúsculos
  auditUrl: string              // "/lotes/{lotId}/auditoria"
}
```
Nunca incluir: `winnerId`, `userId`, nome, e-mail, `rawData` da FIPE, token (o chamador já o tem).

`LotState` ganha:
- `result: null | { outcome: "SOLD"|"UNSOLD", finalBidCents: number|null, winnerPseudonym: string|null, hammerAt: string, settledAt: string }`. `null` enquanto `LIVE/SCHEDULED/CLOSING/CANCELLED`.
- `myReceiptToken: string | null`: preenchido apenas para o vencedor logado (nunca para outros nem para visitantes).

`GET /my/lots` — cada linha ganha `resultado: null | { outcome: "SOLD"|"UNSOLD", finalBidCents: number|null, winnerPseudonym: string|null, referencePriceCents: number, settledAt: string }` (se a S02 já definiu campo equivalente, manter o nome existente e completar). `totalReceivedCents` = soma de `SALE_CREDIT` do usuário.

Rotina de fechamento (sem rota HTTP): `infra/settlement-job.ts` expõe `start()`, `stop()` e `sweep(publisher): Promise<SettleOutcome[]>`; o service `settleLot(lotId): Promise<SettleOutcome>` é exportado para testes e seed. Tipo (em `apps/api`, não em `shared`): `SettleOutcome = { lotId: string, result: 'SOLD'|'UNSOLD'|'SKIPPED', events: DomainEvent[] }`. O service NÃO publica nada (INV-4): quem chama entrega `events` ao `Publisher` depois do commit daquele lote. `sweep(publisher)` faz isso lote a lote, logo após cada commit; o seed e os testes chamam `settleLot` e decidem se publicam.
- `sweep` **nunca rejeita**: toda a função (inclusive a listagem de candidatos, que pode falhar com cold start do Neon ou conexão caída) fica em `try/catch` com log em nível erro, e o handler do `setInterval` ainda usa `.catch(log)`. Uma promise rejeitada não tratada derrubaria o processo da API (Node ≥ 15), que é justamente quem fecha os lotes.
- `stop()` faz `clearInterval`, chama `unref()` no timer (para o Vitest/CI encerrarem) e devolve uma promise que espera o `sweep` em curso terminar (usada no shutdown gracioso).

## 7. Contratos Socket.IO

Emitidos por esta fatia, depois do commit de cada lote (payloads exatos da S04):

| Evento | Sala | Payload |
| --- | --- | --- |
| `lot:closed` | `lot:{id}` | `{ lotId, version: entryCount, outcome: "SOLD"\|"UNSOLD", finalBidCents?, winnerPseudonym?, finalHash?, serverTime }` (campos opcionais só em `SOLD`) |
| `showcase:lot` | `showcase` | `LotCard` com `status = SOLD\|UNSOLD` + `version` (= `entryCount`, que o fechamento não incrementa; o cliente aplica com `>=` neste evento terminal) + `serverTime` |
| `wallet:updated` | `user:{vencedor}` e `user:{leiloeiro}` | `{ totalCents, committedCents, availableCents, serverTime }` (só em `SOLD`) |

O evento público NÃO leva o token do comprovante. O vencedor o obtém no `GET /lots/:id` que o cliente faz ao receber `lot:closed` (campo `myReceiptToken`).

## 8. Mensagens

| Código / situação | HTTP | Texto | Onde |
| --- | --- | --- | --- |
| `NOT_FOUND` (comprovante) | 404 | "Esse papel não existe, ou já foi para a gaveta." | Comprovante, título "Comprovante não encontrado" + botão "Voltar à vitrine" |
| `LOT_ENDED` (lance depois do fim/liquidação) | 409 | "Martelo batido às {hh:mm}. Este lote não aceita mais lances." | Sala (já da S03; vale também com `settledAt` preenchido) |
| Copiar link, sucesso | — | "Link copiado" (botão, por 2,2 s) | Comprovante, Sala |
| Copiar link, falha | — | "Não deu para copiar. Selecione o link e copie à mão." | Comprovante, Sala |
| Erro de rede ao carregar comprovante | — | "Não deu para carregar o comprovante." + "Tentar novamente" (texto a revisar) | Comprovante |

Textos da Sala encerrada estão na tabela de §9.1.

## 9. Telas e estados

### 9.1 Sala (`/lotes/[id]`) — estados de encerramento

Aplicável de `now >= endsAt` em diante. Regras comuns: `Cronometro` na variante Encerrado ("00:00", rótulo "ENCERRADO", sem animação, `role="timer"` `aria-label="Tempo restante 00:00"`); selo "Ao vivo" some; formulário de lance some e entra `BotaoDesabilitado` "Lote fechado" (`disabled` real); histórico permanece (sem "VOCÊ" para visitante); `PlacaLance` mostra o lance final (rótulo "LANCE FINAL", texto a revisar) ou, sem lances, o lance inicial (rótulo "LANCE INICIAL"). Horários sempre em Brasília com segundos.

| Estado | Condição | Tratamento |
| --- | --- | --- |
| Apurando | `CLOSING`: `now >= endsAt`, `settledAt` nulo | `FaixaStatus` neutra (`tinta`/`fundo`): título "Martelo batido", subtítulo "Apurando o resultado…". Formulário desabilitado. Nenhum carimbo, nenhum vencedor, nenhum comprovante. A tela refaz `GET /lots/:id` a cada 3 s e também reage a `lot:closed`. Sem prazo máximo prometido. |
| Você arrematou | `SOLD` e `myReceiptToken != null` | `FaixaStatus` `verde`/`sobreCor`: título "Você arrematou", subtítulo "Martelo batido às {hh:mm:ss} · R$ {valor},00". `Stamp` "Arrematado" grande (52px) que "bate" (`la-bate`, assenta em −6°) só se a transição foi vista nesta sessão; ao abrir um lote já encerrado, aparece direto assentado. Frase (`body`): "Você levou o {título do lote} por R$ {valor},00. O valor saiu do saldo e o comprovante já tem link público." Único botão primário da tela: "Ver comprovante" → `/c/{myReceiptToken}`. Botão secundário "Copiar link" (copia `{origem}/c/{token}`). "Lote fechado" desabilitado no lugar do formulário. |
| Não venceu (participou) | `SOLD`, logado, `myBestBidCents != null`, sem token | `FaixaStatus` neutra: "Martelo batido", subtítulo "Licitante {XXXX} levou por R$ {valor},00". `Stamp` "Arrematado". Frase: "Seu saldo foi liberado quando seu lance foi superado." Sem "Ver comprovante". |
| Não venceu (nunca deu lance) / leiloeiro / visitante | `SOLD`, sem participação ou sem login | Igual ao anterior, SEM a frase do saldo. Visitante e leiloeiro: link secundário "Voltar à vitrine". Não há convite "Entre para dar lances" (lote fechado). |
| Sem lances | `UNSOLD` | `Stamp` "Sem lances" (borda 4px tracejada, `tinta2`, −2°, sem outline). `FaixaStatus` neutra: "Martelo batido", subtítulo "Este lote encerrou sem lances". Frase: "Ninguém quis. Lote fechado sem vencedor." Sem vencedor, sem comprovante. |
| Carregando / erro | — | `FeedbackState` ("Carregando…" / erro + "Tentar novamente"); dados anteriores permanecem, marcados desatualizados. |

Detalhes:
- "Martelo batido às hh:mm:ss" usa `hammerAt` (= `endsAt`).
- `{XXXX}` = os 4 caracteres do pseudônimo (`winnerPseudonym` já vem como "Licitante 7F3A"; a frase usa o texto completo "Licitante 7F3A").
- Quem venceu é decidido pelo servidor (`myReceiptToken`), nunca comparando pseudônimos no cliente (colisão de 4 hex).
- `FaixaStatus` tem `aria-live="polite"`: é a única região que anuncia a mudança de situação (apurando → arrematou/ não venceu/ sem lances). O histórico não é live.
- A faixa muda no mesmo lugar do painel de lance da Sala; no mobile a ordem do DOM é a da S03.
- Transição ao vivo: ao receber `lot:closed`, o cliente aplica o evento (R-4.7 da S04) e faz `GET /lots/:id` para obter `result` e `myReceiptToken`.

### 9.2 Comprovante (`/c/[token]`)

Público, renderizado no servidor (Next, sem token de usuário), `<meta name="robots" content="noindex">`. O `fetch` do SSR à API tem **timeout de 8 s** (a API no Render pode estar dormindo e a função serverless da Vercel não deve pendurar nem dar 500): se estourar ou falhar por rede, a página renderiza o esqueleto e um componente de cliente refaz o `fetch` mostrando o erro de rede com "Tentar novamente". Só se responde 404 quando a API devolve 404. Cabeçalho mínimo mesmo para quem está logado: `Logo` + legenda mono "PÁGINA PÚBLICA · NÃO PRECISA DE LOGIN". Contêiner máximo 1200px, gutter `clamp(16px,4vw,56px)`.

Estrutura (h1 em `display-titulo`, caixa-alta: "Comprovante de arremate"):
1. **Recibo** em cinco faixas sobrepostas (cabeçalho, picote, corpo, picote, rodapé), girado −1° com `drop-shadow(8px 8px 0 sombra)`.
   - Cabeçalho: `LotTag` (etiqueta-lote encerrado, fundo `papel`) com o número; título do carro (Big Shoulders 900 32px); `Stamp` "Arrematado" (+3°).
   - Corpo: `dl` em IBM Plex Mono 17px / lh 1.7, linhas rótulo/valor: LOTE (`{NNN}`), CARRO (`{título}`), ANO / COMBUSTÍVEL, REFERÊNCIA FIPE (`R$ X,00 · {mês/ano do snapshot}`), LANCES (`{N}` e, se `extended`, `· PRORROGADO`), MARTELO (`dd/mm/aaaa hh:mm:ss`, Brasília), ARREMATANTE (`Licitante XXXX`, o pseudônimo daquele lote), VALOR (`R$ X,00`).
   - Rodapé: rótulo "HASH FINAL · HMAC-SHA256" + hash completo (64 hex, quebra em qualquer ponto, selecionável), "Nº DO COMPROVANTE" = `receiptCode`, e código de barras decorativo.
2. Foto do carro (`CarPhoto`, 16:9, `contain`, crédito em legenda abaixo; sem foto: ilustração padrão + "Imagem ilustrativa").
3. Ações: `BotaoSecundario` "Copiar link" (nome acessível "Copiar link do comprovante do lote {NNN}"). Link para a Auditoria entra na S08.
4. Nota de privacidade (`body-nota`, texto a revisar): "Nome e e-mail do arrematante não aparecem aqui. Em cada lote ele vira um Licitante diferente."

| Estado | Tratamento |
| --- | --- |
| Padrão | como acima, claro e noite |
| Token inexistente / malformado | resposta HTTP 404 (`notFound()`, só quando a API devolveu 404); `FeedbackState` com título "Comprovante não encontrado", texto "Esse papel não existe, ou já foi para a gaveta.", botão secundário "Voltar à vitrine". Não ecoa o token. |
| Erro de rede / timeout do SSR (8 s) | esqueleto + `FeedbackState` erro no cliente: "Não deu para carregar o comprovante." + "Tentar novamente" (refaz o `fetch` no navegador; nunca vira 404) |
| Copiar link: sucesso | botão vira "Link copiado" por 2,2 s; anúncio em região viva `aria-live="polite"` |
| Copiar link: falha da área de transferência | o botão mostra "Não deu para copiar. Selecione o link e copie à mão."; aparece um campo somente leitura com o URL já selecionado (`select()`) |

Copiar link copia `${window.location.origin}/c/${token}` com `navigator.clipboard.writeText`; falhou ⇒ estado de falha acima.

Acessibilidade: `main` com `h1`; `dl`; o código de barras é `aria-hidden`; rotação decorativa não pode quebrar zoom até 200% nem reflow (recibo vira coluna única); hash com `overflow-wrap: anywhere`.

### 9.3 Painel (`/painel`)

- Resumo: "TOTAL RECEBIDO" (`totalReceivedCents`, IBM Plex Mono, nota na cor fixa `rotuloNotaPainel` #B3AA99 sobre `painel`) e "ARREMATES" (nº de lotes `SOLD`). Placares AO VIVO / AGENDADOS / ENCERRADOS (LED `led`; AO VIVO em `ledAlerta` quando >0): "AO VIVO" conta `LIVE` + `CLOSING` (apurando ainda é ao vivo, igual à Vitrine) e "ENCERRADOS" conta só `SOLD` + `UNSOLD`.
- Cartões "Encerrados" (variante encerrado do `LotCard` da S02): `Stamp` "Arrematado" ou "Sem lances" + resultado: `SOLD` → "{Licitante XXXX} levou" (pseudônimo daquele lote) e "R$ {valor},00"; `UNSOLD` → "Fechado sem lances". Comparação com a FIPE (**se sobrar tempo**; cortável sem ferir o PRD) na linha mono: `FIPE R$ {ref},00 · {+8,2%|−3,0%}` (variação = (final − ref) / ref, uma casa, vírgula decimal; sem referência ou `UNSOLD`, omitir). `CLOSING` não é Encerrado: o cartão fica na lista de ao vivo com o rótulo "Apurando o resultado…" no lugar do carimbo, como na Vitrine, e migra para Encerrados quando chegar `showcase:lot` `SOLD/UNSOLD` (o Painel refaz `GET /my/lots`).
- Atualiza por `showcase:lot` (S04) e refaz `GET /my/lots` quando um lote próprio passa a `SOLD/UNSOLD`.
- "Cancelar" e seção "Cancelados" são da S06.

### 9.4 Vitrine (`/`)

- Seção "Encerrados" (ordem `endsAt↓`): cartão encerrado (ilustração/foto a `opacity .55`, `Stamp` central de 184px de largura: "Arrematado" ou "Sem lances"), rodapé "RESULTADO": `SOLD` → valor (mono 600 22px) e "N lances"; `UNSOLD` → "Sem lances". Destino do cartão: Sala (`lotCardHref`; a S08 troca para a Auditoria).
- Card `CLOSING` fica em "Ao vivo" com "00:00" e "Apurando o resultado…" até chegar `showcase:lot` com `SOLD/UNSOLD` (S04: recarrega a lista a cada 3 s enquanto houver card assim). Depois migra para "Encerrados".
- Filtro "Encerrados" da aba e busca continuam do servidor.

### 9.5 Carteira (`/carteira`)

- Extrato ganha o rótulo da movimentação `SALE_DEBIT`: "Arremate · lote {NNN}" com valor negativo `−R$ X,00` e a linha de apoio mono "TOTAL −R$ X,00 · COMPROMETIDO −R$ X,00 · DISPONÍVEL não muda".
- "Travado onde você lidera" deixa de listar o lote liquidado (`leadingLots` só inclui lotes com `settledAt` nulo e `cancelledAt` nulo).
- O vencedor recebe `wallet:updated` e a Carteira/chip atualizam sozinhos.

## 10. Componentes criados

### Recibo (`Recibo`)
Fundo `papel`; borda `2px dashed tracejado`; padding `14px 16px`; IBM Plex Mono 17px, lh 1.7; linhas rótulo/valor em `dl`. No Comprovante, montagem em 5 faixas sobrepostas com `Perforation` (picote 24px de altura, linha `2px dashed tracejado` com `left/right:20px; top:11px`, dois semicírculos 24×24 nas laterais com fundo `fundo`), rotação −1°, `filter: drop-shadow(8px 8px 0 var(--sombra))`. Rótulos em IBM Plex Mono 12px caixa-alta, tracking .12em. No tema noite: `papel`/`tracejado`/`sombra` noite.

### CodigoDeBarras (decorativo; **se sobrar tempo**, pode sair sem ferir o PRD)
SVG `aria-hidden`; barras de larguras 1–4px derivadas deterministicamente dos bytes do `finalHash` (mesma entrada, mesmo desenho); cor `tinta`; altura 48px; largura 100% até 360px. Não carrega informação.

### ResultadoDoLote (Sala + Painel)
Bloco que combina `Stamp` + frase de resultado conforme §9.1/§9.3. `Stamp`: Arrematado (`tinta`, borda 4px sólida + outline 2px offset 3px, +3°; na Sala 52px assenta em −6° após `la-bate .55s cubic-bezier(.2,.8,.3,1)`); Sem lances (`tinta2`, borda 4px tracejada, sem outline, −2°). O texto do carimbo é o status; não depende de cor nem de rotação. Reduced-motion: sem animação, carimbo visível.

### BotaoCopiarLink
`BotaoSecundario` (fundo `papel`, texto `tinta`, borda 3px, sombra 5px, Big Shoulders 800 20px, min-height 52px). Estados: padrão "Copiar link"; sucesso "Link copiado" (2,2 s); falha com a mensagem de §8 e campo `readonly` selecionado. Região viva `aria-live="polite"` associada. Nome acessível inclui o lote.

### Estado "Apurando"
Reaproveita `FaixaStatus` neutra; sem componente novo.

## 11. Seed desta fatia

Todos os lotes abaixo são criados pelos MESMOS services da aplicação (create lot, bid, settle) com `FakeClock`, nunca por insert direto, para a cadeia HMAC nascer válida (PRD S9). Itens vêm de `prisma/fipe-fixture.json`, sem rede.

| Lote | Como é feito |
| --- | --- |
| Encerrado e arrematado (S4) | `FakeClock` em `T0 = agora − 3 dias`. Cria o lote (início `T0`, fim `T0 + 1 h`), 4 lances alternados dos dois licitantes, o último a `fim − 40 s` (prorroga o fim em +2 min, para o recibo mostrar "PRORROGADO"). Avança o relógio para depois do novo fim e chama `settleLot`. O vencedor é o licitante 1 do seed. Valores coerentes com o saldo semeado. |
| Encerrado sem lances (S5) | Mesmo recurso: cria o lote no passado, avança o relógio, `settleLot` ⇒ `UNSOLD`. |

- O seed imprime no console a URL do comprovante de demonstração (`/c/{token}`) e o README (S09) indica o caminho: login do licitante vencedor → Sala do lote arrematado → "Ver comprovante".
- Garantir que os depósitos do seed (S01) cubram os lances e deixem saldo disponível > 0 depois das liquidações, para o avaliador conseguir dar lances no lote ao vivo. Ajustar o valor do depósito do seed se preciso.
- Com a rotina real rodando, os lotes semeados já nascem liquidados; o seed não depende do timer.
- `seed:demo` (S09) recria o lote ao vivo; não precisa recriar estes.

## 12. Critérios de aceite

Convenção de dados de teste: `Ana` (A) deposita R$ 50.000,00; `Bruno` (B); leiloeiro `L`; lote com lance inicial R$ 20.000,00 e incremento R$ 1.000,00.

- **AC-5.1 [auto] (AC8, R11)** Dado Ana líder com R$ 32.000,00 (total 50.000, comprometido 32.000) e `endsAt` ≤ agora, quando a rotina roda, então total de Ana = R$ 18.000,00, comprometido = R$ 0,00, disponível = R$ 18.000,00; total do leiloeiro aumentou R$ 32.000,00; existe exatamente 1 `Receipt` do lote com `amountCents = 3.200.000`; `settledAt` preenchido.
- **AC-5.2 [auto] (exemplo do PRD)** Dado Ana depositou R$ 50.000, liderou A com R$ 30.000, Bruno cobriu com R$ 31.000 e Ana voltou com R$ 32.000, quando o lote A fecha, então Ana termina com total/comprometido/disponível = R$ 18.000 / R$ 0 / R$ 18.000 e Bruno com total e disponível inalterados (R$ 0 comprometido).
- **AC-5.3 [auto] (AC8)** Dado o lote A fechado, quando a rotina roda de novo 3 vezes, então continua 1 `Receipt`, 1 `SALE_DEBIT` e 1 `SALE_CREDIT` do lote, saldos idênticos e nenhum `lot:closed` repetido.
- **AC-5.4 [auto] (R13)** Dado um lote vencido e não liquidado, quando `Promise.all` dispara 10 chamadas `settleLot(lotId)` e 3 `sweep()`, então: 1 `Receipt`, 1 `SALE_DEBIT`, 1 `SALE_CREDIT`, `settledAt` uma única vez, no máximo uma chamada com `result: 'SOLD'` (as demais `SKIPPED`; com `SKIP LOCKED` pode ocorrer de nenhuma ver o lote destravado no mesmo instante, então o teste termina com um `sweep()` sequencial que garante a liquidação e assevera que os totais acima valem), sem deadlock nem erro de unicidade vazando. Não asserir quantas chamadas vieram `SKIPPED`.
- **AC-5.5 [auto] (AC9, R12)** Dado lote vencido sem lances, quando a rotina roda, então `settledAt` preenchido, nenhum `Receipt`, nenhum `LedgerEntry` com esse `lotId`, `lotStatus` = `UNSOLD`, `lot:closed` com `outcome: "UNSOLD"` e sem `finalBidCents`.
- **AC-5.6 [auto] (fronteira)** Dado `FakeClock` exatamente em `endsAt` e Ana líder, quando `Promise.all` dispara um lance de Bruno (R$ 33.000,00) e `sweep()`, então o lance volta `LOT_ENDED`, nada é comprometido para Bruno (nenhum `HOLD`), e o ledger soma certo. Como o `sweep` pode pular o lote se o lance ainda segurar o lock (`SKIP LOCKED`), a asserção de liquidação roda **depois de aguardar o lance** e de executar um segundo `sweep()` sequencial: o lote é liquidado para Ana pelo valor anterior. O determinístico do teste é a recusa `LOT_ENDED` e a ausência de `HOLD` para Bruno.
- **AC-5.7 [auto]** Dado `FakeClock` em `endsAt − 1 ms` e Ana líder, quando Bruno dá lance (aceito) e depois roda `sweep()` com o relógio ainda em `endsAt − 1 ms`, então o lance prorrogou (`endsAt = now + 2 min`) e o `sweep` NÃO liquida (lote não elegível); avançando o relógio para o novo fim, o `sweep` liquida para Bruno.
- **AC-5.8 [auto]** Dado lote com `settledAt` preenchido e relógio recuado (`now < endsAt`), quando alguém dá lance, então `LOT_ENDED` (R-5.11).
- **AC-5.9 [auto]** Dado lote cancelado, vencido e não liquidado, quando a rotina roda, então nada acontece (sem `Receipt`, sem ledger).
- **AC-5.10 [auto]** Dados 3 lotes vencidos e um deles com um CHECK forçado a falhar, quando a rotina roda, então os 2 outros são liquidados, o problemático permanece sem `settledAt`, o erro é logado e o próximo ciclo o tenta de novo.
- **AC-5.11 [auto]** Dado o boot do servidor com 2 lotes vencidos e não liquidados (simula servidor hibernado), quando o processo inicia, então a varredura inicial os liquida, `settledAt > endsAt` e o `hammerAt` do comprovante continua sendo `endsAt`.
- **AC-5.12 [auto]** Dado `GET /lots/:id`, `GET /lots` e `GET /receipts/:token` chamados repetidamente num lote vencido não liquidado, então nenhum deles liquida (R-5.9); `lotStatus` = `CLOSING`.
- **AC-5.13 [auto]** Dado lote liquidado, quando `GET /receipts/:token` com o token certo, então 200 com `ReceiptDTO` completo: `winnerPseudonym` igual ao do `Bid` vencedor, `finalHash` igual a `lot.lastHash`, `receiptCode` no formato `NNN-XXXX`, `hammerAt = endsAt`; o JSON não contém `winnerId`, `userId`, nome nem e-mail do vencedor nem do leiloeiro (busca por substring no corpo serializado).
- **AC-5.14 [auto] (P4)** Dado token inexistente, token curto, token com caracteres inválidos, então 404 `NOT_FOUND` com corpo idêntico nos três casos.
- **AC-5.15 [auto]** Dado dois lotes arrematados pelo mesmo licitante, então os dois comprovantes têm pseudônimos diferentes (cada um o do seu lote) e tokens diferentes.
- **AC-5.16 [auto]** Dado `GET /lots/:id` de lote `SOLD`: vencedor logado recebe `myReceiptToken`; outro licitante, o leiloeiro e o visitante recebem `null`; `result.winnerPseudonym` é público.
- **AC-5.17 [auto]** Dado liquidação com lances, então `lot:closed` (`SOLD`, com `finalBidCents`, `winnerPseudonym`, `finalHash`, sem token), `showcase:lot` (status `SOLD`) e `wallet:updated` para o vencedor e para o leiloeiro são emitidos depois do commit e só uma vez; um terceiro usuário não recebe `wallet:updated`.
- **AC-5.18 [auto]** Dado `GET /my/lots` de `L`, então `totalReceivedCents` = soma dos `SALE_CREDIT` de `L` e cada lote encerrado traz `resultado` (SOLD com valor e pseudônimo; UNSOLD sem valor); lote de outro leiloeiro não aparece.
- **AC-5.19 [auto]** Dado `GET /wallet` do vencedor após o fechamento, então o extrato traz `SALE_DEBIT` com `totalAfter` e `committedAfter` coerentes e `leadingLots` não lista mais o lote.
- **AC-5.20 [manual] (AC8/E7)** Dado o lote arrematado do seed, quando o vencedor abre a Sala, então vê faixa verde "Você arrematou", subtítulo "Martelo batido às hh:mm:ss · R$ X,00", carimbo "Arrematado", a frase "Você levou o {carro} por R$ X,00. O valor saiu do saldo e o comprovante já tem link público.", botão "Ver comprovante" e "Lote fechado" desabilitado.
- **AC-5.21 [manual]** Dado o mesmo lote, quando o outro licitante (que foi superado) abre a Sala, então vê "Martelo batido" / "Licitante XXXX levou por R$ X,00" e "Seu saldo foi liberado quando seu lance foi superado.", sem "Ver comprovante".
- **AC-5.22 [manual]** Dado o mesmo lote, quando um visitante abre a Sala, então vê a faixa neutra, sem frase de saldo, sem convite para dar lance, e o link "Voltar à vitrine".
- **AC-5.23 [manual] (AC9)** Dado o lote encerrado sem lances, então Sala mostra carimbo tracejado "Sem lances", "Este lote encerrou sem lances", "Ninguém quis. Lote fechado sem vencedor.", sem comprovante.
- **AC-5.24 [manual]** Dado Sala aberta em 00:00 antes da liquidação, então vê "Martelo batido" / "Apurando o resultado…", formulário desabilitado; em até alguns ciclos de 5 s a tela vira o resultado final sem recarregar.
- **AC-5.25 [manual] (AC12 parcial)** Dado `/c/{token}` aberto em janela anônima, então vê lote, carro, ano/combustível, referência FIPE com mês do snapshot, lances, martelo com segundos, "Licitante XXXX", valor, hash final de 64 hex, código `NNN-XXXX` e carimbo; nenhum nome nem e-mail; rótulo diz HMAC-SHA256 (nunca "SHA-256").
- **AC-5.26 [manual]** Dado "Copiar link" com permissão, então o botão vira "Link copiado" por 2,2 s e o clipboard contém `{origem}/c/{token}`; com clipboard negado, aparece "Não deu para copiar. Selecione o link e copie à mão." e o URL selecionado em campo somente leitura.
- **AC-5.27 [manual]** Dado `/c/abc`, então 404 com "Comprovante não encontrado" / "Esse papel não existe, ou já foi para a gaveta." e botão "Voltar à vitrine".
- **AC-5.28 [manual]** Dado o Painel do leiloeiro do seed, então "Total recebido" = soma do(s) lote(s) arrematado(s), "ARREMATES" = quantidade, o cartão do arrematado mostra o carimbo, "Licitante XXXX levou", valor e a variação sobre a FIPE; o sem lances mostra "Fechado sem lances".
- **AC-5.29 [manual]** Dado a Vitrine com um lote em `CLOSING`, então o card fica em "Ao vivo" com "00:00" e "Apurando o resultado…" e migra sozinho para "Encerrados" com o carimbo correto quando o servidor liquidar.
- **AC-5.30 [manual]** Dado reduced-motion ativo, então o carimbo "Arrematado" aparece assentado sem "bater" e a informação continua legível; nos dois temas o recibo mantém contraste.
- **AC-5.31 [manual]** Dado a API externa (FIPE/Wikipedia) fora do ar, então Sala encerrada, Vitrine, Painel (listas) e Comprovante continuam funcionando (AC13).

## 13. Casos de borda e concorrência

- **Mesma fronteira `now == endsAt`:** o lance é recusado (`LOT_ENDED`, R1: aceito só se `now < endsAt`), o fechamento é elegível (`endsAt <= now`).
- **Lance aceito aos `endsAt − 1 ms`** prorroga; o `sweep` relê `endsAt` sob lock e pula.
- **Dois líderes impossíveis:** a liquidação usa `leaderId`/`currentBidCents` lidos sob lock; nunca recalcula por soma de lances.
- **Líder trocou três vezes:** só o último líder é debitado; os anteriores já foram liberados (RELEASE) na hora em que foram superados.
- **Vencedor também é "Ana voltou a liderar":** igual ao exemplo do PRD (AC-5.2).
- **Lote sem carteira do leiloeiro:** impossível (toda conta ganha carteira no cadastro); se ocorrer, a tx falha, é logada e tentada de novo (R-5.10).
- **Servidor hibernado (Render free):** o timer para; ao acordar a varredura do boot liquida; `settledAt` posterior a `endsAt`; o martelo exibido continua sendo `endsAt`. Documentar no README.
- **Duas instâncias da API:** `SKIP LOCKED` evita liquidar em dobro (Socket.IO multi-instância segue fora de escopo).
- **Ciclo da rotina maior que 5 s:** `sweep` não reentra (flag em execução); o próximo tick é pulado.
- **Erro na listagem de candidatos (Neon acordando, conexão caída):** logado; o `sweep` termina sem rejeitar e o próximo tick tenta de novo; a API não cai.
- **Shutdown:** `stop()` limpa o timer, faz `unref()` e espera o `sweep` em curso; nenhum lote fica meio liquidado (cada um é uma transação).
- **Visitante abre a Sala em `CLOSING`:** vê "Apurando o resultado…"; nenhum `GET` liquida.
- **Comprovante de lote cuja imagem não existe:** ilustração padrão.
- **Pseudônimo igual para dois licitantes no mesmo lote (colisão de 4 hex):** aceita; `iWon` vem do servidor (`myReceiptToken`), nunca da comparação de pseudônimos.
- **Valores no limite:** lance vencedor de R$ 10.000.000,00 e total de carteira de R$ 20.000.000,00 liquidam sem estourar `MAX_SAFE_INTEGER`.
- **`finalHash`:** igual a `lot.lastHash` no instante da liquidação; como a liquidação não escreve na cadeia, a S08 compara comprovante e selo sem ruído.

## 14. Testes exigidos

Integração (Vitest + Postgres real):
1. `settleLot` com lances: saldos (exemplo do PRD), ledger (1 SALE_DEBIT e 1 SALE_CREDIT com `totalAfter`/`committedAfter` corretos), `Receipt`, `settledAt`.
2. Sem lances: só `settledAt`.
3. Idempotência: `sweep` 3×; `Promise.all` de 10 `settleLot` + 3 `sweep`.
4. Fronteira: `Promise.all` lance × `sweep` com `FakeClock` em `endsAt`; e em `endsAt − 1 ms`.
5. Lote cancelado e lote com `settledAt` não são liquidados; lance em lote liquidado ⇒ `LOT_ENDED`.
6. Falha isolada: um lote quebrado não impede os demais.
7. Varredura de boot com lotes atrasados.
8. `GET /receipts/:token`: 200 sem dados pessoais (varredura por substring), 404 idêntico nos 3 casos de token ruim, `receiptCode`.
9. `GET /lots/:id`: `result`, `myReceiptToken` por papel.
10. `GET /my/lots`: `totalReceivedCents` e `resultado`.
11. Eventos: `lot:closed` uma vez, `wallet:updated` só para vencedor e leiloeiro, `showcase:lot` com status certo.
12. `lotStatus` unitário: `CLOSING` → `SOLD`/`UNSOLD` nas bordas `now == endsAt`.

Web (lógica pura): variação sobre a FIPE (arredondamento, sinal, vírgula), `receiptCode` (padding), decisão de estado da Sala (apurando/arrematou/não venceu/sem lances) a partir de `LotState`, copiar link (sucesso/falha) com clipboard simulado.

## 15. Retrofits e integrações

| Onde | Mudança |
| --- | --- |
| S02 `LotState`, `GET /my/lots`, `LotCard` | Campos `result`, `myReceiptToken`, `resultado`, `totalReceivedCents`; `LotCard.status` já aceita `SOLD/UNSOLD/CLOSING`. |
| S02 Vitrine / Painel | Encerrados com carimbo e resultado; `CLOSING` em "Ao vivo". |
| S01 Carteira / extrato | Rótulo e linha de apoio de `SALE_DEBIT`. |
| S03 transação de lance | Recusar com `LOT_ENDED` se `settledAt != null`; `leadingLots` filtra `settledAt IS NULL AND cancelledAt IS NULL`. |
| S03 Sala | Esconde formulário em estados de encerramento (usa `ResultadoDoLote`). |
| S04 | Passa a receber `lot:closed`; Sala refaz `GET` ao recebê-lo e a cada 3 s em `CLOSING`. O reducer único é `applyLotEvent` (S04); `showcase:lot` carrega `version`. |
| Servidor | Composição liga `settlement-job.start()` após `listen` e roda `sweep()` no boot; desliga no shutdown. |
| S07 | `GET /me/bids` usa `Receipt.token` para `receiptToken` e `LotState.result` para WON/LOST. |
| S08 | Acrescenta "Verificar na auditoria"/"Auditar lote" no Comprovante, "Auditar este lote" na Sala; `verifyChain` compara `Receipt.finalHash` com `lastHash`; `lotCardHref` de encerrado passa para a Auditoria. |
| S09 | README: hibernação do Render, `settledAt` vs `endsAt`, link do comprovante de demonstração. |

## 16. Conflitos resolvidos e perguntas abertas

Conflitos resolvidos:
- **Martelo = `endsAt`, não `settledAt`:** a arquitetura define `settledAt` no `GET /receipts/:token` (data do comprovante). Com Render hibernado a liquidação pode ocorrer muito depois do fim e a data exibida enganaria. Resolvido: o DTO traz `hammerAt` (= `endsAt`) além de `settledAt`; a UI mostra o martelo. Adição aditiva ao contrato.
- **Convite "Entre para dar lances" no lote encerrado (visitante):** EXPERIENCE marcou "decisão a confirmar (P20)"; a recomendação autorizada do triagem é remover o convite e oferecer "Voltar à vitrine". Adotado o triagem.
- **Frase de saldo (P19):** o design dizia que o saldo "voltou" no encerramento; pelo PRD R8 o saldo volta no instante em que o lance é superado. Texto adotado: "Seu saldo foi liberado quando seu lance foi superado." e só para quem participou.
- **Quem venceu:** comparar pseudônimos no cliente é frágil (colisão de 4 hex aceita no README); o servidor decide por `myReceiptToken`.
- **Rotina com `SKIP LOCKED`:** a arquitetura descreve a busca já com `FOR UPDATE SKIP LOCKED`; para manter uma transação por lote, a rotina lista candidatos sem lock e cada `settleLot` adquire o lock com `SKIP LOCKED` e relê. Equivalente em garantias.

Perguntas abertas (nada bloqueia a fatia):
- Formato da comparação com a FIPE no Painel (`FIPE R$ X · +8,2%`) é sugestão minha a partir de "comparação com a FIPE" do EXPERIENCE (texto a revisar).
- Rótulo "LANCE FINAL" da placa no encerrado é sugestão (texto a revisar).
- Nota de privacidade do Comprovante é sugestão (texto a revisar).
- `<meta noindex>` no Comprovante é uma proteção barata que não vem das fontes; confirmar que não atrapalha a avaliação.
- O leiloeiro vê "Total recebido" mas não saldo de carteira: fechado nas fontes; nenhuma tela de carteira do leiloeiro.

## 17. Definition of Done

- [ ] Migração do `Receipt` aplicada no deploy (Neon) pelo start da API.
- [ ] Rotina ligada em produção (`start()` + varredura de boot); log mostra liquidações.
- [ ] Testes de §14 passando no CI, incluindo os de concorrência.
- [ ] Seed estendido com o lote arrematado (com prorrogação) e o sem lances, via services com `FakeClock`; cadeia válida.
- [ ] ACs [manual] percorridos no link público: Sala nos 4 estados, Comprovante em janela anônima nos dois temas, Painel, Vitrine, Carteira.
- [ ] Varredura de privacidade: nenhuma resposta de `/receipts`, `/lots/:id`, `/lots` contém e-mail ou nome de usuário.
- [ ] Nenhum link para a Auditoria foi adicionado (fica para a S08); sem links quebrados.
- [ ] README: nota sobre hibernação e `settledAt` (rascunho; fechamento na S09).
- [ ] Deploy atualizado e smoke no link público: lote de 5 min fechado de ponta a ponta com dois navegadores.
