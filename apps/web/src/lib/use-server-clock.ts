"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { hydrationNow, isServerClockSynced, serverClockSnapshot, subscribeServerClock, syncServerTime } from "./server-clock";

/**
 * Agora (ms) pelo relógio do servidor, atualizado a cada segundo. No SSR e na hidratação vale o
 * `serverTime` da carga; depois, o relógio vivo. Se nenhuma resposta acertou o relógio ainda, o `serverTime`
 * da carga acerta (INV-1): sem isso, um primeiro fetch do cliente que falhe deixaria a tela no relógio do aparelho.
 */
export function useServerNow(serverTime?: string): number {
  useEffect(() => {
    if (serverTime && !isServerClockSynced()) syncServerTime(serverTime);
  }, [serverTime]);
  return useSyncExternalStore(subscribeServerClock, serverClockSnapshot, () => hydrationNow(serverTime));
}

export interface ReachState {
  target: number | null;
  armed: boolean;
  fired: boolean;
}

export const INITIAL_REACH: ReachState = { target: null, armed: false, fired: false };

/**
 * Passo puro do `useOnReach`: dado o estado anterior, o alvo e o agora, devolve o estado novo e se deve disparar.
 * Só arma se o alvo estava no futuro quando passou a ser observado (alvo já vencido não dispara). Se o alvo muda
 * depois de já ter passado sem disparar (a lista andou no mesmo tique), dispara antes de trocar e rearma no novo.
 */
export function reachStep(prev: ReachState, target: number | null, now: number): { next: ReachState; fire: boolean } {
  if (prev.target !== target) {
    const missed = prev.target !== null && prev.armed && !prev.fired && now >= prev.target;
    return { next: { target, armed: target !== null && now > 0 && now < target, fired: false }, fire: missed };
  }
  if (target === null || now <= 0) return { next: prev, fire: false };
  const armed = prev.armed || now < target;
  if (armed && !prev.fired && now >= target) return { next: { target, armed, fired: true }, fire: true };
  return { next: armed === prev.armed ? prev : { ...prev, armed }, fire: false };
}

/** Dispara `callback` uma vez quando `now` cruza `target` (ver `reachStep`). */
export function useOnReach(target: number | null, now: number, callback: () => void): void {
  const state = useRef<ReachState>(INITIAL_REACH);
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  });
  useEffect(() => {
    const step = reachStep(state.current, target, now);
    state.current = step.next;
    if (step.fire) saved.current();
  }, [target, now]);
}
