import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditView } from "@lanceauto/shared";

const apiGet = vi.fn();
vi.mock("./api-client", () => ({ apiGet: (...args: unknown[]) => apiGet(...args) }));

import { AuditNotFoundError, AuditRequestError, fetchAudit } from "./audit-query";

const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const view: AuditView = {
  lot: {
    id: "lot-1",
    number: 18,
    title: "Gol",
    brand: "VW",
    model: "Gol",
    year: 1996,
    status: "LIVE",
    startsAt: "2026-10-25T13:00:00.000Z",
    endsAt: "2026-10-25T14:00:00.000Z",
    originalEndsAt: "2026-10-25T14:00:00.000Z",
    bidCount: 0,
    imageUrl: null,
  },
  entries: [],
  verdict: { code: "OK", firstBad: null, okCount: 0, foundCount: 0, registeredCount: 0, sealOk: true, receiptChecked: false, receiptOk: null, consistencyIssue: null },
  finalHash: HASH,
  receipt: null,
  verifiedAt: "2026-10-25T15:00:00.000Z",
  serverTime: "2026-10-25T15:00:00.000Z",
};

const ok = (data: unknown) => ({ ok: true, status: 200, data });
const fail = (status: number | null, message?: string) => ({ ok: false, status, error: message ? { code: "X", message } : null, body: null });

describe("fetchAudit (S08 §9)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiGet.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a resposta só chega depois de 400 ms, mesmo que a API responda na hora", async () => {
    apiGet.mockResolvedValue(ok(view));
    let settled = false;
    const promise = fetchAudit("lot-1").then((value) => {
      settled = true;
      return value;
    });
    await vi.advanceTimersByTimeAsync(399);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    expect((await promise).lot.id).toBe("lot-1");
  });

  it("API lenta não ganha mais 400 ms: a espera mínima corre junto com a chamada", async () => {
    apiGet.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(ok(view)), 1_000)));
    let settled = false;
    void fetchAudit("lot-1").then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });

  it("chama o endpoint do lote com o id codificado", async () => {
    apiGet.mockResolvedValue(ok(view));
    const promise = fetchAudit("a b/c");
    await vi.advanceTimersByTimeAsync(400);
    await promise;
    expect(apiGet).toHaveBeenCalledWith("/lots/a%20b%2Fc/audit", expect.anything());
  });

  it("404 vira AuditNotFoundError", async () => {
    apiGet.mockResolvedValue(fail(404, "Lote não encontrado."));
    const result = fetchAudit("x").catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(400);
    expect(await result).toBeInstanceOf(AuditNotFoundError);
  });

  it("429 leva a mensagem do servidor e marca rateLimited", async () => {
    apiGet.mockResolvedValue(fail(429, "Muitas tentativas. Espere um minuto."));
    const result = fetchAudit("x").catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(400);
    const error = (await result) as AuditRequestError;
    expect(error).toBeInstanceOf(AuditRequestError);
    expect(error.rateLimited).toBe(true);
    expect(error.message).toBe("Muitas tentativas. Espere um minuto.");
  });

  it("rede caída e 5xx viram AuditRequestError sem rateLimited", async () => {
    for (const status of [null, 500]) {
      apiGet.mockResolvedValue(fail(status));
      const result = fetchAudit("x").catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(400);
      const error = (await result) as AuditRequestError;
      expect(error).toBeInstanceOf(AuditRequestError);
      expect(error.rateLimited).toBe(false);
    }
  });

  it("corpo fora do contrato (campo faltando) vira erro, não tela quebrada", async () => {
    apiGet.mockResolvedValue(ok({ ...view, verdict: undefined }));
    const result = fetchAudit("x").catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(400);
    expect(await result).toBeInstanceOf(AuditRequestError);
  });
});
