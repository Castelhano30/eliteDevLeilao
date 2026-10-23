---
id: S02
titulo: Catálogo, criação de lote, vitrine e painel base
depende_de: [S00, S01]
cobre: [E2, E3, E12, O1, T1, T8, X1, X2, X3, X4, X5, X6, X7, DM-Item, DM-Lot, STAT, S3, S8]
parcial: [E4, E9, T3, T7, CLK, S2, S7, AC13, UX-RESP, UX-THEME, UX-A11Y]
fontes_de_origem: [PRD Regras/API pública/Telas/Seed, ARQ AD-3 AD-7 AD-8(genesis) AD-10 AD-12 AD-13, EXP Vitrine/Criar lote/Painel/Sala, DESIGN cartao-lote cronometro foto-veiculo etiqueta-lote, protótipos Vitrine/Painel/CriarLote só para microcopy]
---
# S02 — Catálogo, criação de lote, vitrine e painel base

## 1. Objetivo e demonstração

O leiloeiro escolhe um carro na Tabela FIPE, confere a foto sugerida da Wikipedia, agenda o lote e todo mundo (inclusive visitante) o vê na Vitrine e abre a Sala em modo leitura. Com a FIPE e a Wikipedia fora do ar, Vitrine e Sala seguem funcionando.

Roteiro de demonstração:
1. Visitante abre `/`: vê a Vitrine com o lote ao vivo (seed, 30 dias) e o agendado.
2. Digita "corolla" (ou "COROLLA") e filtra; escolhe a marca no select; troca a aba para Agendados; vê o vazio de filtro e clica "Limpar filtros".
3. Abre a Sala do lote ao vivo: ficha do carro, foto (ou ilustração), cronômetro, placa "LANCE INICIAL", "Nenhum lance ainda. O mínimo é o lance inicial."
4. Entra como leiloeiro (seed), vai a "Criar lote", escolhe marca → modelo → ano, vê "REFERÊNCIA FIPE" e a foto sugerida com crédito, preenche regras e clica "Agendar lote".
5. Volta ao Painel com a confirmação; o lote aparece em Agendados (Painel e Vitrine) e abre sozinho no horário.
6. Derruba a FIPE (env apontando para host morto): "Criar lote" mostra "A tabela FIPE não respondeu.", mas Vitrine e Sala continuam normais.

## 2. Fora desta fatia

| Item | Fatia |
|---|---|
| Tabela `Bid`, formulário de lance, histórico, posição, `myPseudonym` | S03 |
| Eventos Socket.IO, cartões e Painel atualizando sozinhos, aviso de prorrogação para todos | S04 |
| Liquidação, comprovante, `totalReceivedCents` ≠ 0, resultado por lote, carimbos de encerrado populados, Sala encerrada completa | S05 |
| Botão "Cancelar", diálogo, seção "Cancelados" no Painel, Sala cancelada com dados reais | S06 |
| Link "Auditar este lote", cartão encerrado apontando para a auditoria | S08 |
| Varredura final de acessibilidade, 404/erros globais padronizados, `/kit` fora de produção | S09 |
| Edição de lote agendado | Nunca (decisão do usuário) |
| Filtro por faixa de preço da Vitrine | Pergunta aberta Q1 |

## 3. Ponto de partida

Entregue por S00/S01 e usado aqui: monorepo; `apps/api` com `env.ts`, `Clock`/`FakeClock`, `AppError` + handler do envelope, `Publisher`/`NoopPublisher`, rate-limit utilitário, Prisma configurado, `modules/auth` (`requireAuth`, `requireRole`, JWT), tabelas `User`/`Wallet`/`LedgerEntry`; `packages/shared` com `ErrorCode`, `money`; `apps/web` com tokens/temas, fontes, `apiClient`, TanStack Query, primitivos (`Logo`, `Button`, `Field`, `RefusalMessage`, `FeedbackState`, `Stamp`, `LotTag`, `Perforation`, `DataTable`, `FilterTabs`, `Dialog`, `IdentityChip`, `PageShell`), `Header` por papel, guardas de rota, `homeFor(role)`, stub de `/painel`.

Se `optionalAuth` (lê o token se vier, não exige) não existir em `modules/auth/middleware`, crie-o aqui.

**Invariantes que valem aqui**
- INV-1 Servidor é a fonte de verdade de tempo e valores; relógio da tela = `Date.now()+offset`.
- INV-2 Dinheiro em centavos (`BigInt` no banco, `number` nas bordas, assert ≤ `MAX_SAFE_INTEGER` nos mappers; campos `…Cents`). UI só reais inteiros `R$ 31.000,00` em IBM Plex Mono.
- INV-3 Datas ISO UTC com `Z`; `new Date()`/`Date.now()` só em `infra/clock.ts`; UI em America/Sao_Paulo.
- INV-11 `lotStatus(lot, now)` é função pura em `packages/shared`; telas nunca recalculam status por conta própria.
- INV-12 (parte genesis/seal) `genesis`/`seal` calculados na criação do lote.
- INV-14 Vitrine, Sala (e Auditoria/Comprovante) leem só o banco; só `/catalog/*` e `POST /lots` chamam FIPE/Wikipedia.
- INV-15/16/17/18 papel único; envelope de erro com `serverTime` nos estados de lote; contratos em `shared`; voz do pátio (sem exclamação/emoji, motivo + valor).

## 4. Regras de negócio

| # | Regra | Origem |
|---|---|---|
| R-2.1 | Só o back-end chama FIPE e Wikipedia; o front nunca. Cache em memória (`Map`) por URL, TTL 24 h; se a chamada falhar e houver entrada vencida, serve a vencida (loga `warn`); sem entrada → `503 EXTERNAL_UNAVAILABLE`. Chamadas simultâneas à mesma chave compartilham uma só requisição (single-flight). | PRD API/Gestão · AD-12 |
| R-2.2 | Chamada externa: timeout 4 s, 2 tentativas (1 repetição) só em erro de rede, timeout, 429 ou 5xx; 404 e demais 4xx não repetem. Base e token em env (`FIPE_BASE_URL`, `FIPE_TOKEN?`, `WIKI_USER_AGENT`). | PRD · AD-12 |
| R-2.3 | `POST /lots` busca o detalhe do carro na FIPE de novo (via cache) pelos ids `brandId/modelId/yearId`; nunca confia em dados do carro vindos do cliente. Grava o snapshot completo em `Item` (inclui `rawData` e a imagem). | PRD fluxo passo 4 |
| R-2.4 | A imagem é baixada no momento da criação, também quando a URL foi digitada pelo leiloeiro, e guardada em `Item.imageData`. Falha no download → lote criado sem imagem (`imageStatus: "FAILED"`); a Sala/Vitrine usam a ilustração padrão. "Sem foto" → sem `imageUrl` → `imageStatus: "NONE"`. | PRD X3 · AD-12 |
| R-2.5 | Download seguro: só `http`/`https` nas portas 80/443; antes de conectar, resolve o DNS e recusa endereço não público (ver §5.3); revalida em cada redirecionamento (máx. 3); timeout 4 s; para a leitura ao passar de 2 MB; `Content-Type` precisa ser `image/jpeg`, `image/png`, `image/webp` ou `image/gif` (SVG recusado); sempre envia `User-Agent: WIKI_USER_AGENT`. | AD-12 (SVG fora por endurecimento) |
| R-2.6 | Nenhuma chamada HTTP externa e nenhum download acontecem dentro de transação do banco. A transação de `POST /lots` só insere `Item` e `Lot`. | AD-2 (boa prática) |
| R-2.7 | O leiloeiro cria lote com: carro (3 ids), título, lance inicial ≥ R$ 1,00, incremento mínimo ≥ R$ 1,00, início, fim, imagem opcional. `endsAt − startsAt ≥ 5 min`; `startsAt ≥ agora − 60 s`. Início dentro da tolerância e já passado → o lote nasce ao vivo. `originalEndsAt = endsAt`. | AD (POST /lots) · PRD |
| R-2.8 | O lote nasce sem lances: `currentBidCents = null`, `leaderId = null`, `bidCount = 0`, `entryCount = 0`, `lastHash = genesis`, `seal = HMAC(seal, entryCount 0, genesis)`. | AD-8 |
| R-2.9 | Edição de lote agendado não existe: não há rota nem tela de edição. | Decisão do usuário |
| R-2.10 | Status é calculado: `lotStatus` (ver §6.0). Nenhum processo "abre" lotes. | PRD STAT · AD-7 |
| R-2.11 | Lote cancelado nunca aparece em `GET /lots` (Vitrine), mas `GET /lots/:id` responde para cancelado e agendado. Só `GET /my/lots` lista cancelados (para o dono). | PRD R14 · AD |
| R-2.12 | Vitrine, Sala e Painel não dependem das APIs externas; só Criar lote mostra erro de FIPE. | PRD X2/X5 |
| R-2.13 | Busca ignora caixa e acento e procura em título, marca, modelo e ano; vários termos = todos precisam aparecer. Marcas do filtro vêm dos lotes existentes. | EXP P23 |
| R-2.14 | Preço e saldo são simulados; a UI diz isso no rodapé da Vitrine. | EXP Vitrine |

## 5. Modelo de dados

Migração `lots_and_items` (depois da migração de S01). **Não criar ainda:** `Bid`, `Receipt` (S03, S05).

### 5.1 Prisma

