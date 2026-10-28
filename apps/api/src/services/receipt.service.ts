import type { PrismaClient } from "@prisma/client";
import { RECEIPT_TEXT, isReceiptToken, receiptCode, type ReceiptDTO } from "@lanceauto/shared";
import { AppError } from "../errors";
import { toNumber } from "./mappers";

export interface ReceiptServiceDeps {
  db: PrismaClient;
}

/** Token inexistente e token de formato inválido respondem igual: ninguém aprende nada tentando adivinhar (AC-5.14). */
const receiptNotFound = () => new AppError("NOT_FOUND", undefined, RECEIPT_TEXT.notFoundBody);

export function makeReceiptService({ db }: ReceiptServiceDeps) {
  return {
    /**
     * Comprovante público por token (R-5.12). Lê só o banco (INV-14) e nunca liquida. O DTO não leva `winnerId`,
     * `userId`, nome, e-mail, `rawData` da FIPE nem o token. O martelo é `endsAt`, não `settledAt` (R-5.6).
     */
    async getByToken(token: string): Promise<ReceiptDTO> {
      if (!isReceiptToken(token)) throw receiptNotFound();
      const receipt = await db.receipt.findUnique({
        where: { token },
        select: {
          pseudonym: true,
          amountCents: true,
          token: true,
          finalHash: true,
          issuedAt: true,
          lot: {
            select: {
              id: true,
              number: true,
              title: true,
              itemId: true,
              endsAt: true,
              originalEndsAt: true,
              bidCount: true,
              settledAt: true,
              item: {
                select: {
                  brand: true,
                  model: true,
                  year: true,
                  fuel: true,
                  referencePriceCents: true,
                  referenceMonth: true,
                  imageCount: true,
                  imageCredit: true,
                },
              },
            },
          },
        },
      });
      if (!receipt) throw receiptNotFound();
      const { lot } = receipt;
      const { item } = lot;
      const hasImage = item.imageCount > 0;
      return {
        lotNumber: lot.number,
        receiptCode: receiptCode(lot.number, receipt.token),
        lotId: lot.id,
        car: {
          title: lot.title,
          brand: item.brand,
          model: item.model,
          year: item.year,
          fuel: item.fuel,
          referencePriceCents: toNumber(item.referencePriceCents),
          referenceMonth: /^\d{4}-(0[1-9]|1[0-2])$/.test(item.referenceMonth)
            ? `${item.referenceMonth.slice(5)}/${item.referenceMonth.slice(0, 4)}`
            : item.referenceMonth,
          imageUrl: hasImage ? `/items/${lot.itemId}/image` : null,
          imageCredit: hasImage ? item.imageCredit : null,
        },
        amountCents: toNumber(receipt.amountCents),
        bidCount: lot.bidCount,
        extended: lot.endsAt.getTime() > lot.originalEndsAt.getTime(),
        hammerAt: lot.endsAt.toISOString(),
        settledAt: (lot.settledAt ?? receipt.issuedAt).toISOString(),
        winnerPseudonym: receipt.pseudonym,
        finalHash: receipt.finalHash,
        auditUrl: `/lotes/${lot.id}/auditoria`,
      };
    },
  };
}

export type ReceiptService = ReturnType<typeof makeReceiptService>;
