import SwaggerParser from "@apidevtools/swagger-parser";
import express from "express";
import helmet from "helmet";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  ERROR_HTTP_STATUS,
  EVENTS,
  LOT_IMAGE_MAX_BYTES,
  LOT_IMAGE_MAX_COUNT,
  LOT_PAYLOAD_MAX_BYTES,
  LOT_UPLOAD_MAX_BYTES,
  LOT_UPLOAD_MIME_TYPES,
} from "@lanceauto/shared";
import { createApp } from "../app";
import { createLogger } from "../infra/logger";
import { testEnv, tokenFor } from "../../test/helpers/app";
import { registeredRoutes } from "../../test/helpers/routes";
import { buildOpenApiDocument } from "./document";
import { isDocsPath } from "./router";

// Sem banco: nada aqui toca o Prisma (como o `health.test.ts`).
const db = { $queryRaw: () => Promise.reject(new Error("sem banco")), $disconnect: () => undefined };
const makeApp = () => createApp({ env: testEnv, db: db as never, logger: createLogger("silent") });

type Json = Record<string, unknown>;

interface Operation {
  tags: string[];
  summary: string;
  description?: string;
  security?: Array<Record<string, string[]>>;
  parameters?: Array<{ name: string; in: string; schema: Json }>;
  requestBody?: { content: Record<string, { schema: Json; encoding?: Json }> };
  responses: Record<
    string,
    { content?: Record<string, { schema?: Json; examples?: Record<string, { value: { error: { code: string } } }> }> }
  >;
}

interface Doc {
  openapi: string;
  info: { description: string };
  servers: Array<{ url: string }>;
  tags: Array<{ name: string; description: string }>;
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Json>; securitySchemes: Record<string, Json> };
}

const doc = () => structuredClone(buildOpenApiDocument()) as unknown as Doc;

const operations = () =>
  Object.entries(doc().paths).flatMap(([path, item]) =>
    Object.entries(item).map(([method, operation]) => ({ method, path, operation })),
  );

describe("GET /docs/openapi.json", () => {
  it("responde 200 JSON com um OpenAPI 3.x que passa no swagger-parser, sem banco", async () => {
    const res = await request(makeApp()).get("/docs/openapi.json");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.openapi).toMatch(/^3\./);
    await expect(SwaggerParser.validate(structuredClone(res.body))).resolves.toBeTruthy();
  });

  it("tem servidor relativo, as oito tags em pt-BR e resumo em toda operação", () => {
    const d = doc();
    expect(d.servers).toEqual([expect.objectContaining({ url: "/" })]);
    expect(d.tags.map((tag) => tag.name)).toEqual([
      "Auth",
      "Conta",
      "Catálogo",
      "Lotes",
      "Lances",
      "Comprovante",
      "Auditoria",
      "Saúde",
    ]);
    for (const { path, method, operation } of operations()) {
      const where = `${method.toUpperCase()} ${path}`;
      expect(operation.summary, where).toBeTruthy();
      expect(operation.tags, where).toHaveLength(1);
      expect(d.tags.map((tag) => tag.name), where).toContain(operation.tags[0]);
    }
  });

  it("descreve o Socket.IO só em texto, com os nomes de evento de EVENTS, e fora dos caminhos", () => {
    const d = doc();
    for (const name of Object.values(EVENTS)) expect(d.info.description).toContain(name);
    expect(Object.keys(d.paths).some((path) => path.includes("socket"))).toBe(false);
  });
});

