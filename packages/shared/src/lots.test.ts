import { describe, expect, it } from "vitest";
import {
  LOT_TEXT,
  isHttpUrl,
  lotStatus,
  minimumNextCents,
  showcaseGroup,
  validateCreateLot,
  type LotStatusInput,
} from "./lots";

describe("lotStatus (AC-2.22)", () => {
  const T = "2026-10-23T12:00:00.000Z";
  const base: LotStatusInput = {
    startsAt: T,
    endsAt: "2026-10-23T13:00:00.000Z",
    cancelledAt: null,
    settledAt: null,
    bidCount: 0,
  };

  it("agendado até 1 ms antes do início; ao vivo no instante do início", () => {
    expect(lotStatus(base, "2026-10-23T11:59:59.999Z")).toBe("SCHEDULED");
    expect(lotStatus(base, T)).toBe("LIVE");
  });

  it("ao vivo até 1 ms antes do fim; no fim exato já é CLOSING", () => {
    expect(lotStatus(base, "2026-10-23T12:59:59.999Z")).toBe("LIVE");
    expect(lotStatus(base, "2026-10-23T13:00:00.000Z")).toBe("CLOSING");
  });

  it("liquidado com lances é SOLD; sem lances, UNSOLD", () => {
    const settled = { ...base, settledAt: "2026-10-23T13:00:05.000Z" };
    expect(lotStatus({ ...settled, bidCount: 3 }, "2026-10-23T14:00:00.000Z")).toBe("SOLD");
    expect(lotStatus(settled, "2026-10-23T14:00:00.000Z")).toBe("UNSOLD");
  });

  it("cancelado vence qualquer horário", () => {
    const cancelled = { ...base, cancelledAt: T };
    for (const now of ["2026-10-22T00:00:00.000Z", T, "2026-10-24T00:00:00.000Z"]) {
      expect(lotStatus(cancelled, now)).toBe("CANCELLED");
    }
  });

  it("aceita Date ou string", () => {
    expect(lotStatus({ ...base, startsAt: new Date(T) }, new Date(T))).toBe("LIVE");
  });
});

describe("showcaseGroup e minimumNextCents", () => {
  it("ao vivo contém LIVE e CLOSING; encerrados, SOLD e UNSOLD", () => {
    expect(showcaseGroup("LIVE")).toBe("LIVE");
    expect(showcaseGroup("CLOSING")).toBe("LIVE");
    expect(showcaseGroup("SOLD")).toBe("ENDED");
    expect(showcaseGroup("UNSOLD")).toBe("ENDED");
    expect(showcaseGroup("CANCELLED")).toBeNull();
  });

  it("sem lances o mínimo é o inicial; com lance, atual + incremento", () => {
    expect(minimumNextCents({ currentBidCents: null, startingBidCents: 1_500_000, minIncrementCents: 50_000 })).toBe(1_500_000);
    expect(minimumNextCents({ currentBidCents: 1_600_000, startingBidCents: 1_500_000, minIncrementCents: 50_000 })).toBe(1_650_000);
  });
});

