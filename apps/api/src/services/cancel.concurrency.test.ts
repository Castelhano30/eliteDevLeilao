import type { Prisma } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FakeClock } from "../infra/clock";
import { makeTestApp } from "../../test/helpers/app";
import { RecordingPublisher, assertLotInvariants, makeUser, postBid, type TestUser } from "../../test/helpers/bids";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { insertLot } from "../../test/helpers/lots";

const NOW_MS = Date.parse("2026-10-23T12:00:00.000Z");
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const ENDS_AT = iso(NOW_MS + HOUR);
const LIVE = { startsAt: iso(NOW_MS - 2 * HOUR), endsAt: ENDS_AT, startingBidCents: 2_000_000, minIncrementCents: 50_000 };
const ROUNDS = 20;

/** Gerador determinístico (mulberry32): a semente impressa na falha reproduz a ordem das rodadas. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe.skipIf(!testDatabaseUrl)("cancelamento: concorrência (integração, DATABASE_URL_TEST)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let app: ReturnType<typeof makeTestApp>["app"];
  let clock: FakeClock;
  let ana: TestUser;
  let bruno: TestUser;
  let carla: TestUser;
  let joao: TestUser;

  const live = (extra: Partial<Parameters<typeof insertLot>[1]> = {}) =>
    insertLot(prisma, { auctioneerId: joao.id, ...LIVE, ...extra });
  const cancel = (lotId: string, confirmEntryCount: number) =>
    request(app).post(`/lots/${lotId}/cancel`).set("Authorization", joao.auth).send({ confirmEntryCount });

  /** Cada carteira bate com o que o ledger conta e com o que ela lidera em lote ao vivo (S06 §14). */
  async function assertBooks() {
    const wallets = await prisma.wallet.findMany();
    const entries = await prisma.ledgerEntry.findMany();
    const leading = await prisma.lot.findMany({ where: { cancelledAt: null, settledAt: null, leaderId: { not: null } } });
    for (const wallet of wallets) {
      let total = 0n;
      let committed = 0n;
      for (const entry of entries.filter((row) => row.userId === wallet.userId)) {
        if (entry.kind === "DEPOSIT" || entry.kind === "SALE_CREDIT") total += entry.amountCents;
        if (entry.kind === "SALE_DEBIT") {
          total -= entry.amountCents;
          committed -= entry.amountCents;
        }
        if (entry.kind === "HOLD") committed += entry.amountCents;
        if (entry.kind === "RELEASE" || entry.kind === "REFUND") committed -= entry.amountCents;
      }
      expect(wallet.totalCents, `total de ${wallet.userId}`).toBe(total);
      expect(wallet.committedCents, `comprometido de ${wallet.userId}`).toBe(committed);
      const led = leading.filter((lot) => lot.leaderId === wallet.userId).reduce((sum, lot) => sum + (lot.currentBidCents ?? 0n), 0n);
      expect(wallet.committedCents, `lances ao vivo de ${wallet.userId}`).toBe(led);
      expect(wallet.totalCents >= wallet.committedCents).toBe(true);
    }
  }

  beforeEach(async () => {
    await truncateAll(prisma);
    ({ app, clock } = makeTestApp(prisma, {}, { timeoutMs: 300 }, new RecordingPublisher()));
    ana = await makeUser(app, "Ana", { depositCents: 5_000_000 });
    bruno = await makeUser(app, "Bruno", { depositCents: 10_000_000 });
    carla = await makeUser(app, "Carla", { depositCents: 6_000_000 });
    joao = await makeUser(app, "Joao", { role: "AUCTIONEER" });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("AC-6.19 e §13: cancelar × lance, 20 rodadas em ordem aleatória, sempre uma das duas saídas e sem deadlock", async () => {
    const seed = Number(process.env.CANCEL_RACE_SEED ?? Date.now() % 1_000_000);
    const random = seeded(seed);
    const lotIds: string[] = [];
    const tally = { bidFirst: 0, cancelFirst: 0 };

    for (let round = 0; round < ROUNDS; round++) {
      const lot = await live({ title: `Rodada ${round}` });
      lotIds.push(lot.id);
      expect((await postBid(app, ana, lot.id, 2_000_000)).status).toBe(201);

      // O leiloeiro viu 1 lance; Carla cobre no mesmo instante. A ordem de largada é sorteada.
      const racers = [
        { name: "cancel", run: () => cancel(lot.id, 1) },
        { name: "bid", run: () => postBid(app, carla, lot.id, 2_050_000, 2_000_000) },
      ].sort(() => random() - 0.5);
      const outcome = new Map<string, request.Response>();
      await Promise.all(racers.map(async (racer) => void outcome.set(racer.name, await racer.run())));
      const cancelRes = outcome.get("cancel")!;
      const bidRes = outcome.get("bid")!;
      const where = `semente ${seed}, rodada ${round}, cancel=${cancelRes.status} ${JSON.stringify(cancelRes.body)} bid=${bidRes.status} ${JSON.stringify(bidRes.body)}`;

      if (bidRes.status === 201) {
        // (a) o lance entrou antes: a contagem confirmada ficou velha e nada foi cancelado.
        expect(cancelRes.status, where).toBe(409);
        expect(cancelRes.body.error.code, where).toBe("LOT_CHANGED");
        expect(cancelRes.body.error.details, where).toEqual({ entryCount: 2 });
        const retry = await cancel(lot.id, 2);
        expect(retry.status, where).toBe(200);
        tally.bidFirst += 1;
      } else {
        // (b) o cancelamento entrou antes: o lance é recusado e não deixa HOLD.
        expect(cancelRes.status, where).toBe(200);
        expect(bidRes.status, where).toBe(409);
        expect(bidRes.body.error.code, where).toBe("LOT_CANCELLED");
        expect(await prisma.ledgerEntry.count({ where: { lotId: lot.id, userId: carla.id } }), where).toBe(0);
        tally.cancelFirst += 1;
      }
      const row = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
      expect(row.cancelledAt, where).not.toBeNull();
      expect(await prisma.ledgerEntry.count({ where: { lotId: lot.id, kind: "REFUND" } }), where).toBe(1);
      expect(await prisma.bid.count({ where: { lotId: lot.id, kind: "CANCEL" } }), where).toBe(1);
    }

    process.stderr.write(`cancelar × lance: semente ${seed}, lance antes ${tally.bidFirst}, cancelamento antes ${tally.cancelFirst}\n`);
    expect(tally.bidFirst + tally.cancelFirst).toBe(ROUNDS);
    for (const id of lotIds) await assertLotInvariants(prisma, id);
    await assertBooks();
    // Nenhum saldo ficou comprometido em lote cancelado: tudo voltou ao disponível.
    for (const user of [ana, bruno, carla]) {
      expect(Number((await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).committedCents)).toBe(0);
    }
  }, 180_000);

  it("§13: 5 cancelamentos simultâneos do mesmo lote dão um sucesso, quatro LOT_CANCELLED e um REFUND", async () => {
    const lot = await live();
    expect((await postBid(app, ana, lot.id, 2_000_000)).status).toBe(201);
    expect((await postBid(app, bruno, lot.id, 2_050_000, 2_000_000)).status).toBe(201);

    const results = await Promise.all(Array.from({ length: 5 }, () => cancel(lot.id, 2)));

    expect(results.filter((res) => res.status === 200)).toHaveLength(1);
    const refused = results.filter((res) => res.status !== 200);
    expect(refused).toHaveLength(4);
    for (const res of refused) expect(res.body.error.code).toBe("LOT_CANCELLED");
    expect(await prisma.ledgerEntry.count({ where: { lotId: lot.id, kind: "REFUND" } })).toBe(1);
    expect(await prisma.bid.count({ where: { lotId: lot.id, kind: "CANCEL" } })).toBe(1);
    await assertLotInvariants(prisma, lot.id);
    await assertBooks();
  });

  it("§13: cancelar × depósito do líder não trava e deixa total e comprometido coerentes", async () => {
    const lot = await live();
    expect((await postBid(app, bruno, lot.id, 2_000_000)).status).toBe(201);

    const [cancelRes, deposit] = await Promise.all([
      cancel(lot.id, 1),
      request(app).post("/wallet/deposits").set("Authorization", bruno.auth).send({ amountCents: 1_000_000 }),
    ]);

    expect(cancelRes.status).toBe(200);
    expect(deposit.status).toBe(201);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: bruno.id } });
    expect([wallet.totalCents, wallet.committedCents]).toEqual([11_000_000n, 0n]);
    await assertBooks();
  });

  /** Segura o `FOR UPDATE` de uma linha numa transação à parte até `release()`, para provar quem espera por ela. */
  async function holdLock(table: "Lot" | "Wallet", id: string, work?: (tx: Prisma.TransactionClient) => Promise<void>) {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const holder = prisma.$transaction(
      async (tx) => {
        if (table === "Lot") await tx.$queryRaw`SELECT "id" FROM "Lot" WHERE "id" = ${id} FOR UPDATE`;
        else await tx.$queryRaw`SELECT "userId" FROM "Wallet" WHERE "userId" = ${id} FOR UPDATE`;
        await work?.(tx);
        locked();
        await held;
      },
      { timeout: 30_000 },
    );
    await lockTaken;
    return {
      async release() {
        release();
        await holder;
      },
    };
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 400));
  /** O `supertest` só envia no `then`: aqui a requisição sai já e a promise diz se terminou. */
  function startCancel(lotId: string, confirmEntryCount: number) {
    const state = { done: false };
    const result = cancel(lotId, confirmEntryCount).then((res) => {
      state.done = true;
      return res;
    });
    return { state, result };
  }

  it("§13: o relógio é lido depois do lock: quem esperou na fila e viu o fim passar recebe LOT_ENDED", async () => {
    const lot = await live();
    expect((await postBid(app, ana, lot.id, 2_000_000)).status).toBe(201);
    const lock = await holdLock("Lot", lot.id);

    // O cancelamento começa com o relógio antes do fim e fica esperando o lock; o fim passa enquanto ele espera.
    const waiting = startCancel(lot.id, 1);
    await settle();
    expect(waiting.state.done).toBe(false);
    clock.set(ENDS_AT);
    await lock.release();
    const res = await waiting.result;

    expect(res.status, JSON.stringify(res.body)).toBe(409);
    expect(res.body.error.code).toBe("LOT_ENDED");
    expect((await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } })).cancelledAt).toBeNull();
    expect(await prisma.ledgerEntry.count({ where: { kind: "REFUND" } })).toBe(0);
    await assertBooks();
  });

  it("INV-5: o cancelamento espera o lock da carteira do líder e estorna sobre o saldo que ela deixou, não sobre uma leitura velha", async () => {
    const lot = await live();
    expect((await postBid(app, bruno, lot.id, 2_000_000)).status).toBe(201);
    // Outra transação trava a carteira e deposita R$ 10.000 antes de soltar: o total passa a 11.000.000 só no commit dela.
    const lock = await holdLock("Wallet", bruno.id, async (tx) => {
      await tx.wallet.update({ where: { userId: bruno.id }, data: { totalCents: 11_000_000n } });
      await tx.ledgerEntry.create({
        data: { userId: bruno.id, kind: "DEPOSIT", amountCents: 1_000_000n, totalAfter: 11_000_000n, committedAfter: 2_000_000n, createdAt: new Date(NOW_MS) },
      });
    });

    const waiting = startCancel(lot.id, 1);
    await settle();
    expect(waiting.state.done, "terminou com a carteira do líder travada por outra transação").toBe(false);
    await lock.release();
    const res = await waiting.result;

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: bruno.id } });
    expect([wallet.totalCents, wallet.committedCents]).toEqual([11_000_000n, 0n]);
    const refund = await prisma.ledgerEntry.findFirstOrThrow({ where: { userId: bruno.id, kind: "REFUND" } });
    expect([refund.totalAfter, refund.committedAfter]).toEqual([11_000_000n, 0n]);
    await assertBooks();
  });
});