describe("GET /docs (Swagger UI)", () => {
  it("serve o HTML da UI e o inicializador que aponta para /docs/openapi.json, com CSP própria", async () => {
    const app = makeApp();
    const page = await request(app).get("/docs/");
    expect(page.status).toBe(200);
    expect(page.headers["content-type"]).toMatch(/text\/html/);
    expect(page.text).toContain("swagger-ui");
    const csp = String(page.headers["content-security-policy"]);
    expect(csp).toMatch(/style-src 'self' 'unsafe-inline'/);
    expect(csp).toMatch(/img-src 'self' data:/);
    // Scripts seguem só em 'self': a UI roda sem afrouxar o script-src.
    expect(csp).toMatch(/script-src 'self'(;|$)/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe/);

    const init = await request(app).get("/docs/swagger-ui-init.js");
    expect(init.status).toBe(200);
    expect(init.text).toContain("/docs/openapi.json");
    expect((await request(app).get("/docs/swagger-ui-bundle.js")).status).toBe(200);
  });

  it("o resto da API mantém o CSP padrão do helmet, sem nenhum ajuste da UI", async () => {
    const reference = express()
      .use(helmet())
      .get("/x", (_req, res) => void res.json({}));
    const expected = (await request(reference).get("/x")).headers["content-security-policy"];
    expect(expected).toBeTruthy();

    const health = await request(makeApp()).get("/health");
    expect(health.headers["content-security-policy"]).toBe(expected);
    expect(String(expected)).toContain("upgrade-insecure-requests");
    const notFound = await request(makeApp()).get("/docsx");
    expect(notFound.headers["content-security-policy"]).toBe(expected);
  });

  it("o Express roteia /DOCS/ sem diferenciar caixa, então a CSP da UI vale também ali", async () => {
    const app = makeApp();
    for (const path of ["/DOCS/", "/Docs/openapi.json"]) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(200);
      const csp = String(res.headers["content-security-policy"]);
      expect(csp, path).toMatch(/style-src 'self' 'unsafe-inline'/);
      expect(csp, path).not.toContain("upgrade-insecure-requests");
    }
  });

  it("a UI não pede o selo do validator.swagger.io", async () => {
    const init = await request(makeApp()).get("/docs/swagger-ui-init.js");
    expect(init.text).toMatch(/"validatorUrl":\s*null/);
  });
});

describe("cobertura de rotas", () => {
  const documented = () => new Set(operations().map(({ method, path }) => `${method.toUpperCase()} ${path}`));
  const real = (app: ReturnType<typeof makeApp>) =>
    registeredRoutes(app)
      .filter((route) => !isDocsPath(route.path))
      .map((route) => `${route.method.toUpperCase()} ${route.path}`);

  it("documenta as 22 operações, todas as rotas GET/POST do Express, e nada além delas", () => {
    const routes = real(makeApp());
    expect(routes).toHaveLength(22);
    const undocumented = routes.filter((route) => !documented().has(route));
    expect(undocumented, `rotas sem documentação: ${undocumented.join(", ")}`).toEqual([]);
    const stale = [...documented()].filter((route) => !routes.includes(route));
    expect(stale, `documentadas sem rota: ${stale.join(", ")}`).toEqual([]);
  });

  it("acusa, nomeando método e caminho, uma rota nova que entrou sem documentação", () => {
    const app = makeApp();
    app.get("/rota-nova", (_req, res) => void res.end());
    app.post("/rota-nova/:id", (_req, res) => void res.end());
    const undocumented = real(app).filter((route) => !documented().has(route));
    expect(undocumented).toEqual(["GET /rota-nova", "POST /rota-nova/{id}"]);
  });
});

