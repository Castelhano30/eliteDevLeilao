import { describe, expect, it } from "vitest";
import type { LotCard, LotListResponse, MyLotsResponse } from "@lanceauto/shared";
import { DEFAULT_FILTERS } from "../vitrine-query";
import { card } from "./fixtures";
import { INITIAL_OPENING_CHECKS } from "../lot-state";
import {
  SHOWCASE_CLOSING_CHECKS,
  SHOWCASE_CLOSING_POLL_MS,
  SHOWCASE_ERROR_POLL_MS,
  cardStatusAt,
  checksForFilter,
  isFiltered,
  needsClosingPoll,
  showcaseRefetchInterval,
  sortShowcase,
  upsertMyLot,
  upsertShowcaseCard,
} from "./showcase-cache";

const list = (lots: LotCard[], counts = { live: 0, scheduled: 0, ended: 0 }): LotListResponse => ({
  lots,
  brands: ["Fiat"],
  counts,
  serverTime: "2026-10-24T15:00:00.000Z",
});

describe("upsertShowcaseCard (AC-4.29, R-4.13)", () => {
  const base = () => list([card({ id: "a", number: 1, version: 7, currentBidCents: 2_000_000, bidCount: 7 })], { live: 1, scheduled: 0, ended: 0 });

  it("cartão em version 7: evento 6 é descartado, 8 aplica, 7 (mesma versão) aplica", () => {
    const stale = upsertShowcaseCard(base(), card({ id: "a", version: 6, currentBidCents: 1_900_000 }), false);
    expect(stale.data.lots[0]).toMatchObject({ version: 7, currentBidCents: 2_000_000 });
    expect(stale.invalidate).toBe(false);

    const next = upsertShowcaseCard(base(), card({ id: "a", version: 8, currentBidCents: 2_100_000, bidCount: 8 }), false);
    expect(next.data.lots[0]).toMatchObject({ version: 8, currentBidCents: 2_100_000, bidCount: 8 });
  });

  it("fechamento não incrementa a versão: SOLD com a mesma version aplica (`>=`) e move a contagem", () => {
    const result = upsertShowcaseCard(base(), card({ id: "a", version: 7, status: "SOLD" }), false);
    expect(result.data.lots[0]!.status).toBe("SOLD");
    expect(result.data.counts).toEqual({ live: 0, scheduled: 0, ended: 1 });
  });

  it("LIVE atrasado na mesma versão não reabre SOLD nem UNSOLD", () => {
    for (const status of ["SOLD", "UNSOLD"] as const) {
      const closed = upsertShowcaseCard(base(), card({ id: "a", version: 7, status }), false).data;
      expect(upsertShowcaseCard(closed, card({ id: "a", version: 7, status: "LIVE" }), false).data).toEqual(closed);
      const mine: MyLotsResponse = { lots: [{ ...closed.lots[0]!, resultado: null }], totalReceivedCents: 0, serverTime: "x" };
      expect(upsertMyLot(mine, card({ id: "a", version: 7, status: "LIVE" })).data).toEqual(mine);
    }
  });

  it("não muta a lista recebida", () => {
    const data = base();
    const snapshot = JSON.stringify(data);
    upsertShowcaseCard(data, card({ id: "a", version: 9 }), false);
    expect(JSON.stringify(data)).toBe(snapshot);
  });

  it("cancelado sai da lista e da contagem", () => {
    const result = upsertShowcaseCard(base(), card({ id: "a", version: 8, status: "CANCELLED", cancelledAt: "2026-10-24T15:00:00.000Z" }), false);
    expect(result.data.lots).toEqual([]);
    expect(result.data.counts.live).toBe(0);
  });

  it("cancelado que a lista nunca teve é ignorado", () => {
    const data = base();
    expect(upsertShowcaseCard(data, card({ id: "z", status: "CANCELLED" }), false)).toEqual({ data, invalidate: false });
  });

  it("lote novo sem filtro entra direto, ordenado, e soma na contagem", () => {
    const scheduled = card({ id: "b", number: 2, status: "SCHEDULED", startsAt: "2026-10-30T10:00:00.000Z", endsAt: "2026-10-31T10:00:00.000Z" });
    const result = upsertShowcaseCard(base(), scheduled, false);
    expect(result.data.lots.map((l) => l.id)).toEqual(["a", "b"]);
    expect(result.data.counts).toEqual({ live: 1, scheduled: 1, ended: 0 });
    expect(result.invalidate).toBe(false);
  });

  it("lote novo com filtro ativo: o cliente não decide, pede nova consulta e não toca na lista", () => {
    const data = base();
    const result = upsertShowcaseCard(data, card({ id: "b", number: 2, brand: "Chevrolet" }), true);
    expect(result).toEqual({ data, invalidate: true });
  });

  it("com filtro, lote conhecido que mudou de grupo pede nova consulta (pode ter deixado de casar com a aba)", () => {
    const result = upsertShowcaseCard(base(), card({ id: "a", version: 7, status: "SOLD" }), true);
    expect(result.invalidate).toBe(true);
    const sameGroup = upsertShowcaseCard(base(), card({ id: "a", version: 8 }), true);
    expect(sameGroup.invalidate).toBe(false);
  });

  it("contagem nunca fica negativa", () => {
    const result = upsertShowcaseCard(list([card({ id: "a", version: 1 })], { live: 0, scheduled: 0, ended: 0 }), card({ id: "a", version: 2, status: "SOLD" }), false);
    expect(result.data.counts).toEqual({ live: 0, scheduled: 0, ended: 1 });
  });
});