```prisma
model Item {
  id                  String   @id @default(uuid())
  source              String   // "FIPE"
  externalId          String   // "{codeFipe}-{yearId}", ex. "002118-8-2015-1"
  brand               String   // nome limpo, ver cleanBrand
  model               String
  year                Int
  fuel                String
  referencePriceCents BigInt
  referenceMonth      String   // "YYYY-MM"; a UI mostra "OUT/2026"
  imageData           Bytes?
  imageMime           String?
  imageCredit         String?
  imageCreditUrl      String?
  rawData             Json     // resposta bruta do detalhe da FIPE
  fetchedAt           DateTime
  lots                Lot[]
}

model Lot {
  id                String    @id @default(uuid())
  number            Int       @unique @default(autoincrement())
  auctioneerId      String
  auctioneer        User      @relation("LotAuctioneer", fields: [auctioneerId], references: [id])
  itemId            String
  item              Item      @relation(fields: [itemId], references: [id])
  title             String
  searchText        String    // minúsculo, sem acento: título + marca + modelo + ano
  startingBidCents  BigInt
  minIncrementCents BigInt
  startsAt          DateTime
  endsAt            DateTime
  originalEndsAt    DateTime
  currentBidCents   BigInt?
  leaderId          String?
  leader            User?     @relation("LotLeader", fields: [leaderId], references: [id])
  bidCount          Int       @default(0)
  entryCount        Int       @default(0)
  lastHash          String
  seal              String
  cancelledAt       DateTime?
  settledAt         DateTime?
  createdAt         DateTime  @default(now())
  @@index([endsAt])
  @@index([auctioneerId])
}
```

Em `User` (S01) acrescente os lados inversos: `lotsAuctioned Lot[] @relation("LotAuctioneer")` e `lotsLeading Lot[] @relation("LotLeader")`. Colunas `DateTime` são `timestamp(3)`; `BigInt` converte para `number` só nos mappers.

CHECKs na migração (endurecimento, não mudam regra): `"startingBidCents" >= 100`, `"minIncrementCents" >= 100`, `"endsAt" > "startsAt"`, `"originalEndsAt" >= "startsAt"`.

### 5.2 Funções puras (em `domain/` e `packages/shared`)

- `cleanBrand(name)`: se o nome da FIPE contém `" - "`, fica a parte depois do último `" - "` ("VW - VolksWagen" → "VolksWagen", "GM - Chevrolet" → "Chevrolet"); `trim`.
- `normalizeSearch(s)`: `NFD`, remove marcas combinantes (`\p{M}`), minúsculas, colapsa espaços.
- `searchText = normalizeSearch(title + " " + brand + " " + model + " " + year)`.
- `parseBRL("R$ 45.000,00") → 4500000` (remove tudo menos dígitos e vírgula; vírgula vira separador de centavos).
- `parseReferenceMonth("outubro de 2026") → "2026-10"`; se não reconhecer, grava o texto cru; `formatReferenceMonth("2026-10") → "OUT/2026"`.
- `formatLotNumber(n) → "018"` (3 dígitos, mais se precisar).
- `wikiTitleCandidates(brand, model)`: marca limpa + primeiro token do modelo que não contenha dígito e não seja motor/versão (ex.: "Gol 1.0 MPI" → "Gol"; "Corolla XEi 2.0" → "Corolla"). Candidatos em ordem: `"{marca} {token}"`, `"{token}"`. Título na URL: espaços viram `_`, `encodeURIComponent`.
- Em `packages/shared`: `lotStatus` (abaixo), `brasiliaLocalToUtcIso("2026-10-25T10:00") → "2026-10-25T13:00:00.000Z"` e `utcIsoToBrasiliaLocal` (offset fixo −03:00; o Brasil não tem horário de verão desde 2019), `formatBrasilia(iso, "list"|"seconds")`.
- `genesisHash(key, lot)` e `sealHash(key, lotId, entryCount, lastHash)` em `domain/audit-chain.ts` (formatos de INV-12; `at`/`startsAt` em ISO UTC com ms).

### 5.3 Endereços recusados no download (R-2.5)

IPv4: `0.0.0.0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16` (inclui metadata de nuvem), `172.16/12`, `192.0.0.0/24`, `192.168/16`, `198.18/15`, `224/4`, `240/4`. IPv6: `::`, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, e `::ffff:a.b.c.d` com IPv4 acima. Implemente com `lookup` customizado no agente HTTP (valida o IP efetivamente usado na conexão, para não cair em troca de DNS entre checagem e uso).

### 5.4 `lotStatus` (shared, puro)

```ts
type LotStatus = 'CANCELLED'|'SCHEDULED'|'LIVE'|'CLOSING'|'SOLD'|'UNSOLD'
lotStatus(lot:{startsAt,endsAt,cancelledAt,settledAt,bidCount}, now): LotStatus
// 1 cancelledAt != null → CANCELLED
// 2 now <  startsAt     → SCHEDULED
// 3 now <  endsAt       → LIVE            (now == startsAt é LIVE; now == endsAt NÃO é LIVE)
// 4 settledAt == null   → CLOSING
// 5 bidCount > 0        → SOLD
// 6 senão               → UNSOLD
```
Aceita `Date` ou string ISO. Vocabulário de UX: SCHEDULED=Agendado, LIVE=Ao vivo, CLOSING="apurando" (mostra "Ao vivo/00:00"), SOLD=Arrematado, UNSOLD=Sem lances, CANCELLED=Cancelado.

## 6. Contratos REST

Erros no envelope `{error:{code,message,details?}}`. `ROLE_NOT_ALLOWED` fora de lance usa o texto "Só leiloeiros fazem isso." (texto a revisar). Toda resposta de estado inclui `serverTime` (ISO UTC com ms).

### 6.0 DTOs (em `packages/shared`, com schema zod de entrada)

```ts
LotCard = {
  id, number, title, brand, model, year, fuel, status: LotStatus,
  currentBidCents: number|null, startingBidCents, minIncrementCents, referencePriceCents,
  bidCount, startsAt, endsAt, originalEndsAt, cancelledAt: string|null,
  imageUrl: string|null            // caminho relativo "/items/{itemId}/image"; null se não há imagem
}
LotState = {
  serverTime,
  lot: { id, number, title, status, startingBidCents, minIncrementCents, currentBidCents: number|null,
         minimumNextCents,         // currentBidCents? current+minIncrement : startingBid
         bidCount, entryCount, startsAt, endsAt, originalEndsAt, cancelledAt|null, settledAt|null },
  car: { brand, model, year, fuel, referencePriceCents, referenceMonth /*"YYYY-MM"*/,
         imageUrl|null, imageCredit|null, imageCreditUrl|null },
  bids: []                          // vazio até a S03
}
```
`imageUrl` é relativo; o front prefixa com `NEXT_PUBLIC_API_URL` (`assetUrl()`). `LotCard`/`LotState` acrescentam campos às definições da arquitetura (fuel, model, referencePriceCents, minIncrementCents, originalEndsAt, cancelledAt, minimumNextCents) porque as telas desta fatia precisam deles.

### 6.1 Catálogo (papel AUCTIONEER; 401 `UNAUTHENTICATED`, 403 `ROLE_NOT_ALLOWED`)

Rate-limit de 120 req/min por usuário no prefixo `/catalog`.

| Rota | Resposta 200 | Erros |
|---|---|---|
| `GET /catalog/brands` | `{ items: [{id, name}] }` (marcas, nome limpo na apresentação; ordenado por nome pt-BR) | 503 `EXTERNAL_UNAVAILABLE {source:"FIPE"}` |
| `GET /catalog/brands/:brandId/models` | `{ items: [{id, name}] }` | 503 FIPE; 404 `NOT_FOUND` |
| `GET /catalog/brands/:brandId/models/:modelId/years` | `{ items: [{id, name}] }`, ex. `{id:"2015-1", name:"2015 Gasolina"}`; remove "Zero Km" (`32000-*`, sem ano) | 503 FIPE; 404 |
| `GET /catalog/preview?brand=&model=&year=` | `{ car:{brand,model,year,fuel,referencePriceCents,referenceMonth,codeFipe}, suggestedImage?:{url,credit,creditUrl}, imageStatus:"FOUND"\|"NOT_FOUND"\|"UNAVAILABLE" }` | 503 FIPE (a FIPE é obrigatória); 404 se o id não existe |

Notas: a arquitetura listava `/models/:m/years` sem a marca; a FIPE exige marca e modelo, por isso a rota ficou com os dois ids. Falha da Wikipedia **não** é erro: `imageStatus:"UNAVAILABLE"` (rede) ou `"NOT_FOUND"` (sem artigo/foto), sem `suggestedImage`, e o `car` segue válido.

**Adaptador FIPE** (`infra/fipe.ts`): base `FIPE_BASE_URL` (padrão `https://fipe.parallelum.com.br/api/v2`), veículo `cars`, cabeçalho `X-Subscription-Token` se `FIPE_TOKEN` existir. Endpoints: `/cars/brands`, `/cars/brands/{b}/models`, `/cars/brands/{b}/models/{m}/years`, `/cars/brands/{b}/models/{m}/years/{y}`. Os formatos de resposta (`code`/`name`, e no detalhe `brand, model, modelYear, fuel, codeFipe, price, referenceMonth`) **[ASSUMPTION a conferir no dia 1 contra a API real]**; o adaptador normaliza para o formato interno acima e é o único lugar que conhece o formato da FIPE.

