import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { Env } from "./env";
import { errorHandler, notFoundHandler } from "./errors";
import type { Logger } from "./infra/logger";
import type { Db } from "./infra/prisma";
import { requestContext } from "./middleware/request-context";
import { healthRouter } from "./routes/health";

export interface AppDeps {
  env: Pick<Env, "NODE_ENV" | "WEB_ORIGIN">;
  db: Db;
  logger: Logger;
}

export function createApp({ env, db, logger }: AppDeps): Express {
  const app = express();

  // Atrás do Render o IP real vem de X-Forwarded-For; sem isso o rate limit por IP vira global.
  if (env.NODE_ENV === "production") app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN }));
  app.use(requestContext(logger));
  app.use(express.json());

  app.use(healthRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
