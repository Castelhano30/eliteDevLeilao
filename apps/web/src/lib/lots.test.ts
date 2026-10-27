import { afterEach, describe, expect, it, vi } from "vitest";
import { assetUrl, countdownState, formatCountdown, lotCardHref, lotCountLabel, opensLabel, safeHref } from "./lots";
import { hydrationNow, serverNow, serverOffset, syncServerTime } from "./server-clock";

describe("formatCountdown", () => {
  it("mm:ss abaixo de 1 h, arredondando o segundo para cima", () => {
    expect(formatCountdown(400)).toBe("00:01");
    expect(formatCountdown(90_000)).toBe("01:30");
    expect(formatCountdown(3_599_000)).toBe("59:59");
  });
  it("hh:mm:ss de 1 h a 24 h e Nd hh:mm:ss acima", () => {
    expect(formatCountdown(3_600_000)).toBe("01:00:00");
    expect(formatCountdown(86_399_000)).toBe("23:59:59");
    expect(formatCountdown(30 * 86_400_000)).toBe("30d 00:00:00");
    expect(formatCountdown(86_400_000 + 3_661_000)).toBe("1d 01:01:01");
  });
  it("nunca negativo", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5_000)).toBe("00:00");
    expect(formatCountdown(Number.NaN)).toBe("00:00");
  });
});

describe("countdownState", () => {
  const lot = {
    status: "LIVE" as const,
    startsAt: "2026-10-23T10:00:00.000Z",
    endsAt: "2026-10-23T12:00:00.000Z",
    originalEndsAt: "2026-10-23T12:00:00.000Z",
  };
  const end = Date.parse(lot.endsAt);

  it("últimos 2 min é inclusivo em 120 s", () => {
    expect(countdownState(lot, end - 120_001).variant).toBe("normal");
    expect(countdownState(lot, end - 120_000).variant).toBe("ultimos");
    expect(countdownState(lot, end - 1).variant).toBe("ultimos");
  });
  it("no fim exato, ou fora de LIVE, é encerrado em 00:00", () => {
    expect(countdownState(lot, end)).toMatchObject({ variant: "encerrado", text: "00:00" });
    expect(countdownState({ ...lot, status: "CLOSING" }, end - 60_000).variant).toBe("encerrado");
  });
  it("agendado conta até o início", () => {
    const state = countdownState({ ...lot, status: "SCHEDULED" }, Date.parse(lot.startsAt) - 90_000);
    expect(state).toMatchObject({ variant: "normal", text: "01:30" });
  });
  it("prorrogado quando o fim passou do original", () => {
    expect(countdownState({ ...lot, endsAt: "2026-10-23T12:02:00.000Z" }, end).extended).toBe(true);
    expect(countdownState(lot, end - 1).extended).toBe(false);
  });
});

describe("useServerClock (store)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offset = serverTime − Date.now(); agora = Date.now() + offset (relógio do aparelho adiantado 10 min)", () => {
    const device = Date.parse("2026-10-23T12:10:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(device);
    syncServerTime("2026-10-23T12:00:00.000Z");
    expect(serverOffset()).toBe(-600_000);
    expect(serverNow()).toBe(Date.parse("2026-10-23T12:00:00.000Z"));
  });

  it("ignora serverTime inválido", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    syncServerTime("2026-10-23T12:00:00.000Z");
    const before = serverOffset();
    syncServerTime("lixo");
    expect(serverOffset()).toBe(before);
  });

  it("hidratação usa o serverTime da carga", () => {
    expect(hydrationNow("2026-10-23T12:00:00.000Z")).toBe(Date.parse("2026-10-23T12:00:00.000Z"));
    expect(hydrationNow(undefined)).toBe(0);
  });
});

describe("lotCardHref, assetUrl, safeHref e rótulos", () => {
  it("ao vivo, agendado, apurando e cancelado levam à Sala; o encerrado leva à auditoria (S08 AC-8.34)", () => {
    for (const status of ["LIVE", "SCHEDULED", "CLOSING", "CANCELLED"] as const) {
      expect(lotCardHref({ id: "abc", status })).toBe("/lotes/abc");
    }
    expect(lotCardHref({ id: "abc", status: "SOLD" })).toBe("/lotes/abc/auditoria");
    expect(lotCardHref({ id: "abc", status: "UNSOLD" })).toBe("/lotes/abc/auditoria");
  });
  it("prefixa o caminho relativo com a URL da API", () => {
    expect(assetUrl("/items/1/image")).toMatch(/^https?:\/\/.+\/items\/1\/image$/);
    expect(assetUrl("https://x.test/a.png")).toBe("https://x.test/a.png");
    expect(assetUrl(null)).toBeNull();
  });
  it("só http(s) vira link", () => {
    expect(safeHref("https://pt.wikipedia.org/wiki/X")).toBe("https://pt.wikipedia.org/wiki/X");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref(null)).toBeNull();
  });
  it("rótulos", () => {
    expect(lotCountLabel(1)).toBe("01 LOTE");
    expect(lotCountLabel(2)).toBe("02 LOTES");
    expect(opensLabel("2026-10-24T17:00:00.000Z")).toBe("ABRE SÁB 24/10 14:00");
  });
});
