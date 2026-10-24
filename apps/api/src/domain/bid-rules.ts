import {
  BID_TEXT,
  EXTENSION_WINDOW_MS,
  belowMinimumMessage,
  insufficientBalanceMessage,
  lotEndedMessage,
  lotNotStartedMessage,
  type BelowMinimumDetails,
  type BelowMinimumReason,
  type ErrorCode,
  type InsufficientBalanceDetails,
  type LotNotStartedDetails,
} from "@lanceauto/shared";
import { toDate } from "../infra/clock";

/** Lote como as regras o veem: dinheiro em `number` (centavos), datas em `Date`. */
export interface BidLot {
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
  startingBidCents: number;
  minIncrementCents: number;
  currentBidCents: number | null;
  leaderId: string | null;
}

/** Mínimo aceito: lance inicial sem lances; senão lance atual + incremento (R-3.2). */
export function minimumBid(lot: Pick<BidLot, "startingBidCents" | "minIncrementCents" | "currentBidCents">): number {
  return lot.currentBidCents === null ? lot.startingBidCents : lot.currentBidCents + lot.minIncrementCents;
}

export interface BidRefusal {
  ok: false;
  code: ErrorCode;
  message: string;
  details?: BelowMinimumDetails | LotNotStartedDetails | InsufficientBalanceDetails;
}

export interface BidInput {
  lot: BidLot;
  userId: string;
  role: "BIDDER" | "AUCTIONEER";
  amountCents: number;
  /** O que o cliente viu como lance atual (`null` = sem lances). */
  expectedCurrentCents: number | null;
  now: Date;
}

/**
 * Checagens 2 a 7 da ordem de validação (INV-8, C1): cancelado → ainda não abriu → encerrado → abaixo do mínimo →
 * já lidera → papel. Para na primeira falha. O saldo (checagem 8) vem depois do lock das carteiras.
 */
export function validateBidPreWallet(input: BidInput): { ok: true; minimumCents: number } | BidRefusal {
  const { lot, userId, role, amountCents, expectedCurrentCents, now } = input;
  const nowMs = now.getTime();

  if (lot.cancelledAt !== null) return { ok: false, code: "LOT_CANCELLED", message: BID_TEXT.lotCancelled };
  if (nowMs < lot.startsAt.getTime()) {
    const startsAt = lot.startsAt.toISOString();
    return { ok: false, code: "LOT_NOT_STARTED", message: lotNotStartedMessage(startsAt), details: { startsAt } };
  }
  if (nowMs >= lot.endsAt.getTime()) {
    return { ok: false, code: "LOT_ENDED", message: lotEndedMessage(lot.endsAt.toISOString()) };
  }

  const minimumCents = minimumBid(lot);
  if (amountCents < minimumCents) {
    const reason: BelowMinimumReason =
      lot.leaderId === userId ? "OWN_LEAD" : expectedCurrentCents !== lot.currentBidCents ? "OUTDATED" : "MINIMUM";
    return {
      ok: false,
      code: "BELOW_MINIMUM",
      message: belowMinimumMessage(reason, minimumCents),
      details: { minimumCents, currentBidCents: lot.currentBidCents, reason },
    };
  }
  if (lot.leaderId === userId) return { ok: false, code: "ALREADY_WINNING", message: BID_TEXT.alreadyWinning };
  if (role === "AUCTIONEER") return { ok: false, code: "ROLE_NOT_ALLOWED", message: BID_TEXT.roleNotAllowed };
  return { ok: true, minimumCents };
}

/** Valor igual ao disponível é aceito; um centavo a mais, não (R-3.5). */
export function validateBalance(availableCents: number, amountCents: number): { ok: true } | BidRefusal {
  if (amountCents <= availableCents) return { ok: true };
  return {
    ok: false,
    code: "INSUFFICIENT_BALANCE",
    message: insufficientBalanceMessage(availableCents),
    details: { availableCents },
  };
}

/**
 * Prorrogação (INV-9): `endsAt − now <= 2 min` leva o fim a `now + 2 min`, sem teto. `extended` só se o fim novo
 * for depois do atual (no limite exato de 2:00.000 o fim não muda).
 */
export function nextEndsAt(endsAt: Date, now: Date): { endsAt: Date; extended: boolean } {
  if (endsAt.getTime() - now.getTime() > EXTENSION_WINDOW_MS) return { endsAt, extended: false };
  const next = toDate(now.getTime() + EXTENSION_WINDOW_MS);
  return { endsAt: next, extended: next.getTime() > endsAt.getTime() };
}