**Adaptador Wikipedia** (`infra/wikipedia.ts`): `GET https://pt.wikipedia.org/api/rest_v1/page/summary/{título}` com `User-Agent: WIKI_USER_AGENT` e `Accept: application/json`; tenta os candidatos de `wikiTitleCandidates` na ordem; ignora resposta com `type: "disambiguation"` ou sem imagem; URL sugerida = `originalimage.source` se `originalimage.width ≤ 2400`, senão `thumbnail.source`; `credit` = `Foto: Wikipedia, artigo "{title}" (licença Creative Commons, veja a página do artigo)`; `creditUrl` = `content_urls.desktop.page`. Cache e single-flight iguais aos da FIPE; "não achou" também é cacheado por 24 h.

### 6.2 Lotes

| Rota | Papel | Corpo → resposta | Erros |
|---|---|---|---|
| `POST /lots` | AUCTIONEER | `{brandId, modelId, yearId, title, startingBidCents, minIncrementCents, startsAt, endsAt, imageUrl?, imageCredit?, imageCreditUrl?}` → `201 { ...LotState, imageStatus:"STORED"\|"NONE"\|"FAILED" }` | 400 `VALIDATION {fields}`, 401, 403 `ROLE_NOT_ALLOWED`, 404 `NOT_FOUND` (ids FIPE inexistentes), 503 `EXTERNAL_UNAVAILABLE {source:"FIPE"}` |
| `GET /lots?status&q&brand` | público | `200 { lots: LotCard[], brands: string[], counts:{live,scheduled,ended}, serverTime }` | 400 `VALIDATION` |
| `GET /lots/:id` | público (token opcional, ignorado nesta fatia) | `200 LotState` | 404 `NOT_FOUND` (id inexistente ou malformado) |
| `GET /my/lots` | AUCTIONEER | `200 { lots: LotCard[], totalReceivedCents: 0, serverTime }` (inclui cancelados; só os do chamador) | 401, 403 |
| `GET /items/:id/image` | público | bytes com `Content-Type` salvo; `Cache-Control: public, max-age=31536000, immutable`; `ETag`; `Cross-Origin-Resource-Policy: cross-origin`; `X-Content-Type-Options: nosniff` | 404 `NOT_FOUND` se não há imagem |

**Ordem do `POST /lots`:** (1) `requireAuth` + `requireRole(AUCTIONEER)`; (2) zod do corpo; (3) regras de data com `clock.now()` (erros aqui vêm antes de qualquer chamada externa); (4) detalhe da FIPE (via cache); (5) se `imageUrl`, download seguro (falha não derruba); (6) transação: gera `lotId` (uuid), calcula `genesis`/`seal`, insere `Item` e `Lot`; (7) 201. `Item.fetchedAt = clock.now()`; `source="FIPE"`; `externalId="{codeFipe}-{yearId}"`; `referencePriceCents=parseBRL(price)`; `year` = ano do `yearId`; `brand=cleanBrand(...)`. `imageCredit`/`imageCreditUrl` gravados como vieram do corpo (≤ 200 e ≤ 500 caracteres); sem imagem armazenada, ficam `null`.

**Validação (`details.fields`, mensagens exatas):**

| Campo | Regra | Mensagem |
|---|---|---|
| `brandId`,`modelId`,`yearId` | obrigatórios, não vazios | "Escolha marca, modelo e ano." |
| `title` | `trim`, 1–120 caracteres | "Dê um título ao lote." / "O título aceita até 120 caracteres." |
| `startingBidCents` | inteiro ≥ 100 | "O lance inicial precisa ser de pelo menos R$ 1,00." |
| `minIncrementCents` | inteiro ≥ 100 | "O incremento precisa ser de pelo menos R$ 1,00." |
| `startsAt` | ISO UTC com `Z`; ≥ agora − 60 s | "Informe o início." / "O início não pode estar no passado." |
| `endsAt` | ISO UTC com `Z`; ≥ `startsAt` + 5 min | "Informe o fim." / "O fim precisa ser pelo menos 5 minutos depois do início." |
| `imageUrl` | opcional; URL `http`/`https` válida, ≤ 2048 | "Use um endereço http ou https válido." |
| `imageCredit` | opcional, ≤ 200 | "O crédito aceita até 200 caracteres." |

Valores monetários fora de inteiro (`1.5`, texto) → mensagem do campo correspondente. Os limites de 120 caracteres do título e de 2048/200/500 das imagens são defensivos (o PRD não fixa).

**`GET /lots`:** `status` ∈ `LIVE` (= LIVE + CLOSING), `SCHEDULED`, `ENDED` (= SOLD + UNSOLD); ausente = todos; outro valor → `VALIDATION {fields:{status}}`. `q` é truncado em 100 caracteres, normalizado e dividido em termos (`searchText contains` de cada um). `brand` compara com `Item.brand` exato; marca sem lote → lista vazia, não erro. Sempre exclui `cancelledAt != null`. Condições SQL equivalentes a `lotStatus` com `now = clock.now()`: LIVE `startsAt <= now < endsAt`; CLOSING `endsAt <= now AND settledAt IS NULL`; ENDED `settledAt IS NOT NULL`; SCHEDULED `now < startsAt`. Ordem de saída: ao vivo (`endsAt ↑`), agendados (`startsAt ↑`), encerrados (`endsAt ↓`); teto defensivo de 200 linhas (sem paginação). `brands` = marcas distintas dos lotes não cancelados (independe de `status` e `q`), ordem alfabética pt-BR. `counts` = totais por grupo, também sem aplicar `status`/`q`/`brand` (alimenta a barra "Pátio aberto"): `live` = LIVE + CLOSING, `scheduled`, `ended`. Os `LotCard` são montados passando cada linha por `lotStatus`.

**`GET /my/lots`:** ordem ao vivo, agendados, encerrados, cancelados (`cancelledAt ↓`) no fim. `totalReceivedCents` é sempre `0` até a S05 (soma dos `SALE_CREDIT` do usuário).

## 7. Contratos Socket.IO

Nenhum nesta fatia. Telas se atualizam por `GET` (ao montar, ao voltar o foco da janela e, na Sala/Vitrine/Painel, uma vez quando um cronômetro chega a 00:00).

## 8. Mensagens

| Código · HTTP | Texto | Onde |
|---|---|---|
| `EXTERNAL_UNAVAILABLE` 503 `{source:"FIPE"}` | "A tabela FIPE não respondeu." | Criar lote (banner) |
| — (corpo do banner) | "Tente de novo em instantes. O resto do formulário continua aqui, do jeito que você deixou." | Criar lote |
| `NOT_FOUND` 404 | "Lote não encontrado." (título) · "Esse lote não existe, ou já foi para a gaveta." (texto a revisar) | Sala |
| `ROLE_NOT_ALLOWED` 403 | "Só leiloeiros fazem isso." | API; no web, aviso de papel errado (guarda de S01) |
| `VALIDATION` 400 | mensagens por campo da tabela de §6.2 | Criar lote |
| M4 `LOT_NOT_STARTED` (referência para S03) | "Este lote abre em 24/10 às 14:00." (PRD) — na Sala agendada usa-se o texto de §9 | Sala agendada |
| M6 `LOT_CANCELLED` (referência para S03) | "O leiloeiro cancelou este lote. Nada foi vendido e todo saldo travado voltou." (texto a revisar) | Sala cancelada |

## 9. Telas e estados

Todas as telas: `lang="pt-BR"`, skip-link, landmarks `header`/`nav`(aria-label por papel)/`main`, alvos ≥ 44 px, foco visível, cores só por token, os dois temas. Valores em Plex Mono, "Licitante XXXX" nunca aparece aqui (sem lances).

### 9.1 Vitrine — `/` (T1, todos; SSR)

SSR: o servidor chama `GET /lots` sem token (`cache: 'no-store'`) e hidrata o TanStack Query; se o fetch no servidor falhar, a página renderiza o esqueleto com `FeedbackState` de erro e o cliente tenta de novo.

Estrutura, de cima para baixo:
1. **Barra "Pátio aberto"** (`counts` sem filtro): ponto pulsante + "Pátio aberto" · "N lote(s) ao vivo" · "N agendado(s)" · data e hora de Brasília pelo relógio do servidor, formato "Qui 22/out · 18:47", atualizada a cada minuto.
2. **Hero:** título `display-hero` caixa-alta: "Quem dá mais, leva." e, em corpo `body`, "Quem hesita, assiste."; lead `body-lead`: "Lotes montados a partir da Tabela FIPE, lances ao vivo com saldo de mentira e um comprovante que qualquer pessoa confere. Até quem não tem conta."; nota `body-nota`: "Referência: Tabela FIPE. Nenhum carro de verdade troca de dono aqui."
3. **"Como funciona"** (âncora `#como-funciona`, link no cabeçalho do visitante): título de seção "Como funciona", subtítulo "3 passos, nenhum formulário de 12 páginas", 3 `Canhoto` (grid `repeat(auto-fit, minmax(min(100%,300px),1fr))`, gap 24). Textos sugeridos (todos **texto a revisar**):
   - **01 · Crie a conta e deposite** — "Escolha ser licitante, deposite saldo de mentira (até R$ 10 milhões por vez) e fique com o dinheiro à mão."
   - **02 · Dê o seu lance** — "Cada lote tem lance inicial e incremento mínimo. Lance nos 2 minutos finais estica o relógio em +2 min."
   - **03 · Leve e confira** — "Maior lance quando o martelo bate leva o carro e ganha um comprovante com link. Qualquer pessoa audita o histórico, sem login."
