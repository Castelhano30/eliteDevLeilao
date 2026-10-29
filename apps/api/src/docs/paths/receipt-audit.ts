import { z } from "zod";
import { LOT_TEXT, RECEIPT_TEXT } from "@lanceauto/shared";
import { registry } from "../registry";
import { auditSchema, receiptSchema } from "../schemas";
import { OPTIONAL_AUTH, TAGS, errorResponses } from "./common";

const NO_STORE = { "Cache-Control": { description: "`no-store`.", schema: { type: "string" as const } } };

export function registerReceiptAuditPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/receipts/{token}",
    tags: [TAGS.receipt],
    summary: "Comprovante público",
    description:
      "Abre o comprovante de um arremate pelo token do link (`/c/{token}` no web). Sem login. O token tem 32 caracteres " +
      "(24 bytes aleatórios em base64url). Token inexistente e token malformado respondem igual, 404, para ninguém " +
      "aprender nada adivinhando. Nunca vai para cache. A resposta não traz usuário, nome, e-mail nem o token.",
    request: {
      params: z.object({
        token: z
          .string()
          .describe("Token do comprovante: só quem recebeu o link (o vencedor) o conhece.")
          .openapi({ example: "Abcdefghijklmnopqrstuvwxyz012345" }),
      }),
    },
    responses: {
      200: {
        description: "Comprovante.",
        headers: NO_STORE,
        content: { "application/json": { schema: receiptSchema } },
      },
      ...errorResponses({ code: "NOT_FOUND", message: RECEIPT_TEXT.notFoundBody }),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/lots/{id}/audit",
    tags: [TAGS.audit],
    summary: "Auditoria pública do lote",
    description:
      "Refaz, do primeiro ao último lance, o HMAC-SHA256 de cada linha da cadeia (cada hash entra no cálculo do " +
      "seguinte) e compara com o selo do lote e com o comprovante. O veredito é `OK` ou aponta o primeiro registro " +
      "problemático (`BROKEN_AT`, `SEAL_MISMATCH`, `RECEIPT_MISMATCH`). Quem confere é o servidor; a chave fica só " +
      "no servidor. Sem login: o token é opcional e serve só para marcar as linhas do próprio usuário (`mine`). " +
      "Recalcula a cada chamada, então tem limite de 60 requisições por minuto por IP. Nunca vai para cache. O " +
      "token do comprovante não aparece aqui: só o código `receiptCode`.",
    security: OPTIONAL_AUTH,
    request: { params: z.object({ id: z.string().describe("Id do lote.").openapi({ example: "cm2x7q1ab0000lot" }) }) },
    responses: {
      200: { description: "Cadeia e veredito.", headers: NO_STORE, content: { "application/json": { schema: auditSchema } } },
      ...errorResponses({ code: "NOT_FOUND", message: LOT_TEXT.notFoundTitle }, "RATE_LIMITED"),
    },
  });
}
