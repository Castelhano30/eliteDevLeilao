import { describe, expect, it } from "vitest";
import { INITIAL_OPENING_CHECKS, OPENING_CHECKS, type OpeningChecks } from "../lot-state";
import { CLOSING_POLL_MS, OPENING_POLL_MS, createSubmitGuard, isHammered, lotRefetchInterval, panelSituation } from "./panel-decisions";

const ENDS = "2026-10-24T16:00:00.000Z";
const at = (iso: string) => Date.parse(iso);

describe("isHammered", () => {
  it("apurando vale sempre; ao vivo só quando o relógio do servidor chega ao fim (inclusive)", () => {
    expect(isHammered({ status: "CLOSING", endsAt: ENDS }, 1)).toBe(true);
    expect(isHammered({ status: "LIVE", endsAt: ENDS }, at("2026-10-24T15:59:59.999Z"))).toBe(false);
    expect(isHammered({ status: "LIVE", endsAt: ENDS }, at(ENDS))).toBe(true);
    expect(isHammered({ status: "LIVE", endsAt: ENDS }, at("2026-10-24T16:00:01.000Z"))).toBe(true);
  });

  it("relógio ainda não acertado (0) nunca decide; outros estados não são martelo", () => {
    expect(isHammered({ status: "LIVE", endsAt: ENDS }, 0)).toBe(false);
    for (const status of ["SCHEDULED", "SOLD", "UNSOLD", "CANCELLED"] as const) {
      expect(isHammered({ status, endsAt: ENDS }, at("2030-01-01T00:00:00.000Z"))).toBe(false);
    }
  });
});

describe("panelSituation", () => {
  const lot = { status: "LIVE" as const, endsAt: ENDS, myRank: 1, myBestBidCents: 2_000_000, bidderCount: 3, minimumBidCents: 2_050_000 };

  it("antes do fim segue viewer × estado; depois do fim vira apurando para todos", () => {
    expect(panelSituation(lot, { role: "BIDDER" }, at("2026-10-24T15:00:00.000Z"))).toMatchObject({ kind: "winning" });
    expect(panelSituation(lot, null, at("2026-10-24T15:00:00.000Z"))).toMatchObject({ kind: "visitor" });
    for (const viewer of [null, { role: "BIDDER" as const }, { role: "AUCTIONEER" as const }]) {
      expect(panelSituation(lot, viewer, at(ENDS))).toEqual({ kind: "closing" });
    }
  });
});

describe("lotRefetchInterval (Sala.refetchInterval)", () => {
  const live = { status: "LIVE" as const, startsAt: "2026-10-24T10:00:00.000Z", endsAt: ENDS };
  const scheduled = { status: "SCHEDULED" as const, startsAt: "2026-10-24T14:00:00.000Z", endsAt: ENDS };

  it("ao vivo longe do fim não consulta; no 00:00 consulta de 3 em 3 s até o servidor decidir", () => {
    expect(lotRefetchInterval(live, at("2026-10-24T15:00:00.000Z"), INITIAL_OPENING_CHECKS, 1).interval).toBe(false);
    expect(lotRefetchInterval(live, at(ENDS), INITIAL_OPENING_CHECKS, 1).interval).toBe(CLOSING_POLL_MS);
    expect(lotRefetchInterval({ ...live, status: "CLOSING" }, 1, INITIAL_OPENING_CHECKS, 1).interval).toBe(CLOSING_POLL_MS);
  });

  it("agendado antes da hora não consulta; depois da hora confere de 2 em 2 s", () => {
    expect(lotRefetchInterval(scheduled, at("2026-10-24T13:59:59.000Z"), INITIAL_OPENING_CHECKS, 1).interval).toBe(false);
    expect(lotRefetchInterval(scheduled, at("2026-10-24T14:00:00.000Z"), INITIAL_OPENING_CHECKS, 1).interval).toBe(OPENING_POLL_MS);
  });

  it("a conferência de abertura só conta resposta nova e desiste na décima", () => {
    const now = at("2026-10-24T14:00:05.000Z");
    let checks: OpeningChecks = INITIAL_OPENING_CHECKS;
    let step = lotRefetchInterval(scheduled, now, checks, 1_000);
    checks = step.checks;
    // Reavaliar sem resposta nova (cada render) não gasta tentativa.
    for (let i = 0; i < 50; i++) checks = lotRefetchInterval(scheduled, now, checks, 1_000).checks;
    expect(checks.count).toBe(0);
    for (let n = 1; n <= OPENING_CHECKS; n++) {
      step = lotRefetchInterval(scheduled, now, checks, 1_000 + n);
      checks = step.checks;
    }
    expect(step.interval).toBe(false);
  });

  it("encerrado e cancelado não consultam", () => {
    for (const status of ["SOLD", "UNSOLD", "CANCELLED"] as const) {
      expect(lotRefetchInterval({ ...live, status }, at("2030-01-01T00:00:00.000Z"), INITIAL_OPENING_CHECKS, 1).interval).toBe(false);
    }
  });
});

describe("createSubmitGuard (BidForm.inFlight)", () => {
  it("o segundo envio durante o primeiro é recusado; liberado, volta a aceitar", () => {
    const guard = createSubmitGuard();
    expect(guard.tryEnter()).toBe(true);
    expect(guard.busy).toBe(true);
    expect(guard.tryEnter()).toBe(false);
    expect(guard.tryEnter()).toBe(false);
    guard.leave();
    expect(guard.busy).toBe(false);
    expect(guard.tryEnter()).toBe(true);
  });

  it("cada formulário tem a sua trava", () => {
    const a = createSubmitGuard();
    const b = createSubmitGuard();
    expect(a.tryEnter()).toBe(true);
    expect(b.tryEnter()).toBe(true);
  });
});