4. **Filtros:** campo "Buscar" (48 px, `type=search`), select "Marca" (48 px; "Todas" + `brands`), `FilterTabs` Todos / Ao vivo / Agendados / Encerrados (`aria-pressed`, sem contador). Aplicam enquanto o usuário digita/seleciona (debounce 250 ms, mantém a lista anterior enquanto carrega); nada vai para a URL.
5. **Seções** (cada uma some se vazia sob filtro): **Ao vivo** — subtítulo "Lance nos 2 min finais estica o prazo em +2 min"; **Agendados** — "Dá para olhar. Lance, só na abertura."; **Encerrados** — "Todo histórico é auditável. Sem login." Cabeçalho da seção: `display-secao` + contador mono "NN LOTE(S)" refletindo o filtro (`01 LOTE`, `02 LOTES`). Grade de `LotCard`: `repeat(auto-fill, minmax(min(100%,330px),1fr))`, gap 40/32 (3 colunas em 1440 px, 1 em 390 px). "Ao vivo" contém LIVE e CLOSING.
6. **Rodapé:** "Lotes cancelados não aparecem aqui. Nem em sonho." e "Preços de referência: Tabela FIPE · saldo 100% simulado".

| Estado | Tratamento |
|---|---|
| Padrão | seções conforme `lots` |
| Filtro sem resultado | `FeedbackState` tracejado: título "Pátio vazio", texto "Nada com esse filtro. Afrouxe a busca ou volte quando o leiloeiro acordar." + botão secundário "Limpar filtros" (zera busca, marca e aba) |
| Nenhum lote publicado (`counts` todos 0 e sem filtro) | `FeedbackState`: "O pátio está vazio." + "Nenhum lote publicado por enquanto." **sem** "Limpar filtros" |
| Carregando (troca de filtro) | mantém a lista anterior com `aria-busy="true"`; primeira carga: `FeedbackState` "Carregando…" ocupando o espaço |
| Erro de carga | `FeedbackState` erro (ferrugem + texto) "Não consegui trazer os lotes." + "Tentar novamente" (texto a revisar); se havia dados antes, mantém-nos marcados "dados desatualizados" |
| FIPE/Wikipedia fora | sem efeito |
| Cronômetro chega a 00:00 | o cartão mostra "ENCERRADO"/"Apurando…"; uma vez, 1 s depois, refaz `GET /lots` (o cartão só troca de seção quando o servidor confirmar) |
| Foco da janela volta | refaz `GET /lots` |

`lotCardHref(card)`: ao vivo e agendado → `/lotes/{id}`; encerrado → `/lotes/{id}` **por enquanto** (a S08 troca para `/lotes/{id}/auditoria`). Cancelado nunca aparece.

Cabeçalho: visitante vê "Como funciona" (âncora), "Entrar" e "Criar conta"; licitante e leiloeiro seguem o `Header` de S01 com o item "Vitrine" ativo.

### 9.2 Sala do lote — somente leitura — `/lotes/[id]` (T3, todos; SSR)

SSR busca `GET /lots/:id` (sem token); cliente hidrata e, depois, refaz o `GET` ao voltar o foco e quando o cronômetro cruza um limite (início ou fim). Layout: duas colunas fluidas (`flex: 1 1 520px` ficha à esquerda; `flex: 1 1 440px`, máx. 560 px, painel à direita), gap 36; no celular empilha (ficha primeiro, painel depois, pela ordem do DOM). Contêiner 1320 px, gutter `clamp(16px,4vw,56px)`.

**Coluna esquerda (ficha do carro):** `CarPhoto` (16:9, `contain`), crédito em legenda abaixo ("Foto: Wikipedia, artigo …" com link; só quando há `imageCredit`), `dl` auto-fit `minmax(min(100%,220px),1fr)` com Marca, Modelo, Ano, Combustível, "Preço de referência" (mono, `R$ …,00`), e a linha mono "FONTE: TABELA FIPE · OUT/2026" (mês do snapshot). Nenhuma chamada à FIPE.

**Coluna direita (painel):** `LotTag` (número) + título `h1` (`clamp(48px,7vw,104px)`, lh .84, caixa-alta) + selo "Ao vivo" quando LIVE. Abaixo, conforme estado:

| Estado | Tratamento |
|---|---|
| **Agendado** (`SCHEDULED`) | Etiqueta ocre. Frase: "Este lote abre em DD/MM às HH:mm (Brasília)." (mono nos números). `Cronometro` com rótulo "ABRE EM" contando até `startsAt` (formato de §10.3). Linhas: "Lance inicial R$ X,00 · Incremento R$ Y,00 · Fecha DD/MM às HH:mm (Brasília)". Sem formulário. Quando o relógio chega a `startsAt`, refaz o `GET` e passa para "Ao vivo". |
| **Ao vivo, sem lances** (`LIVE`, `currentBidCents = null`) | Selo "Ao vivo"; `PlacaLance` com rótulo "LANCE INICIAL" e o lance inicial; contador mono "00 LANCES"; `Cronometro` rótulo "TEMPO RESTANTE"; texto "Nenhum lance ainda. O mínimo é o lance inicial." (mono no valor: "Mínimo aceito R$ X,00 · incremento R$ Y,00"); caixa de histórico vazia. **Sem formulário** (a S03 insere o painel de lance abaixo do cronômetro). |
| **Ao vivo, com lance** (defensivo; a S03 popula) | `PlacaLance` rótulo "LANCE ATUAL" com `currentBidCents`; contador "NN LANCES". |
| **Últimos 2 min / Prorrogado** | variantes do `Cronometro` (§10.3); o aviso textual de prorrogação para todos é da S04. |
| **Apurando** (`CLOSING`) | `Cronometro` encerrado "00:00 / ENCERRADO"; texto "Martelo batido. Apurando o resultado…"; sem formulário. A tela refaz `GET` a cada 3 s enquanto estiver nesse estado. |
| **Encerrado** (`SOLD`/`UNSOLD`) | invólucro neutro: `Cronometro` encerrado e `Stamp` (Arrematado ou Sem lances) com o lance final; o conteúdo completo (faixas, frases, comprovante) é da S05. |
| **Cancelado** (`CANCELLED`) | `Stamp` "Cancelado" (cor `tinta2`, não "Ao vivo"), sem cronômetro nem lance; texto "O leiloeiro cancelou este lote. Nada foi vendido e todo saldo travado voltou." (texto a revisar) + botão secundário "Voltar à vitrine". A URL responde mesmo cancelado. |
| Visitante / licitante / leiloeiro | nesta fatia a Sala é igual para todos (sem formulário). |
| Lote inexistente | `FeedbackState`: "Lote não encontrado." + "Esse lote não existe, ou já foi para a gaveta." + botão "Voltar à vitrine". Sem expor id nem detalhe interno. |
| Carregando / erro de rede | `FeedbackState` "Carregando…" / erro com "Tentar novamente"; dados anteriores ficam visíveis marcados como desatualizados |
| Sem foto | ilustração padrão + legenda "Pintado à mão pelo pátio: o leiloeiro não mandou foto" |
| Foto quebrada (`onError`) | ilustração padrão + nota "Imagem ilustrativa" |

### 9.3 Criar lote — `/painel/criar-lote` (T8, AUCTIONEER)

Cabeçalho da página: trilha "PAINEL / CRIAR LOTE", título "Criar lote", `LotTag` com texto "NOVO" (se o `LotTag` de S00 só aceita número, aceite `number: number | string`), subtítulo "Escolha o carro na Tabela FIPE, ajuste as regras e solte no pátio." Três grupos numerados em ordem: **01 O carro**, **02 A imagem**, **03 As regras**; ao lado (ou abaixo no celular) a prévia **"Assim ele aparece na Vitrine"**. Reflow por `flex-wrap`; sem media queries de largura.

**01 O carro:** indicador de status da FIPE (live region `polite`): "TABELA FIPE CONECTADA" (verde), "CONSULTANDO A FIPE…" (tinta2, pulsa) ou "FIPE FORA DO AR" (ferrugem, pulsa). Selects (48 px, rótulo mono): "1 · MARCA", "2 · MODELO", "3 · ANO / COMBUSTÍVEL". Trocar a marca zera modelo e ano; trocar o modelo zera o ano. Cada select só carrega depois do anterior. Escolhido o ano, chama `/catalog/preview` e mostra a caixa "REFERÊNCIA FIPE · OUT/2026" com `R$ …,00` (mês do snapshot, vindo do preview). Respostas atrasadas de uma seleção antiga são descartadas (AbortController).

**02 A imagem:** campo "URL DA IMAGEM · SUGERIDA AUTOMATICAMENTE" (preenche sozinho com `suggestedImage.url`, editável), campo "CRÉDITO DA IMAGEM" (preenche com `credit`), caixa "Sem foto. Usar a ilustração padrão do pátio." (checkbox): marcada, desabilita a URL e o crédito (`opacity .5`) e envia sem `imageUrl`. Se o usuário já editou a URL/crédito, uma sugestão nova **não** sobrescreve. Enquanto busca: "Buscando imagem…". Se `imageStatus ≠ FOUND`: `FeedbackState` neutro "Não encontramos uma foto. Cole uma URL ou use a ilustração do pátio." (a seleção da FIPE continua válida e o botão não é bloqueado).