describe("sortShowcase", () => {
  it("ao vivo por fim crescente, agendados por início crescente, encerrados por fim decrescente; número desempata", () => {
    const sorted = sortShowcase([
      card({ id: "e1", number: 5, status: "SOLD", endsAt: "2026-10-20T10:00:00.000Z" }),
      card({ id: "s2", number: 4, status: "SCHEDULED", startsAt: "2026-10-30T10:00:00.000Z" }),
      card({ id: "l2", number: 3, status: "LIVE", endsAt: "2026-10-26T10:00:00.000Z" }),
      card({ id: "e2", number: 6, status: "UNSOLD", endsAt: "2026-10-22T10:00:00.000Z" }),
      card({ id: "s1", number: 2, status: "SCHEDULED", startsAt: "2026-10-28T10:00:00.000Z" }),
      card({ id: "l1", number: 1, status: "CLOSING", endsAt: "2026-10-25T10:00:00.000Z" }),
      card({ id: "l3", number: 7, status: "LIVE", endsAt: "2026-10-26T10:00:00.000Z" }),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(["l1", "l2", "l3", "s1", "s2", "e2", "e1"]);
  });

  it("não muta a entrada", () => {
    const input = [card({ id: "b", number: 2, endsAt: "2026-10-26T10:00:00.000Z" }), card({ id: "a", number: 1, endsAt: "2026-10-25T10:00:00.000Z" })];
    sortShowcase(input);
    expect(input.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("cardStatusAt (AC-4.24: agendado vira ao vivo em startsAt, sem evento)", () => {
  const scheduled = card({ status: "SCHEDULED", startsAt: "2026-10-24T14:00:00.000Z", endsAt: "2026-10-24T16:00:00.000Z" });
  const at = (iso: string) => Date.parse(iso);

  it("até um ms antes continua agendado; em startsAt exato já é ao vivo", () => {
    expect(cardStatusAt(scheduled, at("2026-10-24T13:59:59.999Z"))).toBe("SCHEDULED");
    expect(cardStatusAt(scheduled, at("2026-10-24T14:00:00.000Z"))).toBe("LIVE");
  });

  it("ao vivo em endsAt vira apurando (nunca encerrado: isso só o servidor confirma)", () => {
    const live = card({ status: "LIVE", endsAt: "2026-10-24T16:00:00.000Z" });
    expect(cardStatusAt(live, at("2026-10-24T15:59:59.999Z"))).toBe("LIVE");
    expect(cardStatusAt(live, at("2026-10-24T16:00:00.000Z"))).toBe("CLOSING");
    expect(cardStatusAt(scheduled, at("2026-10-24T16:00:00.000Z"))).toBe("CLOSING");
  });

  it("encerrados e cancelados não mudam, e relógio não acertado (0) também não", () => {
    expect(cardStatusAt(card({ status: "SOLD" }), at("2030-01-01T00:00:00.000Z"))).toBe("SOLD");
    expect(cardStatusAt(card({ status: "CANCELLED" }), at("2030-01-01T00:00:00.000Z"))).toBe("CANCELLED");
    expect(cardStatusAt(scheduled, 0)).toBe("SCHEDULED");
  });
});

describe("needsClosingPoll", () => {
  const live = card({ status: "LIVE", endsAt: "2026-10-24T16:00:00.000Z" });
  it("refaz a lista de 3 em 3 s só enquanto houver cartão apurando", () => {
    expect(needsClosingPoll([live], Date.parse("2026-10-24T15:00:00.000Z"))).toBe(false);
    expect(needsClosingPoll([live], Date.parse("2026-10-24T16:00:00.000Z"))).toBe(true);
    expect(needsClosingPoll([card({ status: "CLOSING" })], 1)).toBe(true);
    expect(needsClosingPoll([card({ status: "SOLD" })], Date.parse("2030-01-01T00:00:00.000Z"))).toBe(false);
    expect(needsClosingPoll(undefined, 1)).toBe(false);
  });
});

describe("showcaseRefetchInterval (polling da Vitrine, com teto)", () => {
  const ENDS = "2026-10-24T16:00:00.000Z";
  const closing = [card({ status: "LIVE", endsAt: ENDS })];
  const now = Date.parse(ENDS);
  const step = (over: Partial<Parameters<typeof showcaseRefetchInterval>[0]> = {}) =>
    showcaseRefetchInterval({ failed: false, lots: closing, now, checks: INITIAL_OPENING_CHECKS, dataUpdatedAt: 1_000, ...over });

  it("com cartão apurando, confere de 3 em 3 s; sem cartão apurando, não consulta e zera a conta", () => {
    expect(step().interval).toBe(SHOWCASE_CLOSING_POLL_MS);
    const none = step({ lots: [card({ status: "SOLD" })], checks: { seenAt: 5, count: 7 } });
    expect(none).toEqual({ interval: false, checks: INITIAL_OPENING_CHECKS });
  });

  it("reavaliar sem resposta nova (cada render) não gasta tentativa; cada resposta nova conta uma", () => {
    let checks = step().checks;
    for (let render = 0; render < 50; render++) checks = step({ checks }).checks;
    expect(checks.count).toBe(0);
    checks = step({ checks, dataUpdatedAt: 4_000 }).checks;
    expect(checks.count).toBe(1);
  });

  it("para depois do teto de respostas novas, mesmo com o cartão ainda apurando", () => {
    let current = step();
    for (let n = 1; n <= SHOWCASE_CLOSING_CHECKS; n++) {
      current = step({ checks: current.checks, dataUpdatedAt: 1_000 + n * SHOWCASE_CLOSING_POLL_MS });
      expect(current.interval).toBe(n < SHOWCASE_CLOSING_CHECKS ? SHOWCASE_CLOSING_POLL_MS : false);
    }
  });

  it("o showcase:lot que encerra o cartão faz o polling parar e a conta recomeçar do zero no próximo apurando", () => {
    const counted = step({ checks: { seenAt: 9_000, count: 12 } });
    expect(counted.interval).toBe(SHOWCASE_CLOSING_POLL_MS);
    const closed = step({ lots: [card({ status: "SOLD" })], checks: counted.checks });
    expect(closed).toEqual({ interval: false, checks: INITIAL_OPENING_CHECKS });
  });

  it("consulta com erro tenta de novo a cada 10 s sem mexer na conta", () => {
    const checks = { seenAt: 9_000, count: 3 };
    expect(step({ failed: true, checks })).toEqual({ interval: SHOWCASE_ERROR_POLL_MS, checks });
  });

  it("um filtro novo recebe seu próprio ciclo de 20 respostas, mesmo após esgotar o anterior", () => {
    const exhausted = { key: "/lots?brand=Fiat", checks: { seenAt: 61_000, count: SHOWCASE_CLOSING_CHECKS } };
    expect(step({ checks: exhausted.checks, dataUpdatedAt: 61_000 }).interval).toBe(false);
    const next = checksForFilter(exhausted, "/lots?brand=Toyota");
    expect(step({ checks: next.checks, dataUpdatedAt: 62_000 }).interval).toBe(SHOWCASE_CLOSING_POLL_MS);
    expect(checksForFilter(next, next.key)).toBe(next);
  });
});

describe("isFiltered", () => {
  it("busca, marca ou aba diferente de Todos contam como filtro", () => {
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
    expect(isFiltered({ ...DEFAULT_FILTERS, q: "  " })).toBe(false);
    expect(isFiltered({ ...DEFAULT_FILTERS, q: "vw" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, brand: "Fiat" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, status: "LIVE" })).toBe(true);
  });
});

describe("upsertMyLot (Painel, §9.3)", () => {
  const row = (over: Partial<LotCard> = {}): MyLotsResponse["lots"][number] => ({ ...card(over), resultado: null });
  const mine = (): MyLotsResponse => ({ lots: [row({ id: "a", version: 3 }), row({ id: "b", number: 2, version: 1 })], totalReceivedCents: 0, serverTime: "x" });

  it("atualiza a linha do lote próprio; id desconhecido é ignorado", () => {
    const result = upsertMyLot(mine(), card({ id: "a", version: 4, currentBidCents: 1_600_000, bidCount: 4 }));
    expect(result.data.lots[0]).toMatchObject({ version: 4, currentBidCents: 1_600_000 });
    expect(result.refetch).toBe(false);

    const data = mine();
    expect(upsertMyLot(data, card({ id: "de-outro" }))).toEqual({ data, refetch: false });
  });

  it("o cartão do evento não apaga o resultado que a linha já tinha", () => {
    const resultado = { outcome: "SOLD" as const, finalBidCents: 3_200_000, winnerPseudonym: "Licitante 7F3A", referencePriceCents: 3_000_000, settledAt: "2026-10-24T16:00:00.000Z" };
    const data: MyLotsResponse = { ...mine(), lots: [{ ...row({ id: "a", version: 3, status: "SOLD" }), resultado }] };
    const result = upsertMyLot(data, card({ id: "a", version: 3, status: "SOLD" }));
    expect(result.data.lots[0]!.resultado).toEqual(resultado);
  });

  it("evento mais velho que a linha é descartado", () => {
    const data = mine();
    expect(upsertMyLot(data, card({ id: "a", version: 2 }))).toEqual({ data, refetch: false });
  });

  it("lote próprio que chega a SOLD, UNSOLD ou CANCELLED pede GET /my/lots; repetir o estado final não", () => {
    for (const status of ["SOLD", "UNSOLD", "CANCELLED"] as const) {
      expect(upsertMyLot(mine(), card({ id: "a", version: 3, status })).refetch).toBe(true);
    }
    const already: MyLotsResponse = { lots: [row({ id: "a", version: 3, status: "SOLD" })], totalReceivedCents: 0, serverTime: "x" };
    expect(upsertMyLot(already, card({ id: "a", version: 3, status: "SOLD" })).refetch).toBe(false);
  });
});
