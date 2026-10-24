import { Prisma, type PrismaClient } from "@prisma/client";
import {
  AUTH_TEXT,
  EVENTS,
  type DepositResponse,
  type DomainEvent,
  type LeadingLotDto,
  type WalletPageDto,
} from "@lanceauto/shared";
import { AppError } from "../errors";
import type { Clock } from "../infra/clock";
import { userRoom } from "../socket";
import { toLedgerEntryDto, toNumber, toWalletDto } from "./mappers";

export const LEDGER_PAGE_SIZE = 50;

export interface DepositResult {
  response: DepositResponse;
  /** Entregues ao `Publisher` pela rota, só depois do commit (INV-4). */
  events: DomainEvent[];
}

export interface WalletServiceDeps {
  db: PrismaClient;
  clock: Clock;
}

const unauthenticated = () => new AppError("UNAUTHENTICATED", undefined, AUTH_TEXT.unauthenticated);

export function encodeCursor(seq: number): string {
  return Buffer.from(String(seq)).toString("base64url");
}

export function decodeCursor(cursor: string): number | null {
  const seq = Number(Buffer.from(cursor, "base64url").toString());
  return Number.isSafeInteger(seq) && seq > 0 ? seq : null;
}

export function makeWalletService({ db, clock }: WalletServiceDeps) {
  return {
    /** Saldo mais a página do extrato, do mais novo para o mais antigo, por `seq` (R-1.10). */
    async page(userId: string, cursor?: string): Promise<WalletPageDto> {
      const before = cursor === undefined ? undefined : decodeCursor(cursor);
      if (before === null) {
        throw new AppError("VALIDATION", { fields: { cursor: "Cursor inválido." } }, "Cursor inválido.");
      }
      const wallet = await db.wallet.findUnique({ where: { userId } });
      if (!wallet) throw unauthenticated();
      const rows = await db.ledgerEntry.findMany({
        where: { userId, ...(before === undefined ? {} : { seq: { lt: before } }) },
        orderBy: { seq: "desc" },
        take: LEDGER_PAGE_SIZE + 1,
      });
      const hasMore = rows.length > LEDGER_PAGE_SIZE;
      const pageRows = rows.slice(0, LEDGER_PAGE_SIZE);
      const last = pageRows[pageRows.length - 1];
      // O ledger não tem FK para o lote (histórico imutável): o número vem de uma busca só pelos ids da página.
      const lotIds = [...new Set(pageRows.flatMap((row) => (row.lotId ? [row.lotId] : [])))];
      const numbers = new Map(
        (await db.lot.findMany({ where: { id: { in: lotIds } }, select: { id: true, number: true } })).map((lot) => [
          lot.id,
          lot.number,
        ]),
      );
      // Lotes em que lidero e que ainda não foram liquidados nem cancelados (ao vivo ou apurando), os que fecham antes primeiro.
      const leading: LeadingLotDto[] = (
        await db.lot.findMany({
          where: { leaderId: userId, cancelledAt: null, settledAt: null },
          orderBy: [{ endsAt: "asc" }, { number: "asc" }],
          select: { id: true, number: true, title: true, currentBidCents: true },
        })
      ).map((lot) => ({
        lotId: lot.id,
        number: lot.number,
        title: lot.title,
        committedCents: lot.currentBidCents === null ? 0 : toNumber(lot.currentBidCents),
      }));
      return {
        ...toWalletDto(wallet),
        entries: pageRows.map((row) => toLedgerEntryDto(row, row.lotId ? (numbers.get(row.lotId) ?? null) : null)),
        nextCursor: hasMore && last ? encodeCursor(last.seq) : null,
        leadingLots: leading,
      };
    },

    /**
     * Soma ao total, travando só a própria carteira (INV-5); carteira e extrato na mesma tx (INV-6).
     * Os eventos voltam para a rota entregar ao `Publisher` depois do commit (INV-4).
     */
    async deposit(userId: string, amountCents: number): Promise<DepositResult> {
      try {
        return await db.$transaction(
          async (tx) => {
            const rows = await tx.$queryRaw<{ totalCents: bigint; committedCents: bigint }[]>`
              SELECT "totalCents", "committedCents" FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
            const current = rows[0];
            if (!current) throw unauthenticated();
            const amount = BigInt(amountCents);
            const totalCents = current.totalCents + amount;
            const wallet = await tx.wallet.update({ where: { userId }, data: { totalCents } });
            const entry = await tx.ledgerEntry.create({
              data: {
                userId,
                kind: "DEPOSIT",
                amountCents: amount,
                totalAfter: totalCents,
                committedAfter: current.committedCents,
                createdAt: clock.now(),
              },
            });
            const dto = toWalletDto(wallet);
            return {
              response: { wallet: dto, entry: toLedgerEntryDto(entry) },
              // Só a própria sala do dono: o saldo nunca vai para os outros (R-4.12).
              events: [{ type: EVENTS.WALLET_UPDATED, room: userRoom(userId), payload: dto }],
            };
          },
          { maxWait: 10_000, timeout: 10_000 },
        );
      } catch (err) {
        // Usuário apagado com token ainda válido: violação de FK vira 401, nunca 500 (R-1.6).
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") throw unauthenticated();
        throw err;
      }
    },
  };
}

export type WalletService = ReturnType<typeof makeWalletService>;