**03 As regras:** "TÍTULO DO LOTE" (pré-preenche com "{Modelo} {Ano}" ao escolher o ano, enquanto o usuário não editou), "LANCE INICIAL · R$" e "INCREMENTO MÍNIMO · R$" (máscara: só dígitos, milhar com ponto, ",00" fixo; envia centavos), "INÍCIO" e "FIM" (`datetime-local`, rótulos terminam em "(horário de Brasília)"; o valor digitado é convertido com `brasiliaLocalToUtcIso`). Nota: "Lance nos 2 minutos finais estica o fim em +2 min." (a frase do protótipo sobre não poder cancelar com lance foi removida: cancelar com lances é permitido).

**Prévia:** um `LotCard` agendado **não clicável** (`div`, sem `<a>`) que acompanha os campos: título, imagem (a URL digitada, `referrerpolicy="no-referrer"`; ilustração se vazia/"sem foto"), meta "{ano} · {combustível} · FIPE R$ X", "LANCE INICIAL R$ X,00", "ABERTURA" com dia/hora de `startsAt`, crédito abaixo. Sem carro: título "Carro a definir", meta "— · — · FIPE —", ilustração e texto "Sem carro escolhido. A FIPE está de folga." Etiqueta "NOVO" (o número só existe depois de criado).

Rodapé do formulário: botão primário **"Agendar lote"** (único ocre) e link "Voltar ao painel sem salvar"; nota "Ele aparece em “Agendados” e abre sozinho no horário marcado."

| Estado | Tratamento |
|---|---|
| FIPE conectada | como acima |
| Consultando | indicador "CONSULTANDO A FIPE…"; botão de repetição "Consultando…" inerte; selects dependentes desabilitados até chegar |
| **FIPE fora do ar** (qualquer chamada `/catalog/*` ou `/preview` falha com 503) | indicador "FIPE FORA DO AR"; banner `role="alert"` (borda tracejada ferrugem): título "A tabela FIPE não respondeu.", texto "Tente de novo em instantes. O resto do formulário continua aqui, do jeito que você deixou.", botão secundário "Tentar de novo" (refaz **a chamada que falhou**); selects desabilitados (`opacity .5`, borda tracejada); prévia "Carro a definir"; botão `desabilitado` "Agendar lote" com nota "Sem marca, modelo e ano não tem lote. O resto já está guardado."; título, regras, datas e imagem continuam editáveis e **preservados** |
| Falha repetida | volta ao estado acima sem apagar nada |
| Erros de campo | no envio, valida no cliente com as mesmas regras de §6.2 e mostra erro junto ao campo (`aria-invalid`, `aria-describedby`, borda ferrugem); mais de um erro → alerta-resumo no topo do formulário "Corrija os campos marcados."; foco vai ao primeiro inválido; o valor digitado permanece. Erros `VALIDATION` do servidor entram nos mesmos campos |
| Enviando | botão "Agendando…" inerte; campos preservados; sem envio duplo |
| Sucesso | `router.push('/painel?criado={number}')`; o Painel mostra uma vez "Lote {NNN} agendado. Abre sozinho em DD/MM às HH:mm (Brasília)." (`FeedbackState` neutro, nunca verde decorativo) e remove o parâmetro; se `imageStatus = FAILED`, acrescenta "A imagem não pôde ser baixada; o lote usa a ilustração padrão." |
| Erro 5xx / rede no envio | `FeedbackState` erro "Não deu para agendar agora." + "Tentar novamente"; formulário intacto |

Acessibilidade: todo campo tem rótulo visível; ajuda via `aria-describedby`; `required` real; anunciar mudança de status da FIPE em live region; o alvo mínimo de 44 px vale para selects e botões.

### 9.4 Painel base — `/painel` (T7, AUCTIONEER; substitui o stub de S01)

Título `display-titulo` "Painel do pátio", subtítulo "Seus lotes, quem está brigando por eles e quanto já entrou." Botão primário **"Criar lote"** (único ocre) → `/painel/criar-lote`. Dados de `GET /my/lots`.

- **Resumo:** "TOTAL RECEBIDO · N ARREMATES" com `totalReceivedCents` (nesta fatia `R$ 0,00` e `0 ARREMATES`; a S05 alimenta) e a nota "Saldo simulado. O pátio agradece mesmo assim."; placares em LED (`painel` + `led`): **AO VIVO** (cor `ledAlerta`), **AGENDADOS**, **ENCERRADOS**, contagens de `lots` do chamador (AO VIVO = LIVE + CLOSING).
- **Tabela "Ao vivo"** (`DataTable`, `min-width` 760 px, rolagem horizontal em região focável): colunas LOTE (`LotTag` pequena + título como link para `/lotes/{id}`) · CARRO ("Marca Modelo ano") · LANCE ATUAL (ou lance inicial se sem lances) · LANCES · RESTAM (`Cronometro` compacto) · AÇÃO (nesta fatia, link secundário "Ver sala"; a S06 acrescenta "Cancelar").
- **Tabela "Agendados":** LOTE · CARRO · LANCE INICIAL · LANCES · ABRE · FECHA (as duas datas, "DD/MM HH:mm") · AÇÃO ("Ver sala").
- **Seção "Encerrados":** grade de `LotCard` variante encerrado (vazia até a S05).
- Seção "Cancelados": S06.

| Estado | Tratamento |
|---|---|
| Seção vazia | texto curto em `FeedbackState` tracejado: "Nada ao vivo por aqui." / "Nada agendado ainda." / "Nenhum lote encerrado." (texto a revisar) |
| Carregando / erro | `FeedbackState` "Carregando…" / "Não consegui trazer seus lotes." + "Tentar novamente" |
| Após criar | mensagem única de §9.3 |
| FIPE fora do ar | sem efeito (o aviso só existe em Criar lote) |

Visitante e licitante em `/painel` e `/painel/criar-lote` seguem a guarda de S01 (visitante → `/entrar?next=`; papel errado → aviso com link ao destino permitido).

## 10. Componentes criados

Tokens: nomes são os do tema em código (S00): `fundo papel suave pontos tinta tinta2 linha sombra tracejado ocre sobreOcre ferrugem verde sobreCor painel led ledAlerta falha` e fixas `digitoPlaca linhaCentralPlaca rotuloRelogio`. Tipografias: `mono`, `mono-rotulo`, `mono-rotulo-pequeno`, `cartaz-cartao`, `cartaz-subtitulo`, `cronometro`, `body`, `body-nota`, `body-legenda`. Movimento: `la-pulsa`, `la-vira`, `la-bate`, `la-mais`; todos desligados por `prefers-reduced-motion`.

### 10.1 `LotCard` (cartao-lote)

Todo o cartão é um `<a href={lotCardHref}>` (na prévia de Criar lote, `div`). Fundo `papel`, borda 3px `linha`, sombra `6px 6px 0 sombra`, raio 0. `LotTag` acima: `top:0; left:20px`, rotação −4° (ao vivo), +3° (agendado), −2° (encerrado). Imagem: `CarPhoto` de 200 px de altura. Título `Big Shoulders 900 32px` caixa-alta; meta mono 13px: "{ano} · {combustível} · FIPE R$ {referência},00". Divisória tracejada (2px `tracejado`) e rodapé por variante. Nome acessível = título do lote (`aria-labelledby` no título), não o texto todo; o crédito da foto **não** aparece no cartão (evita link aninhado).

| Variante | Rodapé |
|---|---|
| Ao vivo (`LIVE`) | `Stamp` "Ao vivo" no canto (ponto 10px pulsante, −5°); rótulo "LANCE ATUAL" (ou "LANCE INICIAL" se `currentBidCents = null`) + valor mono 600 22px; "N lances" (ou "Nenhum lance"); `Cronometro` compacto (mono 28px, rótulo "RESTAM"); últimos 2 min: dígitos `ledAlerta`, rótulo "ÚLTIMOS 2 MIN", borda `ferrugem`, pulso 1s |
| Apurando (`CLOSING`) | igual ao ao vivo, `Cronometro` "00:00 / ENCERRADO" e texto "Apurando…" |
| Agendado (`SCHEDULED`) | selo mono 12px, fundo `papel`, borda 3px: "ABRE QUI 24/10 14:00"; "LANCE INICIAL" + valor; "incremento R$ X,00"; caixa "ABERTURA" com dia (`Big Shoulders 900 26px`) e hora |
| Encerrado (`SOLD`/`UNSOLD`) | ilustração/foto a `opacity .55` com `Stamp` central de 184px de largura: "Arrematado" (valor final + nº de lances) ou "Sem lances" (borda tracejada); rodapé "RESULTADO" |

### 10.2 `CarPhoto` (foto-veiculo)

`fundo suave` com pontilhado `radial-gradient(pontos 1.3px, transparent 1.7px)` em 8px×8px; `object-fit: contain` (nunca recorta, distorce ou aplica filtro). Alturas: 200 px no cartão; 16:9 com largura fluida na Sala e na prévia. Sem imagem (`imageUrl = null`) ou `onError`: ilustração SVG padrão (silhueta única de carro; o dado não traz carroceria) em `tinta` sobre `suave`, `aria-hidden`, com a legenda do estado (§9.2). Com foto: `alt="Foto do {título}"`; ilustração: decorativa. Proporção reservada para evitar salto de layout. `imageUrl` passa por `assetUrl()`.

### 10.3 `Cronometro` e `SeloProrrogacao`

"LCD de bomba de gasolina". Fundo `painel`; borda 3px `linha`; padding `10px 14px 12px`; gap 4px; dígitos mono 600 (cartão 28px, Sala 58px, painel/lista 28px) cor `led`; dígitos fantasma "88:88" (ou na largura do formato) a `opacity .1` atrás do valor real; rótulo `mono-rotulo-pequeno` (10px, ls .16em) na cor fixa `rotuloRelogio` (`#8A8273`).

