import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { Env } from "./env";
import { errorHandler, notFoundHandler } from "./errors";
import type { Logger } from "./infra/logger";
import type { PrismaClient } from "@prisma/client";
import { makeAuth } from "./middleware/auth";
import { SystemClock, type Clock } from "./infra/clock";
import { guardPublisher, NoopPublisher, type Publisher } from "./infra/publisher";
import { ExternalCache } from "./infra/external-cache";
import { makeFipeCatalog, type CatalogPort } from "./infra/fipe";
import { makeImageStore, type ImageDownloader, type ImageStoreOptions } from "./infra/image-store";
import { makeWikipedia, type ImageSuggestionPort } from "./infra/wikipedia";
import { requestContext } from "./middleware/request-context";
import { accountRouter } from "./routes/account";
import { authRouter } from "./routes/auth";
import { healthRouter } from "./routes/health";
import { catalogRouter, lotsRouter } from "./routes/lots";
import { makeAuthService } from "./services/auth.service";
import { makeBidService } from "./services/bid.service";
import { makeCatalogService } from "./services/catalog.service";
import { makeLotService, type LotService } from "./services/lot.service";
import { makeWalletService } from "./services/wallet.service";

export interface AppDeps {
  env: Pick<
    Env,
    | "NODE_ENV"
    | "WEB_ORIGIN"
    | "JWT_SECRET"
    | "AUTH_RATE_LIMIT_MAX"
    | "AUDIT_HMAC_KEY"
    | "FIPE_BASE_URL"
    | "FIPE_TOKEN"
    | "WIKI_USER_AGENT"
    | "WIKIPEDIA_BASE_URL"
  >;
  db: PrismaClient;
  logger: Logger;
  clock?: Clock;
  /** Entrega os eventos de domínio depois do commit. Ausente, descarta; em produção é o do Socket.IO (`realtime.ts`). */
  publisher?: Publisher;
  /** Portas externas; ausentes, saem dos adaptadores reais apontados pelo env. Os testes injetam. */
  external?: {
    catalog?: CatalogPort;
    images?: ImageSuggestionPort;
    imageStore?: ImageDownloader;
    /** Timeout por chamada externa (padrão 4 s); os testes encurtam. */
    timeoutMs?: number;
    /** Ajustes do download (os testes de sucesso liberam o servidor local). */
    imageStoreOptions?: Partial<ImageStoreOptions>;
  };
}

export function createApp(deps: AppDeps): Express {
  return composeApp(deps).app;
}

/** O app e os services que o servidor de tempo real também usa (o snapshot do `lot:join`). */
export function composeApp({
  env,
  db,
  logger,
  clock = new SystemClock(),
  publisher: rawPublisher = new NoopPublisher(),
  external = {},
}: AppDeps): { app: Express; lots: LotService } {
  const app = express();
  // Publicar nunca derruba uma requisição já confirmada (R-4.2): um ponto só protege todas as rotas.
  const publisher = guardPublisher(rawPublisher, logger);

  // Atrás do proxy do Railway o IP real vem de X-Forwarded-For; sem isso o rate limit por IP vira global.
  if (env.NODE_ENV === "production") app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN }));
  app.use(requestContext(logger));
  app.use(express.json());

  const auth = makeAuth(env.JWT_SECRET);
  const authService = makeAuthService({ db, clock, jwtSecret: env.JWT_SECRET });
  const walletService = makeWalletService({ db, clock });

  // Cache em memória por fonte: zera quando o servidor reinicia (R-2.1).
  const catalog =
    external.catalog ??
    makeFipeCatalog({
      baseUrl: env.FIPE_BASE_URL,
      token: env.FIPE_TOKEN || undefined,
      cache: new ExternalCache({ clock, logger, source: "FIPE" }),
      timeoutMs: external.timeoutMs,
    });
  const images =
    external.images ??
    makeWikipedia({
      baseUrl: env.WIKIPEDIA_BASE_URL,
      userAgent: env.WIKI_USER_AGENT,
      cache: new ExternalCache({ clock, logger, source: "Wikipedia" }),
      timeoutMs: external.timeoutMs,
    });
  const imageStore =
    external.imageStore ?? makeImageStore({ userAgent: env.WIKI_USER_AGENT, ...external.imageStoreOptions });
  const catalogService = makeCatalogService({ catalog, images });
  const lotService = makeLotService({ db, clock, auditKey: env.AUDIT_HMAC_KEY, catalog, images, imageStore, logger });

  const bidService = makeBidService({ db, clock, auditKey: env.AUDIT_HMAC_KEY });

  app.use(healthRouter(db));
  app.use(authRouter(authService, env.AUTH_RATE_LIMIT_MAX));
  app.use(accountRouter(auth, authService, walletService, publisher));
  app.use(catalogRouter(auth, catalogService));
  app.use(lotsRouter(auth, lotService, bidService, clock, publisher));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, lots: lotService };
}