describe("contratos do documento", () => {
  it("usa Bearer em requireAuth, Bearer opcional em optionalAuth e nada nas rotas públicas", () => {
    const d = doc();
    expect(d.components.securitySchemes.bearerAuth).toMatchObject({ type: "http", scheme: "bearer", bearerFormat: "JWT" });
    const securityOf = (method: string, path: string) => d.paths[path]?.[method]?.security;
    const required = [{ bearerAuth: [] }];
    const optional = [{}, { bearerAuth: [] }];

    for (const [method, path] of [
      ["get", "/me"],
      ["get", "/wallet"],
      ["post", "/wallet/deposits"],
      ["get", "/catalog/brands"],
      ["get", "/catalog/brands/{brandId}/models"],
      ["get", "/catalog/brands/{brandId}/models/{modelId}/years"],
      ["get", "/catalog/preview"],
      ["post", "/lots"],
      ["post", "/lots/{id}/bids"],
      ["post", "/lots/{id}/cancel"],
      ["get", "/my/lots"],
      ["get", "/me/bids"],
    ] as const) {
      expect(securityOf(method, path), `${method} ${path}`).toEqual(required);
    }
    for (const [method, path] of [
      ["get", "/lots/{id}"],
      ["get", "/lots/{id}/audit"],
    ] as const) {
      expect(securityOf(method, path), `${method} ${path}`).toEqual(optional);
    }
    for (const [method, path] of [
      ["get", "/health"],
      ["post", "/auth/register"],
      ["post", "/auth/login"],
      ["get", "/brands"],
      ["get", "/lots"],
      ["get", "/items/{id}/image"],
      ["get", "/items/{id}/images/{position}"],
      ["get", "/receipts/{token}"],
    ] as const) {
      expect(securityOf(method, path), `${method} ${path}`).toBeUndefined();
    }
  });

  it("cita o papel exigido na descrição das rotas com requireRole", () => {
    const d = doc();
    const auctioneer: Array<[string, string]> = [
      ["/catalog/brands", "get"],
      ["/catalog/brands/{brandId}/models", "get"],
      ["/catalog/brands/{brandId}/models/{modelId}/years", "get"],
      ["/catalog/preview", "get"],
      ["/lots", "post"],
      ["/lots/{id}/cancel", "post"],
      ["/my/lots", "get"],
    ];
    for (const [path, method] of auctioneer) expect(d.paths[path]![method]!.description, path).toContain("AUCTIONEER");
    expect(d.paths["/wallet/deposits"]!.post!.description).toContain("BIDDER");
    expect(d.paths["/me/bids"]!.get!.description).toContain("BIDDER");
  });

  it("usa os códigos e status reais de errors.ts, no envelope, e 429 onde há limitador", () => {
    const limited = new Set([
      "POST /auth/register",
      "POST /auth/login",
      "GET /catalog/brands",
      "GET /catalog/brands/{brandId}/models",
      "GET /catalog/brands/{brandId}/models/{modelId}/years",
      "GET /catalog/preview",
      "POST /lots",
      "POST /lots/{id}/bids",
      "GET /lots/{id}/audit",
    ]);
    for (const { method, path, operation } of operations()) {
      const where = `${method.toUpperCase()} ${path}`;
      expect(Object.keys(operation.responses).includes("429"), where).toBe(limited.has(where));
      for (const [status, response] of Object.entries(operation.responses)) {
        if (Number(status) < 400 || where === "GET /health") continue;
        const media = response.content?.["application/json"];
        expect(media?.schema, `${where} ${status}`).toEqual({ $ref: "#/components/schemas/ErrorEnvelope" });
        for (const [code, example] of Object.entries(media?.examples ?? {})) {
          expect(example.value.error.code).toBe(code);
          expect(ERROR_HTTP_STATUS[code as keyof typeof ERROR_HTTP_STATUS], `${where} ${code}`).toBe(Number(status));
        }
      }
    }
  });

  it("documenta o multipart de POST /lots com os limites lidos do shared", () => {
    const d = doc();
    const body = d.paths["/lots"]!.post!.requestBody!.content;
    expect(Object.keys(body).sort()).toEqual(["application/json", "multipart/form-data"]);
    const form = body["multipart/form-data"]!;
    const props = (form.schema as { properties: Record<string, Json> }).properties;
    expect(Object.keys(props).sort()).toEqual(["images", "payload"]);
    expect(props.images).toMatchObject({
      type: "array",
      maxItems: LOT_IMAGE_MAX_COUNT,
      items: { type: "string", format: "binary" },
    });
    expect(String(props.images!.description)).toContain(`${LOT_IMAGE_MAX_BYTES / 1024 / 1024} MiB`);
    expect(String(props.images!.description)).toContain(`${LOT_UPLOAD_MAX_BYTES / 1024 / 1024} MiB`);
    expect(String(props.payload!.description)).toContain(`${LOT_PAYLOAD_MAX_BYTES / 1024} KiB`);
    expect((form.encoding as { images: { contentType: string } }).images.contentType).toBe(
      LOT_UPLOAD_MIME_TYPES.join(", "),
    );
    // O corpo JSON reaproveita o zod do shared.
    expect(body["application/json"]!.schema).toEqual({ $ref: "#/components/schemas/CreateLotInput" });
    expect(d.components.schemas.CreateLotInput).toMatchObject({
      required: expect.arrayContaining(["brandId", "modelId", "yearId", "title", "startingBidCents", "startsAt", "endsAt"]),
    });
  });

  it("serve as imagens como binário image/jpeg|png|webp, com ETag e 304", () => {
    const d = doc();
    for (const path of ["/items/{id}/image", "/items/{id}/images/{position}"]) {
      const get = d.paths[path]!.get!;
      const ok = get.responses["200"] as unknown as { content: Json; headers: Json };
      expect(Object.keys(ok.content).sort()).toEqual([...LOT_UPLOAD_MIME_TYPES].sort());
      expect(ok.headers).toHaveProperty("ETag");
      expect(get.responses["304"]).toBeDefined();
      expect(get.parameters!.map((p) => p.name)).toContain("If-None-Match");
    }
    const position = d.paths["/items/{id}/images/{position}"]!.get!.parameters!.find((p) => p.name === "position");
    expect(position!.schema.enum).toEqual(["0", "1", "2", "3", "4"]);
  });

  it("escreve dinheiro como inteiro, datas como date-time e ids sem format uuid", () => {
    expect(JSON.stringify(doc())).not.toContain('"format":"uuid"');
    const walk = (node: unknown, trail: string): void => {
      if (Array.isArray(node)) return node.forEach((item, i) => walk(item, `${trail}[${i}]`));
      if (node === null || typeof node !== "object") return;
      const object = node as Json;
      const properties = object.properties as Record<string, Json> | undefined;
      for (const [name, schema] of Object.entries(properties ?? {})) {
        const type = ([] as unknown[]).concat(schema.type).filter((t) => t !== "null");
        if (name.endsWith("Cents")) expect(type, `${trail}.${name}`).toEqual(["integer"]);
      }
      for (const [key, value] of Object.entries(object)) walk(value, `${trail}.${key}`);
    };
    walk(doc().components.schemas, "schemas");
  });
});

