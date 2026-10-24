import { describe, expect, it } from "vitest";
import { minimumBid, nextEndsAt, validateBalance, validateBidPreWallet, type BidInput, type BidLot } from "./bid-rules";

const at = (iso: string) => new Date(iso);
const NOW = at("2026-10-24T15:00:00.000Z");

const lot = (over: Partial<BidLot> = {}): BidLot => ({
  startsAt: at("2026-10-24T14:00:00.000Z"),
  endsAt: at("2026-10-24T20:00:00.000Z"),
  cancelledAt: null,
  startingBidCents: 2_500_000,
  minIncrementCents: 100_000,
  currentBidCents: null,
  leaderId: null,
  ...over,
});

const input = (over: Partial<BidInput> = {}, lotOver: Partial<BidLot> = {}): BidInput => ({
  lot: lot(lotOver),
  userId: "ana",
  role: "BIDDER",
  amountCents: 2_500_000,
  expectedCurrentCents: null,
  now: NOW,
  ...over,
});

describe("minimumBid", () => {
  it("sem lances é o lance inicial; com lances, atual + incremento", () => {
    expect(minimumBid(lot())).toBe(2_500_000);
    expect(minimumBid(lot({ currentBidCents: 3_000_000 }))).toBe(3_100_000);
  });
});

describe("validateBidPreWallet", () => {
  it("aceita o primeiro lance igual ao inicial e devolve o mínimo", () => {
    expect(validateBidPreWallet(input())).toEqual({ ok: true, minimumCents: 2_500_000 });
  });

  it("período: início inclusivo, fim exclusivo", () => {
    expect(validateBidPreWallet(input({ now: lot().startsAt })).ok).toBe(true);
    expect(validateBidPreWallet(input({ now: at("2026-10-24T19:59:59.999Z") })).ok).toBe(true);
    expect(validateBidPreWallet(input({ now: lot().endsAt }))).toMatchObject({ ok: false, code: "LOT_ENDED" });
    expect(validateBidPreWallet(input({ now: at("2026-10-24T13:59:59.999Z") }))).toMatchObject({
      ok: false,
      code: "LOT_NOT_STARTED",
      details: { startsAt: "2026-10-24T14:00:00.000Z" },
    });
  });

  it("cancelado vence encerrado e não iniciado (checagem 2 antes de 3 e 4)", () => {
    const cancelledAt = at("2026-10-24T14:30:00.000Z");
    expect(validateBidPreWallet(input({ now: at("2026-10-25T00:00:00.000Z") }, { cancelledAt }))).toMatchObject({
      ok: false,
      code: "LOT_CANCELLED",
      message: "Este lote foi cancelado pelo leiloeiro.",
    });
    expect(validateBidPreWallet(input({ now: at("2026-10-24T10:00:00.000Z") }, { cancelledAt }))).toMatchObject({
      code: "LOT_CANCELLED",
    });
  });

  it("abaixo do mínimo por um centavo: MINIMUM quando o esperado bate", () => {
    expect(validateBidPreWallet(input({ amountCents: 2_499_999 }))).toMatchObject({
      ok: false,
      code: "BELOW_MINIMUM",
      details: { minimumCents: 2_500_000, currentBidCents: null, reason: "MINIMUM" },
    });
    expect(
      validateBidPreWallet(
        input({ amountCents: 3_099_999, expectedCurrentCents: 3_000_000 }, { currentBidCents: 3_000_000, leaderId: "bruno" }),
      ),
    ).toMatchObject({ details: { minimumCents: 3_100_000, reason: "MINIMUM" } });
  });

  it("OUTDATED quando o cliente viu outro lance atual (null-safe nos dois lados)", () => {
    const current = { currentBidCents: 3_000_000, leaderId: "bruno" };
    expect(validateBidPreWallet(input({ amountCents: 3_050_000, expectedCurrentCents: 2_900_000 }, current))).toMatchObject({
      details: { reason: "OUTDATED", minimumCents: 3_100_000 },
    });
    expect(validateBidPreWallet(input({ amountCents: 3_050_000, expectedCurrentCents: null }, current))).toMatchObject({
      details: { reason: "OUTDATED" },
    });
    expect(validateBidPreWallet(input({ amountCents: 100, expectedCurrentCents: 2_000_000 }))).toMatchObject({
      details: { reason: "OUTDATED", currentBidCents: null },
    });
  });

  it("OWN_LEAD vence OUTDATED quando quem reenvia é o líder (C1/T10)", () => {
    const refused = validateBidPreWallet(
      input({ amountCents: 3_050_000, expectedCurrentCents: 2_900_000 }, { currentBidCents: 3_000_000, leaderId: "ana" }),
    );
    expect(refused).toMatchObject({
      code: "BELOW_MINIMUM",
      message: "Você já está na frente. Para cobrir o próprio lance, o mínimo é R$ 31.000,00.",
      details: { reason: "OWN_LEAD" },
    });
  });

  it("líder com valor suficiente: ALREADY_WINNING", () => {
    expect(validateBidPreWallet(input({ amountCents: 3_100_000 }, { currentBidCents: 3_000_000, leaderId: "ana" }))).toMatchObject({
      ok: false,
      code: "ALREADY_WINNING",
      message: "Você já está na frente. Cobrir o próprio lance só gasta saldo.",
    });
  });

  it("leiloeiro: só ROLE_NOT_ALLOWED se o lance passaria nas checagens anteriores", () => {
    expect(validateBidPreWallet(input({ role: "AUCTIONEER" }))).toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    expect(validateBidPreWallet(input({ role: "AUCTIONEER", amountCents: 100 }))).toMatchObject({ code: "BELOW_MINIMUM" });
    expect(validateBidPreWallet(input({ role: "AUCTIONEER", now: lot().endsAt }))).toMatchObject({ code: "LOT_ENDED" });
    expect(validateBidPreWallet(input({ role: "AUCTIONEER" }, { cancelledAt: at("2026-10-24T14:30:00.000Z") }))).toMatchObject({
      code: "LOT_CANCELLED",
    });
  });
});

