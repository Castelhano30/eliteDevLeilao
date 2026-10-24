import type { BidPlacedPayload } from "./bids";
import type { LotCard, LotState } from "./lots";
import type { WalletDto } from "./wallet";

/** Nomes dos eventos do Socket.IO. */
export const EVENTS = {
  /** servidor para cliente */
  BID_PLACED: "bid:placed",
  LOT_CLOSED: "lot:closed",
  LOT_CANCELLED: "lot:cancelled",
  SHOWCASE_LOT: "showcase:lot",
  WALLET_UPDATED: "wallet:updated",
  /** cliente para servidor */
  LOT_JOIN: "lot:join",
  LOT_LEAVE: "lot:leave",
  SHOWCASE_JOIN: "showcase:join",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export interface DomainEvent {
  type: EventName;
  room: string;
  payload: unknown;
}

/** Payload como o service o produz: o `Publisher` é o único que carimba `serverTime` (R-4.3). */
export type WithoutServerTime<T> = Omit<T, "serverTime">;

/** `lot:closed`: terminal e idempotente. O fechamento não incrementa `entryCount`, então `version` é o atual (C10). */
export interface LotClosedPayload {
  lotId: string;
  version: number;
  outcome: "SOLD" | "UNSOLD";
  finalBidCents?: number;
  winnerPseudonym?: string;
  finalHash?: string;
  serverTime: string;
}

/** `lot:cancelled`: sem `cancelledAt`; o cliente refaz o `GET` em vez de presumir (R-4.6). */
export interface LotCancelledPayload {
  lotId: string;
  version: number;
  serverTime: string;
}

export type ShowcaseLotPayload = LotCard & { serverTime: string };

export type WalletUpdatedPayload = WalletDto & { serverTime: string };

/**
 * Resposta de `lot:join`: o snapshot de quem entrou, `NOT_FOUND` (lote inexistente ou `lotId` inválido) ou
 * `INTERNAL` (o servidor não conseguiu montar o snapshot; o cliente tenta de novo).
 */
export type LotJoinAck = { ok: true; lot: LotState } | { ok: false; error: { code: "NOT_FOUND" | "INTERNAL" } };

/** Os eventos de uma sala de lote, como o reducer da Sala os recebe. */
export type LotEvent =
  | { type: typeof EVENTS.BID_PLACED; payload: BidPlacedPayload }
  | { type: typeof EVENTS.LOT_CLOSED; payload: LotClosedPayload }
  | { type: typeof EVENTS.LOT_CANCELLED; payload: LotCancelledPayload };
