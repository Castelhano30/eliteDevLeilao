import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { buildSearchText } from "@lanceauto/shared";
import { genesisHash, sealHash } from "../../src/domain/audit-chain";
import { testEnv } from "./app";

export interface InsertLotOptions {
  id?: string;
  auctioneerId: string;
  startingBidCents?: number;
  minIncrementCents?: number;
  title?: string;
  brand?: string;
  model?: string;
  year?: number;
  startsAt: string;
  endsAt: string;
  cancelledAt?: string | null;
  settledAt?: string | null;
  bidCount?: number;
  /** Fotos do item, a primeira é a capa. `image` é atalho para uma só. */
  images?: { data: Buffer; mime: string }[];
  image?: { data: Buffer; mime: string } | null;
}

/**
 * Lote direto no banco, para estados que a API não produz (cancelado, encerrado, apurando) e para os lances.
 * Nasce com genesis e selo reais (chave de teste), então a cadeia dos lances começa válida.
 */
export async function insertLot(prisma: PrismaClient, options: InsertLotOptions) {
  const { auctioneerId, title = "Lote de teste", brand = "Toyota", model = "Corolla XEi 2.0", year = 2015 } = options;
  const id = options.id ?? randomUUID();
  const photos = options.images ?? (options.image ? [options.image] : []);
  const startingBidCents = BigInt(options.startingBidCents ?? 1_000_000);
  const minIncrementCents = BigInt(options.minIncrementCents ?? 10_000);
  const startsAt = new Date(options.startsAt);
  const genesis = genesisHash(testEnv.AUDIT_HMAC_KEY, { id, startsAt, startingBidCents, minIncrementCents });
  return prisma.lot.create({
    data: {
      id,
      title,
      searchText: buildSearchText(title, brand, model, year),
      startingBidCents,
      minIncrementCents,
      startsAt,
      endsAt: new Date(options.endsAt),
      originalEndsAt: new Date(options.endsAt),
      cancelledAt: options.cancelledAt ? new Date(options.cancelledAt) : null,
      settledAt: options.settledAt ? new Date(options.settledAt) : null,
      bidCount: options.bidCount ?? 0,
      lastHash: genesis,
      seal: sealHash(testEnv.AUDIT_HMAC_KEY, id, 0, genesis),
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
          imageCount: photos.length,
          images: {
            createMany: {
              data: photos.map((photo, position) => ({ position, mime: photo.mime, data: new Uint8Array(photo.data) })),
            },
          },
          rawData: {},
          fetchedAt: new Date("2026-10-23T12:00:00.000Z"),
        },
      },
    },
  });
}
