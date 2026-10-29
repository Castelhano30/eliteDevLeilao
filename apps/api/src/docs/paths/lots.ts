import { z } from "zod";
import {
  AUTH_TEXT,
  CANCEL_TEXT,
  CATALOG_TEXT,
  LOT_IMAGE_MAX_BYTES,
  LOT_IMAGE_MAX_COUNT,
  LOT_PAYLOAD_MAX_BYTES,
  LOT_TEXT,
  LOT_UPLOAD_MAX_BYTES,
  LOT_UPLOAD_MIME_TYPES,
  cancelLotSchema,
  createLotBaseSchema,
  lotChangedMessage,
  lotListQuerySchema,
} from "@lanceauto/shared";
import { registry } from "../registry";
import {
  brandListSchema,
  createLotResponseSchema,
  lotListSchema,
  lotStateSchema,
  myLotsSchema,
} from "../schemas";
import { OPTIONAL_AUTH, REQUIRES_AUTH, TAGS, errorResponses } from "./common";

const MIB = 1024 * 1024;
const KIB = 1024;

const createLotBody = registry.register(
  "CreateLotInput",
  createLotBaseSchema
    .extend({
      startsAt: createLotBaseSchema.shape.startsAt
        .describe("Início do lote. ISO 8601 UTC com `Z`. Pode estar até 60 s no passado.")
        .openapi({ format: "date-time", example: "2026-11-02T13:00:00.000Z" }),
      endsAt: createLotBaseSchema.shape.endsAt
        .describe("Fim do lote. ISO 8601 UTC com `Z`, pelo menos 5 minutos depois do início.")
        .openapi({ format: "date-time", example: "2026-11-02T15:00:00.000Z" }),
      startingBidCents: createLotBaseSchema.shape.startingBidCents.describe("Lance inicial, em centavos inteiros (mínimo R$ 1,00)."),
      minIncrementCents: createLotBaseSchema.shape.minIncrementCents.describe("Incremento mínimo entre lances, em centavos inteiros (mínimo R$ 1,00)."),
      imageUrl: createLotBaseSchema.shape.imageUrl.describe("URL http(s) da foto. Não vale junto com fotos enviadas. Ausente, o lote usa a ilustração padrão."),
    })
    .describe("Dados do lote. Os ids de marca, modelo e ano são os da FIPE (`/catalog/*`)."),
);
const cancelBody = registry.register(
  "CancelLotInput",
  cancelLotSchema.describe("`confirmEntryCount` é a contagem de linhas da cadeia de auditoria que o leiloeiro viu."),
);

const lotId = z.string().describe("Id do lote (texto, não é UUID).").openapi({ example: "cm2x7q1ab0000lot" });
const itemId = z.string().describe("Id do item (o carro do lote), o mesmo de `imageUrl`.").openapi({ example: "cm2x7q1ab0000itm" });

const listQuery = lotListQuerySchema.extend({
  status: lotListQuerySchema.shape.status.describe(
    "Grupo da Vitrine: `LIVE` (ao vivo e apurando), `SCHEDULED` (agendados) ou `ENDED` (arrematados e sem lances). Ausente, traz os três. Cancelados nunca aparecem.",
  ),
  q: lotListQuerySchema.shape.q.describe("Busca por título, marca ou modelo, sem diferenciar caixa nem acento."),
  brand: lotListQuerySchema.shape.brand.describe("Marca exata, como em `GET /brands`."),
});

const createLotExample = {
  brandId: "59",
  modelId: "5940",
  yearId: "2022-5",
  title: "Volkswagen Gol 1.0 2022, único dono",
  startingBidCents: 3_000_000,
  minIncrementCents: 50_000,
  startsAt: "2026-11-02T13:00:00.000Z",
  endsAt: "2026-11-02T15:00:00.000Z",
};

const multipartBody = z.object({
  payload: z
    .string()
    .describe(
      `JSON do lote, com os mesmos campos de \`CreateLotInput\`, como texto. Até ${LOT_PAYLOAD_MAX_BYTES / KIB} KiB. ` +
        "Com fotos anexadas, `imageUrl` não pode ir junto.",
    )
    .openapi({ example: JSON.stringify(createLotExample) }),
  images: z
    .array(z.string().openapi({ format: "binary" }))
    .max(LOT_IMAGE_MAX_COUNT)
    .optional()
    .describe(
      `Fotos do carro, a primeira é a capa. Até ${LOT_IMAGE_MAX_COUNT}, ${LOT_IMAGE_MAX_BYTES / MIB} MiB cada e ` +
        `${LOT_UPLOAD_MAX_BYTES / MIB} MiB no corpo todo. ${LOT_UPLOAD_MIME_TYPES.join(", ")}, conferidos pelos bytes ` +
        "(o nome e o `Content-Type` da parte são ignorados).",
    ),
});

