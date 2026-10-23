/** Nomes dos eventos do Socket.IO. Payloads são tipados pelas fatias donas. */
export const EVENTS = {
  /** servidor para cliente */
  BID_PLACED: "bid:placed",
  LOT_CLOSED: "lot:closed",
  LOT_CANCELLED: "lot:cancelled",
  SHOWCASE_LOT: "showcase:lot",
  WALLET_UPDATED: "wallet:updated",
  /** cliente para servidor */
  LOT_JOIN: "lot:join",
  SHOWCASE_JOIN: "showcase:join",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export interface DomainEvent {
  type: EventName;
  room: string;
  payload: unknown;
}