Props: `{ endsAt, startsAt?, originalEndsAt?, status, size:'sala'|'cartao', label?, serverTime? }`. Calcula `restante = alvo − now()` com `useServerClock`; alvo = `startsAt` se `status = SCHEDULED` (rótulo "ABRE EM"), senão `endsAt`.

| Variante | Condição | Rótulo | Dígitos / borda |
|---|---|---|---|
| Normal | LIVE, restante > 2 min | "TEMPO RESTANTE" (Sala) / "RESTAM" (cartão/lista) | `led` / `linha` |
| Últimos 2 min | LIVE, `0 < restante ≤ 120 s` (inclusivo, igual à regra de prorrogação) | "ÚLTIMOS 2 MIN" em `ledAlerta` | `ledAlerta`, pulsam `la-pulsa 1s` / borda `ferrugem` |
| Prorrogado | `endsAt > originalEndsAt` | "PRORROGADO" (`rotuloRelogio`) | como Normal ou Últimos 2 min, mais `SeloProrrogacao` no canto (`right:-14px; top:-14px`) |
| Encerrado | `restante ≤ 0` (ou status CLOSING/SOLD/UNSOLD) | "ENCERRADO" | "00:00" em `led`, sem animação, borda `linha` |

Formato: `< 1 h` → `mm:ss`; `≥ 1 h` e `< 24 h` → `hh:mm:ss`; `≥ 24 h` → `Nd hh:mm:ss` (decisão: o seed deixa o lote ao vivo por 30 dias; ver Q3). Arredonda para cima os segundos (restante 0,4 s mostra 00:01) e nunca mostra negativo.

`SeloProrrogacao` ("+2 MIN"): fundo `ocre`, texto `sobreOcre`, borda 3px `tinta`, `Big Shoulders 900` 18px (22px na Sala), padding `2px 8px 0`, rotação −6°, animação `la-mais` (.6s, desligada em reduced-motion; o selo aparece direto).

A11y: na Sala `role="timer"` com `aria-label="Tempo restante mm:ss"` (atualizado a cada 10 s e ao cruzar 2 min, não a cada segundo); nos cartões também `role="timer"` e rótulo acessível ("Tempo restante …"). Uma região `polite` visualmente oculta anuncia **uma vez** "Últimos 2 minutos" e a cada prorrogação. Nada depende de animação.

### 10.4 `useServerClock`

Módulo com store único (`useSyncExternalStore`) e um só `setInterval` de 1 s (250 ms ao se aproximar de zero é opcional). `syncServerTime(iso)`: `offset = Date.parse(iso) − Date.now()`; o `apiClient` chama em **toda** resposta que traga `serverTime` (retrofit de S00) e a S04 chamará nos eventos. `now() = Date.now() + offset`. SSR/hidratação: o primeiro render usa `Date.parse(serverTime)` da própria carga para casar com o HTML do servidor, e só depois passa a usar o relógio vivo. `onReach(target, cb)` dispara o callback uma vez quando `now() ≥ target`. O relógio do aparelho nunca decide estado: ao chegar a zero a tela só pede o `GET` e aguarda o status do servidor.

### 10.5 `PlacaLance` (placa-lance)

Mostra o lance atual/inicial. Cada dígito é uma placa: fundo `painel`, dígito `digitoPlaca` (`#F5EEDF`) mono 600 40px, 40×60px, raio 3px, linha central 2px `linhaCentralPlaca` (`#000`); ponto de milhar de 16px de largura; prefixo "R$" e sufixo ",00" (mono 20px) fora das placas. Rótulo mono acima ("LANCE ATUAL" / "LANCE INICIAL"). Quando o valor muda, cada dígito alterado vira com `la-vira` (rotateX 90°→0, .5s, atraso .06s por dígito; sem animação em reduced-motion). O container tem `aria-label="Lance atual R$ 31.000,00"` (ou "Lance inicial …") e as placas são `aria-hidden`. Quebra de linha permitida no celular. (A S03 reutiliza e dispara a troca; esta fatia só o exibe.)

### 10.6 `Canhoto` (cartao-canhoto, versão "Como funciona")

Cartão `papel`, borda 3px, sombra 6/6, raio 0, padding 24px. Numeral gigante (`Big Shoulders 900` 76px, preenchimento `ocre`, `-webkit-text-stroke: 3px linha`), título `cartaz-subtitulo` (26px), texto `body` 17px, `Perforation` (altura 24px, linha `2px dashed tracejado` com `left/right: 20px; top: 11px`, dois semicírculos 24×24 com fundo `fundo`) e rodapé tracejado mono "CANHOTO / Nº 0X". (A S07 reutiliza o picote no ingresso de Meus arremates.)

### 10.7 Outros desta fatia

`PriceTag`/utilitários: `formatBRL` (de `shared/money`), `assetUrl(path)`, `formatBrasilia`. Páginas Next: `app/page.tsx` (Vitrine), `app/lotes/[id]/page.tsx`, `app/painel/page.tsx`, `app/painel/criar-lote/page.tsx`.

## 11. Seed desta fatia

`prisma/fipe-fixture.json` (arquivo local, **sem rede**, S8): array de itens no formato do detalhe normalizado da FIPE (`brandId, modelId, yearId, brandName, modelName, year, fuel, codeFipe, priceCents, referenceMonth`, `image: "seed-images/arquivo.jpg"|null`, `imageCredit`, `imageCreditUrl`). Sugestão de carga inicial (preços ilustrativos, não são consulta real; a imagem pode ser `null` e o app usa a ilustração): Fiat Uno Mille Way 1.0 2010 Flex · R$ 19.800; Honda Civic LXS 1.8 2012 Flex · R$ 54.700; Toyota Corolla XEi 2.0 2015 Flex · R$ 76.300; Toyota Hilux SRV 2.8 4x4 2017 Diesel · R$ 176.500; Volkswagen Gol GTI 2.0 1996 Gasolina; mais 2 itens à escolha para os lotes encerrados/cancelados das S05/S06. Imagens, se houver, ficam em `prisma/seed-images/` com crédito e licença registrados no fixture (Q4).

`seed.ts` (estende o de S01) cria lotes **pelo mesmo serviço** `createLot` (porta `CatalogPort` implementada pelo fixture; imagem lida do arquivo local, sem download), para o genesis/seal nascerem válidos (S9):
- **Ao vivo (S2, parte 1):** Uno Mille Way 2010; `startsAt = agora − 1 h`, `endsAt = agora + 30 dias`; lance inicial R$ 15.000,00; incremento R$ 500,00; sem lances (a S03 acrescenta os lances).
- **Agendado (S3):** Corolla XEi 2015; `startsAt = agora + 2 dias`, `endsAt = agora + 3 dias`; lance inicial R$ 60.000,00; incremento R$ 1.000,00.
Datas relativas ao momento da execução (S7: o comando que recria o lote de demonstração é `npm run seed:demo`, criado aqui apenas para o lote ao vivo e estendido nas fatias seguintes). O leiloeiro dono é o do seed de S01. `npm run seed` continua recusando-se se já houver usuários.

## 12. Critérios de aceite

**Catálogo e resiliência**
- AC-2.1 [auto] Dado FIPE respondendo, quando `GET /catalog/brands` é chamado como leiloeiro, então retorna `{items:[{id,name}]}` ordenado por nome; como licitante → 403 `ROLE_NOT_ALLOWED`; sem token → 401.
- AC-2.2 [auto] Dado `GET /catalog/brands` já chamado (cache quente), quando a FIPE passa a falhar (timeout/5xx), então a mesma chamada ainda responde 200 com a lista em cache (vencida ou não) e nenhuma requisição nova explode.
- AC-2.3 [auto] Dado a FIPE fora e cache vazio, quando `GET /catalog/brands` é chamado, então 503 `EXTERNAL_UNAVAILABLE {source:"FIPE"}` com "A tabela FIPE não respondeu.", em até ~8 s (2 tentativas × 4 s).
- AC-2.4 [auto] Dado uma resposta 404 da FIPE, quando o adaptador a recebe, então não repete a chamada e responde 404 `NOT_FOUND`.
- AC-2.5 [auto] Dadas 5 chamadas simultâneas à mesma URL com cache vazio, quando executadas, então o adaptador faz 1 requisição externa (single-flight).
- AC-2.6 [auto] Dado `GET /catalog/preview` com a Wikipedia fora do ar, quando chamado, então 200 com `car` válido, `imageStatus:"UNAVAILABLE"` e sem `suggestedImage`; com artigo inexistente → `"NOT_FOUND"`.
- AC-2.7 [auto] Dado "Gol 1.0 MPI" da "VW - VolksWagen", quando se calculam os candidatos, então `["VolksWagen Gol","Gol"]`; dado "Corolla XEi 2.0" da "Toyota", então `["Toyota Corolla","Corolla"]`.
- AC-2.8 [auto] Dado `price:"R$ 45.000,00"`, quando `parseBRL`, então `4500000`; `"R$ 1.234.567,89"` → `123456789`.