describe("privacidade", () => {
  /** Nomes de propriedade que identificam alguém ou dão acesso: nunca numa resposta pública. */
  const FORBIDDEN = /user_?id|e-?mail|token|^name$|leader_?id|bidder_?id|winner_?id|password/i;
  /** Única permissão: o dono vê o próprio token do comprovante na Sala (T9). Em qualquer outra operação pública, nenhuma. */
  const OWNER_ALLOWED: Record<string, string[]> = { "get /lots/{id}": ["myReceiptToken"] };

  /** Todos os nomes de propriedade alcançáveis a partir de um nó, seguindo `$ref`. */
  function propertyNames(root: unknown, schemas: Record<string, unknown>): Set<string> {
    const names = new Set<string>();
    const seen = new Set<string>();
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (node === null || typeof node !== "object") return;
      const object = node as Json;
      if (typeof object.$ref === "string") {
        const key = object.$ref.split("/").pop()!;
        if (seen.has(key)) return;
        seen.add(key);
        return visit(schemas[key]);
      }
      for (const name of Object.keys((object.properties as Json | undefined) ?? {})) names.add(name);
      Object.values(object).forEach(visit);
    };
    visit(root);
    return names;
  }

  it("nenhuma resposta pública traz userId, nome, e-mail nem token", () => {
    const d = doc();
    // Pública = sem login obrigatório. As respostas de Auth entregam ao dono o próprio token e perfil.
    const publicOps = operations().filter(
      ({ operation }) =>
        (operation.security === undefined || operation.security.some((s) => Object.keys(s).length === 0)) &&
        operation.tags[0] !== "Auth",
    );
    expect(publicOps.map(({ method, path }) => `${method} ${path}`).sort()).toEqual([
      "get /brands",
      "get /health",
      "get /items/{id}/image",
      "get /items/{id}/images/{position}",
      "get /lots",
      "get /lots/{id}",
      "get /lots/{id}/audit",
      "get /receipts/{token}",
    ]);
    for (const { method, path, operation } of publicOps) {
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!status.startsWith("2")) continue;
        const names = propertyNames(response, d.components.schemas);
        const allowed = OWNER_ALLOWED[`${method} ${path}`] ?? [];
        const leaked = [...names].filter((name) => FORBIDDEN.test(name) && !allowed.includes(name));
        expect(leaked, `${method} ${path} ${status} expõe ${leaked.join(", ")}`).toEqual([]);
      }
    }
  });

  it("o token do comprovante só aparece como parâmetro, em myReceiptToken (dono) e em receiptToken (Meus arremates)", () => {
    const d = doc();
    const holders = Object.entries(d.components.schemas)
      .map(([name, schema]) => [name, Object.keys((schema.properties as Json | undefined) ?? {}).filter((key) => /oken/.test(key))] as const)
      .filter(([, keys]) => keys.length > 0);
    expect(holders).toEqual([
      ["AuthResponse", ["token"]],
      ["LotStateLot", ["myReceiptToken"]],
      ["MyBidItem", ["receiptToken"]],
    ]);
    expect(d.paths["/receipts/{token}"]!.get!.parameters!.map((p) => p.name)).toEqual(["token"]);
    // A auditoria não carrega o token: só o código.
    const auditNames = propertyNames({ $ref: "#/components/schemas/AuditView" }, d.components.schemas);
    expect(auditNames.has("receiptCode")).toBe(true);
    expect([...auditNames].filter((name) => FORBIDDEN.test(name))).toEqual([]);
  });
});

/**
 * A verdade vem do app real, sem banco: cada operação é chamada de verdade e o documento é conferido contra a
 * resposta. Com `db` vazio, o que passa de auth e papel esbarra num 500 (o serviço não tem banco), e isso basta
 * para saber que auth e papel deixaram passar.
 */
