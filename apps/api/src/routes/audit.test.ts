import { readFileSync } from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AuditView } from "@lanceauto/shared";
import { entryHash, genesisHash, sealHash } from "../domain/audit-chain";
import { FakeClock } from "../infra/clock";
import { seedCancelledLot, seedClosedLots, seedLiveBids, seedShowcaseLots, type FixtureCar } from "../seed/showcase";
import { TEST_JWT_SECRET, makeTestApp, registerUser, testEnv } from "../../test/helpers/app";
import { FORBIDDEN_KEYS, collectKeys, makeUser, postBid, type TestUser } from "../../test/helpers/bids";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { insertLot } from "../../test/helpers/lots";
import { makeSettlement } from "../../test/helpers/settlement";
import { appendOnlyTriggerState, withAppendOnlyTriggerDisabled } from "../../test/helpers/tamper";

const NOW = "2026-10-23T12:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const ENDS_AT = iso(NOW_MS + HOUR);
/** Lote de referência: inicial R$ 20.000, incremento R$ 500, ao vivo, fecha em 1 h. */
const LIVE = { startsAt: iso(NOW_MS - 2 * HOUR), endsAt: ENDS_AT, startingBidCents: 2_000_000, minIncrementCents: 50_000 };
const HEX = "ab".repeat(32);
const WRONG_KEY = "x".repeat(32);

const baseDir = path.resolve(__dirname, "../../prisma");
const cars = JSON.parse(readFileSync(path.join(baseDir, "fipe-fixture.json"), "utf8")) as FixtureCar[];