const IMAGE_HEADERS = {
  ETag: { description: "Validador da foto; reenvie em `If-None-Match` para receber 304.", schema: { type: "string" as const } },
  "Cache-Control": {
    description: "`public, max-age=31536000, immutable`.",
    schema: { type: "string" as const },
  },
};

const imageContent = Object.fromEntries(
  LOT_UPLOAD_MIME_TYPES.map((mime) => [mime, { schema: z.string().openapi({ format: "binary" }) }]),
);

function imageResponses() {
  return {
    200: { description: "Os bytes da foto.", headers: IMAGE_HEADERS, content: imageContent },
    304: { description: "A foto não mudou desde o `If-None-Match` enviado. Sem corpo.", headers: IMAGE_HEADERS },
    ...errorResponses({ code: "NOT_FOUND", message: "Imagem não encontrada." }),
  };
}

const ifNoneMatch = z.object({
  "If-None-Match": z.string().optional().describe("ETag recebido antes. Aceita `*`, ETag fraco (`W/`) e lista separada por vírgula."),
});

export function registerLotPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/brands",
    tags: [TAGS.lots],
    summary: "Marcas do filtro da Vitrine",
    description: "Marcas da FIPE (em cache) mais as dos lotes publicados, sem repetir. Nunca devolve 503: sem FIPE, valem as marcas dos lotes.",
    responses: { 200: { description: "Marcas.", content: { "application/json": { schema: brandListSchema } } }, ...errorResponses() },
  });

  registry.registerPath({
    method: "get",
    path: "/lots",
    tags: [TAGS.lots],
    summary: "Vitrine: lista de lotes",
    description:
      "Lotes ao vivo, agendados e encerrados, com contagem por grupo. Lê só o banco. Cancelados nunca aparecem. Os " +
      "campos `…Cents` são centavos inteiros; a tela mostra reais inteiros.",
    request: { query: listQuery },
    responses: {
      200: { description: "Lotes e contagens.", content: { "application/json": { schema: lotListSchema } } },
      ...errorResponses("VALIDATION"),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/lots/{id}",
    tags: [TAGS.lots],
    summary: "Sala: estado de um lote",
    description:
      "Estado completo do lote para a Sala, mais o relógio do servidor (`serverTime`) e o histórico de lances. Público. " +
      "O token é opcional: com um token de licitante válido a resposta ganha `myPseudonym`, `myRank` e " +
      "`myBestBidCents`; com o do vencedor, também `myReceiptToken` (T9). Token inválido ou expirado vira visitante, sem 401.",
    security: OPTIONAL_AUTH,
    request: { params: z.object({ id: lotId }) },
    responses: {
      200: { description: "Estado do lote.", content: { "application/json": { schema: lotStateSchema } } },
      ...errorResponses({ code: "NOT_FOUND", message: LOT_TEXT.notFoundTitle }),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/lots",
    tags: [TAGS.lots],
    summary: "Cria um lote",
    description:
      "**Papel exigido: `AUCTIONEER`.** Limite de 10 criações por minuto por usuário. O servidor valida o corpo e as " +
      "datas antes de chamar a FIPE e grava um snapshot completo do carro. O corpo pode ser JSON (a foto vem de " +
      "`imageUrl`, ou fica a ilustração padrão) ou `multipart/form-data` com o campo `payload` e até " +
      `${LOT_IMAGE_MAX_COUNT} fotos em \`images\`. As regras de data: início a partir de 60 s atrás e fim pelo menos ` +
      "5 minutos depois do início. Datas em ISO 8601 UTC com `Z`. Com a FIPE fora do ar, volta 503 e nada é gravado.",
    security: REQUIRES_AUTH,
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: createLotBody, example: createLotExample },
          "multipart/form-data": {
            schema: multipartBody,
            encoding: { images: { contentType: LOT_UPLOAD_MIME_TYPES.join(", ") } },
          },
        },
      },
    },
    responses: {
      201: { description: "Lote criado.", content: { "application/json": { schema: createLotResponseSchema } } },
      ...errorResponses(
        { code: "VALIDATION", details: { fields: { endsAt: LOT_TEXT.endsAtTooSoon } } },
        { code: "UNAUTHENTICATED", message: AUTH_TEXT.unauthenticated },
        { code: "ROLE_NOT_ALLOWED", message: CATALOG_TEXT.roleNotAllowed },
        { code: "NOT_FOUND", message: CATALOG_TEXT.notFound },
        { code: "PAYLOAD_TOO_LARGE", message: LOT_TEXT.uploadTooLarge },
        "RATE_LIMITED",
        { code: "EXTERNAL_UNAVAILABLE", message: CATALOG_TEXT.fipeUnavailable, details: { source: "FIPE" } },
      ),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/lots/{id}/cancel",
    tags: [TAGS.lots],
    summary: "Cancela um lote",
    description:
      "**Papel exigido: `AUCTIONEER`, dono do lote.** Cancela um lote agendado ou ao vivo, com ou sem lances. O saldo " +
      "comprometido do líder volta a ele (estorno), a linha de cancelamento entra na cadeia de auditoria e o lote some da " +
      "Vitrine. `confirmEntryCount` é a contagem de linhas da cadeia que o leiloeiro viu: se entrou lance nesse meio " +
      "tempo, volta `LOT_CHANGED` com a contagem real e é preciso confirmar de novo.",
    security: REQUIRES_AUTH,
    request: {
      params: z.object({ id: lotId }),
      body: { required: true, content: { "application/json": { schema: cancelBody, example: { confirmEntryCount: 3 } } } },
    },
    responses: {
      200: { description: "O lote já cancelado, como a Sala o lê.", content: { "application/json": { schema: lotStateSchema } } },
      ...errorResponses(
        "VALIDATION",
        { code: "UNAUTHENTICATED", message: AUTH_TEXT.unauthenticated },
        { code: "ROLE_NOT_ALLOWED", message: CANCEL_TEXT.roleNotAllowed },
        { code: "FORBIDDEN", message: CANCEL_TEXT.forbidden },
        { code: "NOT_FOUND", message: CANCEL_TEXT.notFound },
        { code: "LOT_CANCELLED", message: CANCEL_TEXT.lotCancelled },
        { code: "LOT_ENDED", message: CANCEL_TEXT.lotEnded },
        { code: "LOT_CHANGED", message: lotChangedMessage(4), details: { entryCount: 4 } },
        "PAYLOAD_TOO_LARGE",
      ),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/my/lots",
    tags: [TAGS.lots],
    summary: "Painel do leiloeiro",
    description:
      "**Papel exigido: `AUCTIONEER`.** Os lotes do leiloeiro com o resultado de cada encerrado, o estorno dos " +
      "cancelados e o total recebido (soma das vendas liquidadas; cancelados não entram). Não confundir com `/me/bids`.",
    security: REQUIRES_AUTH,
    responses: {
      200: { description: "Lotes do leiloeiro.", content: { "application/json": { schema: myLotsSchema } } },
      ...errorResponses(
        { code: "UNAUTHENTICATED", message: AUTH_TEXT.unauthenticated },
        { code: "ROLE_NOT_ALLOWED", message: CATALOG_TEXT.roleNotAllowed },
      ),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/items/{id}/image",
    tags: [TAGS.lots],
    summary: "Capa do carro",
    description:
      "Foto de capa (posição 0) guardada no banco. Público, sem chamada externa. Cabeçalhos imutáveis, `ETag` e 304 " +
      "sem ler o arquivo. O tipo da resposta é `image/jpeg`, `image/png` ou `image/webp`.",
    request: { params: z.object({ id: itemId }), headers: ifNoneMatch },
    responses: imageResponses(),
  });

  registry.registerPath({
    method: "get",
    path: "/items/{id}/images/{position}",
    tags: [TAGS.lots],
    summary: "Foto da galeria",
    description:
      "Foto de uma posição da galeria (0 a 4, sem zero à esquerda; a posição 0 é a capa). Qualquer outro valor volta 404 " +
      "sem tocar no banco. Mesmos cabeçalhos, `ETag` e 304 da capa.",
    request: {
      params: z.object({
        id: itemId,
        position: z.enum(["0", "1", "2", "3", "4"]).describe("Posição da foto na galeria."),
      }),
      headers: ifNoneMatch,
    },
    responses: imageResponses(),
  });
}