describe("validateCreateLot", () => {
  const now = Date.parse("2026-10-23T12:00:00.000Z");
  const valid = {
    brandId: "59",
    modelId: "5940",
    yearId: "2015-1",
    title: "Corolla 2015",
    startingBidCents: 6_000_000,
    minIncrementCents: 100_000,
    startsAt: "2026-10-25T13:00:00Z",
    endsAt: "2026-10-26T13:00:00.000Z",
  };
  const fields = (body: unknown) => {
    const result = validateCreateLot(body, now);
    return result.ok ? null : result.fields;
  };

  it("aceita o corpo válido, inclusive data sem milissegundos", () => {
    expect(validateCreateLot(valid, now).ok).toBe(true);
  });

  it("ids obrigatórios", () => {
    expect(fields({ ...valid, brandId: "" })).toEqual({ brandId: LOT_TEXT.idsRequired });
    expect(fields({ ...valid, yearId: undefined })).toEqual({ yearId: LOT_TEXT.idsRequired });
  });

  it("AC-2.14: título vazio, só espaços ou com 121 caracteres", () => {
    expect(fields({ ...valid, title: "   " })).toEqual({ title: LOT_TEXT.titleRequired });
    expect(fields({ ...valid, title: "a".repeat(121) })).toEqual({ title: LOT_TEXT.titleTooLong });
    expect(validateCreateLot({ ...valid, title: "a".repeat(120) }, now).ok).toBe(true);
  });

  it("AC-2.13: valores abaixo de R$ 1,00, fracionados ou texto", () => {
    expect(fields({ ...valid, startingBidCents: 99 })).toEqual({ startingBidCents: LOT_TEXT.startingBid });
    expect(fields({ ...valid, minIncrementCents: 99 })).toEqual({ minIncrementCents: LOT_TEXT.minIncrement });
    expect(fields({ ...valid, startingBidCents: 1.5 })).toEqual({ startingBidCents: LOT_TEXT.startingBid });
    expect(fields({ ...valid, minIncrementCents: "100" })).toEqual({ minIncrementCents: LOT_TEXT.minIncrement });
    expect(validateCreateLot({ ...valid, startingBidCents: 100, minIncrementCents: 100 }, now).ok).toBe(true);
  });

  it("AC-2.11: início 60 s no passado vale; 61 s não", () => {
    expect(validateCreateLot({ ...valid, startsAt: "2026-10-23T11:59:00.000Z" }, now).ok).toBe(true);
    expect(fields({ ...valid, startsAt: "2026-10-23T11:58:59.000Z" })).toEqual({ startsAt: LOT_TEXT.startsAtPast });
  });

  it("AC-2.12: fim exatamente 5 min depois vale; 4 min 59 s não", () => {
    expect(validateCreateLot({ ...valid, endsAt: "2026-10-25T13:05:00.000Z" }, now).ok).toBe(true);
    expect(fields({ ...valid, endsAt: "2026-10-25T13:04:59.000Z" })).toEqual({ endsAt: LOT_TEXT.endsAtTooSoon });
  });

  it("datas ausentes ou sem Z", () => {
    expect(fields({ ...valid, startsAt: undefined, endsAt: "2026-10-25T13:00" })).toEqual({
      startsAt: LOT_TEXT.startsAtRequired,
      endsAt: LOT_TEXT.endsAtRequired,
    });
  });

  it("recusa data que o Date corrigiria sozinho (31/02, 24:00, mês 13)", () => {
    for (const startsAt of ["2026-02-31T10:00:00Z", "2026-10-25T24:00:00Z", "2026-13-01T10:00:00Z", "2026-10-25T10:60:00Z"]) {
      expect(fields({ ...valid, startsAt })).toEqual({ startsAt: LOT_TEXT.startsAtRequired });
    }
    expect(validateCreateLot({ ...valid, startsAt: "2026-10-31T10:00Z", endsAt: "2026-11-30T23:59:59.999Z" }, now).ok).toBe(true);
  });

  it("junta erros de vários campos, inclusive o de data no passado", () => {
    expect(fields({ ...valid, title: "", startingBidCents: 0, startsAt: "2026-10-01T00:00:00.000Z" })).toEqual({
      title: LOT_TEXT.titleRequired,
      startingBidCents: LOT_TEXT.startingBid,
      startsAt: LOT_TEXT.startsAtPast,
    });
  });

  it("AC-2.18b/2.19: só http e https nas URLs", () => {
    expect(fields({ ...valid, imageCreditUrl: "javascript:alert(1)" })).toEqual({ imageCreditUrl: LOT_TEXT.urlInvalid });
    expect(fields({ ...valid, imageCreditUrl: "data:text/html,<b>x</b>" })).toEqual({ imageCreditUrl: LOT_TEXT.urlInvalid });
    expect(fields({ ...valid, imageUrl: "ftp://x.com/a.png" })).toEqual({ imageUrl: LOT_TEXT.urlInvalid });
    expect(fields({ ...valid, imageUrl: "texto solto" })).toEqual({ imageUrl: LOT_TEXT.urlInvalid });
    expect(validateCreateLot({ ...valid, imageUrl: "https://x.com/a.png", imageCreditUrl: "https://x.com" }, now).ok).toBe(true);
  });

  it("crédito até 200 caracteres; campos de imagem vazios contam como ausentes", () => {
    expect(fields({ ...valid, imageCredit: "a".repeat(201) })).toEqual({ imageCredit: LOT_TEXT.creditTooLong });
    const result = validateCreateLot({ ...valid, imageUrl: "", imageCredit: " " }, now);
    expect(result.ok && result.data.imageUrl).toBeUndefined();
  });

  it("isHttpUrl", () => {
    expect(isHttpUrl("https://a.b")).toBe(true);
    expect(isHttpUrl("HTTP://A.B/x")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});
