import type { PrismaClient } from "@prisma/client";
import { LOT_TEXT, receiptCode, type AuditRowDto, type AuditView } from "@lanceauto/shared";
import { AppError } from "../errors";
import { verifyChain, type AuditRow } from "../domain/audit-chain";
import type { Clock } from "../infra/clock";
import { LOT_SELECT, toLotCard } from "./lot-mappers";
import { toNumber } from "./mappers";

export interface AuditServiceDeps {
  db: PrismaClient;
  clock: Clock;
  auditKey: string;
}

export function makeAuditService({ db, clock, auditKey }: AuditServiceDeps) {
  return {
    /**
     * Refaz a conta da cadeia do lote e devolve o veredito (R-8.1 a R-8.16). Lê só o banco (INV-14) e não grava
     * nada. Lote, linhas e comprovante saem do mesmo snapshot (`RepeatableRead`): um lance que entre durante a
     * verificação não vira falso `SEAL_MISMATCH` (R-8.3). `viewerId` só marca as linhas do próprio usuário
     * (`mine`); `bidderId`, o hash recalculado e o token do comprovante nunca saem daqui (R-8.7, T9).
     */
    async verify(lotId: string, viewerId: string | null): Promise<AuditView> {
      const now = clock.now();
      const snapshot = await db.$transaction(
        async (tx) => {
          const lot = await tx.lot.findUnique({
            where: { id: lotId },
            select: {
              ...LOT_SELECT,
              lastHash: true,
              seal: true,
              receipt: { select: { finalHash: true, amountCents: true, token: true } },
            },
          });
          if (!lot) return null;
          const rows = await tx.bid.findMany({
            where: { lotId },
            orderBy: { seq: "asc" },
            select: { seq: true, kind: true, pseudonym: true, amountCents: true, at: true, prevHash: true, hash: true, bidderId: true },
          });
          return { lot, rows };
        },
        { isolationLevel: "RepeatableRead" },
      );
      if (!snapshot) throw new AppError("NOT_FOUND", undefined, LOT_TEXT.notFoundTitle);
      const { lot, rows } = snapshot;

      const chainRows: AuditRow[] = rows.map((row) => ({
        seq: row.seq,
        kind: row.kind,
        pseudonym: row.pseudonym,
        amountCents: row.amountCents === null ? null : toNumber(row.amountCents),
        at: row.at,
        prevHash: row.prevHash,
        hash: row.hash,
      }));
      const receipt = lot.receipt ? { finalHash: lot.receipt.finalHash, amountCents: toNumber(lot.receipt.amountCents) } : null;
      const result = verifyChain(
        auditKey,
        {
          id: lot.id,
          startsAt: lot.startsAt,
          startingBidCents: toNumber(lot.startingBidCents),
          minIncrementCents: toNumber(lot.minIncrementCents),
          entryCount: lot.entryCount,
          lastHash: lot.lastHash,
          seal: lot.seal,
          bidCount: lot.bidCount,
          settledAt: lot.settledAt,
          cancelledAt: lot.cancelledAt,
        },
        chainRows,
        receipt,
      );

      const card = toLotCard(lot, now);
      const entries: AuditRowDto[] = chainRows.map((row, index) => ({
        seq: row.seq,
        kind: row.kind,
        pseudonym: row.pseudonym,
        mine: viewerId !== null && row.kind === "BID" && rows[index]!.bidderId === viewerId,
        amountCents: row.amountCents,
        at: row.at.toISOString(),
        hash: row.hash,
        status: result.rowStatus[index]!,
      }));

      return {
        lot: {
          id: card.id,
          number: card.number,
          title: card.title,
          brand: card.brand,
          model: card.model,
          year: card.year,
          status: card.status,
          startsAt: card.startsAt,
          endsAt: card.endsAt,
          originalEndsAt: card.originalEndsAt,
          bidCount: card.bidCount,
          imageUrl: card.imageUrl,
        },
        entries,
        verdict: {
          code: result.verdict,
          firstBad: result.firstBad,
          okCount: result.rowStatus.filter((status) => status === "OK").length,
          foundCount: result.foundCount,
          registeredCount: result.registeredCount,
          sealOk: result.sealOk,
          receiptChecked: receipt !== null || result.consistencyIssue === "RECEIPT_MISSING",
          receiptOk: result.receiptOk,
          consistencyIssue: result.consistencyIssue,
        },
        finalHash: lot.lastHash,
        // Só o código curto: o token do comprovante é do vencedor (T9).
        receipt: lot.receipt ? { finalHash: lot.receipt.finalHash, receiptCode: receiptCode(lot.number, lot.receipt.token) } : null,
        verifiedAt: now.toISOString(),
        serverTime: now.toISOString(),
      };
    },
  };
}

export type AuditService = ReturnType<typeof makeAuditService>;
