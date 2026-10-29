import { z } from "zod";
import { AUTH_TEXT, CATALOG_TEXT } from "@lanceauto/shared";
import { registry } from "../registry";
import { catalogListSchema, catalogPreviewSchema } from "../schemas";
import { REQUIRES_AUTH, TAGS, errorResponses } from "./common";

const IDS_RULE = "Só letras, dígitos, `_` e `-`, até 40 caracteres.";
const brandId = z.string().describe(`Id da marca na FIPE. ${IDS_RULE}`).openapi({ example: "59" });
const modelId = z.string().describe(`Id do modelo na FIPE. ${IDS_RULE}`).openapi({ example: "5940" });
const yearId = z.string().describe(`Id do ano na FIPE, por exemplo \`2022-5\`. ${IDS_RULE}`).openapi({ example: "2022-5" });

const COMMON =
  "**Papel exigido: `AUCTIONEER`.** Limite de 120 requisições por minuto por usuário. A resposta vem da FIPE, com " +
  "cache em memória e uso do cache vencido se a FIPE cair; sem cache e sem FIPE, volta 503.";

const catalogErrors = (...extra: Parameters<typeof errorResponses>) =>
  errorResponses(
    { code: "UNAUTHENTICATED", message: AUTH_TEXT.unauthenticated },
    { code: "ROLE_NOT_ALLOWED", message: CATALOG_TEXT.roleNotAllowed },
    "RATE_LIMITED",
    { code: "EXTERNAL_UNAVAILABLE", message: CATALOG_TEXT.fipeUnavailable, details: { source: "FIPE" } },
    ...extra,
  );

export function registerCatalogPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/catalog/brands",
    tags: [TAGS.catalog],
    summary: "Marcas da FIPE",
    description: COMMON,
    security: REQUIRES_AUTH,
    responses: {
      200: { description: "Marcas.", content: { "application/json": { schema: catalogListSchema } } },
      ...catalogErrors(),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/catalog/brands/{brandId}/models",
    tags: [TAGS.catalog],
    summary: "Modelos de uma marca",
    description: COMMON,
    security: REQUIRES_AUTH,
    request: { params: z.object({ brandId }) },
    responses: {
      200: { description: "Modelos.", content: { "application/json": { schema: catalogListSchema } } },
      ...catalogErrors("VALIDATION"),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/catalog/brands/{brandId}/models/{modelId}/years",
    tags: [TAGS.catalog],
    summary: "Anos de um modelo",
    description: COMMON,
    security: REQUIRES_AUTH,
    request: { params: z.object({ brandId, modelId }) },
    responses: {
      200: { description: "Anos.", content: { "application/json": { schema: catalogListSchema } } },
      ...catalogErrors("VALIDATION"),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/catalog/preview",
    tags: [TAGS.catalog],
    summary: "Ficha do carro e foto sugerida",
    description:
      `${COMMON}\n\nDevolve preço de referência, combustível e mês da FIPE, mais uma foto sugerida da Wikipedia. ` +
      "Se a Wikipedia falhar, a resposta continua 200 com `imageStatus` `UNAVAILABLE`: só a FIPE derruba esta rota.",
    security: REQUIRES_AUTH,
    request: { query: z.object({ brandId, modelId, yearId }) },
    responses: {
      200: { description: "Ficha do carro.", content: { "application/json": { schema: catalogPreviewSchema } } },
      ...catalogErrors("VALIDATION", { code: "NOT_FOUND", message: CATALOG_TEXT.notFound }),
    },
  });
}
