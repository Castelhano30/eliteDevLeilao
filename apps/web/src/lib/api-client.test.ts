import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "./api-client";
import { isServerClockSynced, serverOffset } from "./server-clock";

describe("apiClient e o relógio do servidor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("toda resposta com serverTime acerta o offset (INV-1)", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-23T12:10:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ lots: [], serverTime: "2026-10-23T12:00:00.000Z" }), { status: 200 })),
    );
    const result = await apiGet("/lots");
    expect(result.ok).toBe(true);
    expect(isServerClockSynced()).toBe(true);
    expect(serverOffset()).toBe(-600_000);
  });

  it("resposta de erro com serverTime também acerta", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-23T12:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ serverTime: "2026-10-23T12:00:05.000Z" }), { status: 404 })),
    );
    await apiGet("/lots/x");
    expect(serverOffset()).toBe(5_000);
  });
});
