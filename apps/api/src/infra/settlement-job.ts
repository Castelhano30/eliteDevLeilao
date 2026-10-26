import type { PrismaClient } from "@prisma/client";
import type { SettleOutcome, SettlementService } from "../services/settlement.service";
import type { Clock } from "./clock";
import type { Logger } from "./logger";
import type { Publisher } from "./publisher";

/** Ciclo da rotina (INV-10). */
export const SETTLEMENT_INTERVAL_MS = 5_000;
/** Lotes vencidos por varredura; a posição avança mesmo quando algum lote falha. */
export const SETTLEMENT_BATCH = 100;

export interface SettlementJobDeps {
  db: PrismaClient;
  clock: Clock;
  settlement: Pick<SettlementService, "settleLot">;
  /** Recebe os eventos de cada lote logo depois do commit dele. */
  publisher: Publisher;
  logger: Logger;
  intervalMs?: number;
}

export interface SettlementJob {
  /** Varredura imediata (a do boot, que liquida o que venceu enquanto o servidor estava parado) e depois a cada ciclo. */
  start(): void;
  /** Para o timer e espera as varreduras em curso terminarem: nenhum lote fica meio liquidado. */
  stop(): Promise<void>;
  /** Uma varredura. Nunca rejeita. `publisher` ausente usa o da composição. */
  sweep(publisher?: Publisher): Promise<SettleOutcome[]>;
}

/**
 * Rotina de fechamento (INV-10, R-5.1, R-5.10): lista os lotes elegíveis sem lock e deixa cada `settleLot` travar,
 * reler e liquidar o seu numa transação própria. Um lote que falha é logado e não impede os seguintes; é tentado de
 * novo no próximo ciclo. Uma promise rejeitada solta derrubaria o processo (Node ≥ 15), que é justamente quem fecha
 * os lotes: por isso `sweep` e o handler do timer não deixam nada escapar.
 */
export function makeSettlementJob(deps: SettlementJobDeps): SettlementJob {
  const { db, clock, settlement, logger, intervalMs = SETTLEMENT_INTERVAL_MS } = deps;
  const inFlight = new Set<Promise<unknown>>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let ticking = false;
  let cursor: { endsAt: Date; number: number } | null = null;

  async function run(publisher: Publisher): Promise<SettleOutcome[]> {
    const outcomes: SettleOutcome[] = [];
    try {
      const eligible = { endsAt: { lte: clock.now() }, settledAt: null, cancelledAt: null };
      const candidates = await db.lot.findMany({
        where: cursor ? {
          ...eligible,
          OR: [{ endsAt: { gt: cursor.endsAt } }, { endsAt: cursor.endsAt, number: { gt: cursor.number } }],
        } : eligible,
        orderBy: [{ endsAt: "asc" }, { number: "asc" }],
        take: SETTLEMENT_BATCH,
        select: { id: true, endsAt: true, number: true },
      });
      if (candidates.length === 0) {
        cursor = null;
        return outcomes;
      }
      for (const { id } of candidates) {
        try {
          const outcome = await settlement.settleLot(id);
          outcomes.push(outcome);
          if (outcome.result === "SKIPPED") continue;
          logger.info({ lotId: id, result: outcome.result }, "lote liquidado");
          // Só depois do commit daquele lote (INV-4). Falha ao publicar não desfaz nem repete a liquidação.
          try {
            publisher.publish(outcome.events);
          } catch (err) {
            logger.error({ err, lotId: id }, "falha ao publicar os eventos do fechamento");
          }
        } catch (err) {
          logger.error({ err, lotId: id }, "falha ao liquidar o lote; tenta de novo no próximo ciclo");
        }
      }
      const last = candidates.at(-1)!;
      cursor = { endsAt: last.endsAt, number: last.number };
      if (candidates.length < SETTLEMENT_BATCH) cursor = null;
    } catch (err) {
      // Listagem de candidatos (banco caindo, conexão perdida): o ciclo termina e o próximo tick tenta de novo.
      logger.error({ err }, "falha ao listar os lotes vencidos");
    }
    return outcomes;
  }

  function sweep(publisher: Publisher = deps.publisher): Promise<SettleOutcome[]> {
    const promise = run(publisher);
    inFlight.add(promise);
    void promise.finally(() => inFlight.delete(promise));
    return promise;
  }

  /** O timer não reentra: ciclo que passa de 5 s faz o tick seguinte ser pulado. */
  function tick(): void {
    if (ticking) return;
    ticking = true;
    sweep()
      .catch((err: unknown) => logger.error({ err }, "falha na rotina de fechamento"))
      .finally(() => {
        ticking = false;
      });
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(tick, intervalMs);
      // O timer sozinho não segura o processo: o Vitest e o CI encerram.
      timer.unref();
      tick();
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
      await Promise.allSettled([...inFlight]);
    },
    sweep,
  };
}
