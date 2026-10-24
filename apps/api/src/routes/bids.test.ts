import { createHmac } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BID_TEXT } from "@lanceauto/shared";
import { FakeClock } from "../infra/clock";
import { makeTestApp, testEnv } from "../../test/helpers/app";
import {
  FORBIDDEN_KEYS,
  RecordingPublisher,
  assertLotInvariants,
  collectKeys,
  makeUser,
  postBid,
  type TestUser,
} from "../../test/helpers/bids";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { insertLot } from "../../test/helpers/lots";
import { entryHash, genesisHash, sealHash } from "../domain/audit-chain";

const KEY = testEnv.AUDIT_HMAC_KEY;
const NOW = "2026-10-23T12:00:00.000Z";
const iso = (ms: number) => new Date(ms).toISOString();
const NOW_MS = Date.parse(NOW);
const HOUR = 3_600_000;

/** Lote de referência L: inicial R$ 25.000, incremento R$ 1.000, ao vivo, fim longe. */
const LIVE = { startsAt: iso(NOW_MS - 2 * HOUR), endsAt: iso(NOW_MS + 24 * HOUR), startingBidCents: 2_500_000, minIncrementCents: 100_000 };

describe.skipIf(!testDatabaseUrl)("lances (integração, DATABASE_URL_TEST)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let publisher: RecordingPublisher;
  let app: ReturnType<typeof makeTestApp>["app"];
  let clock: FakeClock;

  let ana: TestUser;
  let bruno: TestUser;
  let carla: TestUser;
  let joao: TestUser;
  let lotId: string;

  const live = (extra: Partial<Parameters<typeof insertLot>[1]> = {}) =>
    insertLot(prisma, { auctioneerId: joao.id, ...LIVE, ...extra });

  async function wallet(user: TestUser) {
    const row = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    return { total: Number(row.totalCents), committed: Number(row.committedCents) };
  }
  /** Soma ao saldo pela API, para os testes que precisam de mais de um lote ao mesmo tempo. */
  const topUp = async (user: TestUser, amountCents: number) => {
    const res = await request(app).post("/wallet/deposits").set("Authorization", user.auth).send({ amountCents });
    expect(res.status).toBe(201);
  };
  const bidCount = (id = lotId) => prisma.bid.count({ where: { lotId: id } });

  beforeEach(async () => {
    await truncateAll(prisma);
    publisher = new RecordingPublisher();
    ({ app, clock } = makeTestApp(prisma, {}, { timeoutMs: 300 }, publisher));
    ana = await makeUser(app, "Ana", { depositCents: 5_000_000 });
    bruno = await makeUser(app, "Bruno", { depositCents: 4_000_000 });
    carla = await makeUser(app, "Carla", { depositCents: 6_000_000 });
    joao = await makeUser(app, "Joao", { role: "AUCTIONEER" });
    lotId = (await live()).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("período do lote", () => {
    it("AC-3.1: lote agendado recusa com LOT_NOT_STARTED e não toca em nada", async () => {
      const scheduled = await live({ startsAt: iso(NOW_MS + HOUR), endsAt: iso(NOW_MS + 3 * HOUR) });
      const res = await postBid(app, ana, scheduled.id, 2_500_000);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("LOT_NOT_STARTED");
      expect(res.body.error.details).toEqual({ startsAt: iso(NOW_MS + HOUR) });
      expect(res.body.error.message).toMatch(/^O lote abre .+, \d{2}\/\d{2}, às \d+h(\d{2})?\. Até lá o martelo fica na gaveta\.$/);
      expect(await bidCount(scheduled.id)).toBe(0);
      expect(await wallet(ana)).toEqual({ total: 5_000_000, committed: 0 });
      expect((await prisma.lot.findUniqueOrThrow({ where: { id: scheduled.id } })).entryCount).toBe(0);
    });

    it("AC-3.2: now == startsAt exato aceita (início inclusivo)", async () => {
      clock.set(LIVE.startsAt);
      expect((await postBid(app, ana, lotId, 2_500_000)).status).toBe(201);
    });

    it("AC-3.3: now == endsAt recusa com LOT_ENDED; endsAt − 1 ms aceita (fim exclusivo)", async () => {
      clock.set(LIVE.endsAt);
      const ended = await postBid(app, ana, lotId, 2_500_000);
      expect(ended.status).toBe(409);
      expect(ended.body.error.code).toBe("LOT_ENDED");
      // 24 h depois de 12:00Z em Brasília: 09:00 do dia seguinte
      expect(ended.body.error.message).toBe("Martelo batido às 09:00. Este lote não aceita mais lances.");
      clock.set(iso(Date.parse(LIVE.endsAt) - 1));
      expect((await postBid(app, ana, lotId, 2_500_000)).status).toBe(201);
    });

    it("AC-3.4: lote cancelado recusa com o texto do PRD", async () => {
      const cancelled = await live({ cancelledAt: iso(NOW_MS - HOUR) });
      const res = await postBid(app, ana, cancelled.id, 2_500_000);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: "LOT_CANCELLED", message: "Este lote foi cancelado pelo leiloeiro." });
    });

    it("AC-3.5: encerrado e cancelado dá LOT_CANCELLED (checagem 2 antes da 4)", async () => {
      const both = await live({ endsAt: iso(NOW_MS - HOUR), cancelledAt: iso(NOW_MS - 2 * HOUR) });
      expect((await postBid(app, ana, both.id, 2_500_000)).body.error.code).toBe("LOT_CANCELLED");
    });

    it("AC-3.6: lote inexistente volta 404 NOT_FOUND", async () => {
      const res = await postBid(app, ana, "00000000-0000-4000-8000-000000000000", 2_500_000);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect((await postBid(app, ana, "abc", 2_500_000)).status).toBe(404);
    });
  });

  describe("valor mínimo", () => {
    it("AC-3.7: primeiro lance abaixo do inicial por 1 centavo", async () => {
      const res = await postBid(app, ana, lotId, 2_499_999);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("BELOW_MINIMUM");
      expect(res.body.error.details).toEqual({ minimumCents: 2_500_000, currentBidCents: null, reason: "MINIMUM" });
      expect(await wallet(ana)).toEqual({ total: 5_000_000, committed: 0 });
      expect(await bidCount()).toBe(0);
    });

    it("AC-3.8: primeiro lance igual ao inicial é aceito", async () => {
      const res = await postBid(app, ana, lotId, 2_500_000);
      expect(res.status).toBe(201);
      expect(res.body.bid).toMatchObject({ seq: 1, amountCents: 2_500_000 });
    });

    it("AC-3.9: abaixo de atual + incremento por 1 centavo, com o texto do mínimo", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      const res = await postBid(app, bruno, lotId, 3_099_999, 3_000_000);
      expect(res.status).toBe(422);
      expect(res.body.error.details).toEqual({ minimumCents: 3_100_000, currentBidCents: 3_000_000, reason: "MINIMUM" });
      expect(res.body.error.message).toBe("Seu lance precisa ser de pelo menos R$ 31.000,00.");
    });

    it("AC-3.10: exatamente atual + incremento é aceito", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      expect((await postBid(app, bruno, lotId, 3_100_000, 3_000_000)).status).toBe(201);
    });

    it("AC-3.11: esperado desatualizado vira OUTDATED", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      const res = await postBid(app, bruno, lotId, 3_050_000, 2_900_000);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("BELOW_MINIMUM");
      expect(res.body.error.details).toEqual({ minimumCents: 3_100_000, currentBidCents: 3_000_000, reason: "OUTDATED" });
      expect(res.body.error.message).toBe("Alguém levantou a mão antes de você. O mínimo agora é R$ 31.000,00.");
    });

    it("AC-3.12: esperado desatualizado com valor suficiente ainda é aceito", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      expect((await postBid(app, bruno, lotId, 3_200_000, 2_900_000)).status).toBe(201);
    });

    it("AC-3.13: corpo inválido volta VALIDATION com os campos", async () => {
      const send = (body: unknown) => request(app).post(`/lots/${lotId}/bids`).set("Authorization", ana.auth).send(body as object);
      const missing = await send({ amountCents: 2_500_000 });
      expect(missing.status).toBe(400);
      expect(missing.body.error.code).toBe("VALIDATION");
      expect(Object.keys(missing.body.error.details.fields)).toEqual(["expectedCurrentCents"]);
      for (const amountCents of [0, -5, 2_500_000.5, "2500000", null, Number.MAX_SAFE_INTEGER * 2]) {
        const res = await send({ amountCents, expectedCurrentCents: null });
        expect(res.status).toBe(400);
        expect(res.body.error.details.fields.amountCents).toBe(BID_TEXT.invalidAmount);
      }
      expect((await send({})).body.error.details.fields).toHaveProperty("amountCents");
      expect((await request(app).post(`/lots/${lotId}/bids`).set("Authorization", ana.auth)).status).toBe(400);
      expect(await bidCount()).toBe(0);
    });
  });

  describe("liderança", () => {
    it("AC-3.14: líder reenvia valor suficiente e recebe ALREADY_WINNING", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      const res = await postBid(app, ana, lotId, 3_100_000, 3_000_000);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({
        code: "ALREADY_WINNING",
        message: "Você já está na frente. Cobrir o próprio lance só gasta saldo.",
      });
      expect(await bidCount()).toBe(1);
      expect(await wallet(ana)).toEqual({ total: 5_000_000, committed: 3_000_000 });
    });

    it("AC-3.15: líder abaixo do mínimo recebe BELOW_MINIMUM com OWN_LEAD (C1)", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      const res = await postBid(app, ana, lotId, 3_050_000, 3_000_000);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("BELOW_MINIMUM");
      expect(res.body.error.details.reason).toBe("OWN_LEAD");
      expect(res.body.error.message).toBe("Você já está na frente. Para cobrir o próprio lance, o mínimo é R$ 31.000,00.");
    });

    it("AC-3.16: líder sem saldo para o valor recebe ALREADY_WINNING (liderança antes de saldo)", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      const res = await postBid(app, ana, lotId, 100_000_000, 3_000_000);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ALREADY_WINNING");
    });
  });

  describe("papel e autenticação", () => {
    it("AC-3.17: leiloeiro com lance que passaria recebe ROLE_NOT_ALLOWED e nada é gravado", async () => {
      const res = await postBid(app, joao, lotId, 2_500_000);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatchObject({
        code: "ROLE_NOT_ALLOWED",
        message: "Leiloeiro vende, não compra. Lance é coisa de licitante.",
      });
      expect(await bidCount()).toBe(0);
    });

    it("AC-3.18: leiloeiro cai no código da checagem anterior", async () => {
      const ended = await live({ endsAt: iso(NOW_MS - HOUR) });
      expect((await postBid(app, joao, ended.id, 2_500_000)).body.error.code).toBe("LOT_ENDED");
      expect((await postBid(app, joao, lotId, 100)).body.error.code).toBe("BELOW_MINIMUM");
    });

    it("AC-3.19: sem Authorization volta 401 e nada acontece", async () => {
      const res = await request(app).post(`/lots/${lotId}/bids`).send({ amountCents: 2_500_000, expectedCurrentCents: null });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
      expect(await bidCount()).toBe(0);
    });
  });

  describe("saldo", () => {
    it("AC-3.20: saldo disponível menor que o lance recusa e não mexe em carteira nem extrato", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      const other = await live();
      const before = await prisma.ledgerEntry.count();
      const res = await postBid(app, ana, other.id, 2_500_000);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("INSUFFICIENT_BALANCE");
      expect(res.body.error.details).toEqual({ availableCents: 2_000_000 });
      expect(res.body.error.message).toBe("Saldo insuficiente: você tem R$ 20.000,00 disponíveis.");
      expect(await wallet(ana)).toEqual({ total: 5_000_000, committed: 3_000_000 });
      expect(await prisma.ledgerEntry.count()).toBe(before);
    });

    it("AC-3.21: disponível exato aceita e zera; um centavo a mais recusa", async () => {
      const exact = await postBid(app, ana, lotId, 5_000_000);
      expect(exact.status).toBe(201);
      expect(exact.body.wallet).toEqual({ totalCents: 5_000_000, committedCents: 5_000_000, availableCents: 0 });
      const other = await live();
      const over = await postBid(app, bruno, other.id, 4_000_001);
      expect(over.status).toBe(422);
      expect(over.body.error.code).toBe("INSUFFICIENT_BALANCE");
    });

    it("AC-3.22: exemplo do PRD, passo a passo, com o total sempre igual", async () => {
      const lotB = await live();
      const a1 = await postBid(app, ana, lotId, 3_000_000);
      expect(a1.body.wallet).toEqual({ totalCents: 5_000_000, committedCents: 3_000_000, availableCents: 2_000_000 });
      expect(await prisma.ledgerEntry.findFirstOrThrow({ where: { userId: ana.id, kind: "HOLD" } })).toMatchObject({
        amountCents: 3_000_000n,
        lotId,
      });
      expect((await postBid(app, ana, lotB.id, 2_500_000)).body.error.code).toBe("INSUFFICIENT_BALANCE");

      const b1 = await postBid(app, bruno, lotId, 3_100_000, 3_000_000);
      expect(b1.status).toBe(201);
      expect(await wallet(ana)).toEqual({ total: 5_000_000, committed: 0 });
      expect(await wallet(bruno)).toEqual({ total: 4_000_000, committed: 3_100_000 });
      const release = await prisma.ledgerEntry.findFirstOrThrow({ where: { userId: ana.id, kind: "RELEASE" } });
      expect(release).toMatchObject({ amountCents: 3_000_000n, lotId, totalAfter: 5_000_000n, committedAfter: 0n });

      const a2 = await postBid(app, ana, lotId, 3_200_000, 3_100_000);
      expect(a2.status).toBe(201);
      expect(await wallet(ana)).toEqual({ total: 5_000_000, committed: 3_200_000 });
      expect(a2.body.wallet.availableCents).toBe(1_800_000);
      expect(await wallet(bruno)).toEqual({ total: 4_000_000, committed: 0 });
      expect(await prisma.ledgerEntry.findFirstOrThrow({ where: { userId: bruno.id, kind: "RELEASE" } })).toMatchObject({
        amountCents: 3_100_000n,
        lotId,
      });
      await assertLotInvariants(prisma, lotId);
    });

    it("AC-3.23: depois de qualquer sequência, a carteira bate com o ledger e com os CHECKs", async () => {
      let expected: number | null = null;
      const order = [ana, bruno, carla, ana, bruno, carla, bruno];
      let amount = 2_500_000;
      for (const user of order) {
        const res = await postBid(app, user, lotId, amount, expected);
        expect(res.status).toBe(201);
        expected = amount;
        amount += 100_000;
      }
      await assertLotInvariants(prisma, lotId);
    });

    it("AC-3.24: sem carteira, INSUFFICIENT_BALANCE com disponível 0 e nenhuma carteira criada", async () => {
      await prisma.wallet.delete({ where: { userId: carla.id } });
      const res = await postBid(app, carla, lotId, 2_500_000);
      expect(res.status).toBe(422);
      expect(res.body.error.details).toEqual({ availableCents: 0 });
      expect(await prisma.wallet.count({ where: { userId: carla.id } })).toBe(0);
    });

    it("AC-3.25: falha ao inserir o Bid desfaz tudo e não publica evento", async () => {
      // A linha seq 1 já existe com entryCount ainda 0: o INSERT do lance bate no índice único (violação forçada).
      await prisma.bid.create({
        data: { lotId, seq: 1, kind: "BID", bidderId: ana.id, pseudonym: "X", amountCents: 1n, at: new Date(NOW), prevHash: "a", hash: "b" },
      });
      const before = {
        ana: await wallet(ana),
        bruno: await wallet(bruno),
        lot: await prisma.lot.findUniqueOrThrow({ where: { id: lotId } }),
        ledger: await prisma.ledgerEntry.count(),
      };
      const res = await postBid(app, bruno, lotId, 2_500_000);
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL");
      expect(await wallet(ana)).toEqual(before.ana);
      expect(await wallet(bruno)).toEqual(before.bruno);
      expect(await prisma.lot.findUniqueOrThrow({ where: { id: lotId } })).toEqual(before.lot);
      expect(await prisma.ledgerEntry.count()).toBe(before.ledger);
      expect(publisher.batches).toHaveLength(0);
    });
  });

  describe("efeitos, hash e privacidade", () => {
    it("AC-3.26: primeiro lance grava a cadeia, o selo e atualiza o lote", async () => {
      const lot0 = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
      const res = await postBid(app, ana, lotId, 3_000_000);
      expect(res.status).toBe(201);
      const bid = await prisma.bid.findFirstOrThrow({ where: { lotId } });
      expect(bid).toMatchObject({ seq: 1, kind: "BID", bidderId: ana.id, amountCents: 3_000_000n });
      expect(bid.prevHash).toBe(genesisHash(KEY, lot0));
      expect(bid.prevHash).toBe(lot0.lastHash);
      const expectedHash = createHmac("sha256", KEY)
        .update(`v1|entry|${lotId}|1|BID|${bid.pseudonym}|3000000|${bid.at.toISOString()}|${bid.prevHash}`)
        .digest("hex");
      expect(bid.hash).toBe(expectedHash);
      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
      expect(lot).toMatchObject({ entryCount: 1, bidCount: 1, lastHash: bid.hash, currentBidCents: 3_000_000n, leaderId: ana.id });
      expect(lot.seal).toBe(createHmac("sha256", KEY).update(`v1|seal|${lotId}|1|${bid.hash}`).digest("hex"));
    });

    it("AC-3.27: segundo lance encadeia no hash do primeiro", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      await postBid(app, bruno, lotId, 3_100_000, 3_000_000);
      const [first, second] = await prisma.bid.findMany({ where: { lotId }, orderBy: { seq: "asc" } });
      expect(second).toMatchObject({ seq: 2, prevHash: first!.hash });
      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
      expect(lot.seal).toBe(sealHash(KEY, lotId, 2, second!.hash));
      await assertLotInvariants(prisma, lotId);
    });

    it("AC-3.28: a data do lance é gravada e hasheada com milissegundos", async () => {
      clock.set("2026-10-23T12:00:00.123Z");
      await postBid(app, ana, lotId, 3_000_000);
      const bid = await prisma.bid.findFirstOrThrow({ where: { lotId } });
      expect(bid.at.toISOString()).toBe("2026-10-23T12:00:00.123Z");
      expect(bid.hash).toBe(
        entryHash(KEY, { lotId, seq: 1, kind: "BID", pseudonym: bid.pseudonym, amountCents: 3_000_000, at: bid.at, prevHash: bid.prevHash }),
      );
    });

    it("AC-3.29: UPDATE e DELETE em Bid são recusados pelo banco", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      await expect(prisma.$executeRawUnsafe(`UPDATE "Bid" SET hash = 'x'`)).rejects.toThrow(/Bid é append-only/);
      await expect(prisma.$executeRawUnsafe(`DELETE FROM "Bid"`)).rejects.toThrow(/Bid é append-only/);
      expect(await bidCount()).toBe(1);
    });

    it("Bid_shape_chk: BID sem autor, sem pseudônimo ou sem valor positivo, e CANCEL com dados, são recusados", async () => {
      const insert = (seq: number, kind: "BID" | "CANCEL", bidderId: string | null, pseudonym: string | null, amountCents: number | null) =>
        prisma.$executeRawUnsafe(
          `INSERT INTO "Bid" ("id","lotId","seq","kind","bidderId","pseudonym","amountCents","at","prevHash","hash")
           VALUES ('chk-' || $1::text, $2, $1, $3::"ChainKind", $4, $5, $6, now(), 'x', 'y')`,
          seq,
          lotId,
          kind,
          bidderId,
          pseudonym,
          amountCents,
        );
      await expect(insert(1, "BID", ana.id, "Licitante AAAA", null)).rejects.toThrow(/Bid_shape_chk/);
      await expect(insert(2, "BID", ana.id, "Licitante AAAA", 0)).rejects.toThrow(/Bid_shape_chk/);
      await expect(insert(3, "BID", null, "Licitante AAAA", 3_000_000)).rejects.toThrow(/Bid_shape_chk/);
      await expect(insert(4, "BID", ana.id, null, 3_000_000)).rejects.toThrow(/Bid_shape_chk/);
      await expect(insert(5, "CANCEL", ana.id, null, null)).rejects.toThrow(/Bid_shape_chk/);
      await expect(insert(6, "CANCEL", null, null, 3_000_000)).rejects.toThrow(/Bid_shape_chk/);
      expect(await bidCount()).toBe(0);
      // Contraprova: as duas formas válidas entram, então o CHECK não está só recusando tudo.
      await insert(7, "BID", ana.id, "Licitante AAAA", 3_000_000);
      await insert(8, "CANCEL", null, null, null);
      expect(await bidCount()).toBe(2);
    });

    it("CHECKs de Lot: contadores negativos e lance atual abaixo do inicial são recusados", async () => {
      await expect(prisma.$executeRawUnsafe(`UPDATE "Lot" SET "bidCount" = -1 WHERE "id" = $1`, lotId)).rejects.toThrow(/lot_bid_count_nonneg/);
      await expect(prisma.$executeRawUnsafe(`UPDATE "Lot" SET "entryCount" = -1 WHERE "id" = $1`, lotId)).rejects.toThrow(/lot_entry_count_nonneg/);
      await expect(
        prisma.$executeRawUnsafe(`UPDATE "Lot" SET "currentBidCents" = "startingBidCents" - 1 WHERE "id" = $1`, lotId),
      ).rejects.toThrow(/lot_current_bid_min/);
      // Contraprova: o lance atual igual ao inicial é aceito (limite do CHECK).
      await prisma.$executeRawUnsafe(`UPDATE "Lot" SET "currentBidCents" = "startingBidCents" WHERE "id" = $1`, lotId);
      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
      expect(lot.currentBidCents).toBe(lot.startingBidCents);
    });

    it("AC-3.30: pseudônimo muda de lote e fica igual dentro do mesmo lote", async () => {
      await topUp(ana, 5_000_000);
      const other = await live();
      await postBid(app, ana, lotId, 3_000_000);
      await postBid(app, bruno, lotId, 3_100_000, 3_000_000);
      await postBid(app, ana, lotId, 3_200_000, 3_100_000);
      await postBid(app, ana, other.id, 3_000_000);
      const inLot = (await prisma.bid.findMany({ where: { lotId, bidderId: ana.id } })).map((bid) => bid.pseudonym);
      const elsewhere = (await prisma.bid.findFirstOrThrow({ where: { lotId: other.id, bidderId: ana.id } })).pseudonym;
      expect(inLot).toHaveLength(2);
      expect(new Set(inLot).size).toBe(1);
      expect(inLot[0]).toMatch(/^Licitante [0-9A-F]{4}$/);
      expect(elsewhere).not.toBe(inLot[0]);
    });

    it("AC-3.31: nenhuma chave de usuário aparece no GET do lote nem na resposta do lance", async () => {
      const post = await postBid(app, ana, lotId, 3_000_000);
      await postBid(app, bruno, lotId, 3_100_000, 3_000_000);
      const get = await request(app).get(`/lots/${lotId}`).set("Authorization", ana.auth);
      for (const body of [post.body, get.body]) {
        const keys = collectKeys(body);
        for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden)).toBe(false);
      }
      const text = JSON.stringify([post.body, get.body]);
      expect(text).not.toContain(ana.id);
      expect(text).not.toContain(bruno.id);
      expect(text).not.toContain("lanceauto.test");
    });
  });

  describe("prorrogação", () => {
    const E = Date.parse(LIVE.endsAt);
    const at = (msBeforeEnd: number) => clock.set(iso(E - msBeforeEnd));

    it("AC-3.32: 2:00.001 antes do fim não prorroga", async () => {
      at(120_001);
      const res = await postBid(app, ana, lotId, 2_500_000);
      expect(res.status).toBe(201);
      expect(res.body.lot.endsAt).toBe(LIVE.endsAt);
      expect(res.body.lot.extended).toBe(false);
      expect(publisher.events.find((e) => e.type === "bid:placed")!.payload).toMatchObject({ extended: false });
    });

    it("AC-3.33: 2:00.000 exato recalcula o fim para o mesmo instante e extended=false", async () => {
      at(120_000);
      const res = await postBid(app, ana, lotId, 2_500_000);
      expect(res.body.lot.endsAt).toBe(LIVE.endsAt);
      expect(publisher.events.find((e) => e.type === "bid:placed")!.payload).toMatchObject({ extended: false });
    });

    it("AC-3.34: 1:59.999 antes do fim leva o fim para now + 2 min", async () => {
      at(119_999);
      const res = await postBid(app, ana, lotId, 2_500_000);
      expect(res.body.lot.endsAt).toBe(iso(E + 1));
      expect(res.body.lot.extended).toBe(true);
      expect(res.body.lot.originalEndsAt).toBe(LIVE.endsAt);
      expect(publisher.events.find((e) => e.type === "bid:placed")!.payload).toMatchObject({ extended: true });
      const stored = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
      expect(stored.endsAt.getTime()).toBe(E + 1);
      expect(stored.originalEndsAt.getTime()).toBe(E);
    });

    it("AC-3.35: 1 ms antes do fim ainda é aceito e prorroga", async () => {
      at(1);
      const res = await postBid(app, ana, lotId, 2_500_000);
      expect(res.status).toBe(201);
      expect(res.body.lot.endsAt).toBe(iso(E - 1 + 120_000));
    });

    it("AC-3.36: dez lances seguidos nos 2 min finais, sem teto; originalEndsAt fica fixo", async () => {
      const users = [ana, bruno];
      let amount = 2_500_000;
      let expected: number | null = null;
      let last = "";
      for (let i = 0; i < 10; i++) {
        // sempre dentro da janela: 30 s antes do fim vigente
        const stored = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
        clock.set(iso(stored.endsAt.getTime() - 30_000));
        const res = await postBid(app, users[i % 2]!, lotId, amount, expected);
        expect(res.status).toBe(201);
        last = res.body.lot.endsAt;
        expect(last).toBe(iso(Date.parse(res.body.bid.at) + 120_000));
        expected = amount;
        amount += 100_000;
      }
      const stored = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
      expect(stored.endsAt.toISOString()).toBe(last);
      expect(stored.originalEndsAt.getTime()).toBe(E);
      await assertLotInvariants(prisma, lotId);
    });
  });

  describe("concorrência", () => {
    async function bidders(count: number, depositCents: number, prefix = "Lic") {
      const list: TestUser[] = [];
      for (let i = 0; i < count; i++) list.push(await makeUser(app, `${prefix}${i}`, { depositCents }));
      return list;
    }

    it("AC-3.38: 10 lances iguais ao mesmo tempo: um aceito, nove BELOW_MINIMUM", async () => {
      const crowd = await bidders(10, 5_000_000);
      const results = await Promise.all(crowd.map((user) => postBid(app, user, lotId, 2_500_000, null)));
      const accepted = results.filter((res) => res.status === 201);
      const refused = results.filter((res) => res.status === 422);
      expect(accepted).toHaveLength(1);
      expect(refused).toHaveLength(9);
      for (const res of refused) {
        expect(res.body.error.code).toBe("BELOW_MINIMUM");
        expect(res.body.error.details.reason).toBe("OUTDATED");
      }
      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
      expect(lot.bidCount).toBe(1);
      const sum = await prisma.wallet.aggregate({ _sum: { committedCents: true } });
      expect(sum._sum.committedCents).toBe(2_500_000n);
      await assertLotInvariants(prisma, lotId);
    });

    /** Uma rodada do AC-3.39: valores crescentes distintos, ordem de chegada embaralhada, saldos diferentes. */
    async function round(crowd: TestUser[], target: string, shuffle: boolean) {
      const amounts = crowd.map((_, index) => 2_500_000 + index * 100_000);
      const order = crowd.map((_, index) => index);
      if (shuffle) order.sort(() => Math.random() - 0.5);
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("rodada travou (deadlock?)")), 10_000));
      const results = await Promise.race([
        Promise.all(order.map((index) => postBid(app, crowd[index]!, target, amounts[index]!, null))),
        timeout,
      ]);
      const outcomes = results.map((res, position) => ({ index: order[position]!, res }));
      for (const { res } of outcomes) {
        if (res.status !== 201) {
          expect(res.status).toBe(422);
          expect(["BELOW_MINIMUM", "INSUFFICIENT_BALANCE"]).toContain(res.body.error.code);
        }
      }
      return outcomes;
    }

    it("AC-3.39: 10 lances crescentes com saldos diferentes mantêm todas as invariantes", async () => {
      // pares podem; ímpares têm saldo menor que o próprio lance
      const crowd: TestUser[] = [];
      for (let i = 0; i < 10; i++) {
        crowd.push(await makeUser(app, `Mix${i}`, { depositCents: i % 2 === 0 ? 10_000_000 : 2_000_000 }));
      }
      const outcomes = await round(crowd, lotId, true);
      const accepted = outcomes.filter(({ res }) => res.status === 201).map(({ index }) => index);
      expect(accepted.length).toBeGreaterThan(0);
      for (const index of accepted) expect(index % 2).toBe(0);
      const rows = await prisma.bid.findMany({ where: { lotId }, orderBy: { seq: "asc" } });
      expect(rows.map((row) => row.seq)).toEqual(rows.map((_, i) => i + 1));
      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
      expect(lot.currentBidCents).toBe(rows[rows.length - 1]!.amountCents);
      await assertLotInvariants(prisma, lotId);
      for (const { index, res } of outcomes) {
        if (res.status === 422 && index % 2 === 1) expect(["BELOW_MINIMUM", "INSUFFICIENT_BALANCE"]).toContain(res.body.error.code);
      }
    });

    it("AC-3.40: 20 rodadas embaralhadas, sem deadlock e com as invariantes", async () => {
      const rich = await bidders(5, 500_000_000, "Rica");
      const poor = await bidders(5, 2_000_000, "Pobre");
      const crowd = [rich[0]!, poor[0]!, rich[1]!, poor[1]!, rich[2]!, poor[2]!, rich[3]!, poor[3]!, rich[4]!, poor[4]!];
      for (let i = 0; i < 20; i++) {
        const target = (await live()).id;
        await round(crowd, target, true);
        await assertLotInvariants(prisma, target);
      }
    }, 120_000);

    it("AC-3.41: Ana cobre Bruno em L2 e Bruno cobre Ana em L1 ao mesmo tempo, sem deadlock", async () => {
      await topUp(ana, 5_000_000);
      await topUp(bruno, 5_000_000);
      const l1 = (await live()).id;
      const l2 = (await live()).id;
      expect((await postBid(app, ana, l1, 2_500_000)).status).toBe(201);
      expect((await postBid(app, bruno, l2, 2_500_000)).status).toBe(201);
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("travou")), 10_000));
      const [a, b] = await Promise.race([
        Promise.all([postBid(app, ana, l2, 2_600_000, 2_500_000), postBid(app, bruno, l1, 2_600_000, 2_500_000)]),
        timeout,
      ]);
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(await wallet(ana)).toEqual({ total: 10_000_000, committed: 2_600_000 });
      expect(await wallet(bruno)).toEqual({ total: 9_000_000, committed: 2_600_000 });
      await assertLotInvariants(prisma, l1);
      await assertLotInvariants(prisma, l2);
    });

    it("AC-3.42: duplo envio idêntico do mesmo usuário: um aceito, o outro OWN_LEAD, um só HOLD", async () => {
      const [first, second] = await Promise.all([postBid(app, ana, lotId, 3_000_000, null), postBid(app, ana, lotId, 3_000_000, null)]);
      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([201, 422]);
      const refused = first.status === 422 ? first : second;
      expect(refused.body.error.code).toBe("BELOW_MINIMUM");
      expect(refused.body.error.details.reason).toBe("OWN_LEAD");
      expect(await prisma.ledgerEntry.count({ where: { userId: ana.id, kind: "HOLD" } })).toBe(1);
      await assertLotInvariants(prisma, lotId);
    });

    it("AC-3.43: o GET nunca mostra o lance atual sem a linha correspondente no histórico", async () => {
      const crowd = await bidders(8, 50_000_000, "Rap");
      const readers = Array.from({ length: 40 }, () => request(app).get(`/lots/${lotId}`));
      const writers = crowd.map((user, index) => postBid(app, user, lotId, 2_500_000 + index * 100_000, null));
      const reads = await Promise.all([...readers, ...writers].map((req) => req));
      for (const res of reads.slice(0, 40)) {
        expect(res.status).toBe(200);
        const { lot, bids } = res.body;
        expect(bids).toHaveLength(lot.bidCount);
        expect(lot.version).toBe(bids.length);
        if (lot.currentBidCents !== null) expect(bids[0].amountCents).toBe(lot.currentBidCents);
        else expect(bids).toHaveLength(0);
      }
    });

    it("AC-3.65: reenvio de quem já não é líder vira OUTDATED; o líder atual recebe OWN_LEAD", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      await postBid(app, bruno, lotId, 3_100_000, 3_000_000);
      const stale = await postBid(app, ana, lotId, 3_050_000, 3_000_000);
      expect(stale.body.error.details.reason).toBe("OUTDATED");
      const own = await postBid(app, bruno, lotId, 3_150_000, 3_100_000);
      expect(own.body.error.code).toBe("BELOW_MINIMUM");
      expect(own.body.error.details.reason).toBe("OWN_LEAD");
    });
  });

  describe("leitura: posição, privacidade e carteira", () => {
    it("AC-3.44: posição pelo maior lance de cada licitante, contando cada um uma vez", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      await postBid(app, bruno, lotId, 3_100_000, 3_000_000);
      await postBid(app, carla, lotId, 3_200_000, 3_100_000);
      await postBid(app, ana, lotId, 3_300_000, 3_200_000);
      const asAna = (await request(app).get(`/lots/${lotId}`).set("Authorization", ana.auth)).body;
      expect(asAna.lot).toMatchObject({ myRank: 1, bidderCount: 3, myBestBidCents: 3_300_000, bidCount: 4 });
      expect(asAna.lot.myPseudonym).toMatch(/^Licitante [0-9A-F]{4}$/);
      const asBruno = (await request(app).get(`/lots/${lotId}`).set("Authorization", bruno.auth)).body;
      expect(asBruno.lot).toMatchObject({ myRank: 3, bidderCount: 3, myBestBidCents: 3_100_000 });
      expect(asBruno.bids.map((bid: { seq: number }) => bid.seq)).toEqual([4, 3, 2, 1]);
      expect(asBruno.bids[0]).toMatchObject({ kind: "BID", amountCents: 3_300_000 });
      expect(asBruno.lot.minimumBidCents).toBe(3_400_000);
    });

    it("AC-3.44: o myPseudonym do GET é o pseudônimo gravado nos lances do próprio licitante", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      await postBid(app, bruno, lotId, 3_100_000, 3_000_000);
      await postBid(app, ana, lotId, 3_200_000, 3_100_000);
      const pseudonymOf = (body: { bids: { seq: number; pseudonym: string }[] }, seq: number) =>
        body.bids.find((bid) => bid.seq === seq)?.pseudonym;
      const asAna = (await request(app).get(`/lots/${lotId}`).set("Authorization", ana.auth)).body;
      const asBruno = (await request(app).get(`/lots/${lotId}`).set("Authorization", bruno.auth)).body;
      // A Sala marca "VOCÊ" comparando os dois: o GET precisa calcular o mesmo valor que o placeBid gravou.
      expect(asAna.lot.myPseudonym).toBe(pseudonymOf(asAna, 1));
      expect(asAna.lot.myPseudonym).toBe(pseudonymOf(asAna, 3));
      expect(asBruno.lot.myPseudonym).toBe(pseudonymOf(asBruno, 2));
      expect(asBruno.lot.myPseudonym).not.toBe(asAna.lot.myPseudonym);
    });

    it("quem ainda não deu lance tem pseudônimo, mas posição nula", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      const asBruno = (await request(app).get(`/lots/${lotId}`).set("Authorization", bruno.auth)).body;
      expect(asBruno.lot.myPseudonym).toMatch(/^Licitante /);
      expect(asBruno.lot.myRank).toBeNull();
      expect(asBruno.lot.myBestBidCents).toBeNull();
      expect(asBruno.lot.bidderCount).toBe(1);
    });

    it("AC-3.45: visitante, leiloeiro e token inválido não têm posição e não recebem 401", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      const requests = [
        request(app).get(`/lots/${lotId}`),
        request(app).get(`/lots/${lotId}`).set("Authorization", joao.auth),
        request(app).get(`/lots/${lotId}`).set("Authorization", "Bearer lixo.lixo.lixo"),
      ];
      for (const res of await Promise.all(requests)) {
        expect(res.status).toBe(200);
        expect(res.body.lot).toMatchObject({ myPseudonym: null, myRank: null, myBestBidCents: null });
        expect(res.body.bids).toHaveLength(1);
      }
    });

    it("AC-3.46: leadingLots lista os lotes em que lidero e perde o que foi superado", async () => {
      await topUp(ana, 5_000_000);
      const l2 = await live({ title: "Segundo lote" });
      await postBid(app, ana, lotId, 3_000_000);
      await postBid(app, ana, l2.id, 2_600_000);
      let page = (await request(app).get("/wallet").set("Authorization", ana.auth)).body;
      expect(page.leadingLots).toHaveLength(2);
      expect(page.leadingLots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ lotId, committedCents: 3_000_000 }),
          expect.objectContaining({ lotId: l2.id, committedCents: 2_600_000, title: "Segundo lote" }),
        ]),
      );
      await postBid(app, bruno, lotId, 3_100_000, 3_000_000);
      page = (await request(app).get("/wallet").set("Authorization", ana.auth)).body;
      expect(page.leadingLots.map((lot: { lotId: string }) => lot.lotId)).toEqual([l2.id]);
    });

    it("o extrato traz o número do lote nas linhas HOLD e RELEASE", async () => {
      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
      await postBid(app, ana, lotId, 3_000_000);
      await postBid(app, bruno, lotId, 3_100_000, 3_000_000);
      const page = (await request(app).get("/wallet").set("Authorization", ana.auth)).body;
      const kinds = page.entries.map((entry: { kind: string; lotNumber: number | null }) => [entry.kind, entry.lotNumber]);
      expect(kinds).toEqual([
        ["RELEASE", lot.number],
        ["HOLD", lot.number],
        ["DEPOSIT", null],
      ]);
    });
  });

  describe("resposta e eventos", () => {
    it("201 devolve lance, resumo do lote, carteira e serverTime", async () => {
      const res = await postBid(app, ana, lotId, 3_000_000);
      expect(res.status).toBe(201);
      expect(res.body.bid).toEqual({
        seq: 1,
        kind: "BID",
        pseudonym: expect.stringMatching(/^Licitante [0-9A-F]{4}$/),
        amountCents: 3_000_000,
        at: NOW,
      });
      expect(res.body.lot).toEqual({
        id: lotId,
        status: "LIVE",
        currentBidCents: 3_000_000,
        minimumBidCents: 3_100_000,
        bidCount: 1,
        bidderCount: 1,
        version: 1,
        entryCount: 1,
        endsAt: LIVE.endsAt,
        originalEndsAt: LIVE.endsAt,
        extended: false,
        myRank: 1,
        myBestBidCents: 3_000_000,
        myPseudonym: res.body.bid.pseudonym,
      });
      expect(res.body.wallet).toEqual({ totalCents: 5_000_000, committedCents: 3_000_000, availableCents: 2_000_000 });
      expect(res.body.serverTime).toBe(NOW);
    });

    it("publica bid:placed, showcase:lot e wallet:updated dos dois lados depois do commit", async () => {
      await postBid(app, ana, lotId, 3_000_000);
      expect(publisher.batches).toHaveLength(1);
      expect(publisher.events.map((e) => [e.type, e.room])).toEqual([
        ["bid:placed", `lot:${lotId}`],
        ["showcase:lot", "showcase"],
        ["wallet:updated", `user:${ana.id}`],
      ]);
      publisher.batches.length = 0;
      await postBid(app, bruno, lotId, 3_100_000, 3_000_000);
      expect(publisher.events.map((e) => [e.type, e.room])).toEqual([
        ["bid:placed", `lot:${lotId}`],
        ["showcase:lot", "showcase"],
        ["wallet:updated", `user:${bruno.id}`],
        ["wallet:updated", `user:${ana.id}`],
      ]);
      const placed = publisher.events[0]!.payload;
      expect(placed).toMatchObject({
        lotId,
        version: 2,
        currentBidCents: 3_100_000,
        bidCount: 2,
        bidderCount: 2,
        extended: false,
        serverTime: NOW,
      });
      expect(publisher.events[1]!.payload).toMatchObject({ id: lotId, version: 2, currentBidCents: 3_100_000 });
      expect(publisher.events[3]!.payload).toEqual({ totalCents: 5_000_000, committedCents: 0, availableCents: 5_000_000 });
      const keys = collectKeys(publisher.events.map((event) => event.payload));
      for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden)).toBe(false);
    });

    it("recusa não publica nada", async () => {
      await postBid(app, ana, lotId, 100);
      await postBid(app, joao, lotId, 2_500_000);
      await postBid(app, carla, lotId, 100_000_000);
      expect(publisher.batches).toHaveLength(0);
    });

    it("30 lances por minuto por usuário; o 31º volta RATE_LIMITED com o texto da rota", async () => {
      const previous = process.env.RATE_LIMIT_DISABLED;
      delete process.env.RATE_LIMIT_DISABLED;
      try {
        const limited = makeTestApp(prisma).app;
        let last = 0;
        let body: { error: { code: string; message: string } } | undefined;
        for (let i = 0; i < 31; i++) {
          const res = await request(limited)
            .post(`/lots/${lotId}/bids`)
            .set("Authorization", ana.auth)
            .send({ amountCents: 0, expectedCurrentCents: null });
          last = res.status;
          body = res.body;
          if (i < 30) expect(res.status).toBe(400);
        }
        expect(last).toBe(429);
        expect(body!.error).toEqual({ code: "RATE_LIMITED", message: BID_TEXT.rateLimited });
        // outro usuário não paga pelo estouro do primeiro
        const other = await request(limited)
          .post(`/lots/${lotId}/bids`)
          .set("Authorization", bruno.auth)
          .send({ amountCents: 0, expectedCurrentCents: null });
        expect(other.status).toBe(400);
      } finally {
        if (previous === undefined) delete process.env.RATE_LIMIT_DISABLED;
        else process.env.RATE_LIMIT_DISABLED = previous;
      }
    });
  });
});
