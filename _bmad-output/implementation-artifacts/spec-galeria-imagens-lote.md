---
title: 'Galeria de imagens do lote: URL ou fotos do aparelho'
type: 'feature'
created: '2026-10-28'
status: 'ready-for-dev'
baseline_commit: '21132de8af7311d5686bcd91536b5f45c50dfaf0'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problema:** o lote guarda uma imagem só, que o leiloeiro só consegue informar por URL. Quem tem as fotos no celular ou no computador não tem como mostrá-las, e a Sala não exibe mais de uma foto.

**Abordagem:** no grupo "02 A imagem" do Criar lote o leiloeiro escolhe um de dois modos, **URL** (como hoje) ou **Enviar fotos** (até 5, reduzidas no navegador), e o envio segue junto com "Agendar lote" num único `POST /lots`. A Sala troca a foto única por uma galeria quando o lote tem mais de uma foto; a Vitrine usa só a capa.

## Boundaries & Constraints

**Always:**
- URL e upload são mutuamente exclusivos, no formulário e no servidor. "Sem foto" segue como terceira possibilidade. Modo padrão ao abrir: URL, com a sugestão da Wikipedia como hoje.
- Trocar de modo descarta o que estava no outro. Com fotos já escolhidas, avisa antes (diálogo). Voltar para URL restaura a sugestão automática.
- Um único `POST /lots`, sem upload prévio e sem arquivo órfão: imagens e lote gravados na mesma transação. O contrato JSON (modo URL e sem foto) continua igual.
- Crédito só no modo URL, com a lógica atual intacta. Foto enviada grava crédito `null` e nenhum crédito aparece na Sala nem no card.
- Redução no navegador antes de enviar: lado maior ≤ 1600 px (nunca amplia), JPEG qualidade 0,85, orientação EXIF respeitada, fundo branco sob transparência. O teto de 4 MB por imagem vale também no servidor, como defesa.
- Tipo definido pelos **bytes reais** (magic bytes): JPEG, PNG, WebP. SVG, GIF e qualquer outro tipo são recusados. O `Content-Type` da parte e o nome do arquivo nunca são usados nem gravados.
- Só o leiloeiro autenticado cria o lote e é o dono das fotos; a leitura das fotos segue pública como hoje. DTOs públicos sem `userId`, nome nem e-mail (T9).
- Galeria na Sala só com mais de uma foto. Lote com uma foto ou sem foto fica exatamente como hoje. Miniaturas clicáveis, teclado, `alt` e foco visíveis, claro/noite, 360/768/1280 px sem rolagem horizontal.
- Capa = primeira foto. Na pré-visualização do formulário há "Tornar capa" (leva a foto à frente) e "Remover"; nada além disso (decisão do Felipe, 28/10/2026).
- Multipart lido com `busboy` direto (com `@types/busboy`), em memória, sem arquivo temporário, abortando ao passar do limite e mapeando cada falha ao envelope. Limites: 5 fotos, 4 MiB por foto, 20 MiB no total, campo `payload` até 64 KiB. Versão exata conferida no dia (T13). Esta é a única dependência nova permitida.
- No upload só JPEG, PNG e WebP, pelos bytes; GIF e SVG recusados. O modo URL segue como está, inclusive com GIF.
- Migração única e atômica: cria `ItemImage`, copia a imagem existente para a posição 0, confere as contagens (aborta se divergirem) e então apaga `Item.imageData` e `Item.imageMime`. `Item.imageCount` substitui `imageMime IS NOT NULL`. Irreversível depois de aplicada em produção; seed e testes mudam junto.
- Respeitar T1–T13 e INV-1 a INV-18: erros no envelope em pt-BR (INV-16), contratos e textos em `packages/shared` (INV-17), `Date`/`Date.now()` fora de `infra/clock.ts` proibidos na API (T6), ids TEXT, mutação só por REST via service.