**Criação do lote**
- AC-2.9 [auto] Dado leiloeiro logado e dados válidos, quando `POST /lots`, então 201 com `LotState`: `status` `SCHEDULED` (início futuro), `bidCount 0`, `bids []`, `originalEndsAt = endsAt`, `number` sequencial, e `Item` com snapshot completo (`rawData` não nulo, `referencePriceCents` em centavos).
- AC-2.10 [auto] Dado o lote criado, quando se lê `Lot.lastHash` e `Lot.seal`, então `lastHash = genesisHash(...)`, `entryCount = 0` e `seal = sealHash(lotId, 0, genesis)`.
- AC-2.11 [auto] Dado `startsAt` 30 s no passado, quando `POST /lots`, então 201 e `status = LIVE`; dado 61 s no passado → 400 `VALIDATION` `fields.startsAt = "O início não pode estar no passado."`.
- AC-2.12 [auto] Dado `endsAt = startsAt + 5 min` exatos, então 201; `+4 min 59 s` → 400 com `fields.endsAt = "O fim precisa ser pelo menos 5 minutos depois do início."`.
- AC-2.13 [auto] Dado `startingBidCents = 99` ou `minIncrementCents = 99` ou `1.5` ou texto, então 400 com a mensagem do campo; `100` aceito.
- AC-2.14 [auto] Dado título vazio ou só espaços → "Dê um título ao lote."; 121 caracteres → "O título aceita até 120 caracteres."
- AC-2.15 [auto] Dado licitante ou visitante em `POST /lots`, então 403 `ROLE_NOT_ALLOWED` / 401; nada é gravado.
- AC-2.16 [auto] Dado a FIPE fora e `brandId/modelId/yearId` sem cache, quando `POST /lots`, então 503 `EXTERNAL_UNAVAILABLE`, nenhum `Item`/`Lot` criado, e o erro de data (se houver) teria vindo **antes**, sem chamada externa.
- AC-2.17 [auto] Dado `imageUrl` de uma imagem PNG de 100 KB em host público, quando `POST /lots`, então `imageStatus:"STORED"`, `Item.imageData` preenchido, e `GET /items/:id/image` devolve os bytes com `Content-Type: image/png`, `Cache-Control` imutável e `Cross-Origin-Resource-Policy: cross-origin`.
- AC-2.18 [auto] Dado `imageUrl` que aponta para `http://127.0.0.1/…`, `http://169.254.169.254/…`, host que resolve para IP privado, ou redireciona para um deles, quando `POST /lots`, então o lote é criado com `imageStatus:"FAILED"` e **nenhuma conexão** é feita ao endereço privado.
- AC-2.19 [auto] Dado `imageUrl` de 2,5 MB, de `text/html` ou de `image/svg+xml`, então lote criado, `imageStatus:"FAILED"`, `imageData` nulo; dado `ftp://…` ou texto solto → 400 `fields.imageUrl = "Use um endereço http ou https válido."`.
- AC-2.20 [auto] Dado `imageUrl` omitida, então `imageStatus:"NONE"` e `LotCard.imageUrl = null`.
- AC-2.21 [auto] Dados 2 `POST /lots` simultâneos do mesmo leiloeiro, então 2 lotes com `number` distintos e crescentes.

**Listagem, busca e status**
- AC-2.22 [auto] `lotStatus`: com `startsAt=T`, `endsAt=T+1h`: `now=T-1ms` → SCHEDULED; `now=T` → LIVE; `now=T+1h-1ms` → LIVE; `now=T+1h` → CLOSING (settledAt nulo); com `settledAt` e `bidCount>0` → SOLD; sem lances → UNSOLD; com `cancelledAt` → CANCELLED em qualquer horário.
- AC-2.23 [auto] Dado lotes ao vivo, agendado, encerrado e cancelado, quando `GET /lots`, então o cancelado não vem; a ordem é ao vivo por `endsAt` crescente, agendados por `startsAt` crescente, encerrados por `endsAt` decrescente; `counts` não muda ao aplicar `status`, `q` ou `brand`.
- AC-2.24 [auto] Dado um lote "Opala Comodoro", quando `q=opala`, `q=OPALA`, `q=ópála` e `q=comodoro opala`, então todos o retornam; `q=zzz` → lista vazia, 200.
- AC-2.25 [auto] Dado `brand=Toyota`, então só lotes dessa marca, e `brands` continua listando todas as marcas existentes (não filtradas).
- AC-2.26 [auto] Dado `status=XYZ`, então 400 `VALIDATION`; `status=LIVE` inclui lotes `CLOSING`.
- AC-2.27 [auto] Dado `GET /lots/:id` de lote agendado e de lote cancelado (criado direto no banco), então 200 com `status` correto; de id inexistente ou `"abc"` → 404 `NOT_FOUND`.
- AC-2.28 [auto] Dado a FIPE e a Wikipedia fora do ar, quando `GET /lots`, `GET /lots/:id`, `GET /items/:id/image` e `GET /my/lots`, então todos respondem 200 normalmente sem nenhuma chamada externa (X2).
- AC-2.29 [auto] Dado dois leiloeiros A e B, quando A chama `GET /my/lots`, então só os lotes de A (incluindo cancelados).

**Vitrine (manual)**
- AC-2.30 [manual] Dado seed rodado, quando um visitante abre `/`, então vê a barra "Pátio aberto" com "1 lote ao vivo · 1 agendado", as seções "Ao vivo" (Uno com cronômetro `Nd hh:mm:ss`) e "Agendados" (Corolla com "ABRE …"), sem seção "Encerrados", e o rodapé com "Nem em sonho".
- AC-2.31 [manual] Dado "Corolla" digitado, quando a lista atualiza, então só o Corolla aparece, a seção Ao vivo some e o contador mostra "01 LOTE"; com `zzz` aparece "Pátio vazio — Nada com esse filtro…" com botão "Limpar filtros", que restaura tudo.
- AC-2.32 [manual] Dado banco sem lotes, quando `/` abre, então "O pátio está vazio. Nenhum lote publicado por enquanto." sem "Limpar filtros".
- AC-2.33 [manual] Dado tema noite e 390 px, quando `/` abre, então 1 coluna de cartões, cabeçalho quebrando linha, nenhum scroll horizontal da página, contraste legível e foco visível ao tabular.
- AC-2.34 [manual] Dado leitor de tela, quando navega pelos cartões, então cada um se anuncia pelo título do lote e o cronômetro tem rótulo "Tempo restante …".
- AC-2.35 [manual] Dado API em hibernação/queda no SSR, quando `/` abre, então a página mostra erro com "Tentar novamente" e se recupera quando a API volta, sem recarregar à mão.

**Criar lote e Painel (manual)**
- AC-2.36 [manual] Dado leiloeiro logado, quando escolhe Toyota → Corolla → 2015, então aparecem "REFERÊNCIA FIPE · OUT/2026" (mês do snapshot) com preço, foto sugerida com crédito, título pré-preenchido "Corolla XEi 2.0 2015"; trocar a marca zera modelo e ano.
- AC-2.37 [manual] Dado FIPE fora do ar, quando abre Criar lote, então vê "FIPE FORA DO AR", o banner, selects desabilitados, "Agendar lote" desabilitado com a nota; digita título e regras, clica "Tentar de novo", a FIPE volta e **nada digitado se perdeu**.
- AC-2.38 [manual] Dado "Sem foto" marcado, quando agenda, então a URL fica desabilitada, o lote nasce sem imagem e Vitrine/Sala mostram a ilustração com "Pintado à mão pelo pátio: o leiloeiro não mandou foto".
- AC-2.39 [manual] Dado Wikipedia sem foto, quando escolhe o ano, então aparece "Não encontramos uma foto. Cole uma URL ou use a ilustração do pátio." e o botão continua habilitado.
- AC-2.40 [manual] Dado início "25/10 10:00" digitado, quando agenda, então o lote grava `2026-10-25T13:00:00.000Z` e a Sala exibe "25/10 às 10:00 (Brasília)".
- AC-2.41 [manual] Dado erros em 3 campos, quando clica "Agendar lote", então cada campo mostra sua mensagem, o alerta-resumo aparece, o foco vai ao primeiro inválido e nada se perde; o botão não duplica envio.
- AC-2.42 [manual] Dado sucesso, quando redireciona a `/painel`, então a mensagem "Lote 025 agendado. Abre sozinho em …" aparece uma vez e o lote está em "Agendados" do Painel e da Vitrine.
- AC-2.43 [manual] Dado licitante em `/painel/criar-lote`, então é levado ao aviso de papel errado (guarda de S01), sem ver o formulário.

**Sala somente leitura (manual)**
- AC-2.44 [manual] Dado o lote agendado, quando visitante abre a Sala, então vê a ficha, "Este lote abre em 24/10 às 14:00 (Brasília)." (data real do seed), cronômetro "ABRE EM" contando, sem formulário; ao chegar a zero a tela passa a "Ao vivo" sem recarregar à mão.
- AC-2.45 [manual] Dado o lote ao vivo sem lances, quando abre a Sala, então vê selo "Ao vivo", placa "LANCE INICIAL R$ 15.000,00", "00 LANCES", "Nenhum lance ainda. O mínimo é o lance inicial." e nenhum formulário.
- AC-2.46 [manual] Dado um lote com `endsAt` daqui a 90 s, então o cronômetro está em "ÚLTIMOS 2 MIN" (`ledAlerta`, borda ferrugem, pulso); com `endsAt` > `originalEndsAt`, aparece "PRORROGADO" e o selo "+2 MIN".
- AC-2.47 [manual] Dado um lote cancelado aberto por URL, então carimbo "Cancelado", texto de cancelamento, "Voltar à vitrine" e nenhum cronômetro/lance.
- AC-2.48 [manual] Dado um id inexistente, então "Lote não encontrado." com "Voltar à vitrine".
- AC-2.49 [manual] Dado `prefers-reduced-motion`, então pulsos, flips e `la-mais` ficam parados e o estado final aparece direto.
- AC-2.50 [manual] Dado o relógio do computador adiantado em 10 min, quando abre a Sala de um lote ao vivo, então o cronômetro mostra o tempo restante certo (offset do servidor).