describe("documento x comportamento real", () => {
  const appWith = () => createApp({ env: testEnv, db: {} as never, logger: createLogger("silent") });

  const concrete = (path: string) => path.replace(/\{\w+\}/g, "x");
  const send = (app: ReturnType<typeof appWith>, method: string, path: string, token?: string) => {
    const call = (request(app) as unknown as Record<string, (url: string) => request.Test>)[method]!(concrete(path));
    if (token) call.set("Authorization", `Bearer ${token}`);
    return method === "post" ? call.send({}) : call;
  };
  const documentedError = (operation: Operation, status: string, code: string) =>
    operation.responses[status]?.content?.["application/json"]?.examples?.[code]?.value.error as
      | { code: string; message: string }
      | undefined;
  const isOptionalOrPublic = (operation: Operation) =>
    !operation.security?.length || operation.security.some((s) => Object.keys(s).length === 0);

  const bidder = tokenFor("user-bidder", "BIDDER");
  const auctioneer = tokenFor("user-auctioneer", "AUCTIONEER");

  it("sem token: 401 UNAUTHENTICATED com a mensagem do exemplo onde o login é obrigatório; nunca 401 no resto", async () => {
    const app = appWith();
    for (const { method, path, operation } of operations()) {
      const where = `${method.toUpperCase()} ${path}`;
      const res = await send(app, method, path);
      if (isOptionalOrPublic(operation)) {
        expect(res.status, where).not.toBe(401);
        continue;
      }
      expect(res.status, where).toBe(401);
      expect(res.body.error.code, where).toBe("UNAUTHENTICATED");
      const example = documentedError(operation, "401", "UNAUTHENTICATED");
      expect(example, `${where} sem exemplo de UNAUTHENTICATED`).toBeDefined();
      expect(example!.message, where).toBe(res.body.error.message);
    }
  });

  it("papel errado: 403 ROLE_NOT_ALLOWED com a mensagem documentada, só onde a descrição diz \"Papel exigido\"", async () => {
    // POST /lots/{id}/bids fica de fora: ali o leiloeiro só é barrado dentro do serviço, depois de abrir a transação no banco.
    const app = appWith();
    const gated: string[] = [];
    for (const { method, path, operation } of operations()) {
      if (isOptionalOrPublic(operation)) continue;
      const where = `${method.toUpperCase()} ${path}`;
      const refused: string[] = [];
      for (const [role, token] of [
        ["BIDDER", bidder],
        ["AUCTIONEER", auctioneer],
      ] as const) {
        const res = await send(app, method, path, token);
        if (res.status === 403 && res.body.error?.code === "ROLE_NOT_ALLOWED") {
          refused.push(role);
          expect(documentedError(operation, "403", "ROLE_NOT_ALLOWED")?.message, `${where} ${role}`).toBe(
            res.body.error.message,
          );
        }
      }
      if (refused.length === 0) continue;
      gated.push(where);
      // O papel recusado é o oposto do exigido, e a descrição cita o exigido.
      expect(refused, where).toHaveLength(1);
      const required = refused[0] === "BIDDER" ? "AUCTIONEER" : "BIDDER";
      expect(operation.description, where).toContain(`**Papel exigido: \`${required}\``);
    }
    const claimed = operations()
      .filter(({ operation }) => operation.description?.includes("**Papel exigido:"))
      .map(({ method, path }) => `${method.toUpperCase()} ${path}`);
    expect(gated.sort()).toEqual(claimed.sort());
  });

  it("o limitador devolve 429 exatamente nas operações em que o documento declara 429", async () => {
    const previous = process.env.RATE_LIMIT_DISABLED;
    delete process.env.RATE_LIMIT_DISABLED;
    try {
      const limited: string[] = [];
      const declared: string[] = [];
      for (const { method, path, operation } of operations()) {
        const where = `${method.toUpperCase()} ${path}`;
        if (operation.responses["429"]) declared.push(where);
        // Um app novo por operação, com os contadores zerados. O token é do papel que passa pelo requireRole
        // (senão o papel barraria antes do limitador); o teto mais alto é 120 (catálogo).
        const app = appWith();
        const token = operation.description?.includes("**Papel exigido: `AUCTIONEER`") ? auctioneer : bidder;
        for (let i = 0; i < 125; i += 1) {
          const res = await send(app, method, path, isOptionalOrPublic(operation) ? undefined : token);
          if (res.status === 429) {
            expect(res.body.error.code, where).toBe("RATE_LIMITED");
            limited.push(where);
            break;
          }
        }
      }
      expect(limited.sort()).toEqual(declared.sort());
    } finally {
      if (previous === undefined) delete process.env.RATE_LIMIT_DISABLED;
      else process.env.RATE_LIMIT_DISABLED = previous;
    }
  }, 120_000);
});
