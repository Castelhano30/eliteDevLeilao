import { z } from "zod";
import type { UserDto } from "./auth";
import { MAX_DEPOSIT_CENTS } from "./money";

export const LEDGER_KINDS = ["DEPOSIT", "HOLD", "RELEASE", "REFUND", "SALE_DEBIT", "SALE_CREDIT"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export const DEPOSIT_AMOUNT_MESSAGE = "Informe um valor inteiro entre R$ 1,00 e R$ 10.000.000,00.";

export const depositInputSchema = z.object({
  amountCents: z
    .number({ error: DEPOSIT_AMOUNT_MESSAGE })
    .int(DEPOSIT_AMOUNT_MESSAGE)
    .min(1, DEPOSIT_AMOUNT_MESSAGE)
    .max(MAX_DEPOSIT_CENTS, DEPOSIT_AMOUNT_MESSAGE),
});
export type DepositInput = z.infer<typeof depositInputSchema>;

export interface WalletDto {
  totalCents: number;
  committedCents: number;
  availableCents: number;
}

export interface LedgerEntryDto {
  id: string;
  kind: LedgerKind;
  amountCents: number;
  lotId: string | null;
  /** Número do lote do movimento (join com `Lot`); `null` sem `lotId`. */
  lotNumber: number | null;
  totalAfterCents: number;
  committedAfterCents: number;
  createdAt: string;
}

export interface LeadingLotDto {
  lotId: string;
  number: number;
  title: string;
  committedCents: number;
}

export interface WalletPageDto extends WalletDto {
  entries: LedgerEntryDto[];
  nextCursor: string | null;
  leadingLots: LeadingLotDto[];
}

export interface MeResponse {
  user: UserDto;
  wallet: WalletDto;
}

export interface DepositResponse {
  wallet: WalletDto;
  entry: LedgerEntryDto;
}
