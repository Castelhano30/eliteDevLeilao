import type { PrismaClient } from "@prisma/client";
import type { FakeClock } from "../../src/infra/clock";
import { createLogger } from "../../src/infra/logger";
import { makeSettlementJob } from "../../src/infra/settlement-job";
import type { Publisher } from "../../src/infra/publisher";
import { makeSettlementService } from "../../src/services/settlement.service";
import { RecordingPublisher } from "./bids";

export interface LogLine {
  level: number;
  msg?: string;
  lotId?: string;
}

/** Nível pino de `error`. */
export const LOG_ERROR = 50;

/**
 * Service e rotina de fechamento sobre o banco de testes, com o relógio do teste e um logger que guarda as linhas
 * (para conferir o que foi logado em nível erro). Sem timer: os testes chamam `sweep` à mão.
 */
export function makeSettlement(prisma: PrismaClient, clock: FakeClock, publisher: Publisher = new RecordingPublisher()) {
  const logs: LogLine[] = [];
  const logger = createLogger("info", { write: (line: string) => void logs.push(JSON.parse(line) as LogLine) });
  const settlement = makeSettlementService({ db: prisma, clock });
  const job = makeSettlementJob({ db: prisma, clock, settlement, publisher, logger });
  return { settlement, job, logs, publisher, errors: () => logs.filter((line) => line.level >= LOG_ERROR) };
}
