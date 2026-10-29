import { z } from "zod";
import { AUTH_TEXT, MAX_DEPOSIT_CENTS, depositInputSchema, formatBRL, loginInputSchema, registerInputSchema } from "@lanceauto/shared";
import { registry } from "../registry";
import { authResponseSchema, depositResponseSchema, meResponseSchema, walletPageSchema } from "../schemas";
import { REQUIRES_AUTH, TAGS, errorResponses } from "./common";

// `.describe()` clona o esquema do shared já com `.openapi()`: instâncias criadas antes do `extendZodWithOpenApi` não o têm.
const registerBody = registry.register(
  "RegisterInput",
  registerInputSchema
    .extend({ email: registerInputSchema.shape.email.describe("E-mail da conta; guardado em minúsculas.").openapi({ format: "email" }) })
    .describe("Cadastro. Nome até 120 caracteres; senha de 8 a 72 bytes UTF-8; papel `BIDDER` ou `AUCTIONEER`."),
);
const loginBody = registry.register(
  "LoginInput",
  loginInputSchema
    .extend({ email: loginInputSchema.shape.email.describe("E-mail da conta.").openapi({ format: "email" }) })
    .describe("E-mail e senha da conta."),
);
const depositBody = registry.register(
  "DepositInput",
  depositInputSchema.describe(`Valor do depósito em centavos inteiros, até ${MAX_DEPOSIT_CENTS} (${formatBRL(MAX_DEPOSIT_CENTS)}).`),
);

export function registerAccountPaths(): void {
  registry.registerPath({
    method: "post",
    path: "/auth/register",
    tags: [TAGS.auth],
    summary: "Cria uma conta",
    description:
      "Cadastra licitante (`BIDDER`) ou leiloeiro (`AUCTIONEER`); o papel é fixo, um por conta. A senha tem de 8 a 72 " +
      "bytes UTF-8. O e-mail é guardado em minúsculas. Devolve o token já pronto para uso. Limite: `AUTH_RATE_LIMIT_MAX` " +
      "requisições por minuto por IP (padrão 30), somado ao login.",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: registerBody,
            example: { name: "Ana Souza", email: "ana@lanceauto.test", password: "lance1234", role: "BIDDER" },
          },
        },
      },
    },
    responses: {
      201: { description: "Conta criada.", content: { "application/json": { schema: authResponseSchema } } },
      ...errorResponses(
        "VALIDATION",
        { code: "EMAIL_TAKEN", message: AUTH_TEXT.emailTaken, details: { fields: { email: AUTH_TEXT.emailTaken } } },
        "PAYLOAD_TOO_LARGE",
        "RATE_LIMITED",
      ),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/login",
    tags: [TAGS.auth],
    summary: "Entra na conta",
    description: "Troca e-mail e senha por um token JWT. Divide o limite de requisições por IP com o cadastro.",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: loginBody,
            example: { email: "ana@lanceauto.test", password: "lance1234" },
          },
        },
      },
    },
    responses: {
      200: { description: "Login feito.", content: { "application/json": { schema: authResponseSchema } } },
      ...errorResponses(
        "VALIDATION",
        { code: "INVALID_CREDENTIALS", message: AUTH_TEXT.invalidCredentials },
        "PAYLOAD_TOO_LARGE",
        "RATE_LIMITED",
      ),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/me",
    tags: [TAGS.account],
    summary: "Usuário logado e carteira",
    description: "Perfil e saldos de quem enviou o token. Serve ao cabeçalho do web.",
    security: REQUIRES_AUTH,
    responses: {
      200: { description: "Usuário e carteira.", content: { "application/json": { schema: meResponseSchema } } },
      ...errorResponses({ code: "UNAUTHENTICATED", message: AUTH_TEXT.unauthenticated }),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/wallet",
    tags: [TAGS.account],
    summary: "Carteira e extrato",
    description:
      "Saldos, uma página do extrato (movimento mais novo primeiro) e os lotes em que o usuário lidera. Para a página " +
      "seguinte, repita a chamada com o `nextCursor` recebido. Vale para os dois papéis.",
    security: REQUIRES_AUTH,
    request: {
      query: z.object({
        cursor: z.string().optional().describe("`nextCursor` da página anterior. Cursor mal formado volta 400."),
      }),
    },
    responses: {
      200: { description: "Carteira e página do extrato.", content: { "application/json": { schema: walletPageSchema } } },
      ...errorResponses(
        { code: "VALIDATION", message: "Cursor inválido.", details: { fields: { cursor: "Cursor inválido." } } },
        { code: "UNAUTHENTICATED", message: AUTH_TEXT.unauthenticated },
      ),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/wallet/deposits",
    tags: [TAGS.account],
    summary: "Deposita saldo simulado",
    description:
      `Soma \`amountCents\` ao saldo total. Aceita inteiros positivos de até ${formatBRL(MAX_DEPOSIT_CENTS)} por depósito ` +
      `(${MAX_DEPOSIT_CENTS} centavos); acima disso volta 400. A tela só oferece múltiplos de 100. **Papel exigido: \`BIDDER\`.**`,
    security: REQUIRES_AUTH,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: depositBody, example: { amountCents: 50_000_000 } } },
      },
    },
    responses: {
      201: { description: "Depósito gravado.", content: { "application/json": { schema: depositResponseSchema } } },
      ...errorResponses(
        "VALIDATION",
        { code: "UNAUTHENTICATED", message: AUTH_TEXT.unauthenticated },
        { code: "ROLE_NOT_ALLOWED", message: AUTH_TEXT.depositRoleNotAllowed },
        "PAYLOAD_TOO_LARGE",
      ),
    },
  });
}
