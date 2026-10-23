import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { Env } from "./env";
import { errorHandler, notFoundHandler } from "./errors";
import type { Logger } from "./infra/logger";
import type { PrismaClient } from "@prisma/client";
import { makeAuth } from "./middleware/auth";
import { SystemClock, type Clock } from "./infra/clock";
import { requestContext } from "./middleware/request-context";
import { accountRouter } from "./routes/account";
import { authRouter } from "./routes/auth";
import { healthRouter } from "./routes/health";
import { makeAuthService } from "./services/auth.service";
import { makeWalletService } from "./services/wallet.service";

export interface AppDeps {
  env: Pick<Env, "NODE_ENV" | "WEB_ORIGIN" | "JWT_SECRET" | "AUTH_RATE_LIMIT_MAX">;
  db: PrismaClient;
  logger: Logger;
  clock?: Clock;
}

export function createApp({ env, db, logger, clock = new SystemClock() }: AppDeps): Express {
  const app = express();

  // Atrás do proxy do Railway o IP real vem de X-Forwarded-For; sem isso o rate limit por IP vira global.
  if (env.NODE_ENV === "production") app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN }));
  app.use(requestContext(logger));
  app.use(express.json());

  const auth = makeAuth(env.JWT_SECRET);
  const authService = makeAuthService({ db, clock, jwtSecret: env.JWT_SECRET });
  const walletService = makeWalletService({ db, clock });

  app.use(healthRouter(db));
  app.use(authRouter(authService, env.AUTH_RATE_LIMIT_MAX));
  app.use(accountRouter(auth, authService, walletService));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