**Never:**
- Editar ou reordenar fotos de lote já criado; reordenar além de "tornar capa" (nada de arrastar); legenda ou crédito por foto; `multer`; manter as colunas antigas de imagem em `Item`.
- Mexer na cadeia HMAC (a imagem não entra no genesis, nos lances nem no selo), em `Bid`, saldo ou regras de lance.
- Mudar o download por URL (`image-store.ts`) nem endurecê-lo nesta etapa; ele segue aceitando GIF.
- Ler `ItemImage.data` em listas e estados de lote (R-2.15). Dependência nova além do `busboy`.
- `git push` ou deploy sem pedido do Felipe. Versionar `apps/web/AGENTS.md`. Endurecer o modo URL com checagem de bytes.

## I/O & Edge-Case Matrix

| Cenário | Entrada / Estado | Resultado esperado | Tratamento de erro |
|---|---|---|---|
| Form · abrir | Criar lote | Modo URL, sugestão e crédito como hoje | N/A |
| Form · modo Enviar, sem fotos | Escolhe "Enviar fotos" | Campos de URL e crédito somem; botão "Escolher fotos"; prévia com a ilustração | N/A |
| Form · 1 a 5 fotos válidas | Seleciona no aparelho | Cada uma reduzida (uma por vez), miniatura, 1ª marcada "CAPA", contagem "N de 5"; prévia do card usa a capa | N/A |
| Form · passa de 5 | 3 escolhidas, mais 4 novas | Entram 2; as demais ficam de fora | Aviso "Só cabem 5 fotos. As demais ficaram de fora." |
| Form · arquivo inválido | GIF, SVG, PDF, HEIC sem decodificar, corrompido | Esse arquivo é recusado; os outros entram | "Não deu para ler {nome}. Use JPEG, PNG ou WebP." |
| Form · foto de celular | 8 MB, 4000×3000, EXIF rotacionado | JPEG com lado maior 1600, em pé, abaixo de 4 MB, sem EXIF/GPS | Se ainda passar de 4 MB: recusada com "Cada foto aceita até 4 MB." |
| Form · foto pequena ou PNG com alfa | 800×600; PNG transparente | Sem ampliar, regravada em JPEG; transparência sobre branco | N/A |
| Form · tornar capa | Foto 3 → "Tornar capa" | Vai à posição 1; as demais mantêm a ordem relativa | N/A |
| Form · remover | Remove a capa; ou remove a única | A próxima vira capa; sem fotos volta ao estado vazio | N/A |
| Form · trocar modo, sem fotos | URL → Enviar, ou Enviar → URL | Descarta o outro lado sem avisar; voltar a URL restaura a sugestão | N/A |
| Form · trocar modo, com fotos | Enviar → URL com N fotos | Diálogo "As N fotos escolhidas serão descartadas." (Descartar fotos / Manter fotos) | Cancelar ou Esc mantém o modo e as fotos |
| Form · Sem foto marcado | Qualquer modo | URL, crédito e fotos desabilitados; envia sem imagem; desmarcar restaura o que havia | N/A |
| Form · Enviar sem fotos | Agenda com o modo vazio | Não envia; foco no botão "Escolher fotos" | "Escolha ao menos uma foto ou use a ilustração padrão do pátio." |
| Form · envio | N fotos válidas | Um `POST /lots` multipart, botão em carregamento, sucesso leva ao Painel | Queda de rede: campos e fotos preservados, "Tentar de novo" |
| API · JSON | Corpo atual, com ou sem `imageUrl` | Igual a hoje: 201, `imageStatus` `STORED`/`FAILED`/`NONE` | Como hoje |
| API · multipart válido | `payload` JSON + 1 a 5 partes `images` | 201, `imageStatus:"STORED"`, `imageCount` N, posições 0..N-1 na ordem enviada, crédito `null` | N/A |
| API · URL e fotos juntas | `payload.imageUrl` + partes `images` | 400, nada gravado | `fields.images`: "Escolha uma URL ou fotos do aparelho. As duas juntas não valem." |
| API · fotos demais | 6 partes | 400, nada gravado | `fields.images`: "Envie no máximo 5 fotos." |
| API · foto grande | Parte > 4 MiB | 400, nada gravado | `fields.images`: "Cada foto aceita até 4 MB." |
| API · corpo grande | Total > 20 MiB | 413 antes de ler tudo | `PAYLOAD_TOO_LARGE`: "As fotos passaram de 20 MB no total. Envie menos fotos." |
| API · tipo falso | SVG/GIF/HTML com `image/jpeg` ou `.jpg` | 400 pelos bytes | `fields.images`: "Use fotos JPEG, PNG ou WebP." |
| API · nome hostil | JPEG real, nome `../../x.exe`, tipo `application/octet-stream` | Aceita; nome ignorado; servida como `image/jpeg` | N/A |
| API · parte vazia | 0 bytes | 400 | `fields.images`: "Use fotos JPEG, PNG ou WebP." |
| API · `payload` ausente ou inválido | Sem o campo, JSON quebrado, > 64 KiB | 400 | `VALIDATION`: "Os dados do lote não chegaram completos. Tente de novo." |
| API · papel ou token | Sem token; licitante | 401/403 **antes** de ler o corpo | Mensagens de hoje |
| API · carro ou datas inválidos, FIPE fora | Fotos válidas | 400 com `fields`, ou 503 `EXTERNAL_UNAVAILABLE`; nenhuma imagem gravada | Como hoje |
| GET · foto da galeria | `/items/:id/images/:position` | Bytes, `Content-Type` salvo, cache imutável, ETag, CORP `cross-origin`, `nosniff`, 304 sem ler o blob | 404 se posição não inteira, fora de 0..4 ou inexistente |
| GET · capa | `/items/:id/image` | Igual à posição 0, mesmos cabeçalhos | 404 sem imagem |
| Lote antigo | Uma imagem criada antes da migração | `/items/:id/image` devolve os mesmos bytes; `gallery` com 1 item; Sala, card, auditoria e comprovante iguais | N/A |
| Sala · 0 ou 1 foto | `gallery.length ≤ 1` | `CarPhoto` atual, com crédito da URL quando houver | N/A |
| Sala · 2 a 5 fotos | `gallery.length > 1` | Galeria no lugar da foto: capa em destaque, miniaturas, sem crédito; no encerrado, véu de `dimmed` | Foto que falha ao carregar mostra a ilustração naquele índice |
| Sala · teclado | Foco na galeria | ←/→ trocam a foto (com volta), Home/End vão às pontas, Enter/Espaço nas miniaturas; "Foto N de M" anunciado | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Item` guarda `imageData`/`imageMime`/`imageCredit`/`imageCreditUrl`; ganha `imageCount Int @default(0)` e a relação com o novo `ItemImage { itemId, position, mime, data }` (`@@id([itemId, position])`, sem nome de arquivo). Crédito continua em `Item`. Migrações em `apps/api/prisma/migrations/` (Prisma 6.19.3, ids TEXT).
- `apps/api/src/services/lot.service.ts` -- `createLot` (`options.image` do seed, `imageStore.download`, `resolveCredit`, `db.lot.create` com `item.create`), `getItemImageMeta`/`getItemImageData`. Reaproveitar a transação do `create` aninhado; imagens entram como `images.createMany` ali.
- `apps/api/src/services/lot-mappers.ts` -- `LOT_SELECT` (nunca o blob), `itemImagePath` (hoje por `imageMime`), `toLotCard`, `toLotState` (crédito só com `imageUrl`).
- `apps/api/src/routes/lots.ts` -- `POST /lots` (auth → papel → limitador 10/min) e `GET /items/:id/image` (cabeçalhos e ETag a reaproveitar). `etagMatches` reutilizável.
- `apps/api/src/app.ts` -- `express.json()` global só trata JSON; multipart passa direto.
- `apps/api/src/infra/image-store.ts` -- `IMAGE_MAX_BYTES`, `ALLOWED_IMAGE_TYPES`; **não alterar** o download.
- `apps/api/src/services/receipt.service.ts` (linhas 47–74) e `audit.service.ts` (linha 102) -- `imageUrl` da capa; `receipt` lê `imageMime` direto e passa a usar `imageCount`.
- `apps/api/src/seed/showcase.ts` -- `readFixtureImage` e `options.image` viram lista de uma imagem; `showcase.test.ts` acompanha.
- `apps/api/src/errors.ts` + `packages/shared/src/errors.ts` -- `PAYLOAD_TOO_LARGE` (413) tem texto fixo de 100 KB; a mensagem do upload é passada no `AppError`.
- `packages/shared/src/lots.ts` -- `CreateLotInput`/`createLotBaseSchema`, `LOT_TEXT`, `IMAGE_*`, `LotStateCar` (ganha `gallery: string[]`, caminhos relativos, `gallery[0] === imageUrl`, vazio sem imagem), `LotCard` (não muda), `StoredImageStatus`. Constantes novas aqui: máximo de fotos, bytes por foto e total, lado maior e qualidade da redução. `audit.ts` e `receipts.ts` não mudam.
- `apps/web/src/components/criar-lote-form.tsx` -- grupo "02 A imagem" (`urlInput`, `creditInput`, `noPhoto`, `FIELD_ORDER`, `buildBody`, prévia `previewCard`); `components/ui/dialog.tsx` para o aviso de troca.
- `apps/web/src/lib/api-client.ts` -- `apiPost` só serializa JSON e fixa `Content-Type`; precisa de variante `FormData` (sem `Content-Type`, para o navegador pôr o boundary; prazo maior, 60 s).
- `apps/web/src/lib/lots.ts` -- `assetUrl` prefixa a URL da API em tudo que não é `http(s)`: precisa deixar passar `blob:` (miniaturas e prévia do card).
- `apps/web/src/components/lots/car-photo.tsx` -- fica para card, comprovante e Sala com ≤ 1 foto. `sala.tsx` (linha 183) -- ponto de troca para a galeria.
- `apps/web/src/lib/realtime/fixtures.ts` e `lib/my-bids-fixtures.ts` -- fixtures de `LotState` ganham `gallery`.
- Testes de referência: `apps/api/src/routes/lots.test.ts` (servidor falso de imagem, `makeTestApp`), `lots.rate-limit.test.ts`, `infra/image-store.test.ts`, `components/lots/car-photo.test.tsx`.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/shared/src/lots.ts` -- constantes de upload e de redução, textos novos (`LOT_TEXT`), `gallery` em `LotStateCar` -- contrato único para web e API, com teste de varredura de voz.
- [ ] `apps/api/prisma/schema.prisma` e nova migração -- `ItemImage`, `Item.imageCount`, cópia da imagem antiga com checagem de contagem e remoção das colunas antigas -- lotes antigos preservados.
- [ ] `apps/api/src/infra/image-sniff.ts` -- função pura que devolve o tipo pelos bytes (JPEG, PNG, WebP) ou `null` -- recusa por conteúdo, nunca por cabeçalho.
- [ ] `apps/api/src/middleware/lot-upload.ts` + `routes/lots.ts` -- lê o multipart (`payload` + `images`) após auth, papel e limitador, aplica limites e mapeia falhas ao envelope; JSON passa direto -- um só `POST /lots`.
- [ ] `apps/api/src/services/lot.service.ts` e `lot-mappers.ts` -- gravar as imagens na transação do lote, exclusividade URL/fotos, crédito `null` com fotos, `gallery`, capa por `imageCount`, leitura por posição -- sem órfão.
- [ ] `apps/api/src/routes/lots.ts`, `receipt.service.ts`, `seed/showcase.ts` -- `GET /items/:id/images/:position`, `/items/:id/image` como posição 0, comprovante e seed no novo modelo -- sem regressão.
- [ ] `apps/web/src/lib/image-resize.ts` -- redução em canvas, uma foto por vez, com a conta das dimensões em função pura -- foto de celular sem recusa.
- [ ] `apps/web/src/lib/api-client.ts`, `lib/lots.ts` -- envio `FormData` e `blob:` em `assetUrl`.
- [ ] `apps/web/src/components/criar-lote-form.tsx` (e componente de fotos) -- seletor de modo, `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>` sem `capture`, miniaturas com Tornar capa e Remover, diálogo de troca, `images` em `FIELD_ORDER`, limpeza dos `blob:` ao remover e ao sair.
- [ ] `apps/web/src/components/lots/car-gallery.tsx` e `sala.tsx` -- galeria com destaque 16:9 `contain`, miniaturas em grade de até 5 colunas (≥ 44 px a 320 px), setas, teclado, região viva, `alt` "Foto N de M do {título}"; só com `gallery.length > 1`.
- [ ] Testes -- shared (constantes e textos), API (matriz acima, migração com dado antigo, `select` sem blob, atomicidade, rate limit, dono), web (redução, estado do formulário, galeria e teclado), fixtures.
- [ ] `_bmad-output/progresso.md` -- diário de cada passo.