describe("validateBalance", () => {
  it("igual ao disponível passa; um centavo a mais, não", () => {
    expect(validateBalance(2_500_000, 2_500_000)).toEqual({ ok: true });
    expect(validateBalance(2_500_000, 2_500_001)).toMatchObject({
      ok: false,
      code: "INSUFFICIENT_BALANCE",
      message: "Saldo insuficiente: você tem R$ 25.000,00 disponíveis.",
      details: { availableCents: 2_500_000 },
    });
    expect(validateBalance(0, 100)).toMatchObject({ details: { availableCents: 0 } });
  });
});

describe("nextEndsAt: os quatro limites da prorrogação", () => {
  const end = at("2026-10-24T20:00:00.000Z");
  const before = (ms: number) => at(new Date(end.getTime() - ms).toISOString());

  it("2:00.001 antes do fim: não mexe", () => {
    expect(nextEndsAt(end, before(120_001))).toEqual({ endsAt: end, extended: false });
  });

  it("2:00.000 exato: fim = now + 2 min (igual ao atual) e extended=false", () => {
    const result = nextEndsAt(end, before(120_000));
    expect(result.endsAt.getTime()).toBe(end.getTime());
    expect(result.extended).toBe(false);
  });

  it("1:59.999: prorroga em 1 ms", () => {
    const result = nextEndsAt(end, before(119_999));
    expect(result.endsAt.getTime()).toBe(end.getTime() + 1);
    expect(result.extended).toBe(true);
  });

  it("1 ms antes do fim: fim vira now + 2 min", () => {
    const now = before(1);
    const result = nextEndsAt(end, now);
    expect(result.endsAt.getTime()).toBe(now.getTime() + 120_000);
    expect(result.extended).toBe(true);
  });
});
