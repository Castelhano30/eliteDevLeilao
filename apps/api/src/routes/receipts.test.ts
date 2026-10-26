import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { RECEIPT_TEXT, type LotState, type MyLotsResponse, type ReceiptDTO } from "@lanceauto/shared";
import { FakeClock } from "../infra/clock";
import { makeTestApp } from "../../test/helpers/app";
import { FORBIDDEN_KEYS, RecordingPublisher, collectKeys, makeUser, postBid, type TestUser } from "../../test/helpers/bids";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { insertLot } from "../../test/helpers/lots";
import { makeSettlement } from "../../test/helpers/settlement";

const NOW = "2026-10-23T12:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const ENDS_AT = iso(NOW_MS + HOUR);
const LIVE = { startsAt: iso(NOW_MS - 2 * HOUR), endsAt: ENDS_AT, startingBidCents: 2_000_000, minIncrementCents: 100_000 };

describe.skipIf(!testDatabaseUrl)("comprovante e resultado do lote (integração, DATABASE_URL_TEST)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let app: ReturnType<typeof makeTestApp>["app"];
  let clock: FakeClock;
  let rig: ReturnType<typeof makeSettlement>;
  // Nomes e e-mails distintivos: a varredura por substring não pode esbarrar em texto comum do corpo.
  let winner: TestUser;
  let loser: TestUser;
  let seller: TestUser;

  const live = (extra: Partial<Parameters<typeof insertLot>[1]> = {}) =>
    insertLot(prisma, { auctioneerId: seller.id, ...LIVE, ...extra });
  async function bid(user: TestUser, lotId: string, amount: number, expected: number | null = null) {
    const res = await postBid(app, user, lotId, amount, expected);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
  }
  /** Lote em que `loser` abre e `winner` leva por `finalCents`; fecha e liquida. */
  async function soldLot(finalCents: number, extra: Partial<Parameters<typeof insertLot>[1]> = {}) {
    const lot = await live(extra);
    await bid(loser, lot.id, finalCents - 100_000);
    await bid(winner, lot.id, finalCents, finalCents - 100_000);
    return lot;
  }
  /** Soma ao saldo pela API, para os testes em que o vencedor lidera mais de um lote ao mesmo tempo. */
  const topUp = async (user: TestUser, amountCents: number) => {
    await request(app).post("/wallet/deposits").set("Authorization", user.auth).send({ amountCents }).expect(201);
  };
  const closeAll = async () => {
    clock.set(iso(NOW_MS + 4 * HOUR));
    await rig.job.sweep();
  };
  const tokenOf = async (lotId: string) => (await prisma.receipt.findUniqueOrThrow({ where: { lotId } })).token;
  const getLot = (lotId: string, user?: TestUser) => {
    const req = request(app).get(`/lots/${lotId}`);
    return (user ? req.set("Authorization", user.auth) : req).then((res) => res.body as LotState);
  };
  /** Nada que identifique alguém pode estar no corpo (INV-13): ids, nomes e e-mails de todos os envolvidos. */
  const secrets = (extra: string[] = []) => [
    ...[winner, loser, seller].flatMap((user) => [user.id, user.email]),
    "Zanzibar",
    "Quixote",
    "Tamandua",
    ...extra,
  ];
  const expectNoSecrets = (body: unknown, extra: string[] = []) => {
    const text = JSON.stringify(body);
    for (const secret of secrets(extra)) expect(text, `vazou ${secret}`).not.toContain(secret);
    for (const key of collectKeys(body)) expect(FORBIDDEN_KEYS, `chave proibida ${key}`).not.toContain(key);
  };

  beforeEach(async () => {
    await truncateAll(prisma);
    const publisher = new RecordingPublisher();
    ({ app, clock } = makeTestApp(prisma, {}, { timeoutMs: 300 }, publisher));
    winner = await makeUser(app, "Zanzibar", { depositCents: 5_000_000 });
    loser = await makeUser(app, "Tamandua", { depositCents: 4_000_000 });
    seller = await makeUser(app, "Quixote", { role: "AUCTIONEER" });
    rig = makeSettlement(prisma, clock, publisher);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("GET /receipts/:token", () => {
    it("AC-5.13: 200 com o ReceiptDTO completo, sem dados pessoais e sem cache", async () => {
      const lot = await soldLot(3_200_000);
      await closeAll();
      const token = await tokenOf(lot.id);
      const settled = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id }, include: { bids: { orderBy: { seq: "desc" }, take: 1 } } });

      const res = await request(app).get(`/receipts/${token}`);

      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toBe("no-store");
      const dto = res.body as ReceiptDTO;
      expect(dto).toMatchObject({
        lotNumber: lot.number,
        lotId: lot.id,
        amountCents: 3_200_000,
        bidCount: 2,
        extended: false,
        hammerAt: ENDS_AT,
        settledAt: iso(NOW_MS + 4 * HOUR),
        winnerPseudonym: settled.bids[0]!.pseudonym,
        finalHash: settled.lastHash,
        auditUrl: `/lotes/${lot.id}/auditoria`,
        car: { title: "Lote de teste", brand: "Toyota", model: "Corolla XEi 2.0", year: 2015, fuel: "Flex", referencePriceCents: 8_000_000, referenceMonth: "2026-10", imageUrl: null, imageCredit: null },
      });
      expect(dto.receiptCode).toBe(`${String(lot.number).padStart(3, "0")}-${token.slice(0, 4).toUpperCase()}`);
      expect(dto.finalHash).toMatch(/^[0-9a-f]{64}$/);
      expect(dto.winnerPseudonym).toMatch(/^Licitante [0-9A-F]{4}$/);
      expectNoSecrets(res.body, [token]);
      expect(Object.keys(dto).sort()).toEqual(
        ["amountCents", "auditUrl", "bidCount", "car", "extended", "finalHash", "hammerAt", "lotId", "lotNumber", "receiptCode", "settledAt", "winnerPseudonym"],
      );
    });

    it("lote prorrogado leva extended e o martelo é o endsAt novo, não o settledAt", async () => {
      const lot = await live();
      await bid(loser, lot.id, 2_000_000);
      clock.set(iso(NOW_MS + HOUR - 40_000));
      await bid(winner, lot.id, 2_100_000, 2_000_000);
      const extendedEnd = iso(NOW_MS + HOUR - 40_000 + 120_000);
      await closeAll();
      const res = await request(app).get(`/receipts/${await tokenOf(lot.id)}`);
      expect(res.body.extended).toBe(true);
      expect(res.body.hammerAt).toBe(extendedEnd);
      expect(res.body.settledAt).toBe(iso(NOW_MS + 4 * HOUR));
    });

    it("AC-5.14: token inexistente, curto e com caracteres inválidos dão o mesmo 404", async () => {
      const lot = await soldLot(3_200_000);
      await closeAll();
      const real = await tokenOf(lot.id);
      const bad = ["A".repeat(32), "curto", `${real.slice(0, 31)}+`, "x".repeat(200), "../health"];
      const responses = [];
      for (const token of bad) responses.push(await request(app).get(`/receipts/${encodeURIComponent(token)}`));
      for (const res of responses) {
        expect(res.status).toBe(404);
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: RECEIPT_TEXT.notFoundBody } });
      }
      expect(JSON.stringify(responses.map((res) => res.body))).not.toContain(real.slice(0, 8));
    });

    it("AC-5.15: o mesmo licitante em dois lotes tem pseudônimos e tokens diferentes", async () => {
      await topUp(winner, 5_000_000);
      await topUp(loser, 5_000_000);
      const first = await soldLot(3_200_000, { title: "Primeiro" });
      const second = await soldLot(2_500_000, { title: "Segundo" });
      await closeAll();
      const [a, b] = [
        (await request(app).get(`/receipts/${await tokenOf(first.id)}`)).body as ReceiptDTO,
        (await request(app).get(`/receipts/${await tokenOf(second.id)}`)).body as ReceiptDTO,
      ];
      expect(a.winnerPseudonym).not.toBe(b.winnerPseudonym);
      expect(await tokenOf(first.id)).not.toBe(await tokenOf(second.id));
      expect(a.car.title).toBe("Primeiro");
      expect(b.car.title).toBe("Segundo");
    });
  });

  describe("GET /lots/:id", () => {
    it("AC-5.16: o vencedor logado recebe o token; os demais, null; o resultado é público", async () => {
      const lot = await soldLot(3_200_000);
      await closeAll();
      const token = await tokenOf(lot.id);
      const winningBid = await prisma.bid.findFirstOrThrow({ where: { lotId: lot.id }, orderBy: { seq: "desc" } });

      const asWinner = await getLot(lot.id, winner);
      expect(asWinner.lot.myReceiptToken).toBe(token);
      for (const viewer of [loser, seller, undefined]) {
        const state = await getLot(lot.id, viewer);
        expect(state.lot.myReceiptToken).toBeNull();
        expect(JSON.stringify(state)).not.toContain(token);
        expect(state.lot.result).toEqual({
          outcome: "SOLD",
          finalBidCents: 3_200_000,
          winnerPseudonym: winningBid.pseudonym,
          hammerAt: ENDS_AT,
          settledAt: iso(NOW_MS + 4 * HOUR),
        });
        expect(state.lot.status).toBe("SOLD");
      }
    });

    it("lote sem lances: result UNSOLD sem valor nem vencedor e nenhum token", async () => {
      const lot = await live();
      await closeAll();
      const state = await getLot(lot.id, winner);
      expect(state.lot.status).toBe("UNSOLD");
      expect(state.lot.result).toEqual({
        outcome: "UNSOLD",
        finalBidCents: null,
        winnerPseudonym: null,
        hammerAt: ENDS_AT,
        settledAt: iso(NOW_MS + 4 * HOUR),
      });
      expect(state.lot.myReceiptToken).toBeNull();
    });

    it("ao vivo, apurando e cancelado não têm result", async () => {
      const liveLot = await live({ title: "Ao vivo", endsAt: iso(NOW_MS + 10 * HOUR) });
      const cancelled = await live({ title: "Cancelado", cancelledAt: iso(NOW_MS - HOUR) });
      clock.set(iso(NOW_MS + 2 * HOUR));
      const closing = await live({ title: "Apurando", startsAt: iso(NOW_MS), endsAt: iso(NOW_MS + HOUR) });
      for (const lot of [liveLot, cancelled, closing]) {
        const state = await getLot(lot.id, winner);
        expect(state.lot.result).toBeNull();
        expect(state.lot.myReceiptToken).toBeNull();
      }
      expect((await getLot(closing.id)).lot.status).toBe("CLOSING");
    });
  });

  describe("GET /my/lots", () => {
    it("AC-5.18: totalReceivedCents soma os SALE_CREDIT e cada encerrado traz o resultado; lote de outro leiloeiro não entra", async () => {
      await topUp(winner, 5_000_000);
      await topUp(loser, 5_000_000);
      const sold = await soldLot(3_200_000, { title: "Vendido" });
      const second = await soldLot(2_500_000, { title: "Vendido 2" });
      const unsold = await live({ title: "Sem lances" });
      const other = await makeUser(app, "Outro", { role: "AUCTIONEER" });
      const foreign = await insertLot(prisma, { auctioneerId: other.id, ...LIVE, title: "Alheio" });
      await closeAll();

      const res = await request(app).get("/my/lots").set("Authorization", seller.auth);
      expect(res.status).toBe(200);
      const body = res.body as MyLotsResponse;
      expect(body.totalReceivedCents).toBe(3_200_000 + 2_500_000);
      const byId = new Map(body.lots.map((lot) => [lot.id, lot]));
      expect(byId.has(foreign.id)).toBe(false);
      expect(byId.get(sold.id)!.resultado).toMatchObject({ outcome: "SOLD", finalBidCents: 3_200_000, referencePriceCents: 8_000_000 });
      expect(byId.get(sold.id)!.resultado!.winnerPseudonym).toMatch(/^Licitante [0-9A-F]{4}$/);
      expect(byId.get(second.id)!.resultado).toMatchObject({ outcome: "SOLD", finalBidCents: 2_500_000 });
      expect(byId.get(unsold.id)!.resultado).toMatchObject({ outcome: "UNSOLD", finalBidCents: null, winnerPseudonym: null });
      expect(byId.get(unsold.id)!.status).toBe("UNSOLD");
      expectNoSecrets(body, [await tokenOf(sold.id), await tokenOf(second.id)]);

      const empty = await request(app).get("/my/lots").set("Authorization", other.auth);
      expect(empty.body.totalReceivedCents).toBe(0);
    });

    it("lote ainda apurando ou ao vivo tem resultado null e não entra no total", async () => {
      const lot = await live();
      await bid(winner, lot.id, 2_000_000);
      clock.set(ENDS_AT);
      const res = await request(app).get("/my/lots").set("Authorization", seller.auth);
      expect(res.body.totalReceivedCents).toBe(0);
      expect(res.body.lots[0]).toMatchObject({ id: lot.id, status: "CLOSING", resultado: null });
    });
  });

  describe("GET /wallet", () => {
    it("AC-5.19: extrato do vencedor traz SALE_DEBIT coerente e leadingLots não lista mais o lote", async () => {
      const lot = await soldLot(3_200_000);
      expect((await request(app).get("/wallet").set("Authorization", winner.auth)).body.leadingLots).toHaveLength(1);
      await closeAll();
      const res = await request(app).get("/wallet").set("Authorization", winner.auth);
      expect(res.body).toMatchObject({ totalCents: 1_800_000, committedCents: 0, availableCents: 1_800_000, leadingLots: [] });
      const debit = res.body.entries.find((entry: { kind: string }) => entry.kind === "SALE_DEBIT");
      expect(debit).toMatchObject({
        amountCents: 3_200_000,
        lotId: lot.id,
        lotNumber: lot.number,
        totalAfterCents: 1_800_000,
        committedAfterCents: 0,
      });
      // O disponível não muda com o arremate: o comprometido já estava fora dele desde o lance.
      const hold = res.body.entries.find((entry: { kind: string }) => entry.kind === "HOLD");
      expect(hold.totalAfterCents - hold.committedAfterCents).toBe(1_800_000);
    });
  });

  describe("varredura de privacidade", () => {
    it("nenhuma resposta pública de /receipts, /lots/:id e /lots leva e-mail, nome, id de usuário ou o token fora do dono", async () => {
      const lot = await soldLot(3_200_000);
      const unsold = await live({ title: "Sem lances" });
      await closeAll();
      const token = await tokenOf(lot.id);

      const publicBodies = [
        (await request(app).get(`/receipts/${token}`)).body,
        (await request(app).get("/lots")).body,
        ...(await Promise.all([lot.id, unsold.id].map((id) => getLot(id)))),
        ...(await Promise.all([lot.id, unsold.id].map((id) => getLot(id, loser)))),
        ...(await Promise.all([lot.id, unsold.id].map((id) => getLot(id, seller)))),
      ];
      for (const body of publicBodies) expectNoSecrets(body, [token]);

      // O dono vê o próprio token, e só ele; o que vem junto continua sem dado pessoal.
      const own = await getLot(lot.id, winner);
      expect(own.lot.myReceiptToken).toBe(token);
      expectNoSecrets({ ...own, lot: { ...own.lot, myReceiptToken: null } });
    });
  });
});
