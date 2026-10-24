import { describe, expect, it } from "vitest";
import { INITIAL_REACH, reachStep, type ReachState } from "./use-server-clock";

/** Roda uma sequência de (alvo, agora) e devolve em que passos o callback teria disparado. */
function run(steps: [target: number | null, now: number][]): number[] {
  let state: ReachState = INITIAL_REACH;
  const fired: number[] = [];
  steps.forEach(([target, now], index) => {
    const step = reachStep(state, target, now);
    state = step.next;
    if (step.fire) fired.push(index);
  });
  return fired;
}

describe("reachStep (lógica do useOnReach)", () => {
  it("dispara uma vez ao cruzar o alvo, e só uma", () => {
    expect(
      run([
        [1_000, 400],
        [1_000, 800],
        [1_000, 1_000],
        [1_000, 1_001],
        [1_000, 5_000],
      ]),
    ).toEqual([2]);
  });

  it("não dispara se o alvo já tinha passado quando começou a observar", () => {
    expect(
      run([
        [1_000, 2_000],
        [1_000, 3_000],
      ]),
    ).toEqual([]);
  });

  it("alvo nulo e relógio ainda não acertado (now <= 0) não disparam nem armam", () => {
    expect(run([[null, 10_000]])).toEqual([]);
    expect(
      run([
        [1_000, 0],
        [1_000, 500],
        [1_000, 1_000],
      ]),
    ).toEqual([2]);
  });

  it("rearma quando o alvo muda: dispara de novo no alvo seguinte", () => {
    expect(
      run([
        [1_000, 500],
        [1_000, 1_000],
        [3_000, 1_100],
        [3_000, 2_000],
        [3_000, 3_000],
      ]),
    ).toEqual([1, 4]);
  });

  it("alvo que muda depois de já ter passado, sem disparar, dispara antes de trocar", () => {
    expect(
      run([
        [1_000, 500],
        [3_000, 1_500],
        [3_000, 3_000],
      ]),
    ).toEqual([1, 2]);
  });

  it("alvo que muda para um já vencido não dispara pelo novo", () => {
    expect(
      run([
        [5_000, 1_000],
        [null, 1_500],
        [1_000, 2_000],
        [1_000, 3_000],
      ]),
    ).toEqual([]);
  });
});
