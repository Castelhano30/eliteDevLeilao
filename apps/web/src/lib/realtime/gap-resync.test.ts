import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGapResync } from "./gap-resync";

/** `refetch` controlado à mão: cada chamada devolve uma promessa que o teste resolve. */
function manualRefetch() {
  const pending: ((ok: boolean) => void)[] = [];
  const refetch = vi.fn(() => new Promise<boolean>((resolve) => pending.push(resolve)));
  return { refetch, resolve: (index: number, ok: boolean) => pending[index]!(ok) };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

describe("createGapResync (salto de version, §9.1 Desatualizado)", () => {
  let stale: boolean[];
  const onStale = (value: boolean) => stale.push(value);

  beforeEach(() => {
    vi.useFakeTimers();
    stale = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fica desatualizado até o GET aplicar", async () => {
    const { refetch, resolve } = manualRefetch();
    const gap = createGapResync({ refetch, onStale });
    gap.request();
    expect(stale).toEqual([true]);
    resolve(0, true);
    await flush();
    expect(stale).toEqual([true, false]);
  });

  it("GET que falha não libera o lance: segue desatualizado e tenta de novo em 3 s", async () => {
    const { refetch, resolve } = manualRefetch();
    const gap = createGapResync({ refetch, onStale });
    gap.request();
    resolve(0, false);
    await flush();
    expect(stale).toEqual([true]);
    expect(refetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(refetch).toHaveBeenCalledTimes(2);
    resolve(1, true);
    await flush();
    expect(stale).toEqual([true, false]);
  });

  it("desconectado, não insiste: o join + GET da reconexão resolve (settle)", async () => {
    const { refetch, resolve } = manualRefetch();
    const gap = createGapResync({ refetch, onStale, canRetry: () => false });
    gap.request();
    resolve(0, false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(stale).toEqual([true]);
    gap.settle();
    expect(stale).toEqual([true, false]);
  });

  it("com dois GETs em voo, só o mais recente decide", async () => {
    const { refetch, resolve } = manualRefetch();
    const gap = createGapResync({ refetch, onStale });
    gap.request();
    gap.request();
    resolve(1, true);
    await flush();
    // O primeiro, cancelado pelo segundo, falha depois: não volta a travar nem agenda nova tentativa.
    resolve(0, false);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(stale).toEqual([true, false]);
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("sair da Sala com o GET em voo não deixa o lance inerte nem tentativa pendurada", async () => {
    const { refetch, resolve } = manualRefetch();
    const gap = createGapResync({ refetch, onStale });
    gap.request();
    gap.dispose();
    expect(stale).toEqual([true, false]);
    resolve(0, false);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(stale).toEqual([true, false]);
  });
});
