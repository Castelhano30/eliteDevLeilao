import { OpenAPIRegistry, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Precisa rodar antes de qualquer `.openapi()`; todos os módulos de docs importam o registro daqui.
extendZodWithOpenApi(z);

/** Único registro da documentação: os módulos de `paths/` e `schemas.ts` escrevem nele; `document.ts` o lê. */
export const registry = new OpenAPIRegistry();

/** Nome do esquema de segurança do JWT (Bearer). */
export const BEARER = "bearerAuth";

registry.registerComponent("securitySchemes", BEARER, {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description:
    "Token devolvido por `POST /auth/login` ou `POST /auth/register`. Envie `Authorization: Bearer <token>`. " +
    "Token ausente, inválido ou expirado volta 401 `UNAUTHENTICATED` nas rotas que exigem login.",
});
