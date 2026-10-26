import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeMyStanding, type BidPlacedPayload, type LotState } from "@lanceauto/shared";
import { createApp } from "./app";
import { FakeClock } from "./infra/clock";
import { createLogger } from "./infra/logger";
import { fipeUnavailable, type CatalogPort } from "./infra/fipe";
import type { ImageSuggestionPort } from "./infra/wikipedia";
import { FORBIDDEN_KEYS, collectKeys, makeUser, postBid, type TestUser } from "../test/helpers/bids";
import { TEST_JWT_SECRET, testEnv } from "../test/helpers/app";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../test/helpers/db";
import { insertLot } from "../test/helpers/lots";
import {
  ISO_UTC_MS,
  NOW,
  joinLot,
  named,
  record,
  startRealtime,
  tick,
  type RealtimeHarness,
  type Received,
} from "../test/helpers/realtime";

const NOW_MS = Date.parse(NOW);
const iso = (ms: number) => new Date(ms).toISOString();
const HOUR = 3_600_000;
const LIVE = { startsAt: iso(NOW_MS - 2 * HOUR), endsAt: iso(NOW_MS + 24 * HOUR), startingBidCents: 2_500_000, minIncrementCents: 100_000 };
const ALL_EVENTS = ["bid:placed", "showcase:lot", "wallet:updated", "lot:closed", "lot:cancelled"];
const tokenOf = (user: TestUser) => user.auth.slice("Bearer ".length);

/** Catálogo de um carro só, para os testes que criam lote pela API sem tocar na FIPE. */
const UNO_CATALOG: CatalogPort = {
  brands: async () => [],
  models: async () => [],
  years: async () => [],
  detail: async () => ({
    car: { brand: "Fiat", model: "Uno", year: 2010, fuel: "Flex", referencePriceCents: 2_000_000, referenceMonth: "outubro de 2026", codeFipe: "001" },
    raw: {},
    fetchedAt: new Date(NOW),
  }),
};

/** Catálogo que falha ao ser chamado: prova que conexão, join e eventos não tocam a FIPE (INV-14). */
function forbiddenCatalog(calls: string[]): CatalogPort {
  const hit = (name: string) => {
    calls.push(name);
    throw fipeUnavailable();
  };
  return {
    brands: async () => hit("brands"),
    models: async () => hit("models"),
    years: async () => hit("years"),
    detail: async () => hit("detail"),
  };
}

/** O mesmo para a Wikipedia: o adaptador real, apontado para uma porta morta, falharia calado e sem registro. */
function forbiddenImages(calls: string[]): ImageSuggestionPort {
  return {
    suggest: async () => {
      calls.push("wikipedia");
      return { status: "NOT_FOUND" };
    },
  };
}

