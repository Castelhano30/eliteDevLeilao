import type { LotState } from "@lanceauto/shared";
import { deriveSituation, nextOpeningCheck, type OpeningChecks, type Situation, type Viewer } from "../lot-state";

type Lot = LotState["lot"];

/**
 * O martelo já bateu para esta tela? Apurando, ou ao vivo com o relógio do servidor em 00:00 (o `endsAt` vale
 * `<=`, como o fim exclusivo da regra). Relógio ainda não acertado (`now <= 0`) nunca decide isso.
 */
export function isHammered(lot: Pick<Lot, "status" | "endsAt">, now: number): boolean {
  return lot.status === "CLOSING" || (lot.status === "LIVE" && now > 0 && Date.parse(lot.endsAt) <= now);
}

/** Situação mostrada no painel: martelo batido vale para todos; senão, viewer × estado. */
export function panelSituation(lot: Parameters<typeof deriveSituation>[0] & Pick<Lot, "endsAt">, viewer: Viewer, now: number): Situation | null {
  return isHammered(lot, now) ? { kind: "closing" } : deriveSituation(lot, viewer);
}

/** A Sala confere o servidor de 3 em 3 s enquanto apura ou o relógio local chega a 00:00. */
export const CLOSING_POLL_MS = 3_000;
/** Agendado que já devia ter aberto: de 2 em 2 s. */
export const OPENING_POLL_MS = 2_000;

/**
 * `refetchInterval` da Sala (puro). O servidor decide o estado; o relógio local só pede para conferir:
 * - apurando, ou ao vivo com o relógio em 00:00: a cada 3 s até o servidor decidir (encerrar ou prorrogar);
 * - agendado que já devia ter aberto: a cada 2 s, contando só respostas novas, até 10 (`nextOpeningCheck`);
 * - resto: sem polling (o tempo real e o `useOnReach` cuidam).
 */
export function lotRefetchInterval(
  lot: Pick<Lot, "status" | "startsAt" | "endsAt">,
  now: number,
  checks: OpeningChecks,
  dataUpdatedAt: number,
): { interval: number | false; checks: OpeningChecks } {
  if (lot.status === "CLOSING" || (lot.status === "LIVE" && now >= Date.parse(lot.endsAt))) {
    return { interval: CLOSING_POLL_MS, checks };
  }
  if (lot.status === "SCHEDULED" && now >= Date.parse(lot.startsAt)) {
    const step = nextOpeningCheck(checks, dataUpdatedAt);
    return { interval: step.keepPolling ? OPENING_POLL_MS : false, checks: step.next };
  }
  return { interval: false, checks };
}

export interface SubmitGuard {
  /** `true` se pode enviar agora; `false` se já há um envio em andamento. */
  tryEnter(): boolean;
  leave(): void;
  readonly busy: boolean;
}

/**
 * Trava de duplo envio do formulário de lance: o segundo Enter ou clique durante o envio é descartado. Fica numa
 * trava síncrona (e não no estado do React) porque dois eventos no mesmo tique leriam o mesmo render.
 */
export function createSubmitGuard(): SubmitGuard {
  let busy = false;
  return {
    tryEnter() {
      if (busy) return false;
      busy = true;
      return true;
    },
    leave() {
      busy = false;
    },
    get busy() {
      return busy;
    },
  };
}
