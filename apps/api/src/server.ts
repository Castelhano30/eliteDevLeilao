import path from "node:path";
import dotenv from "dotenv";
import { EnvError, parseEnv, type Env } from "./env";
import { createLogger } from "./infra/logger";
import { createPrisma } from "./infra/prisma";
import { createRealtimeServer } from "./realtime";

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
  const { httpServer, io, settlementJob } = createRealtimeServer({ env, db: prisma, logger });

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "API no ar");
    // Varredura já no boot: liquida o que venceu enquanto o servidor estava parado (INV-10); depois, a cada 5 s.
    settlementJob.start();
  });

  const shutdown = () => {
    // Espera a liquidação em curso terminar: cada lote é uma transação, nenhum fica pela metade.
    void settlementJob.stop().finally(() => {
      void io.close(() => {
        void prisma.$disconnect().finally(() => process.exit(0));
      });
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
