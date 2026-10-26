import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { EVENTS, RECEIPT_TOKEN_PATTERN, lotStatus } from "@lanceauto/shared";
import { FakeClock } from "../infra/clock";
import { createLogger } from "../infra/logger";
import { makeSettlementJob } from "../infra/settlement-job";
import { makeTestApp } from "../../test/helpers/app";
import { RecordingPublisher, assertLotInvariants, makeUser, postBid, type TestUser } from "../../test/helpers/bids";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { insertLot } from "../../test/helpers/lots";
import { makeSettlement } from "../../test/helpers/settlement";

const NOW = "2026-10-23T12:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const ENDS_AT = iso(NOW_MS + HOUR);
/** Lote de referência: inicial R$ 20.000, incremento R$ 1.000, ao vivo, fecha em 1 h. */
const LIVE = { startsAt: iso(NOW_MS - 2 * HOUR), endsAt: ENDS_AT, startingBidCents: 2_000_000, minIncrementCents: 100_000 };

describe.skipIf(!testDatabaseUrl)("fechamento e liquidação (integração, DATABASE_URL_TEST)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let app: ReturnType<typeof makeTestApp>["app"];
  let clock: FakeClock;
  let publisher: RecordingPublisher;
  let rig: ReturnType<typeof makeSettlement>;
  let ana: TestUser;
  let bruno: TestUser;
  let carla: TestUser;
  let joao: TestUser;

  const live = (extra: Partial<Parameters<typeof insertLot>[1]> = {}) =>
    insertLot(prisma, { auctioneerId: joao.id, ...LIVE, ...extra });
  const wallet = async (user: TestUser) => {
    const row = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    return { total: Number(row.totalCents), committed: Number(row.committedCents) };
  };
  async function bid(user: TestUser, lotId: string, amount: number, expected: number | null = null) {
    const res = await postBid(app, user, lotId, amount, expected);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
  }
  /** O exemplo do PRD: Ana 30.000, Bruno 31.000, Ana 32.000. */
  async function prdExample(lotId: string) {
    await bid(ana, lotId, 3_000_000);
    await bid(bruno, lotId, 3_100_000, 3_000_000);
    await bid(ana, lotId, 3_200_000, 3_100_000);
  }
  const reachEnd = () => clock.set(ENDS_AT);
  const count = {
    receipts: (lotId: string) => prisma.receipt.count({ where: { lotId } }),
    ledger: (lotId: string, kind: "SALE_DEBIT" | "SALE_CREDIT") => prisma.ledgerEntry.count({ where: { lotId, kind } }),
  };

  beforeEach(async () => {
    await truncateAll(prisma);
    publisher = new RecordingPublisher();
    ({ app, clock } = makeTestApp(prisma, {}, { timeoutMs: 300 }, publisher));
    ana = await makeUser(app, "Ana", { depositCents: 5_000_000 });
    bruno = await makeUser(app, "Bruno", { depositCents: 4_000_000 });
    carla = await makeUser(app, "Carla", { depositCents: 6_000_000 });
    joao = await makeUser(app, "Joao", { role: "AUCTIONEER" });
    rig = makeSettlement(prisma, clock, publisher);
    publisher.batches.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("liquidação com lances", () => {
    it("AC-5.1 e AC-5.2: o líder paga, o leiloeiro recebe, nasce um Receipt e o lote fica liquidado", async () => {
      const lot = await live();
      await prdExample(lot.id);
      expect(await wallet(ana)).toEqual({ total: 5_000_000, committed: 3_200_000 });
      reachEnd();

      const outcome = await rig.settlement.settleLot(lot.id);

      expect(outcome.result).toBe("SOLD");
      expect(await wallet(ana)).toEqual({ total: 1_800_000, committed: 0 });
      expect(await wallet(bruno)).toEqual({ total: 4_000_000, committed: 0 });
      expect(await wallet(joao)).toEqual({ total: 3_200_000, committed: 0 });

      const debit = await prisma.ledgerEntry.findFirstOrThrow({ where: { lotId: lot.id, kind: "SALE_DEBIT" } });
      expect(debit).toMatchObject({ userId: ana.id, amountCents: 3_200_000n, totalAfter: 1_800_000n, committedAfter: 0n });
      const credit = await prisma.ledgerEntry.findFirstOrThrow({ where: { lotId: lot.id, kind: "SALE_CREDIT" } });
      expect(credit).toMatchObject({ userId: joao.id, amountCents: 3_200_000n, totalAfter: 3_200_000n, committedAfter: 0n });
      expect(debit.createdAt.toISOString()).toBe(ENDS_AT);
      expect(await count.ledger(lot.id, "SALE_DEBIT")).toBe(1);
      expect(await count.ledger(lot.id, "SALE_CREDIT")).toBe(1);

      const settled = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
      const lastBid = await prisma.bid.findFirstOrThrow({ where: { lotId: lot.id }, orderBy: { seq: "desc" } });
      const receipt = await prisma.receipt.findUniqueOrThrow({ where: { lotId: lot.id } });
      expect(settled.settledAt?.toISOString()).toBe(ENDS_AT);
      expect(receipt).toMatchObject({ winnerId: ana.id, amountCents: 3_200_000n, pseudonym: lastBid.pseudonym });
      expect(receipt.token).toMatch(RECEIPT_TOKEN_PATTERN);
      expect(receipt.issuedAt.toISOString()).toBe(ENDS_AT);
      // INV-12: o comprovante repete o selo do lote e a liquidação não escreve na cadeia.
      expect(receipt.finalHash).toBe(settled.lastHash);
      expect(settled.entryCount).toBe(3);
      expect(lotStatus(settled, clock.now())).toBe("SOLD");
      await assertLotInvariants(prisma, lot.id);
    });

    it("líder que trocou três vezes: só o último paga e os anteriores seguem liberados", async () => {
      const lot = await live();
      await bid(ana, lot.id, 2_000_000);
      await bid(bruno, lot.id, 2_100_000, 2_000_000);
      await bid(carla, lot.id, 2_200_000, 2_100_000);
      reachEnd();
      await rig.settlement.settleLot(lot.id);
      expect(await wallet(ana)).toEqual({ total: 5_000_000, committed: 0 });
      expect(await wallet(bruno)).toEqual({ total: 4_000_000, committed: 0 });
      expect(await wallet(carla)).toEqual({ total: 3_800_000, committed: 0 });
      expect((await prisma.receipt.findUniqueOrThrow({ where: { lotId: lot.id } })).winnerId).toBe(carla.id);
    });

    it("valores no limite: lance de R$ 10.000.000,00 com carteira de R$ 20.000.000,00", async () => {
      const rich = await makeUser(app, "Rico", { depositCents: 1_000_000_000 });
      await request(app).post("/wallet/deposits").set("Authorization", rich.auth).send({ amountCents: 1_000_000_000 }).expect(201);
      const lot = await live();
      await bid(rich, lot.id, 1_000_000_000);
      reachEnd();
      expect((await rig.settlement.settleLot(lot.id)).result).toBe("SOLD");
      expect(await wallet(rich)).toEqual({ total: 1_000_000_000, committed: 0 });
      expect(await wallet(joao)).toEqual({ total: 1_000_000_000, committed: 0 });
    });
  });

  describe("liquidação sem lances", () => {
    it("AC-5.5: só settledAt; sem Receipt, sem ledger, UNSOLD e lot:closed sem valor", async () => {
      const lot = await live();
      reachEnd();
      const outcome = await rig.job.sweep();
      expect(outcome.map((o) => o.result)).toEqual(["UNSOLD"]);

      const settled = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
      expect(settled.settledAt?.toISOString()).toBe(ENDS_AT);
      expect(await count.receipts(lot.id)).toBe(0);
      expect(await prisma.ledgerEntry.count({ where: { lotId: lot.id } })).toBe(0);
      expect(lotStatus(settled, clock.now())).toBe("UNSOLD");
      expect(await wallet(joao)).toEqual({ total: 0, committed: 0 });

      const closed = publisher.events.filter((e) => e.type === EVENTS.LOT_CLOSED);
      expect(closed).toHaveLength(1);
      expect(closed[0]!.payload).toEqual({ lotId: lot.id, version: 0, outcome: "UNSOLD" });
      expect(publisher.events.filter((e) => e.type === EVENTS.WALLET_UPDATED)).toHaveLength(0);
      const card = publisher.events.find((e) => e.type === EVENTS.SHOWCASE_LOT)!;
      expect(card.payload).toMatchObject({ id: lot.id, status: "UNSOLD" });
    });
  });

  describe("elegibilidade e idempotência", () => {
    it("antes do fim não liquida (R-5.1)", async () => {
      const lot = await live();
      await bid(ana, lot.id, 2_000_000);
      clock.set(iso(NOW_MS + HOUR - 1));
      expect((await rig.settlement.settleLot(lot.id)).result).toBe("SKIPPED");
      expect((await rig.job.sweep()).length).toBe(0);
      expect((await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } })).settledAt).toBeNull();
    });

    it("AC-5.3: rodar de novo 3 vezes não duplica nada e não repete o lot:closed", async () => {
      const lot = await live();
      await prdExample(lot.id);
      reachEnd();
      await rig.job.sweep();
      const before = { ana: await wallet(ana), joao: await wallet(joao), events: publisher.events.length };
      for (let i = 0; i < 3; i++) await rig.job.sweep();
      expect((await rig.settlement.settleLot(lot.id)).result).toBe("SKIPPED");
      expect(await count.receipts(lot.id)).toBe(1);
      expect(await count.ledger(lot.id, "SALE_DEBIT")).toBe(1);
      expect(await count.ledger(lot.id, "SALE_CREDIT")).toBe(1);
      expect(await wallet(ana)).toEqual(before.ana);
      expect(await wallet(joao)).toEqual(before.joao);
      expect(publisher.events).toHaveLength(before.events);
      expect(publisher.events.filter((e) => e.type === EVENTS.LOT_CLOSED)).toHaveLength(1);
    });

    it("AC-5.4: 10 settleLot e 3 sweep ao mesmo tempo geram 1 Receipt, 1 débito e 1 crédito", async () => {
      const lot = await live();
      await prdExample(lot.id);
      reachEnd();

      const results = await Promise.all([
        ...Array.from({ length: 10 }, () => rig.settlement.settleLot(lot.id)),
        ...Array.from({ length: 3 }, () => rig.job.sweep()),
      ]);
      const outcomes = results.flat();
      expect(outcomes.filter((o) => o.result === "SOLD").length).toBeLessThanOrEqual(1);
      expect(rig.errors()).toEqual([]);

      // Com SKIP LOCKED pode ocorrer de nenhuma chamada ver o lote destravado: um sweep sequencial garante o fim.
      const last = await rig.job.sweep();
      expect(await count.receipts(lot.id)).toBe(1);
      expect(await count.ledger(lot.id, "SALE_DEBIT")).toBe(1);
      expect(await count.ledger(lot.id, "SALE_CREDIT")).toBe(1);
      expect(await wallet(ana)).toEqual({ total: 1_800_000, committed: 0 });
      expect(await wallet(joao)).toEqual({ total: 3_200_000, committed: 0 });
      // Uma só liquidação em toda a corrida, e portanto um só lot:closed; o service não publica, o sweep sim.
      const all = [...outcomes, ...last];
      expect(all.filter((o) => o.result === "SOLD")).toHaveLength(1);
      expect(all.flatMap((o) => o.events).filter((e) => e.type === EVENTS.LOT_CLOSED)).toHaveLength(1);
      expect(publisher.events.filter((e) => e.type === EVENTS.LOT_CLOSED).length).toBeLessThanOrEqual(1);
      expect((await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } })).settledAt).not.toBeNull();
    });

    it("AC-5.9: lote cancelado e vencido não é liquidado", async () => {
      const lot = await live({ cancelledAt: iso(NOW_MS - HOUR / 2) });
      reachEnd();
      expect((await rig.settlement.settleLot(lot.id)).result).toBe("SKIPPED");
      expect(await rig.job.sweep()).toEqual([]);
      const row = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
      expect(row.settledAt).toBeNull();
      expect(await count.receipts(lot.id)).toBe(0);
      expect(await prisma.ledgerEntry.count({ where: { lotId: lot.id } })).toBe(0);
    });

    it("lote que já tem settledAt não é liquidado de novo; id inexistente também pula", async () => {
      const lot = await live({ settledAt: ENDS_AT });
      reachEnd();
      expect((await rig.settlement.settleLot(lot.id)).result).toBe("SKIPPED");
      expect((await rig.settlement.settleLot("nao-existe")).result).toBe("SKIPPED");
    });
  });

  describe("fronteira do relógio", () => {
    it("AC-5.6: lance e sweep em now == endsAt: o lance volta LOT_ENDED, sem HOLD, e o lote liquida para Ana", async () => {
      const lot = await live();
      await bid(ana, lot.id, 3_200_000);
      reachEnd();

      const [lateBid] = await Promise.all([postBid(app, bruno, lot.id, 3_300_000, 3_200_000), rig.job.sweep()]);
      expect(lateBid.status).toBe(409);
      expect(lateBid.body.error.code).toBe("LOT_ENDED");
      expect(await prisma.ledgerEntry.count({ where: { userId: bruno.id, kind: "HOLD" } })).toBe(0);

      await rig.job.sweep();
      expect(await wallet(ana)).toEqual({ total: 1_800_000, committed: 0 });
      expect(await wallet(bruno)).toEqual({ total: 4_000_000, committed: 0 });
      expect((await prisma.receipt.findUniqueOrThrow({ where: { lotId: lot.id } })).winnerId).toBe(ana.id);
      await assertLotInvariants(prisma, lot.id);
    });

    it("AC-5.7: lance em endsAt − 1 ms prorroga e o sweep não liquida; no fim novo liquida para Bruno", async () => {
      const lot = await live();
      await bid(ana, lot.id, 3_200_000);
      clock.set(iso(NOW_MS + HOUR - 1));
      await bid(bruno, lot.id, 3_300_000, 3_200_000);
      const extended = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
      expect(extended.endsAt.toISOString()).toBe(iso(NOW_MS + HOUR - 1 + 120_000));

      expect(await rig.job.sweep()).toEqual([]);
      expect((await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } })).settledAt).toBeNull();

      clock.set(extended.endsAt);
      await rig.job.sweep();
      expect((await prisma.receipt.findUniqueOrThrow({ where: { lotId: lot.id } })).winnerId).toBe(bruno.id);
      expect(await wallet(bruno)).toEqual({ total: 700_000, committed: 0 });
      expect(await wallet(ana)).toEqual({ total: 5_000_000, committed: 0 });
    });

    it("AC-5.8: lote liquidado recusa lance com LOT_ENDED mesmo com o relógio recuado", async () => {
      const lot = await live();
      await bid(ana, lot.id, 3_200_000);
      reachEnd();
      await rig.job.sweep();
      clock.set(iso(NOW_MS + HOUR / 2));
      const res = await postBid(app, bruno, lot.id, 3_300_000, 3_200_000);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("LOT_ENDED");
      expect(await prisma.ledgerEntry.count({ where: { userId: bruno.id, kind: "HOLD" } })).toBe(0);
    });
  });

  describe("rotina", () => {
    it("AC-5.10: um lote quebrado não impede os outros, é logado e tentado de novo no ciclo seguinte", async () => {
      const lots = [await live({ title: "Um" }), await live({ title: "Dois" }), await live({ title: "Tres" })];
      await bid(ana, lots[0]!.id, 2_000_000);
      await bid(bruno, lots[1]!.id, 2_000_000);
      await bid(carla, lots[2]!.id, 2_000_000);
      // Comprometido do Bruno zerado à força: o débito violaria o CHECK `committed >= 0` e a transação desfaz.
      await prisma.$executeRaw`UPDATE "Wallet" SET "committedCents" = 0 WHERE "userId" = ${bruno.id}`;
      reachEnd();

      const outcomes = await rig.job.sweep();
      expect(outcomes.map((o) => o.result).sort()).toEqual(["SOLD", "SOLD"]);
      expect((await prisma.lot.findUniqueOrThrow({ where: { id: lots[0]!.id } })).settledAt).not.toBeNull();
      expect((await prisma.lot.findUniqueOrThrow({ where: { id: lots[2]!.id } })).settledAt).not.toBeNull();
      const broken = await prisma.lot.findUniqueOrThrow({ where: { id: lots[1]!.id } });
      expect(broken.settledAt).toBeNull();
      expect(await count.receipts(lots[1]!.id)).toBe(0);
      expect(await count.ledger(lots[1]!.id, "SALE_CREDIT")).toBe(0);
      expect(rig.errors().map((line) => line.lotId)).toEqual([lots[1]!.id]);

      // Conserta o dado e o próximo ciclo liquida.
      await prisma.$executeRaw`UPDATE "Wallet" SET "committedCents" = 2000000 WHERE "userId" = ${bruno.id}`;
      expect((await rig.job.sweep()).map((o) => o.result)).toEqual(["SOLD"]);
      expect((await prisma.lot.findUniqueOrThrow({ where: { id: lots[1]!.id } })).settledAt).not.toBeNull();
    });

    it("sweep nunca rejeita: falha na listagem é logada e a varredura devolve vazio", async () => {
      const broken = { lot: { findMany: async () => Promise.reject(new Error("conexão caiu")) } };
      const lines: string[] = [];
      const job = makeSettlementJob({
        db: broken as never,
        clock,
        settlement: { settleLot: async () => Promise.reject(new Error("não devia chamar")) },
        publisher,
        logger: createLogger("info", { write: (line: string) => void lines.push(line) }),
      });
      await expect(job.sweep()).resolves.toEqual([]);
      expect(lines.join("")).toContain("falha ao listar os lotes vencidos");
    });

    it("AC-5.11: o boot liquida os lotes vencidos com settledAt depois do fim, e o martelo do comprovante segue sendo o endsAt", async () => {
      const first = await live({ title: "Um" });
      const second = await live({ title: "Dois" });
      await bid(ana, first.id, 2_000_000);
      await bid(bruno, second.id, 2_000_000);
      // O servidor ficou parado: passaram-se 3 h depois do fim.
      clock.set(iso(NOW_MS + 4 * HOUR));

      rig.job.start();
      await rig.job.stop();

      for (const lot of [first, second]) {
        const row = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
        expect(row.settledAt?.toISOString()).toBe(iso(NOW_MS + 4 * HOUR));
        expect(row.settledAt!.getTime()).toBeGreaterThan(row.endsAt.getTime());
        const { token } = await prisma.receipt.findUniqueOrThrow({ where: { lotId: lot.id } });
        const res = await request(app).get(`/receipts/${token}`);
        expect(res.body.hammerAt).toBe(ENDS_AT);
        expect(res.body.settledAt).toBe(iso(NOW_MS + 4 * HOUR));
      }
    });

    it("AC-5.12: GET de lote, lista e comprovante nunca liquidam; o lote fica CLOSING", async () => {
      const lot = await live();
      await bid(ana, lot.id, 2_000_000);
      reachEnd();
      for (let i = 0; i < 3; i++) {
        const state = await request(app).get(`/lots/${lot.id}`);
        expect(state.body.lot.status).toBe("CLOSING");
        expect(state.body.lot.result).toBeNull();
        await request(app).get("/lots");
        await request(app).get("/receipts/nao-existe");
      }
      expect((await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } })).settledAt).toBeNull();
      expect(await count.receipts(lot.id)).toBe(0);
    });
  });

  describe("eventos depois do commit", () => {
    it("AC-5.17: lot:closed, showcase:lot e wallet:updated saem uma vez, sem token, só para quem deve", async () => {
      const lot = await live();
      await prdExample(lot.id);
      publisher.batches.length = 0;
      reachEnd();
      await rig.job.sweep();
      await rig.job.sweep();

      const { token } = await prisma.receipt.findUniqueOrThrow({ where: { lotId: lot.id } });
      const closed = publisher.events.filter((e) => e.type === EVENTS.LOT_CLOSED);
      expect(closed).toHaveLength(1);
      expect(closed[0]!.room).toBe(`lot:${lot.id}`);
      const settled = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
      const lastBid = await prisma.bid.findFirstOrThrow({ where: { lotId: lot.id }, orderBy: { seq: "desc" } });
      expect(closed[0]!.payload).toEqual({
        lotId: lot.id,
        version: 3,
        outcome: "SOLD",
        finalBidCents: 3_200_000,
        winnerPseudonym: lastBid.pseudonym,
        finalHash: settled.lastHash,
      });

      const cards = publisher.events.filter((e) => e.type === EVENTS.SHOWCASE_LOT);
      expect(cards).toHaveLength(1);
      expect(cards[0]!.payload).toMatchObject({ id: lot.id, status: "SOLD", version: 3, currentBidCents: 3_200_000 });

      const wallets = publisher.events.filter((e) => e.type === EVENTS.WALLET_UPDATED);
      expect(wallets.map((e) => e.room).sort()).toEqual([`user:${ana.id}`, `user:${joao.id}`].sort());
      expect(wallets.find((e) => e.room === `user:${ana.id}`)!.payload).toEqual({
        totalCents: 1_800_000,
        committedCents: 0,
        availableCents: 1_800_000,
      });
      expect(wallets.find((e) => e.room === `user:${joao.id}`)!.payload).toEqual({
        totalCents: 3_200_000,
        committedCents: 0,
        availableCents: 3_200_000,
      });
      expect(JSON.stringify(publisher.events)).not.toContain(token);
    });

    it("o service não publica: quem chama decide (INV-4)", async () => {
      const lot = await live();
      await bid(ana, lot.id, 2_000_000);
      publisher.batches.length = 0;
      reachEnd();
      const outcome = await rig.settlement.settleLot(lot.id);
      expect(outcome.events.length).toBeGreaterThan(0);
      expect(publisher.events).toHaveLength(0);
    });
  });
});
