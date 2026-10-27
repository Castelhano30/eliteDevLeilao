import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MY_BIDS_TEXT, type MyBidItem } from "@lanceauto/shared";
import { createApp } from "../app";
import { FakeClock } from "../infra/clock";
import { createLogger } from "../infra/logger";
import { makeTestApp, testEnv } from "../../test/helpers/app";
import { FORBIDDEN_KEYS, collectKeys, makeUser, postBid, type TestUser } from "../../test/helpers/bids";
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
const PSEUDONYM = /^Licitante [0-9A-F]{4}$/;

/** Todas as chaves que `GET /me/bids` pode ter, e só elas (varredura recursiva do AC-7.10). */
const ALLOWED_KEYS = new Set([
  "items",
  "serverTime",
  "lot",
  "state",
  "myBestBidCents",
  "myPseudonym",
  "myRank",
  "bidderCount",
  "winnerPseudonym",
  "receiptToken",
  "refundedCents",
  "id",
  "number",
  "title",
  "brand",
  "model",
  "year",
  "fuel",
  "status",
  "currentBidCents",
  "startingBidCents",
  "minIncrementCents",
  "referencePriceCents",
  "bidCount",
  "version",
  "startsAt",
  "endsAt",
  "originalEndsAt",
  "cancelledAt",
  "imageUrl",
]);