## 13. Casos de borda e concorrência

- Duas criações simultâneas e o contador `number`: ver AC-2.21; `Lot.number` nunca repete.
- Single-flight e cache: uma chamada falha não envenena o cache; uma entrada vencida só é servida quando a chamada nova falhou.
- Resposta atrasada de seleção antiga em Criar lote é descartada; trocar a marca com um `preview` em voo não preenche a imagem do carro antigo.
- Usuário edita a URL durante a busca da imagem: a sugestão que chegar depois não sobrescreve.
- FIPE devolve ano "Zero Km" (`32000-*`) → removido da lista de anos.
- FIPE devolve mês de referência fora do padrão → grava o texto cru; a UI mostra o texto cru em maiúsculas.
- Lote com `startsAt` dentro da tolerância e já passado nasce `LIVE`; o aviso "Ele aparece em Agendados" da nota é aproximado e não bloqueia.
- Lote cujo `endsAt` passou e não foi liquidado (`CLOSING`) fica no grupo "Ao vivo" até a S05; entre S02 e S04 isso é esperado.
- `GET /lots` em 200 linhas: o teto defensivo corta o resto; sem paginação (PRD não pede).
- Título com HTML/script: renderizado como texto (React escapa); `searchText` guarda só texto normalizado.
- Imagem sem `Content-Length` e com streaming infinito: leitura aborta em 2 MB ou 4 s.
- Servidor reiniciado (Render): cache em memória zera; a primeira chamada de catálogo volta a bater na FIPE (atenção ao limite de 500/dia sem token).
- Cronômetro com relógio do aparelho defasado: sempre `Date.now()+offset`; troca de aba por horas: ao voltar o foco, refaz `GET` e ressincroniza.
- `now == endsAt` exato: o cronômetro mostra 00:00/ENCERRADO e o status é `CLOSING`; `now == startsAt` exato: `LIVE`.

## 14. Testes exigidos

Vitest em `shared`/`api`; integração contra Postgres real (`DATABASE_URL_TEST`); servidores HTTP falsos para FIPE/Wikipedia/imagem.
1. `lotStatus` (tabela do AC-2.22) e bordas de milissegundo.
2. `cleanBrand`, `normalizeSearch`, `wikiTitleCandidates`, `parseBRL`, `parseReferenceMonth`, `brasiliaLocalToUtcIso` (inclui virada de dia e de mês).
3. `genesisHash`/`sealHash`: vetores fixos com chave de teste (hex minúsculo, `at` com ms).
4. Adaptador com cache: hit, vencido+falha serve cache, vencido+sucesso troca, vazio+falha 503, single-flight, 404 sem repetição, 429/5xx repete uma vez, timeout.
5. `image-store`: IP privado direto, DNS que resolve a privado, redirecionamento para privado, >2 MB, MIME errado/SVG, porta fora de 80/443, sucesso.
6. Integração `POST /lots`: AC-2.9 a AC-2.21, incluindo ordem (data antes da FIPE).
7. Integração `GET /lots` (AC-2.23 a AC-2.28) e `GET /my/lots` (AC-2.29), com a FIPE desligada.
8. Web (Vitest, lógica pura): `useServerClock` (offset, hidratação), formatador do `Cronometro` (mm:ss, hh:mm:ss, `Nd`), máscara de valor, conversão Brasília↔UTC, `lotCardHref`.

## 15. Retrofits e integrações

- **S00:** `apiClient` passa a chamar `syncServerTime` em toda resposta com `serverTime`; `LotTag` aceita texto ("NOVO"); `Stamp` ganha variante "Cancelado" (cor `tinta2`) se ainda não existir; trocar a página diagnóstica pela Vitrine.
- **S01:** `User` ganha `lotsAuctioned`/`lotsLeading`; `Header` ganha "Vitrine" (todos) e "Meus lotes · Criar lote · Vitrine" (leiloeiro); `/painel` deixa de ser stub; `homeFor` permanece (BIDDER → `/`, AUCTIONEER → `/painel`); a guarda de papel errado cobre `/painel/criar-lote`; `optionalAuth` se faltar.
- **S03:** insere o painel de lance na coluna direita da Sala, popula `bids[]`, `myPseudonym/myRank/myBestBidCents`, reutiliza `PlacaLance` e `Cronometro`, e preenche `Lot.currentBidCents/leaderId/bidCount/entryCount/lastHash/seal`.
- **S04:** chama `syncServerTime` nos eventos, mostra o aviso de prorrogação, atualiza Vitrine/Painel por `showcase:lot`; remove o `GET` por foco como único meio de atualização.
- **S05:** preenche `totalReceivedCents` e "N ARREMATES", renderiza os cartões/estado encerrados completos e a Sala encerrada.
- **S06:** acrescenta "Cancelar" e a seção "Cancelados" no Painel, e o conteúdo real da Sala cancelada.
- **S08:** `lotCardHref` encerrado → `/lotes/{id}/auditoria`; link "Auditar este lote" na Sala; "Auditoria do lote" no Painel.
- **S09:** padroniza 404/erros/carregando e a varredura de acessibilidade em tudo que esta fatia criou.

## 16. Conflitos resolvidos e perguntas abertas

**Conflitos resolvidos**
- C-2.1 Rota de anos: a arquitetura omitia a marca; a FIPE exige marca e modelo → `/catalog/brands/:brandId/models/:modelId/years`.
- C-2.2 DESIGN "nunca foto" × PRD imagem real: PRD vence; foto do snapshot com fallback SVG (C3 do SPEC).
- C-2.3 Protótipo do Criar lote diz "Depois do primeiro lance, o lote não pode mais ser cancelado": removido (decisão do usuário: cancelar com lances existe).
- C-2.4 Arquitetura aceita `image/*`; endurecido para jpeg/png/webp/gif (SVG seria XSS se servido do mesmo host) mantendo o espírito de AD-12.
- C-2.5 EXPERIENCE manda "Restante < 2 min" para o alerta; a regra de prorrogação (INV-9) usa `≤ 2 min`; o alerta usa `≤ 120 s` para coincidir com a regra que o usuário vê.
- C-2.6 EXPERIENCE diz que o cartão migra de seção quando o servidor confirmar; adotado "Ao vivo" = LIVE + CLOSING e `GET` único ao zerar.
- C-2.7 Hero do protótipo cita "Referência FIPE out/2026" fixo: trocado por texto sem mês (cada lote tem o seu, vindo do snapshot).

**Perguntas abertas (decida antes ou durante a fatia)**
- Q1 **Filtro de preço da Vitrine** ("Até R$ 50 mil", "R$ 50 a 100 mil", "Acima de R$ 100 mil") existe no protótipo, mas não no PRD nem no contrato. Sugestão: não fazer agora; seria `price=` sobre o lance atual (ou inicial se sem lances).
- Q2 **Título 1–120 caracteres** e limites de URL/crédito são defensivos, não vêm do PRD. Sugestão: manter.
- Q3 **Formato do cronômetro acima de 1 hora** (`hh:mm:ss` e `Nd hh:mm:ss`): o EXPERIENCE só descreve `mm:ss`, mas o seed deixa o lote ao vivo por 30 dias. Sugestão: manter o formato aqui.
- Q4 **Fotos do seed**: usar `null` (ilustração) ou incluir 1–2 imagens com licença livre e crédito? Sugestão: `null` no primeiro dia e imagens de domínio público/CC depois, com crédito.
- Q5 **Formatos reais da FIPE v2** (campos, token, 500 req/dia) e do `summary` da Wikipedia precisam ser conferidos no dia 1 com chamada real; o adaptador isola a diferença.
- Q6 **Textos marcados "texto a revisar"** (canhotos, estados vazios, erros genéricos) valem como sugestão.
- Q7 Mínimo de 5 min de duração e `startsAt ≥ agora − 60 s` vêm da arquitetura (PRD não fixa); o SPEC já pede confirmação.

## 17. Definition of Done

- [ ] Migração `lots_and_items` aplicada local e em produção (Neon) pelo start da API; CHECKs presentes.
- [ ] `npm test` verde (itens 1–8 de §14) no CI com Postgres de serviço.
- [ ] `POST /lots` cria lote com `genesis`/`seal` válidos; `GET /lots`, `GET /lots/:id`, `GET /my/lots`, `GET /items/:id/image` respondendo em produção.
- [ ] Vitrine, Sala (leitura), Criar lote e Painel base funcionando nos dois temas, 390 px e 1440 px, com AC-2.30 a AC-2.50 percorridos.
- [ ] Teste de resiliência: FIPE e Wikipedia apontando para host morto → Vitrine/Sala/Painel normais; Criar lote com o estado de erro.
- [ ] `seed`/`seed:demo` criam o lote ao vivo (30 dias) e o agendado a partir do fixture, sem rede.
- [ ] `.env.example` e README atualizados (`FIPE_BASE_URL`, `FIPE_TOKEN?`, `WIKI_USER_AGENT`, nota sobre limite diário da FIPE e cache em memória).
- [ ] Smoke no link público: visitante vê a Vitrine; leiloeiro cria um lote com a FIPE real e ele aparece em Agendados.
- [ ] Diário `progresso.md` registra a fatia e o commit; commits atômicos em português.
