import type { LedgerEntry, User, Wallet } from "@prisma/client";
import type { LedgerEntryDto, UserDto, WalletDto } from "@lanceauto/shared";
import { AppError } from "../errors";

/** BigInt do banco para `number` das bordas; passou do intervalo seguro, falha em vez de arredondar (INV-2). */
export function toNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new AppError("INTERNAL");
  }
  return Number(value);
}

export function toUserDto(user: Pick<User, "id" | "name" | "email" | "role">): UserDto {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export function toWalletDto(wallet: Pick<Wallet, "totalCents" | "committedCents">): WalletDto {
  const totalCents = toNumber(wallet.totalCents);
  const committedCents = toNumber(wallet.committedCents);
  return { totalCents, committedCents, availableCents: totalCents - committedCents };
}

/** `lotNumber` vem do join com `Lot` feito pelo chamador; o ledger não tem FK para o lote. */
export function toLedgerEntryDto(entry: LedgerEntry, lotNumber: number | null = null): LedgerEntryDto {
  return {
    id: entry.id,
    kind: entry.kind,
    amountCents: toNumber(entry.amountCents),
    lotId: entry.lotId,
    lotNumber,
    totalAfterCents: toNumber(entry.totalAfter),
    committedAfterCents: toNumber(entry.committedAfter),
    createdAt: entry.createdAt.toISOString(),
  };
}