**Acceptance Criteria:**
- Given um banco com lotes criados antes da migração, when ela roda, then cada lote com imagem passa a ter `imageCount = 1` e uma linha `ItemImage` na posição 0 com os mesmos bytes e o mesmo tipo; lotes sem imagem ficam com `imageCount = 0`; se as contagens divergirem a migração falha sem apagar nada.
- Given um `POST /lots` multipart com uma foto inválida, when a API responde 400, then não existe `Lot`, `Item` nem `ItemImage` novos; given FIPE fora do ar, o mesmo.
- Given `GET /lots`, `GET /my/lots`, `GET /lots/:id`, o comprovante e a auditoria, when consultados, then nenhuma query lê `ItemImage.data`, e `imageUrl` é não nulo exatamente quando `imageCount > 0`.
- Given licitante ou visitante, when chama `POST /lots` (JSON ou multipart), then é recusado antes de qualquer leitura do corpo; given o 11º envio no minuto, then 429 `RATE_LIMITED`.
- Given lote criado com fotos, when a cadeia é auditada e o comprovante é aberto, then o veredito e os hashes são os de um lote sem foto, e nenhum DTO público ganha `userId`, nome ou e-mail.
- Given a Sala com galeria, when o lote é visto em 360, 768 e 1280 px, claro e noite, then não há rolagem horizontal, o foco é visível e toda a navegação é possível só pelo teclado.
- Given um lote com fotos, when aparece na Vitrine, no Painel, na prévia, no comprovante ou na auditoria, then mostra só a capa.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

