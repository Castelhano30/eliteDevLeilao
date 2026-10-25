import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OFFSET_TTL_MS, chooseOffset, resetServerClock, serverNow, serverOffset, syncServerTime } from "./server-clock";

describe("chooseOffset (R-4.10)", () => {
  const server = Date.parse("2026-10-24T15:00:00.000Z");

  it("assume o carimbo do servidor no meio da viagem", () => {
    // Saiu em 1000, voltou em 1100 (rtt 100): o servidor carimbou ~1050, então o offset é server − 1050.
    expect(chooseOffset(null, server, { sentAt: 1_000, receivedAt: 1_100 })).toEqual({ offset: server - 1_050, rtt: 100, at: 1_100 });
  });

  it("fica com a medição de menor latência: resposta lenta não desloca o relógio", () => {
    const fast = chooseOffset(null, server, { sentAt: 1_000, receivedAt: 1_040 });
    const slow = chooseOffset(fast, server + 2_000, { sentAt: 3_000, receivedAt: 3_900 });
    expect(slow).toBe(fast);
  });

  it("uma medição tão boa quanto ou melhor assume o posto", () => {
    const first = chooseOffset(null, server, { sentAt: 1_000, receivedAt: 1_100 });
    const better = chooseOffset(first, server + 5_000, { sentAt: 6_000, receivedAt: 6_050 });
    expect(better).toMatchObject({ rtt: 50, at: 6_050 });
    expect(chooseOffset(better, server + 9_000, { sentAt: 10_000, receivedAt: 10_050 })).toMatchObject({ at: 10_050 });
  });

  it("a melhor medição perde o posto depois de OFFSET_TTL_MS, mesmo que a nova seja mais lenta", () => {
    const old = chooseOffset(null, server, { sentAt: 1_000, receivedAt: 1_010 });
    const later = 1_010 + OFFSET_TTL_MS + 1;
    const next = chooseOffset(old, server + OFFSET_TTL_MS, { sentAt: later - 800, receivedAt: later });
    expect(next).toMatchObject({ rtt: 800, at: later });
  });

  it("relógio do aparelho atrasado de uma hora: a medição velha não fica valendo por mais uma hora", () => {
    const old = chooseOffset(null, server, { sentAt: 10_000_000, receivedAt: 10_000_010 });
    // 5 s depois no servidor, mas o aparelho voltou 1 h no meio: o `at` novo fica antes do velho.
    const back = 10_000_010 - 3_600_000 + 5_000;
    const next = chooseOffset(old, server + 5_000, { sentAt: back - 800, receivedAt: back });
    expect(next).toMatchObject({ rtt: 800, at: back });
    expect(next.offset).toBe(server + 5_000 - (back - 400));
  });

  it("relógio do aparelho que andou para trás não gera latência negativa", () => {
    expect(chooseOffset(null, server, { sentAt: 2_000, receivedAt: 1_000 }).rtt).toBe(0);
  });
});

describe("syncServerTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T12:00:00.000Z"));
    resetServerClock();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetServerClock();
  });

  it("com a amostra, o offset é o da menor latência e serverNow() acompanha o servidor", () => {
    // O aparelho está 10 min atrasado: o servidor diz 12:10 quando o relógio local marca 12:00.
    syncServerTime("2026-10-24T12:10:00.050Z", { sentAt: Date.now(), receivedAt: Date.now() + 100 });
    expect(serverOffset()).toBe(600_000);
    expect(serverNow()).toBe(Date.parse("2026-10-24T12:10:00.000Z"));
  });

  it("resposta lenta depois de uma rápida não mexe no offset", () => {
    const t = Date.now();
    syncServerTime("2026-10-24T12:10:00.020Z", { sentAt: t, receivedAt: t + 40 });
    const before = serverOffset();
    vi.setSystemTime(t + 5_000);
    syncServerTime("2026-10-24T12:10:06.500Z", { sentAt: t + 5_000 - 2_000, receivedAt: t + 5_000 });
    expect(serverOffset()).toBe(before);
  });

  it("sem amostra (carga do SSR), assume latência zero e a próxima medição real a substitui", () => {
    syncServerTime("2026-10-24T12:10:00.000Z");
    expect(serverOffset()).toBe(600_000);
    const t = Date.now();
    syncServerTime("2026-10-24T12:10:00.500Z", { sentAt: t - 100, receivedAt: t + 100 });
    expect(serverOffset()).toBe(Date.parse("2026-10-24T12:10:00.500Z") - t);
  });

  it("serverTime inválido não mexe em nada", () => {
    syncServerTime("não é data", { sentAt: 0, receivedAt: 1 });
    expect(serverOffset()).toBe(0);
  });
});
