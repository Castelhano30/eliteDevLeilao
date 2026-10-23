import { createServer } from "node:http";
import path from "node:path";
import dotenv from "dotenv";
import { createApp } from "./app";
import { EnvError, parseEnv, type Env } from "./env";
import { createLogger } from "./infra/logger";
import { createPrisma } from "./infra/prisma";
import { attachSocket } from "./socket";

// O .env fica na raiz do monorepo (src/ e dist/ estão no mesmo nível, então o caminho vale para os dois).
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

function loadEnv(): Env {
  try {
    return parseEnv(process.env);
  } catch (err) {
    if (err instanceof EnvError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

function main() {
  const env = loadEnv();
  const logger = createLogger(env.NODE_ENV === "production" ? "info" : "debug");
  const prisma = createPrisma(env.DATABASE_URL);
  const app = createApp({ env, db: prisma, logger });
  const httpServer = createServer(app);
  const io = attachSocket(httpServer, env.WEB_ORIGIN, env.JWT_SECRET);

  httpServer.listen(env.PORT, () => logger.info({ port: env.PORT }, "API no ar"));

  const shutdown = () => {
    void io.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