describe.skipIf(!testDatabaseUrl)("GET /lots/:id/audit (integração, DATABASE_URL_TEST)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let app: ReturnType<typeof makeTestApp>["app"];
  let clock: FakeClock;
  let ana: TestUser;
  let bruno: TestUser;
  let joao: TestUser;

  beforeEach(async () => {
    await truncateAll(prisma);
    ({ app, clock } = makeTestApp(prisma));
    ana = await makeUser(app, "Ana", { depositCents: 50_000_000 });
    bruno = await makeUser(app, "Bruno", { depositCents: 30_000_000 });
    joao = await makeUser(app, "Joao", { role: "AUCTIONEER" });
  });
  // Depois de qualquer caso, inclusive os de adulteração e os que lançam, o trigger tem de estar ligado (T2).
  afterEach(async () => {
    expect(await appendOnlyTriggerState(prisma)).toBe("O");
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const audit = async (lotId: string, auth?: string) => {
    const req = request(app).get(`/lots/${lotId}/audit`);
    if (auth) req.set("Authorization", auth);
    const res = await req;
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body as AuditView;
  };

  const live = (extra: Partial<Parameters<typeof insertLot>[1]> = {}) => insertLot(prisma, { auctioneerId: joao.id, ...LIVE, ...extra });

  /** `count` lances alternados Ana/Bruno (Ana abre), um por segundo do relógio do teste. */
  async function placeBids(lotId: string, count: number) {
    let previous: number | null = null;
    for (let i = 0; i < count; i++) {
      clock.advance(1_000);
      const amount = LIVE.startingBidCents + i * LIVE.minIncrementCents;
      const res = await postBid(app, i % 2 === 0 ? ana : bruno, lotId, amount, previous);
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      previous = amount;
    }
  }
  async function liveWithBids(count: number) {
    const lot = await live();
    await placeBids(lot.id, count);
    return lot;
  }
  /** 5 lances (Ana vence com R$ 22.000) e fechamento pelo service: Receipt gerado. */
  async function soldLot() {
    const lot = await liveWithBids(5);
    clock.set(iso(NOW_MS + HOUR + 1_000));
    const rig = makeSettlement(prisma, clock);
    expect((await rig.settlement.settleLot(lot.id)).result).toBe("SOLD");
    return lot;
  }
  async function cancelledLot(bids = 3) {
    const lot = await liveWithBids(bids);
    const res = await request(app).post(`/lots/${lot.id}/cancel`).set("Authorization", joao.auth).send({ confirmEntryCount: bids });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return lot;
  }
  const rowsOf = (lotId: string) => prisma.bid.findMany({ where: { lotId }, orderBy: { seq: "asc" } });

  describe("veredito OK (AC-8.1, 8.11 a 8.14)", () => {
    it("AC-8.1: arrematado com 5 lances e comprovante → OK, comprovante conferido", async () => {
      const lot = await soldLot();
      const view = await audit(lot.id);
      expect(view.verdict).toMatchObject({
        code: "OK",
        firstBad: null,
        okCount: 5,
        foundCount: 5,
        registeredCount: 5,
        sealOk: true,
        receiptChecked: true,
        receiptOk: true,
        consistencyIssue: null,
      });
      expect(view.entries.map((entry) => entry.status)).toEqual(Array(5).fill("OK"));
      expect(view.entries.map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 5]);
      expect(view.lot).toMatchObject({ id: lot.id, status: "SOLD", bidCount: 5 });
      expect(view.finalHash).toBe(view.receipt!.finalHash);
      expect(view.receipt!.receiptCode).toMatch(/^\d{3}-[A-Z0-9_-]{4}$/);
    });

    it("AC-8.11: sem lances → OK com 0 linhas, só depois de conferir genesis, contagem e selo", async () => {
      const lot = await live();
      const view = await audit(lot.id);
      expect(view.verdict).toMatchObject({ code: "OK", foundCount: 0, registeredCount: 0, okCount: 0, sealOk: true });
      expect(view.entries).toEqual([]);
    });

    it("AC-8.12: cancelado com 3 lances + CANCEL → OK, 4 entradas, a última sem pseudônimo nem valor", async () => {
      const lot = await cancelledLot(3);
      const view = await audit(lot.id);
      expect(view.verdict).toMatchObject({ code: "OK", foundCount: 4, registeredCount: 4, okCount: 4 });
      expect(view.lot.bidCount).toBe(3);
      expect(view.lot.status).toBe("CANCELLED");
      expect(view.entries.map((entry) => entry.kind)).toEqual(["BID", "BID", "BID", "CANCEL"]);
      expect(view.entries[3]).toMatchObject({ seq: 4, kind: "CANCEL", pseudonym: null, amountCents: null, mine: false, status: "OK" });
      expect(view.receipt).toBeNull();
    });

    it("AC-8.12: alterar o horário da linha CANCEL → BROKEN_AT na seq 4", async () => {
      const lot = await cancelledLot(3);
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        await tx.$executeRaw`UPDATE "Bid" SET "at" = "at" + interval '1 second' WHERE "lotId" = ${lot.id} AND seq = 4`;
      });
      const view = await audit(lot.id);
      expect(view.verdict).toMatchObject({ code: "BROKEN_AT", firstBad: { seq: 4, expectedSeq: 4, reason: "HASH" }, okCount: 3 });
    });

    it("AC-8.12: cancelado sem lances também é OK (a S06 grava a linha CANCEL)", async () => {
      const lot = await cancelledLot(0);
      const view = await audit(lot.id);
      expect(view.verdict.code).toBe("OK");
      expect(view.entries.map((entry) => entry.kind)).toEqual(["CANCEL"]);
    });

    it("AC-8.13: ao vivo com lances → OK, sem comprovante nem comparação", async () => {
      const lot = await liveWithBids(3);
      const view = await audit(lot.id);
      expect(view.verdict).toMatchObject({ code: "OK", receiptChecked: false, receiptOk: null });
      expect(view.receipt).toBeNull();
      expect(view.lot.status).toBe("LIVE");
    });

    it("R-8.1: agendado e em apuração também se audita, sem login", async () => {
      const scheduled = await live({ startsAt: iso(NOW_MS + HOUR), endsAt: iso(NOW_MS + 2 * HOUR) });
      expect((await audit(scheduled.id)).lot.status).toBe("SCHEDULED");
      const closing = await liveWithBids(2);
      clock.set(iso(NOW_MS + HOUR + 1_000));
      const view = await audit(closing.id);
      expect(view.lot.status).toBe("CLOSING");
      expect(view.verdict.code).toBe("OK");
    });
  });

  describe("adulteração direto no banco (AC-8.2 a 8.10)", () => {
    it("AC-8.2: valor da seq 3 alterado → BROKEN_AT na 3 com HASH; 04 e 05 ELO QUEBRADO", async () => {
      const lot = await soldLot();
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        await tx.$executeRaw`UPDATE "Bid" SET "amountCents" = "amountCents" + 100 WHERE "lotId" = ${lot.id} AND seq = 3`;
      });
      const view = await audit(lot.id);
      expect(view.verdict).toMatchObject({
        code: "BROKEN_AT",
        firstBad: { seq: 3, expectedSeq: 3, reason: "HASH" },
        okCount: 2,
        foundCount: 5,
        // O hash final gravado continua igual ao do comprovante (R-8.12).
        receiptOk: true,
      });
      expect(view.entries.map((entry) => entry.status)).toEqual(["OK", "OK", "MISMATCH", "BROKEN_LINK", "BROKEN_LINK"]);
    });

    it.each([
      ["pseudônimo da seq 2", 2, `UPDATE "Bid" SET "pseudonym" = 'Licitante FFFF'`],
      ["horário da seq 4", 4, `UPDATE "Bid" SET "at" = "at" + interval '1 millisecond'`],
      ["hash da seq 3", 3, `UPDATE "Bid" SET "hash" = '${HEX}'`],
      ["elo (prevHash) da seq 5", 5, `UPDATE "Bid" SET "prevHash" = '${HEX}'`],
    ])("AC-8.3: alterar o %s → BROKEN_AT nessa linha", async (_label, seq, statement) => {
      const lot = await liveWithBids(5);
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        await tx.$executeRawUnsafe(`${statement} WHERE "lotId" = '${lot.id}' AND seq = ${seq}`);
      });
      const view = await audit(lot.id);
      expect(view.verdict.code).toBe("BROKEN_AT");
      expect(view.verdict.firstBad).toMatchObject({ seq, expectedSeq: seq });
      expect(view.verdict.okCount).toBe(seq - 1);
    });

    it("AC-8.4: seq 3 apagada → SEQ_GAP na 4 (esperada 3); 05 ELO QUEBRADO", async () => {
      const lot = await liveWithBids(5);
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        await tx.$executeRaw`DELETE FROM "Bid" WHERE "lotId" = ${lot.id} AND seq = 3`;
      });
      const view = await audit(lot.id);
      expect(view.verdict).toMatchObject({ code: "BROKEN_AT", firstBad: { seq: 4, expectedSeq: 3, reason: "SEQ_GAP" } });
      expect(view.entries.map((entry) => entry.status)).toEqual(["OK", "OK", "MISMATCH", "BROKEN_LINK"]);
    });

    it("AC-8.5: linha forjada no fim (seq 6) → BROKEN_AT na 6", async () => {
      const lot = await liveWithBids(5);
      const before = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        await tx.bid.create({
          data: {
            lotId: lot.id,
            seq: 6,
            kind: "BID",
            bidderId: ana.id,
            pseudonym: "Licitante FFFF",
            amountCents: 9_000_000n,
            at: new Date(NOW),
            prevHash: before.lastHash,
            hash: HEX,
          },
        });
      });
      const view = await audit(lot.id);
      expect(view.verdict).toMatchObject({ code: "BROKEN_AT", firstBad: { seq: 6, expectedSeq: 6 }, foundCount: 6, registeredCount: 5 });
    });

    it("AC-8.5: abrir espaço na seq 3 (deslocando as seguintes) e inserir uma linha forjada → BROKEN_AT na 3", async () => {
      const lot = await liveWithBids(5);
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        // O @@unique([lotId, seq]) não é deferível: um UPDATE seq = seq + 1 colidiria linha a linha.
        await tx.$executeRaw`UPDATE "Bid" SET seq = seq + 1000 WHERE "lotId" = ${lot.id} AND seq >= 3`;
        await tx.$executeRaw`UPDATE "Bid" SET seq = seq - 999 WHERE "lotId" = ${lot.id} AND seq >= 1003`;
        const second = await tx.bid.findFirstOrThrow({ where: { lotId: lot.id, seq: 2 } });
        await tx.bid.create({
          data: {
            lotId: lot.id,
            seq: 3,
            kind: "BID",
            bidderId: bruno.id,
            pseudonym: "Licitante FFFF",
            amountCents: 2_075_000n,
            at: new Date(NOW),
            prevHash: second.hash,
            hash: HEX,
          },
        });
      });
      const view = await audit(lot.id);
      expect(view.entries.map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(view.verdict).toMatchObject({ code: "BROKEN_AT", firstBad: { seq: 3, expectedSeq: 3 }, okCount: 2 });
    });

    it("AC-8.6: as duas últimas apagadas → SEAL_MISMATCH, 3 linhas OK, nenhuma linha inventada", async () => {
      const lot = await liveWithBids(5);
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        await tx.$executeRaw`DELETE FROM "Bid" WHERE "lotId" = ${lot.id} AND seq >= 4`;
      });
      const view = await audit(lot.id);
      expect(view.verdict).toMatchObject({ code: "SEAL_MISMATCH", firstBad: null, foundCount: 3, registeredCount: 5, okCount: 3, sealOk: false });
      expect(view.entries).toHaveLength(3);
      expect(view.entries.map((entry) => entry.status)).toEqual(["OK", "OK", "OK"]);
    });

    it("AC-8.6: o mesmo num lote arrematado também acusa (o selo vem antes do comprovante)", async () => {
      const lot = await soldLot();
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        await tx.$executeRaw`DELETE FROM "Bid" WHERE "lotId" = ${lot.id} AND seq >= 4`;
      });
      expect((await audit(lot.id)).verdict.code).toBe("SEAL_MISMATCH");
    });

    it("AC-8.7: o atacante também reduz entryCount e lastHash (sem recalcular o selo) → SEAL_MISMATCH; e com seal qualquer", async () => {
      const lot = await liveWithBids(5);
      const third = (await rowsOf(lot.id))[2]!;
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        await tx.$executeRaw`DELETE FROM "Bid" WHERE "lotId" = ${lot.id} AND seq >= 4`;
      });
      await prisma.lot.update({ where: { id: lot.id }, data: { entryCount: 3, lastHash: third.hash } });
      expect((await audit(lot.id)).verdict).toMatchObject({ code: "SEAL_MISMATCH", foundCount: 3, registeredCount: 3, sealOk: false });
      await prisma.lot.update({ where: { id: lot.id }, data: { seal: HEX } });
      expect((await audit(lot.id)).verdict.code).toBe("SEAL_MISMATCH");
    });

    it("AC-8.8: cadeia inteira recalculada com a chave ERRADA → BROKEN_AT na seq 1", async () => {
      const lot = await liveWithBids(5);
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        const row = await tx.lot.findUniqueOrThrow({ where: { id: lot.id } });
        let prev = genesisHash(WRONG_KEY, row);
        for (const bid of await tx.bid.findMany({ where: { lotId: lot.id }, orderBy: { seq: "asc" } })) {
          const hash = entryHash(WRONG_KEY, { ...bid, prevHash: prev });
          await tx.bid.update({ where: { id: bid.id }, data: { prevHash: prev, hash } });
          prev = hash;
        }
        await tx.lot.update({ where: { id: lot.id }, data: { lastHash: prev, seal: sealHash(WRONG_KEY, lot.id, 5, prev) } });
      });
      const view = await audit(lot.id);
      expect(view.verdict).toMatchObject({ code: "BROKEN_AT", firstBad: { seq: 1, expectedSeq: 1 }, okCount: 0 });
      // Prova de que a cadeia forjada é coerente consigo mesma: só a chave a denuncia.
      expect(testEnv.AUDIT_HMAC_KEY).not.toBe(WRONG_KEY);
    });

    it("AC-8.9: finalHash do comprovante trocado → RECEIPT_MISMATCH, linhas OK, receiptOk false", async () => {
      const lot = await soldLot();
      await prisma.receipt.update({ where: { lotId: lot.id }, data: { finalHash: HEX } });
      const view = await audit(lot.id);
      expect(view.verdict).toMatchObject({ code: "RECEIPT_MISMATCH", receiptOk: false, consistencyIssue: null, okCount: 5 });
      expect(view.entries.every((entry) => entry.status === "OK")).toBe(true);
    });

    it("AC-8.10: lance inicial alterado → PREV_LINK na seq 1 (com linhas) ou SEAL_MISMATCH (sem linhas)", async () => {
      const withBids = await liveWithBids(3);
      await prisma.lot.update({ where: { id: withBids.id }, data: { startingBidCents: 1_900_000n } });
      expect((await audit(withBids.id)).verdict).toMatchObject({ code: "BROKEN_AT", firstBad: { seq: 1, expectedSeq: 1, reason: "PREV_LINK" } });

      const empty = await live();
      await prisma.lot.update({ where: { id: empty.id }, data: { startingBidCents: 1_900_000n } });
      expect((await audit(empty.id)).verdict).toMatchObject({ code: "SEAL_MISMATCH", foundCount: 0 });
    });

    it("lote sem linhas com lastHash trocado → SEAL_MISMATCH", async () => {
      const empty = await live();
      await prisma.lot.update({ where: { id: empty.id }, data: { lastHash: HEX } });
      expect((await audit(empty.id)).verdict.code).toBe("SEAL_MISMATCH");
    });
  });

  describe("consistência fora da cadeia (AC-8.37 a 8.39)", () => {
    it("AC-8.37: Receipt apagado → RECEIPT_MISSING; valor trocado → RECEIPT_AMOUNT; linhas OK", async () => {
      const lot = await soldLot();
      const original = await prisma.receipt.findUniqueOrThrow({ where: { lotId: lot.id } });
      await prisma.receipt.update({ where: { lotId: lot.id }, data: { amountCents: original.amountCents + 100n } });
      const amount = await audit(lot.id);
      expect(amount.verdict).toMatchObject({ code: "RECEIPT_MISMATCH", consistencyIssue: "RECEIPT_AMOUNT", receiptChecked: true });
      expect(amount.verdict.okCount).toBe(5);

      await prisma.receipt.delete({ where: { lotId: lot.id } });
      const missing = await audit(lot.id);
      expect(missing.verdict).toMatchObject({ code: "RECEIPT_MISMATCH", consistencyIssue: "RECEIPT_MISSING", receiptChecked: true, receiptOk: null });
      expect(missing.receipt).toBeNull();
      expect(missing.entries.every((entry) => entry.status === "OK")).toBe(true);
    });

    it("AC-8.38: cancelledAt limpo no cancelado, ou preenchido no ao vivo → SEAL_MISMATCH / CANCEL_FLAG", async () => {
      const cancelled = await cancelledLot(3);
      await prisma.lot.update({ where: { id: cancelled.id }, data: { cancelledAt: null } });
      expect((await audit(cancelled.id)).verdict).toMatchObject({ code: "SEAL_MISMATCH", consistencyIssue: "CANCEL_FLAG", sealOk: true });

      const liveLot = await liveWithBids(2);
      await prisma.lot.update({ where: { id: liveLot.id }, data: { cancelledAt: new Date(NOW) } });
      expect((await audit(liveLot.id)).verdict).toMatchObject({ code: "SEAL_MISMATCH", consistencyIssue: "CANCEL_FLAG" });
    });

    it("AC-8.39: trocar o dono do lance (bidderId) NÃO é detectado: limitação documentada, fixada para ninguém tomar por bug", async () => {
      const lot = await liveWithBids(3);
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        await tx.$executeRaw`UPDATE "Bid" SET "bidderId" = ${bruno.id} WHERE "lotId" = ${lot.id} AND seq = 1`;
      });
      const view = await audit(lot.id);
      expect(view.verdict.code).toBe("OK");
      // O pseudônimo (que está no hash) não mudou.
      expect(view.entries[0]!.pseudonym).toBe((await rowsOf(lot.id))[0]!.pseudonym);
    });
  });

  describe("trigger append-only (§14 itens 9 e 13)", () => {
    it("sanidade: sem desativá-lo, UPDATE e DELETE em Bid falham", async () => {
      const lot = await liveWithBids(2);
      await expect(prisma.$executeRaw`UPDATE "Bid" SET "amountCents" = 1 WHERE "lotId" = ${lot.id}`).rejects.toThrow(/append-only/);
      await expect(prisma.$executeRaw`DELETE FROM "Bid" WHERE "lotId" = ${lot.id}`).rejects.toThrow(/append-only/);
      expect(await appendOnlyTriggerState(prisma)).toBe("O");
    });

    it("dentro do helper o UPDATE passa e, ao sair, o trigger volta a bloquear", async () => {
      const lot = await liveWithBids(2);
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        expect(await tx.$queryRaw<{ tgenabled: string }[]>`SELECT tgenabled FROM pg_trigger WHERE tgname = 'bid_no_update_delete'`).toEqual([{ tgenabled: "D" }]);
        await tx.$executeRaw`UPDATE "Bid" SET "amountCents" = "amountCents" WHERE "lotId" = ${lot.id}`;
      });
      await expect(prisma.$executeRaw`DELETE FROM "Bid" WHERE "lotId" = ${lot.id}`).rejects.toThrow(/append-only/);
    });

    it("se a adulteração lançar, o rollback desfaz o DISABLE e a adulteração: nada fica desligado nem alterado", async () => {
      const lot = await liveWithBids(2);
      await expect(
        withAppendOnlyTriggerDisabled(prisma, async (tx) => {
          await tx.$executeRaw`UPDATE "Bid" SET "amountCents" = 7 WHERE "lotId" = ${lot.id} AND seq = 1`;
          throw new Error("falha no meio da adulteração");
        }),
      ).rejects.toThrow("falha no meio da adulteração");
      expect(await appendOnlyTriggerState(prisma)).toBe("O");
      expect((await rowsOf(lot.id))[0]!.amountCents).toBe(2_000_000n);
      expect((await audit(lot.id)).verdict.code).toBe("OK");
    });
  });

  describe("concorrência (AC-8.15)", () => {
    it("20 lances alternados em sequência com 20 auditorias em paralelo: nenhuma devolve veredito diferente de OK", async () => {
      const lot = await live();
      const audits: Promise<AuditView>[] = [];
      let previous: number | null = null;
      for (let i = 0; i < 20; i++) {
        clock.advance(1_000);
        const amount = LIVE.startingBidCents + i * LIVE.minIncrementCents;
        const res = await postBid(app, i % 2 === 0 ? ana : bruno, lot.id, amount, previous);
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        previous = amount;
        // A auditoria parte sem esperar o próximo lance: as duas coisas se sobrepõem.
        audits.push(audit(lot.id));
      }
      const views = await Promise.all(audits);
      expect(views).toHaveLength(20);
      for (const view of views) {
        expect(view.verdict.code).toBe("OK");
        expect(view.verdict.foundCount).toBe(view.verdict.registeredCount);
      }
    });
  });

  describe("privacidade (AC-8.16 a 8.20, 8.36)", () => {
    /** O seed completo pelos mesmos services do deploy (001 ao vivo, agendado, arrematado, sem lances, cancelado). */
    async function seedAll() {
      const { user: auctioneer } = await registerUser(app, { role: "AUCTIONEER", email: "leiloeiro@lanceauto.test" });
      const base = { db: prisma, clock, auditKey: testEnv.AUDIT_HMAC_KEY };
      await seedShowcaseLots({ ...base, auctioneerId: auctioneer.id, cars, baseDir });
      await seedLiveBids({ ...base, bidderEmails: ["bruno@lanceauto.test", "ana@lanceauto.test"] });
      await seedClosedLots({ ...base, auctioneerId: auctioneer.id, cars, baseDir, rivalEmail: "bruno@lanceauto.test", winnerEmail: "ana@lanceauto.test" });
      await seedCancelledLot({ ...base, auctioneerId: auctioneer.id, cars, baseDir, firstBidderEmail: "bruno@lanceauto.test", leaderEmail: "ana@lanceauto.test" });
      return prisma.lot.findMany({ orderBy: { number: "asc" }, include: { receipt: true } });
    }
    const leaks = async () => {
      const users = await prisma.user.findMany();
      return users.flatMap((user) => [user.id, user.email, user.passwordHash, user.name]);
    };

    it("AC-8.14: o seed inteiro audita OK, lote a lote", async () => {
      const lots = await seedAll();
      expect(lots.length).toBeGreaterThanOrEqual(5);
      const statuses = new Set<string>();
      for (const lot of lots) {
        const view = await audit(lot.id);
        expect(view.verdict.code, `lote ${lot.number}`).toBe("OK");
        expect(view.verdict.okCount).toBe(view.verdict.foundCount);
        statuses.add(view.lot.status);
      }
      expect([...statuses].sort()).toEqual(["CANCELLED", "LIVE", "SCHEDULED", "SOLD", "UNSOLD"]);
      const sold = lots.find((lot) => lot.receipt)!;
      expect(await audit(sold.id)).toMatchObject({ verdict: { receiptChecked: true, receiptOk: true } });
    });

    it("AC-8.16: nenhum lote do seed vaza e-mail, nome, userId, bidderId, leaderId nem passwordHash", async () => {
      const lots = await seedAll();
      const secrets = await leaks();
      for (const lot of lots) {
        const res = await request(app).get(`/lots/${lot.id}/audit`);
        const text = JSON.stringify(res.body);
        for (const key of FORBIDDEN_KEYS) expect(collectKeys(res.body).has(key), `chave ${key}`).toBe(false);
        for (const secret of secrets) expect(text).not.toContain(secret);
      }
    });

    it("AC-8.17: o mesmo licitante aparece com pseudônimos diferentes em dois lotes", async () => {
      const first = await liveWithBids(2);
      const second = await liveWithBids(2);
      const a = (await audit(first.id)).entries[0]!.pseudonym;
      const b = (await audit(second.id)).entries[0]!.pseudonym;
      expect(a).toMatch(/^Licitante [0-9A-F]{4}$/);
      expect(b).toMatch(/^Licitante [0-9A-F]{4}$/);
      expect(a).not.toBe(b);
    });

    it("AC-8.18: com o token da Ana só as linhas dela são mine; sem token, token inválido ou expirado: 200, todas false", async () => {
      const lot = await liveWithBids(4);
      const withAna = await audit(lot.id, ana.auth);
      expect(withAna.entries.map((entry) => entry.mine)).toEqual([true, false, true, false]);
      expect((await audit(lot.id, bruno.auth)).entries.map((entry) => entry.mine)).toEqual([false, true, false, true]);

      const expired = jwt.sign({ role: "BIDDER" }, TEST_JWT_SECRET, { algorithm: "HS256", subject: ana.id, expiresIn: -60 });
      for (const auth of [undefined, "Bearer lixo", `Bearer ${expired}`]) {
        const view = await audit(lot.id, auth);
        expect(view.entries.map((entry) => entry.mine)).toEqual([false, false, false, false]);
      }
    });

    it("AC-8.18: o leiloeiro logado também é só visitante (nenhuma linha dele)", async () => {
      const lot = await liveWithBids(2);
      expect((await audit(lot.id, joao.auth)).entries.every((entry) => !entry.mine)).toBe(true);
    });

    it("AC-8.19: varredura de privacidade em /lots, /lots/:id, /lots/:id/audit e /receipts/:token", async () => {
      const lots = await seedAll();
      const sold = lots.find((lot) => lot.receipt)!;
      const secrets = await leaks();
      const paths = ["/lots", `/lots/${sold.id}`, `/lots/${sold.id}/audit`, `/receipts/${sold.receipt!.token}`];
      for (const route of paths) {
        const res = await request(app).get(route);
        expect(res.status, route).toBe(200);
        const text = JSON.stringify(res.body);
        for (const key of FORBIDDEN_KEYS) expect(collectKeys(res.body).has(key), `${route}: chave ${key}`).toBe(false);
        for (const secret of secrets) expect(text, route).not.toContain(secret);
      }
    });

    it("AC-8.20: lote adulterado não revela valor original, hash recalculado nem chave", async () => {
      const lot = await liveWithBids(5);
      const original = (await rowsOf(lot.id))[2]!;
      await withAppendOnlyTriggerDisabled(prisma, async (tx) => {
        await tx.$executeRaw`UPDATE "Bid" SET "amountCents" = "amountCents" + 100 WHERE "lotId" = ${lot.id} AND seq = 3`;
      });
      const tampered = (await rowsOf(lot.id))[2]!;
      const recomputed = entryHash(testEnv.AUDIT_HMAC_KEY, tampered);
      const res = await request(app).get(`/lots/${lot.id}/audit`);
      const text = JSON.stringify(res.body);
      expect(res.body.verdict.code).toBe("BROKEN_AT");
      // O gravado aparece; o original (2.100.000), o hash que a linha adulterada daria e a chave nunca.
      expect(text).toContain(`"amountCents":${Number(tampered.amountCents)}`);
      expect(text).not.toContain(`"amountCents":${Number(original.amountCents)}`);
      expect(text).not.toContain(recomputed);
      expect(text).not.toContain(testEnv.AUDIT_HMAC_KEY);
      const keys = collectKeys(res.body);
      for (const forbidden of ["expectedHash", "originalAmount", "recomputedHash", "expected", "original"]) {
        expect(keys.has(forbidden), forbidden).toBe(false);
      }
    });

    it("AC-8.36: o token do comprovante nunca sai da auditoria (visitante, outro licitante e vencedor)", async () => {
      const lots = await seedAll();
      const sold = lots.find((lot) => lot.receipt)!;
      const token = sold.receipt!.token;
      const winner = await prisma.user.findUniqueOrThrow({ where: { id: sold.receipt!.winnerId } });
      const asWinner = `Bearer ${jwt.sign({ role: "BIDDER" }, TEST_JWT_SECRET, { algorithm: "HS256", subject: winner.id, expiresIn: "1h" })}`;
      for (const auth of [undefined, bruno.auth, asWinner]) {
        const req = request(app).get(`/lots/${sold.id}/audit`);
        if (auth) req.set("Authorization", auth);
        const res = await req;
        const text = JSON.stringify(res.body);
        expect(text).not.toContain(token);
        expect(collectKeys(res.body).has("token")).toBe(false);
        expect(Object.keys(res.body.receipt).sort()).toEqual(["finalHash", "receiptCode"]);
      }
    });
  });

  describe("contrato (AC-8.21, 8.22)", () => {
    it("AC-8.21: id inexistente e id malformado → 404 NOT_FOUND no envelope, nunca VALIDATION", async () => {
      for (const id of ["00000000-0000-4000-8000-000000000000", "abc", "%20", "x".repeat(300)]) {
        const res = await request(app).get(`/lots/${id}/audit`);
        expect(res.status, id).toBe(404);
        expect(res.body.error.code).toBe("NOT_FOUND");
        expect(typeof res.body.error.message).toBe("string");
        expect(Object.keys(res.body)).toEqual(["error"]);
        expect(res.headers["cache-control"]).toBe("no-store");
      }
    });

    it("AC-8.22: Cache-Control no-store e verifiedAt/serverTime vêm do Clock; 'verificar de novo' muda a hora", async () => {
      const lot = await liveWithBids(2);
      clock.set("2026-10-23T12:30:00.000Z");
      const first = await request(app).get(`/lots/${lot.id}/audit`);
      expect(first.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("no-store");
      expect(first.body.verifiedAt).toBe("2026-10-23T12:30:00.000Z");
      expect(first.body.serverTime).toBe("2026-10-23T12:30:00.000Z");
      clock.advance(7_000);
      const again = await request(app).get(`/lots/${lot.id}/audit`);
      expect(again.body.verifiedAt).toBe("2026-10-23T12:30:07.000Z");
    });

    it("R-8.2: nada é gravado — a auditoria não muda lote, linhas nem comprovante", async () => {
      const lot = await soldLot();
      const snapshot = async () =>
        JSON.stringify(
          {
            lot: await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } }),
            bids: await rowsOf(lot.id),
            receipt: await prisma.receipt.findUnique({ where: { lotId: lot.id } }),
            ledger: await prisma.ledgerEntry.count(),
          },
          (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
        );
      const before = await snapshot();
      await audit(lot.id);
      await audit(lot.id, ana.auth);
      expect(await snapshot()).toBe(before);
    });
  });
});
