import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { buildSearchText } from "@lanceauto/shared";

export interface InsertLotOptions {
  auctioneerId: string;
  title?: string;
  brand?: string;
  model?: string;
  year?: number;
  startsAt: string;
  endsAt: string;
  cancelledAt?: string | null;
  settledAt?: string | null;
  bidCount?: number;
  image?: { data: Buffer; mime: string } | null;
}

/** Lote direto no banco, para estados que a API desta fatia não produz (cancelado, encerrado, apurando). */
export async function insertLot(prisma: PrismaClient, options: InsertLotOptions) {
  const { auctioneerId, title = "Lote de teste", brand = "Toyota", model = "Corolla XEi 2.0", year = 2015 } = options;
  return prisma.lot.create({
    data: {
      id: randomUUID(),
      title,
      searchText: buildSearchText(title, brand, model, year),
      startingBidCents: 1_000_000n,
      minIncrementCents: 10_000n,
      startsAt: new Date(options.startsAt),
      endsAt: new Date(options.endsAt),
      originalEndsAt: new Date(options.endsAt),
      cancelledAt: options.cancelledAt ? new Date(options.cancelledAt) : null,
      settledAt: options.settledAt ? new Date(options.settledAt) : null,
      bidCount: options.bidCount ?? 0,
      lastHash: "genesis-de-teste",
      seal: "selo-de-teste",
      createdAt: new Date("2026-10-23T12:00:00.000Z"),
      auctioneer: { connect: { id: auctioneerId } },
      item: {
        create: {
          source: "FIPE",
          externalId: "teste",
          brand,
          model,
          year,
          fuel: "Flex",
          referencePriceCents: 8_000_000n,
          referenceMonth: "2026-10",
          imageData: options.image ? new Uint8Array(options.image.data) : null,
          imageMime: options.image?.mime ?? null,
          rawData: {},
          fetchedAt: new Date("2026-10-23T12:00:00.000Z"),
        },
      },
    },
  });
}
