"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { hydrationNow, serverClockSnapshot, subscribeServerClock } from "./server-clock";

/**
 * Agora (ms) pelo relógio do servidor, atualizado a cada segundo. No SSR e na hidratação vale o
 * `serverTime` da carga; depois, o relógio vivo.
 */
export function useServerNow(serverTime?: string): number {
  return useSyncExternalStore(subscribeServerClock, serverClockSnapshot, () => hydrationNow(serverTime));
}

/**
 * Dispara `callback` uma vez quando `now` cruza `target` (só se o alvo estava no futuro quando começou a observar).
 * Se o alvo muda depois de já ter passado sem disparar (a lista andou no mesmo tique), dispara antes de trocar.
 */
export function useOnReach(target: number | null, now: number, callback: () => void): void {
  const state = useRef<{ target: number | null; armed: boolean; fired: boolean }>({ target: null, armed: false, fired: false });
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  });
  useEffect(() => {
    const s = state.current;
    if (s.target !== target) {
      const missed = s.target !== null && s.armed && !s.fired && now >= s.target;
      state.current = { target, armed: target !== null && now > 0 && now < target, fired: false };
      if (missed) saved.current();
      return;
    }
    if (target === null || now <= 0) return;
    if (!s.armed && now < target) s.armed = true;
    if (s.armed && !s.fired && now >= target) {
      s.fired = true;
      saved.current();
    }
  }, [target, now]);
}