describe.skipIf(!testDatabaseUrl)("tempo real (integração, socket.io-client + DATABASE_URL_TEST)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let rt: RealtimeHarness;
  let externalCalls: string[];

  let ana: TestUser;
  let bruno: TestUser;
  let carla: TestUser;
  let joao: TestUser;
  let lotId: string;

  const live = (extra: Partial<Parameters<typeof insertLot>[1]> = {}) =>
    insertLot(prisma, { auctioneerId: joao.id, ...LIVE, ...extra });
  const getLot = async (id: string, user?: TestUser) => {
    const req = request(rt.app).get(`/lots/${id}`);
    const res = await (user ? req.set("Authorization", user.auth) : req);
    return res.body as LotState;
  };
  /** O que o `GET` e o ack devem ter em comum: tudo, menos o carimbo de hora da própria resposta. */
  const withoutTime = (state: LotState) => ({ ...state, serverTime: undefined });
  const bidCount = (id = lotId) => prisma.bid.count({ where: { lotId: id } });

  beforeEach(async () => {
    await truncateAll(prisma);
    externalCalls = [];
    rt = await startRealtime(prisma, { timeoutMs: 300, catalog: forbiddenCatalog(externalCalls), images: forbiddenImages(externalCalls) });
    ana = await makeUser(rt.app, "Ana", { depositCents: 5_000_000 });
    bruno = await makeUser(rt.app, "Bruno", { depositCents: 4_000_000 });
    carla = await makeUser(rt.app, "Carla", { depositCents: 6_000_000 });
    joao = await makeUser(rt.app, "Joao", { role: "AUCTIONEER" });
    lotId = (await live()).id;
  });

  afterEach(async () => {
    await rt.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("bid:placed", () => {
    it("AC-4.2: dois clientes na sala recebem exatamente um, com version == entryCount e serverTime; o Bid já existe", async () => {
      const a = await rt.open(tokenOf(ana));
      const visitor = await rt.open();
      const seenA = record(a, ALL_EVENTS);
      const seenV = record(visitor, ALL_EVENTS);
      await joinLot(a, lotId);
      await joinLot(visitor, lotId);
      // No instante em que o evento chega, o lance já está commitado: outra conexão ao banco enxerga a linha.
      const inDb: Promise<number>[] = [];
      visitor.on("bid:placed", () => inDb.push(bidCount()));

      expect((await postBid(rt.app, bruno, lotId, 2_500_000)).status).toBe(201);
      await tick();

      for (const seen of [seenA, seenV]) {
        const placed = named(seen, "bid:placed");
        expect(placed).toHaveLength(1);
        const payload = placed[0]!.payload as unknown as BidPlacedPayload;
        const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
        expect(payload).toMatchObject({ lotId, version: lot.entryCount, currentBidCents: 2_500_000, bidCount: 1, bidderCount: 1 });
        expect(payload.serverTime).toMatch(ISO_UTC_MS);
        expect(payload.minimumBidCents).toBe(2_600_000);
      }
      expect(await Promise.all(inDb)).toEqual([1]);
    });

    it("AC-4.3: lance recusado não publica nada, para ninguém", async () => {
      const a = await rt.open(tokenOf(ana));
      const visitor = await rt.open();
      const showcase = await rt.open();
      showcase.emit("showcase:join");
      const seen = [...[a, visitor, showcase].map((socket) => record(socket, ALL_EVENTS))];
      await joinLot(a, lotId);
      await joinLot(visitor, lotId);

      const refused = await postBid(rt.app, ana, lotId, 100);
      expect(refused.status).toBe(422);
      await tick();
      expect(seen.flat()).toEqual([]);
      expect(await bidCount()).toBe(0);
    });

    it("AC-4.5: `extended` e `endsAt` conforme o relógio (≤ 2 min estende; antes disso, não)", async () => {
      const visitor = await rt.open();
      const seen = record(visitor, ["bid:placed"]);
      await joinLot(visitor, lotId);

      rt.clock.set(iso(Date.parse(LIVE.endsAt) - 150_000));
      await postBid(rt.app, ana, lotId, 2_500_000);
      rt.clock.set(iso(Date.parse(LIVE.endsAt) - 90_000));
      await postBid(rt.app, bruno, lotId, 2_600_000, 2_500_000);
      await tick();

      const [early, late] = named(seen, "bid:placed").map((event) => event.payload as unknown as BidPlacedPayload);
      expect(early).toMatchObject({ extended: false, endsAt: LIVE.endsAt });
      expect(late).toMatchObject({ extended: true, endsAt: iso(Date.parse(LIVE.endsAt) - 90_000 + 120_000) });
    });

    it("AC-4.32: bidderCount do evento é o do GET, e nenhum payload carrega usuário", async () => {
      const visitor = await rt.open();
      const seen = record(visitor, ALL_EVENTS);
      await joinLot(visitor, lotId);
      await postBid(rt.app, ana, lotId, 2_500_000);
      await postBid(rt.app, bruno, lotId, 2_600_000, 2_500_000);
      await postBid(rt.app, ana, lotId, 2_700_000, 2_600_000);
      await tick();

      const last = named(seen, "bid:placed").at(-1)!.payload as unknown as BidPlacedPayload;
      const state = await getLot(lotId);
      expect(last.bidderCount).toBe(state.lot.bidderCount);
      expect(last.bidderCount).toBe(2);
      expect(last.version).toBe(state.lot.version);
      const keys = collectKeys(seen.map((event) => event.payload));
      for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden)).toBe(false);
    });

    it("serverTime em ISO UTC (ms, Z) em todo payload, carimbado pelo Publisher", async () => {
      const a = await rt.open(tokenOf(ana));
      const showcase = await rt.open();
      showcase.emit("showcase:join");
      const heard = [record(a, ALL_EVENTS), record(showcase, ALL_EVENTS)];
      await joinLot(a, lotId);
      await postBid(rt.app, ana, lotId, 2_500_000);
      await request(rt.app).post("/wallet/deposits").set("Authorization", ana.auth).send({ amountCents: 100_000 });
      await tick();

      const bag: Received[] = heard.flat();
      expect(bag.map((event) => event.name).sort()).toEqual(["bid:placed", "showcase:lot", "wallet:updated", "wallet:updated"]);
      for (const event of bag) {
        expect(event.payload.serverTime).toMatch(ISO_UTC_MS);
        expect(event.payload.serverTime).toBe(rt.clock.now().toISOString());
      }
    });
  });

  describe("wallet:updated (R-4.12)", () => {
    it("AC-4.6: novo líder e líder anterior recebem o próprio saldo; terceiro e visitante, nada", async () => {
      const a = await rt.open(tokenOf(ana));
      const b = await rt.open(tokenOf(bruno));
      const c = await rt.open(tokenOf(carla));
      const visitor = await rt.open();
      await postBid(rt.app, ana, lotId, 2_500_000);
      const seen = [a, b, c, visitor].map((socket) => record(socket, ["wallet:updated"]));
      for (const socket of [a, b, c, visitor]) await joinLot(socket, lotId);

      await postBid(rt.app, bruno, lotId, 2_600_000, 2_500_000);
      await tick();

      expect(seen[0]!.map((event) => event.payload)).toEqual([
        expect.objectContaining({ totalCents: 5_000_000, committedCents: 0, availableCents: 5_000_000 }),
      ]);
      expect(seen[1]!.map((event) => event.payload)).toEqual([
        expect.objectContaining({ totalCents: 4_000_000, committedCents: 2_600_000, availableCents: 1_400_000 }),
      ]);
      expect(seen[2]).toEqual([]);
      expect(seen[3]).toEqual([]);
    });

    it("AC-4.11: o depósito emite só para a sala do dono, inclusive em duas abas", async () => {
      const tab1 = await rt.open(tokenOf(ana));
      const tab2 = await rt.open(tokenOf(ana));
      const b = await rt.open(tokenOf(bruno));
      const seen = [tab1, tab2, b].map((socket) => record(socket, ["wallet:updated"]));

      const res = await request(rt.app).post("/wallet/deposits").set("Authorization", ana.auth).send({ amountCents: 1_000_000 });
      expect(res.status).toBe(201);
      await tick();

      for (const own of [seen[0]!, seen[1]!]) {
        expect(own).toHaveLength(1);
        expect(own[0]!.payload).toMatchObject({ totalCents: 6_000_000, committedCents: 0, availableCents: 6_000_000 });
      }
      expect(seen[2]).toEqual([]);
    });
  });

  describe("lot:cancelled (S06)", () => {
    const cancelOnce = (lot: string, confirmEntryCount: number) =>
      request(rt.app).post(`/lots/${lot}/cancel`).set("Authorization", joao.auth).send({ confirmEntryCount });

    it("S06 §7: sala do lote, Vitrine e carteira do líder recebem cada um o seu evento, com serverTime e sem dados pessoais", async () => {
      await postBid(rt.app, ana, lotId, 2_500_000);
      await postBid(rt.app, bruno, lotId, 2_600_000, 2_500_000);
      const inLot = await rt.open();
      const inShowcase = await rt.open();
      const leaderTab = await rt.open(tokenOf(bruno));
      const loserTab = await rt.open(tokenOf(ana));
      await joinLot(inLot, lotId);
      inShowcase.emit("showcase:join");
      await tick();
      const seenLot = record(inLot, ALL_EVENTS);
      const seenShowcase = record(inShowcase, ALL_EVENTS);
      const seenLeader = record(leaderTab, ALL_EVENTS);
      const seenLoser = record(loserTab, ALL_EVENTS);

      expect((await cancelOnce(lotId, 2)).status).toBe(200);
      await tick();

      const cancelled = named(seenLot, "lot:cancelled");
      expect(cancelled).toHaveLength(1);
      expect(cancelled[0]!.payload).toEqual({ lotId, version: 3, serverTime: expect.stringMatching(ISO_UTC_MS) });
      expect(seenLot.map((event) => event.name)).toEqual(["lot:cancelled"]);

      const card = named(seenShowcase, "showcase:lot");
      expect(card).toHaveLength(1);
      expect(card[0]!.payload).toMatchObject({ id: lotId, status: "CANCELLED", version: 3, serverTime: expect.stringMatching(ISO_UTC_MS) });
      expect(seenShowcase.map((event) => event.name)).toEqual(["showcase:lot"]);

      expect(seenLeader.map((event) => event.payload)).toEqual([
        expect.objectContaining({ totalCents: 4_000_000, committedCents: 0, availableCents: 4_000_000 }),
      ]);
      expect(seenLoser).toEqual([]);

      for (const seen of [seenLot, seenShowcase]) {
        const keys = collectKeys(seen.map((event) => event.payload));
        for (const key of FORBIDDEN_KEYS) expect(keys.has(key), key).toBe(false);
      }
    });

    it("cancelamento recusado (contagem velha) não publica nada, para ninguém", async () => {
      await postBid(rt.app, ana, lotId, 2_500_000);
      const inLot = await rt.open();
      const leaderTab = await rt.open(tokenOf(ana));
      await joinLot(inLot, lotId);
      await tick();
      const seenLot = record(inLot, ALL_EVENTS);
      const seenLeader = record(leaderTab, ALL_EVENTS);

      expect((await cancelOnce(lotId, 0)).status).toBe(409);
      await tick();

      expect(seenLot).toEqual([]);
      expect(seenLeader).toEqual([]);
    });
  });

  describe("conexão e visitante", () => {
    it("AC-4.7: token inválido ou expirado conecta como visitante, recebe o público e nunca user:*", async () => {
      const expired = jwt.sign({ role: "BIDDER" }, TEST_JWT_SECRET, { algorithm: "HS256", subject: ana.id, expiresIn: -10 });
      // Licitantes diferentes a cada volta: o líder do lance anterior não pode cobrir o próprio lance.
      for (const [token, bidder, minimum] of [["lixo", bruno, null], [expired, carla, 2_500_000]] as const) {
        const client = await rt.open(token);
        expect(client.connected).toBe(true);
        const seen = record(client, ALL_EVENTS);
        await joinLot(client, lotId);
        client.emit("showcase:join");
        await tick(30);

        await request(rt.app).post("/wallet/deposits").set("Authorization", ana.auth).send({ amountCents: 100_000 });
        expect((await postBid(rt.app, bidder, lotId, (minimum ?? 2_400_000) + 100_000, minimum)).status).toBe(201);
        await tick();

        expect(named(seen, "bid:placed")).toHaveLength(1);
        expect(named(seen, "showcase:lot")).toHaveLength(1);
        expect(named(seen, "wallet:updated")).toEqual([]);
        const rooms = [...(rt.io.sockets.sockets.get(client.id!)?.rooms ?? [])];
        expect(rooms.some((room) => room.startsWith("user:"))).toBe(false);
      }
    });

    it("AC-4.28: conexão, join, eventos e snapshots não chamam a FIPE nem a Wikipedia", async () => {
      const a = await rt.open(tokenOf(ana));
      await joinLot(a, lotId);
      a.emit("showcase:join");
      await postBid(rt.app, ana, lotId, 2_500_000);
      await request(rt.app).post("/wallet/deposits").set("Authorization", ana.auth).send({ amountCents: 100_000 });
      await getLot(lotId, ana);
      await tick();
      expect(externalCalls).toEqual([]);
    });
  });

  describe("lot:join", () => {
    it("AC-4.8: o ack é o GET do mesmo viewer (posição pessoal incluída); inexistente → NOT_FOUND e sem sala", async () => {
      await postBid(rt.app, ana, lotId, 2_500_000);
      await postBid(rt.app, bruno, lotId, 2_600_000, 2_500_000);
      const a = await rt.open(tokenOf(ana));
      const visitor = await rt.open();

      const ack = await joinLot(a, lotId);
      expect(ack.ok).toBe(true);
      if (!ack.ok) return;
      const fromGet = await getLot(lotId, ana);
      expect(withoutTime(ack.lot)).toEqual(withoutTime(fromGet));
      expect(ack.lot.lot).toMatchObject({ myRank: 2, myBestBidCents: 2_500_000 });
      expect(ack.lot.lot.myPseudonym).toMatch(/^Licitante [0-9A-F]{4}$/);

      const visitorAck = await joinLot(visitor, lotId);
      expect(visitorAck.ok && withoutTime(visitorAck.lot)).toEqual(withoutTime(await getLot(lotId)));
      expect(visitorAck.ok && visitorAck.lot.lot.myPseudonym).toBeNull();

      const roomsBefore = [...(rt.io.sockets.sockets.get(a.id!)?.rooms ?? [])].sort();
      for (const bad of ["nao-existe", "123", "../x"]) {
        expect(await joinLot(a, bad)).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
      }
      expect([...(rt.io.sockets.sockets.get(a.id!)?.rooms ?? [])].sort()).toEqual(roomsBefore);
    });

    it("AC-4.9: lote agendado e lote cancelado aceitam join e devolvem o estado de cada um", async () => {
      const scheduled = await live({ startsAt: iso(NOW_MS + HOUR), endsAt: iso(NOW_MS + 3 * HOUR) });
      const cancelled = await live({ cancelledAt: iso(NOW_MS - HOUR) });
      const visitor = await rt.open();
      const one = await joinLot(visitor, scheduled.id);
      const two = await joinLot(visitor, cancelled.id);
      expect(one.ok && one.lot.lot.status).toBe("SCHEDULED");
      expect(two.ok && two.lot.lot.status).toBe("CANCELLED");
    });

    it("lot:leave tira o socket da sala: o evento seguinte não chega", async () => {
      const visitor = await rt.open();
      const seen = record(visitor, ["bid:placed"]);
      await joinLot(visitor, lotId);
      visitor.emit("lot:leave", { lotId });
      await tick(40);
      await postBid(rt.app, ana, lotId, 2_500_000);
      await tick();
      expect(seen).toEqual([]);
    });

    it("quem está em lot:A não recebe o bid:placed de lot:B", async () => {
      const other = (await live()).id;
      const visitor = await rt.open();
      const seen = record(visitor, ["bid:placed"]);
      await joinLot(visitor, lotId);
      await postBid(rt.app, ana, other, 2_500_000);
      await tick();
      expect(seen).toEqual([]);

      await postBid(rt.app, bruno, lotId, 2_500_000);
      await tick();
      expect(named(seen, "bid:placed").map((event) => event.payload.lotId)).toEqual([lotId]);
    });
  });

  describe("Vitrine", () => {
    it("AC-4.12: POST /lots publica o LotCard do lote novo na sala showcase", async () => {
      await rt.close();
      rt = await startRealtime(prisma, {
        timeoutMs: 300,
        catalog: UNO_CATALOG,
        images: { suggest: async () => ({ status: "NOT_FOUND" }) },
        imageStore: { download: async () => null },
      });
      // Os usuários do beforeEach continuam no banco; o token é válido no servidor novo (mesmo segredo).
      const visitor = await rt.open();
      visitor.emit("showcase:join");
      const seen = record(visitor, ALL_EVENTS);
      await tick(30);

      const res = await request(rt.app)
        .post("/lots")
        .set("Authorization", joao.auth)
        .send({
          brandId: "1",
          modelId: "2",
          yearId: "2010-1",
          title: "Uno do pátio",
          startingBidCents: 2_000_000,
          minIncrementCents: 100_000,
          startsAt: iso(NOW_MS + HOUR),
          endsAt: iso(NOW_MS + 2 * HOUR),
        });
      expect(res.status).toBe(201);
      await tick();

      const cards = named(seen, "showcase:lot");
      expect(cards).toHaveLength(1);
      expect(cards[0]!.payload).toMatchObject({
        id: res.body.lot.id,
        number: res.body.lot.number,
        status: "SCHEDULED",
        version: 0,
        bidCount: 0,
        title: "Uno do pátio",
      });
      expect(cards[0]!.payload.serverTime).toMatch(ISO_UTC_MS);
      const keys = collectKeys(cards.map((event) => event.payload));
      for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden)).toBe(false);
    });

    it("AC-4.12: lote que nasce ao vivo chega com status LIVE", async () => {
      await rt.close();
      rt = await startRealtime(prisma, {
        timeoutMs: 300,
        catalog: UNO_CATALOG,
        images: { suggest: async () => ({ status: "NOT_FOUND" }) },
        imageStore: { download: async () => null },
      });
      const visitor = await rt.open();
      visitor.emit("showcase:join");
      const seen = record(visitor, ["showcase:lot"]);
      await tick(30);
      const res = await request(rt.app)
        .post("/lots")
        .set("Authorization", joao.auth)
        .send({
          brandId: "1",
          modelId: "2",
          yearId: "2010-1",
          title: "Uno ao vivo",
          startingBidCents: 2_000_000,
          minIncrementCents: 100_000,
          startsAt: NOW,
          endsAt: iso(NOW_MS + 2 * HOUR),
        });
      expect(res.status).toBe(201);
      await tick();
      expect(seen.map((event) => event.payload.status)).toEqual(["LIVE"]);
    });

    it("showcase:lot sai a cada lance, com a versão nova, e só para quem entrou na sala", async () => {
      const inRoom = await rt.open();
      inRoom.emit("showcase:join");
      const outside = await rt.open();
      const seenIn = record(inRoom, ["showcase:lot"]);
      const seenOut = record(outside, ["showcase:lot"]);
      await tick(30);
      await postBid(rt.app, ana, lotId, 2_500_000);
      await postBid(rt.app, bruno, lotId, 2_600_000, 2_500_000);
      await tick();
      expect(seenIn.map((event) => [event.payload.version, event.payload.currentBidCents])).toEqual([
        [1, 2_500_000],
        [2, 2_600_000],
      ]);
      expect(seenOut).toEqual([]);
    });
  });

  describe("reconexão (AC-4.18, AC-4.19)", () => {
    it("quem saiu, perdeu uma prorrogação e voltou tem, depois de lot:join + GET, o estado do servidor sem duplicata", async () => {
      await postBid(rt.app, ana, lotId, 2_500_000);
      const a = await rt.open(tokenOf(ana));
      const seen = record(a, ["bid:placed"]);
      const first = await joinLot(a, lotId);
      expect(first.ok && first.lot.lot.version).toBe(1);

      a.disconnect();
      await tick(60);
      // Dois lances enquanto A está fora; o segundo prorroga (≤ 2 min do fim).
      await postBid(rt.app, bruno, lotId, 2_600_000, 2_500_000);
      rt.clock.set(iso(Date.parse(LIVE.endsAt) - 60_000));
      await postBid(rt.app, carla, lotId, 2_700_000, 2_600_000);
      expect(seen).toEqual([]);

      const back = await rt.open(tokenOf(ana));
      const ack = await joinLot(back, lotId);
      const fromGet = await getLot(lotId, ana);
      expect(ack.ok).toBe(true);
      if (!ack.ok) return;
      expect(withoutTime(ack.lot)).toEqual(withoutTime(fromGet));
      expect(fromGet.lot.version).toBe(3);
      expect(fromGet.bids.map((bid) => bid.seq)).toEqual([3, 2, 1]);
      expect(new Set(fromGet.bids.map((bid) => bid.seq)).size).toBe(fromGet.bids.length);
      // AC-4.19: a prorrogação perdida está no estado, sem ter chegado como evento.
      expect(fromGet.lot.endsAt).toBe(iso(Date.parse(LIVE.endsAt) - 60_000 + 120_000));
      expect(Date.parse(fromGet.lot.endsAt)).toBeGreaterThan(Date.parse(fromGet.lot.originalEndsAt));
    });

    it("depois de voltar, o cliente recebe os eventos novos normalmente", async () => {
      const a = await rt.open(tokenOf(ana));
      await joinLot(a, lotId);
      a.disconnect();
      await tick(60);
      const back = await rt.open(tokenOf(ana));
      const seen = record(back, ["bid:placed", "wallet:updated"]);
      await joinLot(back, lotId);
      await postBid(rt.app, bruno, lotId, 2_500_000);
      await tick();
      expect(named(seen, "bid:placed")).toHaveLength(1);
    });
  });

  describe("paridade do cliente com o servidor", () => {
    it("computeMyStanding (pseudônimo + histórico) bate com myRank e myBestBidCents do GET para cada licitante", async () => {
      await postBid(rt.app, ana, lotId, 2_500_000);
      await postBid(rt.app, bruno, lotId, 2_600_000, 2_500_000);
      await postBid(rt.app, carla, lotId, 2_700_000, 2_600_000);
      await postBid(rt.app, ana, lotId, 2_800_000, 2_700_000);
      for (const user of [ana, bruno, carla]) {
        const state = await getLot(lotId, user);
        const local = computeMyStanding(state.bids, state.lot.myPseudonym);
        expect(local).toEqual({ myRank: state.lot.myRank, myBestBidCents: state.lot.myBestBidCents });
      }
      expect((await getLot(lotId, ana)).lot).toMatchObject({ myRank: 1, bidderCount: 3 });
      expect((await getLot(lotId, carla)).lot).toMatchObject({ myRank: 2 });
      expect((await getLot(lotId, bruno)).lot).toMatchObject({ myRank: 3 });
    });
  });

  describe("Publisher que falha (R-4.2, AC-4.10)", () => {
    it("responde 201, o lance está no banco e o erro foi logado", async () => {
      const lines: string[] = [];
      const logger = createLogger("error", { write: (chunk: string) => void lines.push(chunk) });
      const app = createApp({
        env: testEnv,
        db: prisma,
        logger,
        clock: new FakeClock(NOW),
        publisher: {
          publish() {
            throw new Error("socket caiu");
          },
        },
      });
      const res = await postBid(app, ana, lotId, 2_500_000);
      expect(res.status).toBe(201);
      expect(await bidCount()).toBe(1);
      expect(lines.join("")).toContain("falha ao publicar eventos depois do commit");
      expect(lines.join("")).toContain("socket caiu");
    });

    it("o depósito e o POST /lots seguem o mesmo guarda: 201 mesmo com publisher quebrado", async () => {
      const app = createApp({
        env: testEnv,
        db: prisma,
        logger: createLogger("silent"),
        clock: new FakeClock(NOW),
        publisher: {
          publish() {
            throw new Error("socket caiu");
          },
        },
        external: {
          timeoutMs: 300,
          catalog: UNO_CATALOG,
          images: { suggest: async () => ({ status: "NOT_FOUND" }) },
          imageStore: { download: async () => null },
        },
      });
      const deposit = await request(app).post("/wallet/deposits").set("Authorization", ana.auth).send({ amountCents: 100_000 });
      expect(deposit.status).toBe(201);
      expect(deposit.body).not.toHaveProperty("events");

      const created = await request(app)
        .post("/lots")
        .set("Authorization", joao.auth)
        .send({
          brandId: "1",
          modelId: "2",
          yearId: "2010-1",
          title: "Uno do guarda",
          startingBidCents: 2_000_000,
          minIncrementCents: 100_000,
          startsAt: iso(NOW_MS + HOUR),
          endsAt: iso(NOW_MS + 2 * HOUR),
        });
      expect(created.status).toBe(201);
      expect(created.body).not.toHaveProperty("events");
      expect(await prisma.lot.count({ where: { id: created.body.lot.id } })).toBe(1);
    });
  });
});
