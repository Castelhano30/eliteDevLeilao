import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BID_TEXT, CANCEL_TEXT, EVENTS, formatBRL, lotChangedMessage, type DomainEvent } from "@lanceauto/shared";
import { FakeClock } from "../infra/clock";
import type { Publisher } from "../infra/publisher";
import { lotRoom, SHOWCASE_ROOM, userRoom } from "../socket";
import { makeTestApp } from "../../test/helpers/app";
import { FORBIDDEN_KEYS, RecordingPublisher, assertLotInvariants, collectKeys, makeUser, postBid, type TestUser } from "../../test/helpers/bids";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { insertLot } from "../../test/helpers/lots";
import { makeSettlement } from "../../test/helpers/settlement";

const NOW = "2026-10-23T12:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const ENDS_AT = iso(NOW_MS + HOUR);
/** Lote de referência: inicial R$ 20.000, incremento R$ 500, ao vivo, fecha em 1 h. */
const LIVE = { startsAt: iso(NOW_MS - 2 * HOUR), endsAt: ENDS_AT, startingBidCents: 2_000_000, minIncrementCents: 50_000 };

/** Publisher que, ao receber os eventos, já consulta o banco: prova que o commit veio antes de publicar. */
class ProbePublisher implements Publisher {
  readonly probes: Promise<{ cancelledAt: Date | null }>[] = [];
  constructor(private readonly prisma: PrismaClient) {}
  publish(events: DomainEvent[]): void {
    const lotId = (events[0]?.payload as { lotId: string }).lotId;
    this.probes.push(this.prisma.lot.findUniqueOrThrow({ where: { id: lotId }, select: { cancelledAt: true } }));
  }
}

