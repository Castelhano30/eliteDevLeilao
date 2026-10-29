import { Router, type RequestHandler } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { buildOpenApiDocument } from "./document";

/** Caminhos da documentação: `/docs` e tudo abaixo dele (inclusive `/docs/openapi.json`). O Express roteia sem diferenciar caixa, então aqui também. */
export const isDocsPath = (path: string) => {
  const lower = path.toLowerCase();
  return lower === "/docs" || lower.startsWith("/docs/");
};

const defaultHelmet = helmet();

/**
 * Só a Swagger UI precisa de CSP mais folgada: ela injeta estilos em linha e usa imagens `data:`. Os scripts seguem
 * em `'self'` (o `swagger-ui-express` serve o inicializador como arquivo, não em linha). `upgrade-insecure-requests`
 * sai daqui para a UI abrir em `http://localhost` também no Safari. O resto da API mantém o `helmet()` padrão.
 */
const docsHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:"],
      "upgrade-insecure-requests": null,
    },
  },
});

/** `helmet()` padrão em tudo, exceto em `/docs`, que usa a política própria acima. */
export const securityHeaders: RequestHandler = (req, res, next) =>
  (isDocsPath(req.path) ? docsHelmet : defaultHelmet)(req, res, next);

/**
 * `GET /docs` (Swagger UI) e `GET /docs/openapi.json` (o documento). Sempre ligado, inclusive em produção: descreve só
 * contratos já públicos e não lê banco, env nem segredo.
 */
export function docsRouter(): Router {
  const router = Router();

  router.get("/docs/openapi.json", (_req, res) => {
    res.json(buildOpenApiDocument());
  });

  router.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      customSiteTitle: "LanceAuto API",
      swaggerOptions: {
        url: "/docs/openapi.json",
        // Sem o selo do validator.swagger.io: fora de localhost ele violaria o CSP e vazaria a URL.
        validatorUrl: null,
        // O Bearer digitado em "Authorize" sobrevive ao recarregar a página.
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    }),
  );

  return router;
}