- **Um campo `payload` com o JSON do corpo atual, mais as partes `images`.** O zod e `validateCreateLot` de `packages/shared` valem sem mudança (números continuam números), e o modo URL continua no contrato JSON. A ordem das partes `images` é a ordem da galeria; a primeira é a capa.
- **`Item.imageCount`** mantém o que `imageMime` fazia: dizer se há imagem sem tocar no blob, e a lista de 200 lotes sem junção nem subconsulta. O snapshot é imutável, então `gallery` é só `0..imageCount-1` e o ETag nasce do id do item e da posição.
- **Foto de celular:** regravar em canvas sempre, mesmo a pequena, tira o EXIF (inclusive o GPS) da foto que fica pública. O envio direto à API não passa por isso; o leiloeiro é autenticado e o conteúdo é dele, então a API só valida tipo, tamanho e quantidade. Processar uma foto por vez evita estourar a memória do celular. No iOS o seletor com esses tipos entrega JPEG.
- **Antes de escrever código Next:** ler os guias em `node_modules/next/dist/docs/` (Next 16), conforme `apps/web/AGENTS.md`.
- Prévia do card e miniaturas usam `URL.createObjectURL`, revogada ao remover, ao trocar de modo e ao desmontar.

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` -- expected: saída zero (testes da API com `DATABASE_URL_TEST`, `docker compose up -d db` na porta 5433).

**Manual checks (Chrome real, Playwright, banco descartável, API e web locais; ver memória "Conferência no Chrome real"):**
- Criar lote com 1, 3 e 5 fotos, uma foto de 8 MB com EXIF rotacionado, um GIF e um SVG recusados, tornar capa, remover, trocar de modo com e sem fotos, "Sem foto"; conferir a Sala (galeria, teclado, encerrado) e a Vitrine (só a capa), em claro/noite e 360/768/1280 px, sem rolagem horizontal. Registrar evidência e limitações no diário.
