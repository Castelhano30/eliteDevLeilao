import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "./api-client";
import { isServerClockSynced, resetServerClock, serverOffset } from "./server-clock";

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

  it("vale a resposta de menor latência: uma lenta depois não desloca o relógio (R-4.10)", async () => {
    resetServerClock();
    let now = Date.parse("2026-10-23T12:00:00.000Z");
    vi.spyOn(Date, "now").mockImplementation(() => now);
    /** `fetch` que leva `rtt` ms no relógio do aparelho; o servidor carimba `serverTime`. */
    const respond = (serverTime: string, rtt: number) =>
      vi.fn(async () => {
        now += rtt;
        return new Response(JSON.stringify({ serverTime }), { status: 200 });
      });

    vi.stubGlobal("fetch", respond("2026-10-23T12:00:00.020Z", 40));
    await apiGet("/lots");
    expect(serverOffset()).toBe(0);

    now += 1_000;
    // 2 s de ida e volta: tomada sozinha, a resposta diria que o servidor está 1.040 ms atrás.
    vi.stubGlobal("fetch", respond("2026-10-23T12:00:02.000Z", 2_000));
    await apiGet("/lots");
    expect(serverOffset()).toBe(0);
  });
});