describe.skipIf(!testDatabaseUrl)("cancelamento e estorno (integração, DATABASE_URL_TEST)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let app: ReturnType<typeof makeTestApp>["app"];
  let clock: FakeClock;
  let publisher: RecordingPublisher;
  let ana: TestUser;
  let bruno: TestUser;
  let carla: TestUser;
  let joao: TestUser;
  let outro: TestUser;

  const live = (extra: Partial<Parameters<typeof insertLot>[1]> = {}) =>
    insertLot(prisma, { auctioneerId: joao.id, ...LIVE, ...extra });
  const cancel = (user: TestUser | null, lotId: string, body: unknown = { confirmEntryCount: 0 }) => {
    const req = request(app).post(`/lots/${lotId}/cancel`);
    if (user) req.set("Authorization", user.auth);
    return req.send(body as object);
  };
  const wallet = async (user: TestUser) => {
    const row = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    return { total: Number(row.totalCents), committed: Number(row.committedCents) };
  };
  async function bid(user: TestUser, lotId: string, amount: number, expected: number | null = null) {
    const res = await postBid(app, user, lotId, amount, expected);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
  }
  /** Ana R$ 20.000, Bruno R$ 20.500 (líder). */
  async function twoBids(lotId: string) {
    await bid(ana, lotId, 2_000_000);
    await bid(bruno, lotId, 2_050_000, 2_000_000);
  }
  /** Tudo o que um cancelamento recusado não pode mexer. */
  async function snapshot(lotId: string) {
    const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
    return JSON.stringify({
      lot,
      bids: await prisma.bid.findMany({ where: { lotId }, orderBy: { seq: "asc" } }),
      ledger: await prisma.ledgerEntry.findMany({ orderBy: { seq: "asc" } }),
      wallets: await prisma.wallet.findMany({ orderBy: { userId: "asc" } }),
      receipts: await prisma.receipt.count(),
    }, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
  }
  async function expectRefused(lotId: string, send: () => Promise<request.Response>, status: number, code: string) {
    const before = await snapshot(lotId);
    publisher.batches.length = 0;
    const res = await send();
    expect(res.status, JSON.stringify(res.body)).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(await snapshot(lotId)).toBe(before);
    expect(publisher.batches).toHaveLength(0);
    return res;
  }

  beforeEach(async () => {
    await truncateAll(prisma);
    publisher = new RecordingPublisher();
    ({ app, clock } = makeTestApp(prisma, {}, { timeoutMs: 300 }, publisher));
    ana = await makeUser(app, "Ana", { depositCents: 5_000_000 });
    bruno = await makeUser(app, "Bruno", { depositCents: 10_000_000 });
    carla = await makeUser(app, "Carla", { depositCents: 6_000_000 });
    joao = await makeUser(app, "Joao", { role: "AUCTIONEER" });
    outro = await makeUser(app, "Outro", { role: "AUCTIONEER" });
    publisher.batches.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("efeitos", () => {
    it("AC-6.1: lote agendado sem lances cancela, grava a linha CANCEL seq=1 sobre o genesis e não mexe em saldo", async () => {
      const lot = await live({ startsAt: iso(NOW_MS + HOUR), endsAt: iso(NOW_MS + 2 * HOUR) });
      const genesis = lot.lastHash;

      const res = await cancel(joao, lot.id, { confirmEntryCount: 0 });

      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.lot.status).toBe("CANCELLED");
      expect(res.body.lot.cancelledAt).toBe(NOW);
      expect(res.body.serverTime).toBe(NOW);
      const row = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
      expect(row.cancelledAt?.toISOString()).toBe(NOW);
      expect(row.entryCount).toBe(1);
      const cancelRow = await prisma.bid.findFirstOrThrow({ where: { lotId: lot.id } });
      expect(cancelRow).toMatchObject({ seq: 1, kind: "CANCEL", prevHash: genesis, bidderId: null, pseudonym: null, amountCents: null });
      expect(cancelRow.at.toISOString()).toBe(NOW);
      expect(row.lastHash).toBe(cancelRow.hash);
      expect(await prisma.ledgerEntry.count({ where: { lotId: lot.id } })).toBe(0);
      await assertLotInvariants(prisma, lot.id);
    });

    it("AC-6.2: o líder é estornado, o total não muda, o ledger ganha REFUND e a cadeia ganha a linha CANCEL", async () => {
      const lot = await live();
      await twoBids(lot.id);
      expect(await wallet(bruno)).toEqual({ total: 10_000_000, committed: 2_050_000 });
      const anaBefore = await wallet(ana);

      const res = await cancel(joao, lot.id, { confirmEntryCount: 2 });

      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.lot).toMatchObject({ status: "CANCELLED", bidCount: 2, currentBidCents: 2_050_000, version: 3, entryCount: 3 });
      expect(await wallet(bruno)).toEqual({ total: 10_000_000, committed: 0 });
      expect(await wallet(ana)).toEqual(anaBefore);
      const refund = await prisma.ledgerEntry.findMany({ where: { lotId: lot.id, kind: "REFUND" } });
      expect(refund).toHaveLength(1);
      expect(refund[0]).toMatchObject({ userId: bruno.id, amountCents: 2_050_000n, totalAfter: 10_000_000n, committedAfter: 0n });
      const cancelRow = await prisma.bid.findFirstOrThrow({ where: { lotId: lot.id, kind: "CANCEL" } });
      expect(cancelRow.seq).toBe(3);
      const row = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
      expect(row).toMatchObject({ bidCount: 2, entryCount: 3, leaderId: bruno.id, currentBidCents: 2_050_000n });
      await assertLotInvariants(prisma, lot.id);
    });

    it("só o líder atual recebe estorno, e só o lance deste lote (líder com outro lote ao vivo)", async () => {
      const first = await live({ title: "Primeiro" });
      const second = await live({ title: "Segundo" });
      await bid(ana, first.id, 2_000_000);
      await bid(bruno, first.id, 2_050_000, 2_000_000);
      await bid(bruno, second.id, 2_000_000);
      expect(await wallet(bruno)).toEqual({ total: 10_000_000, committed: 4_050_000 });

      const res = await cancel(joao, first.id, { confirmEntryCount: 2 });

      expect(res.status).toBe(200);
      expect(await wallet(bruno)).toEqual({ total: 10_000_000, committed: 2_000_000 });
      expect(await prisma.ledgerEntry.count({ where: { lotId: second.id, kind: "REFUND" } })).toBe(0);
    });

    it("AC-6.19: contagem velha dá LOT_CHANGED; refeito com a nova, estorna o NOVO líder", async () => {
      const lot = await live();
      await twoBids(lot.id);
      await bid(carla, lot.id, 2_100_000, 2_050_000);

      const stale = await expectRefused(lot.id, () => cancel(joao, lot.id, { confirmEntryCount: 2 }), 409, "LOT_CHANGED");
      expect(stale.body.error.details).toEqual({ entryCount: 3 });
      expect(stale.body.error.message).toBe(lotChangedMessage(3));

      const res = await cancel(joao, lot.id, { confirmEntryCount: 3 });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(await wallet(carla)).toEqual({ total: 6_000_000, committed: 0 });
      expect(await wallet(bruno)).toEqual({ total: 10_000_000, committed: 0 });
      expect(await prisma.ledgerEntry.findMany({ where: { lotId: lot.id, kind: "REFUND" } })).toHaveLength(1);
      await assertLotInvariants(prisma, lot.id);
    });

    it("carteira inconsistente (comprometido menor que o lance): 500 e nada muda", async () => {
      const lot = await live();
      await twoBids(lot.id);
      await prisma.$executeRaw`UPDATE "Wallet" SET "committedCents" = 0 WHERE "userId" = ${bruno.id}`;
      await expectRefused(lot.id, () => cancel(joao, lot.id, { confirmEntryCount: 2 }), 500, "INTERNAL");
    });
  });

  describe("erros, um por caso, e nada muda", () => {
    it("AC-6.6: licitante recebe ROLE_NOT_ALLOWED; visitante, UNAUTHENTICATED", async () => {
      const lot = await live();
      await twoBids(lot.id);
      const res = await expectRefused(lot.id, () => cancel(ana, lot.id, { confirmEntryCount: 2 }), 403, "ROLE_NOT_ALLOWED");
      expect(res.body.error.message).toBe(CANCEL_TEXT.roleNotAllowed);
      await expectRefused(lot.id, () => cancel(null, lot.id, { confirmEntryCount: 2 }), 401, "UNAUTHENTICATED");
    });

    it("AC-6.7: leiloeiro de outro lote recebe FORBIDDEN", async () => {
      const lot = await live();
      await twoBids(lot.id);
      const res = await expectRefused(lot.id, () => cancel(outro, lot.id, { confirmEntryCount: 2 }), 403, "FORBIDDEN");
      expect(res.body.error.message).toBe(CANCEL_TEXT.forbidden);
    });

    it("AC-6.8: id inexistente é NOT_FOUND; corpo sem contagem, negativa ou fracionária é VALIDATION por campo", async () => {
      const lot = await live();
      const missing = await cancel(joao, "nao-existe", { confirmEntryCount: 0 });
      expect(missing.status).toBe(404);
      expect(missing.body.error).toMatchObject({ code: "NOT_FOUND", message: CANCEL_TEXT.notFound });
      for (const body of [{}, { confirmEntryCount: -1 }, { confirmEntryCount: 1.5 }, { confirmEntryCount: "0" }]) {
        const res = await expectRefused(lot.id, () => cancel(joao, lot.id, body), 400, "VALIDATION");
        expect(res.body.error.details.fields.confirmEntryCount).toBe(CANCEL_TEXT.invalidCount);
      }
    });

    it("AC-6.9: contagem diferente da real é LOT_CHANGED com a contagem real", async () => {
      const lot = await live();
      await twoBids(lot.id);
      const res = await expectRefused(lot.id, () => cancel(joao, lot.id, { confirmEntryCount: 1 }), 409, "LOT_CHANGED");
      expect(res.body.error.details).toEqual({ entryCount: 2 });
      await expectRefused(lot.id, () => cancel(joao, lot.id, { confirmEntryCount: 3 }), 409, "LOT_CHANGED");
    });

    it("AC-6.10: cancelar de novo é LOT_CANCELLED, sem segundo REFUND nem segunda linha", async () => {
      const lot = await live();
      await twoBids(lot.id);
      expect((await cancel(joao, lot.id, { confirmEntryCount: 2 })).status).toBe(200);

      const res = await expectRefused(lot.id, () => cancel(joao, lot.id, { confirmEntryCount: 3 }), 409, "LOT_CANCELLED");
      expect(res.body.error.message).toBe(CANCEL_TEXT.lotCancelled);
      expect(await prisma.ledgerEntry.count({ where: { kind: "REFUND" } })).toBe(1);
      expect(await prisma.bid.count({ where: { kind: "CANCEL" } })).toBe(1);
    });

    it("AC-6.11: now == endsAt, now > endsAt sem liquidar e lote liquidado dão LOT_ENDED", async () => {
      const lot = await live();
      await twoBids(lot.id);
      clock.set(ENDS_AT);
      const res = await expectRefused(lot.id, () => cancel(joao, lot.id, { confirmEntryCount: 2 }), 409, "LOT_ENDED");
      expect(res.body.error.message).toBe(CANCEL_TEXT.lotEnded);

      clock.set(iso(NOW_MS + 2 * HOUR));
      await expectRefused(lot.id, () => cancel(joao, lot.id, { confirmEntryCount: 2 }), 409, "LOT_ENDED");

      const rig = makeSettlement(prisma, clock);
      expect((await rig.settlement.settleLot(lot.id)).result).toBe("SOLD");
      await expectRefused(lot.id, () => cancel(joao, lot.id, { confirmEntryCount: 2 }), 409, "LOT_ENDED");
    });

    it("AC-6.11: settledAt preenchido recusa mesmo com o relógio antes do fim", async () => {
      const lot = await live({ settledAt: iso(NOW_MS - 1000) });
      await expectRefused(lot.id, () => cancel(joao, lot.id, { confirmEntryCount: 0 }), 409, "LOT_ENDED");
    });

    it("AC-6.12: a 1 s do fim ainda cancela", async () => {
      const lot = await live();
      await twoBids(lot.id);
      clock.set(iso(Date.parse(ENDS_AT) - 1000));
      const res = await cancel(joao, lot.id, { confirmEntryCount: 2 });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.lot.cancelledAt).toBe(iso(Date.parse(ENDS_AT) - 1000));
    });

    it("a ordem de checagem: dono antes de cancelado, cancelado antes de encerrado, encerrado antes da contagem", async () => {
      const lot = await live();
      await twoBids(lot.id);
      expect((await cancel(joao, lot.id, { confirmEntryCount: 2 })).status).toBe(200);
      // outro leiloeiro num lote já cancelado: dono vem primeiro
      await expectRefused(lot.id, () => cancel(outro, lot.id, { confirmEntryCount: 0 }), 403, "FORBIDDEN");
      // cancelado e encerrado: LOT_CANCELLED vem antes de LOT_ENDED
      clock.set(iso(NOW_MS + 2 * HOUR));
      await expectRefused(lot.id, () => cancel(joao, lot.id, { confirmEntryCount: 0 }), 409, "LOT_CANCELLED");
      // encerrado e contagem errada: LOT_ENDED vem antes de LOT_CHANGED
      const other = await live({ title: "Outro lote" });
      await expectRefused(other.id, () => cancel(joao, other.id, { confirmEntryCount: 9 }), 409, "LOT_ENDED");
    });
  });

  describe("depois do cancelamento", () => {
    async function cancelledLot() {
      const lot = await live();
      await twoBids(lot.id);
      expect((await cancel(joao, lot.id, { confirmEntryCount: 2 })).status).toBe(200);
      publisher.batches.length = 0;
      return lot;
    }

    it("AC-6.3: GET /lots não lista o cancelado, nem com filtro que o casaria", async () => {
      const lot = await cancelledLot();
      for (const query of ["", "?status=LIVE", "?q=corolla", "?brand=Toyota"]) {
        const res = await request(app).get(`/lots${query}`);
        expect(res.status).toBe(200);
        expect(res.body.lots.map((card: { id: string }) => card.id)).not.toContain(lot.id);
      }
      expect((await request(app).get("/lots")).body.counts).toEqual({ live: 0, scheduled: 0, ended: 0 });
    });

    it("AC-6.4: GET /lots/:id responde 200 cancelado, com bids só BID e sem dados pessoais", async () => {
      const lot = await cancelledLot();
      const res = await request(app).get(`/lots/${lot.id}`);
      expect(res.status).toBe(200);
      expect(res.body.lot).toMatchObject({ status: "CANCELLED", cancelledAt: NOW, bidCount: 2, entryCount: 3, result: null, myReceiptToken: null });
      expect(res.body.bids).toHaveLength(2);
      expect(res.body.bids.every((row: { kind: string }) => row.kind === "BID")).toBe(true);
      const keys = collectKeys(res.body);
      for (const key of FORBIDDEN_KEYS) expect(keys.has(key), key).toBe(false);
      const text = JSON.stringify(res.body);
      for (const secret of [ana.email, bruno.email, ana.id, bruno.id]) expect(text).not.toContain(secret);
    });

    it("AC-6.5: lance novo em lote cancelado é LOT_CANCELLED com o texto do PRD, sem HOLD nem Bid novo", async () => {
      const lot = await cancelledLot();
      const before = await snapshot(lot.id);
      const res = await postBid(app, carla, lot.id, 2_100_000, 2_050_000);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: "LOT_CANCELLED", message: BID_TEXT.lotCancelled });
      expect(await snapshot(lot.id)).toBe(before);
      expect(await wallet(carla)).toEqual({ total: 6_000_000, committed: 0 });
    });

    it("GET /my/lots traz o cancelado com cancelledAt e o estorno; sem lances, estorno nulo; fora do total recebido", async () => {
      const withBids = await cancelledLot();
      const empty = await live({ title: "Sem lances", startsAt: iso(NOW_MS + HOUR), endsAt: iso(NOW_MS + 2 * HOUR) });
      expect((await cancel(joao, empty.id, { confirmEntryCount: 0 })).status).toBe(200);

      const res = await request(app).get("/my/lots").set("Authorization", joao.auth);
      expect(res.status).toBe(200);
      const byId = new Map<string, { status: string; cancelledAt: string; refundedCents: number | null; resultado: unknown }>(
        res.body.lots.map((lot: { id: string }) => [lot.id, lot]),
      );
      expect(byId.get(withBids.id)).toMatchObject({ status: "CANCELLED", cancelledAt: NOW, refundedCents: 2_050_000, resultado: null });
      expect(byId.get(empty.id)).toMatchObject({ status: "CANCELLED", cancelledAt: NOW, refundedCents: null });
      expect(res.body.totalReceivedCents).toBe(0);
    });

    it("AC-6.23: GET /wallet do líder estornado não lista o lote e o comprometido bate com os lotes ao vivo que ele lidera", async () => {
      const lot = await cancelledLot();
      const other = await live({ title: "Outro ao vivo" });
      await bid(bruno, other.id, 2_000_000);

      const res = await request(app).get("/wallet").set("Authorization", bruno.auth);
      expect(res.status).toBe(200);
      expect(res.body.leadingLots.map((row: { lotId: string }) => row.lotId)).toEqual([other.id]);
      expect(res.body.committedCents).toBe(2_000_000);
      const refund = res.body.entries.find((row: { kind: string }) => row.kind === "REFUND");
      expect(refund).toMatchObject({ amountCents: 2_050_000, lotId: lot.id, lotNumber: lot.number, committedAfterCents: 0 });
    });

    it("AC-6.13: o job de fechamento não liquida lote cancelado vencido", async () => {
      const lot = await cancelledLot();
      clock.set(iso(NOW_MS + 2 * HOUR));
      const rig = makeSettlement(prisma, clock);

      await rig.job.sweep();
      expect((await rig.settlement.settleLot(lot.id)).result).toBe("SKIPPED");

      const row = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
      expect(row.settledAt).toBeNull();
      expect(await prisma.receipt.count()).toBe(0);
      expect(await prisma.ledgerEntry.count({ where: { kind: { in: ["SALE_DEBIT", "SALE_CREDIT"] } } })).toBe(0);
    });
  });

  describe("eventos e privacidade", () => {
    it("AC-6.14: devolve lot:cancelled, showcase:lot e wallet:updated ao líder, nesta ordem, só depois do commit", async () => {
      const probe = new ProbePublisher(prisma);
      const lot = await live();
      await twoBids(lot.id);
      const recording = new RecordingPublisher();
      ({ app, clock } = makeTestApp(prisma, {}, { timeoutMs: 300 }, recording));

      expect((await cancel(joao, lot.id, { confirmEntryCount: 2 })).status).toBe(200);

      expect(recording.batches).toHaveLength(1);
      const events = recording.batches[0]!;
      expect(events.map((event) => [event.type, event.room])).toEqual([
        [EVENTS.LOT_CANCELLED, lotRoom(lot.id)],
        [EVENTS.SHOWCASE_LOT, SHOWCASE_ROOM],
        [EVENTS.WALLET_UPDATED, userRoom(bruno.id)],
      ]);
      expect(events[0]!.payload).toEqual({ lotId: lot.id, version: 3 });
      expect(events[1]!.payload).toMatchObject({ id: lot.id, status: "CANCELLED", version: 3, cancelledAt: NOW });
      expect(events[2]!.payload).toEqual({ totalCents: 10_000_000, committedCents: 0, availableCents: 10_000_000 });

      // O mesmo cancelamento visto por um publisher que consulta o banco no instante da publicação.
      const second = await live({ title: "Segundo" });
      ({ app, clock } = makeTestApp(prisma, {}, { timeoutMs: 300 }, probe));
      expect((await cancel(joao, second.id, { confirmEntryCount: 0 })).status).toBe(200);
      expect((await Promise.all(probe.probes)).map((row) => row.cancelledAt?.toISOString())).toEqual([NOW]);
    });

    it("sem líder não há wallet:updated; recusa não publica nada", async () => {
      const lot = await live({ startsAt: iso(NOW_MS + HOUR), endsAt: iso(NOW_MS + 2 * HOUR) });
      expect((await cancel(joao, lot.id, { confirmEntryCount: 0 })).status).toBe(200);
      expect(publisher.events.map((event) => event.type)).toEqual([EVENTS.LOT_CANCELLED, EVENTS.SHOWCASE_LOT]);

      publisher.batches.length = 0;
      expect((await cancel(joao, lot.id, { confirmEntryCount: 1 })).status).toBe(409);
      expect(publisher.batches).toHaveLength(0);
    });

    it("a resposta e os eventos não identificam o líder: sem userId, nome, e-mail nem token", async () => {
      const lot = await live();
      await twoBids(lot.id);
      publisher.batches.length = 0;

      const res = await cancel(joao, lot.id, { confirmEntryCount: 2 });

      const publicEvents = publisher.events.filter((event) => event.type !== EVENTS.WALLET_UPDATED);
      for (const subject of [res.body, ...publicEvents.map((event) => event.payload)]) {
        const keys = collectKeys(subject);
        for (const key of FORBIDDEN_KEYS) expect(keys.has(key), key).toBe(false);
        const text = JSON.stringify(subject);
        for (const secret of [ana.email, bruno.email, ana.id, bruno.id, "Bruno", "Ana"]) expect(text).not.toContain(secret);
      }
      expect(res.body.lot.myPseudonym).toBeNull();
      expect(formatBRL(res.body.lot.currentBidCents)).toBe("R$ 20.500,00");
    });
  });
});