describe.skipIf(!testDatabaseUrl)("GET /me/bids (integração, DATABASE_URL_TEST)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let app: ReturnType<typeof makeTestApp>["app"];
  let clock: FakeClock;
  let rig: ReturnType<typeof makeSettlement>;
  let ana: TestUser;
  let bruno: TestUser;
  let carla: TestUser;
  let joao: TestUser;

  const live = (extra: Partial<Parameters<typeof insertLot>[1]> = {}) =>
    insertLot(prisma, { auctioneerId: joao.id, ...LIVE, ...extra });
  const mine = (user: TestUser | null) => {
    const req = request(app).get("/me/bids");
    return user ? req.set("Authorization", user.auth) : req;
  };
  async function list(user: TestUser): Promise<MyBidItem[]> {
    const res = await mine(user);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body.items as MyBidItem[];
  }
  const itemOf = async (user: TestUser, lotId: string) => (await list(user)).find((item) => item.lot.id === lotId);
  async function bid(user: TestUser, lotId: string, amount: number, expected: number | null = null) {
    const res = await postBid(app, user, lotId, amount, expected);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
  }
  /** Fecha o lote como a rotina: o relógio vai ao fim e fica lá, e o serviço liquida. Lance e cancelamento vêm antes. */
  async function settle(lotId: string) {
    clock.set(ENDS_AT);
    await rig.settlement.settleLot(lotId);
  }
  async function cancel(user: TestUser, lotId: string) {
    const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
    const res = await request(app)
      .post(`/lots/${lotId}/cancel`)
      .set("Authorization", user.auth)
      .send({ confirmEntryCount: lot.entryCount });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }

  beforeEach(async () => {
    await truncateAll(prisma);
    ({ app, clock } = makeTestApp(prisma));
    ana = await makeUser(app, "Ana", { depositCents: 10_000_000 });
    bruno = await makeUser(app, "Bruno", { depositCents: 10_000_000 });
    carla = await makeUser(app, "Carla", { depositCents: 10_000_000 });
    joao = await makeUser(app, "Joao", { role: "AUCTIONEER" });
    rig = makeSettlement(prisma, clock);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("acesso (AC-7.9)", () => {
    it("visitante recebe 401 UNAUTHENTICATED no envelope", async () => {
      const res = await mine(null);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });

    it("leiloeiro recebe 403 ROLE_NOT_ALLOWED com a mensagem da fatia", async () => {
      const res = await mine(joao);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatchObject({ code: "ROLE_NOT_ALLOWED", message: MY_BIDS_TEXT.roleNotAllowed });
      expect(res.body.items).toBeUndefined();
    });

    it("a rota não atrapalha GET /me, e a resposta nunca é guardada em cache", async () => {
      expect((await request(app).get("/me").set("Authorization", ana.auth)).status).toBe(200);
      expect((await mine(ana)).headers["cache-control"]).toBe("no-store");
    });
  });

  describe("lista vazia e lotes sem lance", () => {
    it("sem lances: 200 com items vazio e o serverTime do relógio", async () => {
      await live();
      const res = await mine(ana);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], serverTime: NOW });
    });

    it("só entra lote em que dei lance: ver o lote, ou o lance dos outros, não basta (R-7.1)", async () => {
      const seen = await live();
      const bidOnly = await live();
      await request(app).get(`/lots/${seen.id}`).set("Authorization", ana.auth);
      await bid(bruno, bidOnly.id, 2_000_000);
      expect(await list(ana)).toEqual([]);
      expect((await list(bruno)).map((item) => item.lot.id)).toEqual([bidOnly.id]);
    });

    it("lista vazia pula a segunda consulta e o findMany do lote", async () => {
      const statements: string[] = [];
      const spy = new PrismaClient({ datasources: { db: { url: testDatabaseUrl! } }, log: [{ emit: "event", level: "query" }] });
      spy.$on("query", (event) => void statements.push(event.query));
      const spyApp = createApp({ env: testEnv, db: spy, logger: createLogger("silent"), clock });
      try {
        const lot = await live();
        const empty = await request(spyApp).get("/me/bids").set("Authorization", ana.auth);
        expect(empty.body.items).toEqual([]);
        const selects = statements.filter((sql) => /^\s*SELECT/i.test(sql));
        expect(selects).toHaveLength(1);
        expect(selects[0]).toContain('"Bid"');
        expect(statements.some((sql) => sql.includes('"Lot"'))).toBe(false);

        statements.length = 0;
        await bid(ana, lot.id, 2_000_000);
        const full = await request(spyApp).get("/me/bids").set("Authorization", ana.auth);
        expect(full.body.items).toHaveLength(1);
        expect(statements.filter((sql) => sql.includes("ANY"))).toHaveLength(1);
        expect(statements.some((sql) => sql.includes('"Lot"'))).toBe(true);
      } finally {
        await spy.$disconnect();
      }
    });
  });

  describe("ao vivo: Ganhando e Superado", () => {
    it("AC-7.2: só eu dou lance e lidero → LEADING, 1º de 1 (ids TEXT que não são uuid funcionam)", async () => {
      const lot = await live({ id: "lote-texto-nao-uuid" });
      await bid(ana, lot.id, 2_000_000);
      const item = await itemOf(ana, lot.id);
      expect(item).toMatchObject({
        state: "LEADING",
        myRank: 1,
        bidderCount: 1,
        myBestBidCents: 2_000_000,
        winnerPseudonym: null,
        receiptToken: null,
        refundedCents: null,
      });
      expect(item?.myPseudonym).toMatch(PSEUDONYM);
      expect(item?.lot).toMatchObject({ id: "lote-texto-nao-uuid", status: "LIVE", currentBidCents: 2_000_000, bidCount: 1 });
    });

    it("AC-7.3: A e B, B líder → A: OUTBID, 2º de 2, com o maior lance de A (não o de B)", async () => {
      const lot = await live();
      await bid(ana, lot.id, 2_000_000);
      await bid(bruno, lot.id, 2_100_000, 2_000_000);
      expect(await itemOf(ana, lot.id)).toMatchObject({
        state: "OUTBID",
        myRank: 2,
        bidderCount: 2,
        myBestBidCents: 2_000_000,
        receiptToken: null,
        winnerPseudonym: null,
      });
      expect(await itemOf(bruno, lot.id)).toMatchObject({ state: "LEADING", myRank: 1, bidderCount: 2, myBestBidCents: 2_100_000 });
    });

    it("AC-7.4: três licitantes (30.000, 28.000, 25.000) e B com vários lances → B é 2º de 3, não de 4", async () => {
      const lot = await live();
      await bid(bruno, lot.id, 2_200_000); // B: 22.000
      await bid(carla, lot.id, 2_500_000, 2_200_000); // C: 25.000
      await bid(bruno, lot.id, 2_800_000, 2_500_000); // B: 28.000 (o maior de B)
      await bid(ana, lot.id, 3_000_000, 2_800_000); // A: 30.000
      expect(await itemOf(bruno, lot.id)).toMatchObject({ state: "OUTBID", myRank: 2, bidderCount: 3, myBestBidCents: 2_800_000 });
      expect(await itemOf(ana, lot.id)).toMatchObject({ myRank: 1, bidderCount: 3 });
      expect(await itemOf(carla, lot.id)).toMatchObject({ myRank: 3, bidderCount: 3, myBestBidCents: 2_500_000 });
      expect((await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } })).bidCount).toBe(4);
    });

    it("AC-7.13: A superado volta a liderar com lance maior → OUTBID vira LEADING e o maior lance sobe", async () => {
      const lot = await live();
      await bid(ana, lot.id, 3_000_000);
      await bid(bruno, lot.id, 3_100_000, 3_000_000);
      expect(await itemOf(ana, lot.id)).toMatchObject({ state: "OUTBID", myBestBidCents: 3_000_000 });
      await bid(ana, lot.id, 3_200_000, 3_100_000);
      expect(await itemOf(ana, lot.id)).toMatchObject({ state: "LEADING", myRank: 1, bidderCount: 2, myBestBidCents: 3_200_000 });
    });

    it("AC-7.8: fim passado e ainda sem liquidar → o estado segue LEADING/OUTBID e o lote vem CLOSING", async () => {
      const lot = await live();
      await bid(ana, lot.id, 2_000_000);
      await bid(bruno, lot.id, 2_100_000, 2_000_000);
      clock.set(ENDS_AT);
      expect(await itemOf(ana, lot.id)).toMatchObject({ state: "OUTBID", myRank: 2, lot: { status: "CLOSING" } });
      expect(await itemOf(bruno, lot.id)).toMatchObject({ state: "LEADING", myRank: 1, lot: { status: "CLOSING" } });
    });

    it("não liquida: o GET nunca fecha o lote (INV-10)", async () => {
      const lot = await live();
      await bid(ana, lot.id, 2_000_000);
      clock.set(ENDS_AT);
      await list(ana);
      expect((await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } })).settledAt).toBeNull();
    });
  });

  describe("liquidado", () => {
    it("AC-7.5: lote liquidado em que sou o líder → WON, com o meu Receipt e sem posição", async () => {
      const lot = await live();
      await bid(ana, lot.id, 2_000_000);
      await bid(bruno, lot.id, 2_100_000, 2_000_000);
      await bid(ana, lot.id, 2_200_000, 2_100_000);
      await settle(lot.id);
      const receipt = await prisma.receipt.findUniqueOrThrow({ where: { lotId: lot.id } });
      const item = await itemOf(ana, lot.id);
      expect(item).toMatchObject({
        state: "WON",
        receiptToken: receipt.token,
        myRank: null,
        bidderCount: 2,
        myBestBidCents: 2_200_000,
        refundedCents: null,
        lot: { status: "SOLD", currentBidCents: 2_200_000 },
      });
      expect(item?.winnerPseudonym).toBe(item?.myPseudonym);
      expect(item?.winnerPseudonym).toBe(receipt.pseudonym);
    });

    it("AC-7.6: lote liquidado em que outro venceu → LOST, sem token e com o pseudônimo do vencedor naquele lote", async () => {
      const lot = await live();
      await bid(ana, lot.id, 2_000_000);
      await bid(bruno, lot.id, 2_100_000, 2_000_000);
      await settle(lot.id);
      const winner = await itemOf(bruno, lot.id);
      const loser = await itemOf(ana, lot.id);
      expect(loser).toMatchObject({ state: "LOST", receiptToken: null, myRank: null, refundedCents: null, myBestBidCents: 2_000_000 });
      expect(loser?.winnerPseudonym).toMatch(PSEUDONYM);
      expect(loser?.winnerPseudonym).toBe(winner?.myPseudonym);
      expect(loser?.winnerPseudonym).not.toBe(loser?.myPseudonym);
      expect(JSON.stringify(await mine(ana).then((res) => res.body))).not.toContain(winner!.receiptToken!);
    });

    it("AC-7.11: lote que outro venceu sem lance meu fica fora da lista e o token dele nunca aparece", async () => {
      const lot = await live();
      const mineLot = await live();
      await bid(carla, lot.id, 2_000_000);
      await bid(ana, mineLot.id, 2_000_000);
      await settle(lot.id);
      await settle(mineLot.id);
      const carlaToken = (await prisma.receipt.findUniqueOrThrow({ where: { lotId: lot.id } })).token;
      const anaItems = await list(ana);
      expect(anaItems.map((item) => item.lot.id)).toEqual([mineLot.id]);
      const raw = JSON.stringify((await mine(ana)).body);
      expect(raw).not.toContain(carlaToken);
      const carlaRaw = JSON.stringify((await mine(carla)).body);
      expect(carlaRaw).toContain(carlaToken);
      expect(carlaRaw).not.toContain(anaItems[0]!.receiptToken!);
    });
  });

  describe("cancelado (AC-7.7)", () => {
    it("o líder: CANCELLED com o estorno igual ao lance atual; o superado: CANCELLED sem estorno; nunca LOST", async () => {
      const lot = await live();
      await bid(ana, lot.id, 2_000_000);
      await bid(bruno, lot.id, 2_100_000, 2_000_000);
      await cancel(joao, lot.id);
      const leader = await itemOf(bruno, lot.id);
      const outbid = await itemOf(ana, lot.id);
      expect(leader).toMatchObject({
        state: "CANCELLED",
        refundedCents: 2_100_000,
        myRank: null,
        receiptToken: null,
        winnerPseudonym: null,
        lot: { status: "CANCELLED", currentBidCents: 2_100_000 },
      });
      expect(outbid).toMatchObject({ state: "CANCELLED", refundedCents: null, myRank: null, receiptToken: null, winnerPseudonym: null });
      expect(leader?.state).not.toBe("LOST");
      expect(outbid?.state).not.toBe("LOST");
    });
  });

  describe("transição por serviço (§14)", () => {
    it("A superado → OUTBID; o lote liquida → LOST", async () => {
      const lot = await live();
      await bid(ana, lot.id, 2_000_000);
      expect((await itemOf(ana, lot.id))?.state).toBe("LEADING");
      await bid(bruno, lot.id, 2_100_000, 2_000_000);
      expect((await itemOf(ana, lot.id))?.state).toBe("OUTBID");
      await settle(lot.id);
      expect((await itemOf(ana, lot.id))?.state).toBe("LOST");
    });

    it("A superado → OUTBID; o leiloeiro cancela → CANCELLED", async () => {
      const lot = await live();
      await bid(ana, lot.id, 2_000_000);
      await bid(bruno, lot.id, 2_100_000, 2_000_000);
      expect((await itemOf(ana, lot.id))?.state).toBe("OUTBID");
      await cancel(joao, lot.id);
      expect((await itemOf(ana, lot.id))?.state).toBe("CANCELLED");
    });
  });

  describe("ordem (R-7.9)", () => {
    it("OUTBID antes de LEADING, cada um pelo fim mais próximo; depois os finalizados pelo fim mais recente", async () => {
      const outbidLate = await live({ endsAt: iso(NOW_MS + 5 * HOUR) });
      const outbidSoon = await live({ endsAt: iso(NOW_MS + 2 * HOUR) });
      const leadingSoon = await live({ endsAt: iso(NOW_MS + 1.5 * HOUR) });
      const won = await live({ endsAt: iso(NOW_MS + 0.5 * HOUR) });
      const cancelled = await live({ endsAt: iso(NOW_MS + 0.8 * HOUR) });
      for (const lot of [outbidLate, outbidSoon]) {
        await bid(ana, lot.id, 2_000_000);
        await bid(bruno, lot.id, 2_100_000, 2_000_000);
      }
      await bid(ana, leadingSoon.id, 2_000_000);
      await bid(ana, won.id, 2_000_000);
      await bid(ana, cancelled.id, 2_000_000);
      await cancel(joao, cancelled.id);
      clock.set(iso(NOW_MS + 0.5 * HOUR));
      await rig.settlement.settleLot(won.id);

      const states = (await list(ana)).map((item) => [item.lot.id, item.state]);
      expect(states).toEqual([
        [outbidSoon.id, "OUTBID"],
        [outbidLate.id, "OUTBID"],
        [leadingSoon.id, "LEADING"],
        [cancelled.id, "CANCELLED"],
        [won.id, "WON"],
      ]);
    });
  });

  describe("privacidade (AC-7.10)", () => {
    it("nenhuma chave de identidade na resposta, em nenhum dos estados; e só as chaves do contrato", async () => {
      const liveLot = await live();
      const settled = await live();
      const cancelled = await live();
      for (const lot of [liveLot, settled, cancelled]) {
        await bid(ana, lot.id, 2_000_000);
        await bid(bruno, lot.id, 2_100_000, 2_000_000);
        await bid(ana, lot.id, 2_200_000, 2_100_000);
      }
      await cancel(joao, cancelled.id);
      await settle(settled.id);

      for (const user of [ana, bruno]) {
        const res = await mine(user);
        const keys = collectKeys(res.body);
        for (const forbidden of [...FORBIDDEN_KEYS, "userId", "name", "email", "leaderId", "bidderId", "winnerId"]) {
          expect(keys.has(forbidden), forbidden).toBe(false);
        }
        expect([...keys].filter((key) => !ALLOWED_KEYS.has(key))).toEqual([]);
        const raw = JSON.stringify(res.body);
        for (const person of [ana, bruno, carla, joao]) {
          expect(raw).not.toContain(person.id);
          expect(raw).not.toContain(person.email);
        }
      }
    });

    it("receiptToken só existe em WON", async () => {
      const lots = [await live(), await live(), await live()];
      for (const lot of lots) {
        await bid(ana, lot.id, 2_000_000);
        await bid(bruno, lot.id, 2_100_000, 2_000_000);
      }
      await cancel(joao, lots[1]!.id);
      await settle(lots[0]!.id);
      for (const user of [ana, bruno]) {
        for (const item of await list(user)) {
          expect(item.receiptToken !== null, `${user.email} ${item.state}`).toBe(item.state === "WON");
        }
      }
    });
  });
});
