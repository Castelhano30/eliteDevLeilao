import { registry } from "../registry";
import { healthDownSchema, healthOkSchema } from "../schemas";
import { TAGS } from "./common";

export function registerHealthPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/health",
    tags: [TAGS.health],
    summary: "Verifica o processo e o banco",
    description: "Faz um `SELECT 1` no banco. Público, sem login e sem limite de requisições.",
    responses: {
      200: {
        description: "Processo e banco respondendo.",
        content: { "application/json": { schema: healthOkSchema, example: { ok: true, db: true } } },
      },
      503: {
        description: "O processo responde, mas o banco não. Este é o único erro fora do envelope de erro.",
        content: { "application/json": { schema: healthDownSchema, example: { ok: false, db: false } } },
      },
    },
  });
}
