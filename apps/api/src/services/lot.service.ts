import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  AUTH_TEXT,
  LOT_TEXT,
  buildSearchText,
  lotDateErrors,
  lotStatus,
  normalizeSearch,
  searchTerms,
  type CreateLotInput,
  type CreateLotResponse,
  type LotListQuery,
  type LotListResponse,
  type LotState,
  type LotStatus,
  type MyLotsResponse,
  type StoredImageStatus,
} from "@lanceauto/shared";
import { genesisHash, sealHash } from "../domain/audit-chain";
import { AppError } from "../errors";
import { toDate, type Clock } from "../infra/clock";
import type { CatalogPort } from "../infra/fipe";
import type { DownloadedImage, ImageDownloader } from "../infra/image-store";
import type { Logger } from "../infra/logger";
import type { ImageSuggestionPort } from "../infra/wikipedia";
import { LOT_SELECT, toLotCard, toLotState, type LotRow } from "./lot-mappers";

/** Teto defensivo da Vitrine (sem paginação). */
export const SHOWCASE_LIMIT = 200;
const MY_LOTS_LIMIT = 500;

export interface LotServiceDeps {
  db: PrismaClient;
  clock: Clock;
  auditKey: string;
  catalog: CatalogPort;
  images: ImageSuggestionPort;
  imageStore: ImageDownloader;
  logger?: Logger;
}

export interface CreateLotOptions {
  /** Só o seed: aceita início no passado e duração curta (T11). */
  allowPast?: boolean;
  /** Só o seed: imagem lida de arquivo local, sem download. */
  image?: DownloadedImage | null;
}

const lotNotFound = () => new AppError("NOT_FOUND", undefined, LOT_TEXT.notFoundTitle);

/** O crédito tem a cara do que a Wikipedia sugere? */
const looksLikeWikiCredit = (credit: string) => credit.startsWith("Foto: Wikipedia");

export function makeLotService({ db, clock, auditKey, catalog, images, imageStore, logger }: LotServiceDeps) {
  /**
   * Leiloeiro trocou a imagem mas deixou o crédito da Wikipedia: limpa o crédito (evita atribuição falsa).
   * Sem confirmação de que a URL é a sugerida, também limpa.
   */
  async function keepCredit(input: CreateLotInput, brand: string, model: string): Promise<boolean> {
    if (!input.imageCredit || !looksLikeWikiCredit(input.imageCredit)) return true;
    try {
      const suggestion = await images.suggest(brand, model);
      return suggestion.status === "FOUND" && suggestion.image.url === input.imageUrl;
    } catch {
      return false;
    }
  }

  async function findState(id: string): Promise<LotRow | null> {
    return db.lot.findUnique({ where: { id }, select: LOT_SELECT });
  }

  return {
    /**
     * Cria o lote (R-2.3 a R-2.8): detalhe da FIPE de novo (via cache), download da imagem fora da transação,
     * e uma inserção de `Item` + `Lot` com genesis e selo. Nenhuma chamada externa dentro da transação.
     */
    async createLot(auctioneerId: string, input: CreateLotInput, options: CreateLotOptions = {}): Promise<CreateLotResponse> {
      const now = clock.now();
      const startsAt = toDate(input.startsAt);
      const endsAt = toDate(input.endsAt);
      if (!options.allowPast) {
        const fields = lotDateErrors(input, now.getTime());
        if (Object.keys(fields).length > 0) throw new AppError("VALIDATION", { fields });
      }
      if (endsAt.getTime() <= startsAt.getTime()) {
        throw new AppError("VALIDATION", { fields: { endsAt: LOT_TEXT.endsAtTooSoon } });
      }

      const detail = await catalog.detail(input.brandId, input.modelId, input.yearId);
      const { car } = detail;

      let image: DownloadedImage | null = null;
      let imageStatus: StoredImageStatus = "NONE";
      if (options.image !== undefined) {
        image = options.image;
        imageStatus = image ? "STORED" : "NONE";
      } else if (input.imageUrl) {
        image = await imageStore.download(input.imageUrl);
        imageStatus = image ? "STORED" : "FAILED";
        if (!image) logger?.info({ auctioneerId }, "imagem do lote não pôde ser baixada; segue com a ilustração");
      }
      const creditKept = image !== null && (options.image !== undefined || (await keepCredit(input, car.brand, car.model)));

      const id = randomUUID();
      const startingBidCents = BigInt(input.startingBidCents);
      const minIncrementCents = BigInt(input.minIncrementCents);
      const genesis = genesisHash(auditKey, { id, startsAt, startingBidCents, minIncrementCents });
      const seal = sealHash(auditKey, id, 0, genesis);

      try {
        const row = await db.lot.create({
          data: {
            id,
            title: input.title,
            searchText: buildSearchText(input.title, car.brand, car.model, car.year),
            startingBidCents,
            minIncrementCents,
            startsAt,
            endsAt,
            originalEndsAt: endsAt,
            lastHash: genesis,
            seal,
            createdAt: now,
            auctioneer: { connect: { id: auctioneerId } },
            item: {
              create: {
                source: "FIPE",
                externalId: `${car.codeFipe}-${input.yearId}`,
                brand: car.brand,
                model: car.model,
                year: car.year,
                fuel: car.fuel,
                referencePriceCents: BigInt(car.referencePriceCents),
                referenceMonth: car.referenceMonth,
                imageData: image ? new Uint8Array(image.data) : null,
                imageMime: image?.mime ?? null,
                imageCredit: creditKept ? (input.imageCredit ?? null) : null,
                imageCreditUrl: creditKept ? (input.imageCreditUrl ?? null) : null,
                rawData: (detail.raw ?? {}) as Prisma.InputJsonValue,
                fetchedAt: detail.fetchedAt,
              },
            },
          },
          select: LOT_SELECT,
        });
        return { ...toLotState(row, clock.now()), imageStatus };
      } catch (err) {
        // Leiloeiro apagado com token ainda válido.
        if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2025" || err.code === "P2003")) {
          throw new AppError("UNAUTHENTICATED", undefined, AUTH_TEXT.unauthenticated);
        }
        throw err;
      }
    },

    /** Vitrine (R-2.11, R-2.13): nunca cancelados; ao vivo, agendados e encerrados, cada grupo na sua ordem. */
    async listLots(query: LotListQuery): Promise<LotListResponse> {
      const now = clock.now();
      const groups = {
        LIVE: { startsAt: { lte: now }, OR: [{ endsAt: { gt: now } }, { settledAt: null }] },
        SCHEDULED: { startsAt: { gt: now } },
        ENDED: { endsAt: { lte: now }, settledAt: { not: null } },
      } satisfies Record<string, Prisma.LotWhereInput>;
      const notCancelled = { cancelledAt: null } satisfies Prisma.LotWhereInput;

      const brandRows = await db.item.findMany({
        where: { lots: { some: notCancelled } },
        select: { brand: true },
        distinct: ["brand"],
      });
      const byKey = new Map<string, string>();
      for (const { brand } of brandRows) if (!byKey.has(normalizeSearch(brand))) byKey.set(normalizeSearch(brand), brand);
      const brands = [...byKey.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));

      const [live, scheduled, ended] = await Promise.all([
        db.lot.count({ where: { ...notCancelled, ...groups.LIVE } }),
        db.lot.count({ where: { ...notCancelled, ...groups.SCHEDULED } }),
        db.lot.count({ where: { ...notCancelled, ...groups.ENDED } }),
      ]);
      const counts = { live, scheduled, ended };

      const filters: Prisma.LotWhereInput[] = [notCancelled];
      for (const term of searchTerms(query.q)) filters.push({ searchText: { contains: term } });
      if (query.brand !== undefined && query.brand.trim() !== "") {
        const wanted = normalizeSearch(query.brand);
        const stored = brandRows.map((row) => row.brand).filter((brand) => normalizeSearch(brand) === wanted);
        if (stored.length === 0) return { lots: [], brands, counts, serverTime: now.toISOString() };
        filters.push({ item: { brand: { in: stored } } });
      }

      const order = {
        LIVE: [{ endsAt: "asc" }, { number: "asc" }],
        SCHEDULED: [{ startsAt: "asc" }, { number: "asc" }],
        ENDED: [{ endsAt: "desc" }, { number: "desc" }],
      } satisfies Record<string, Prisma.LotOrderByWithRelationInput[]>;
      const wanted = query.status ? [query.status] : (["LIVE", "SCHEDULED", "ENDED"] as const);
      const rows: LotRow[] = [];
      for (const group of wanted) {
        if (rows.length >= SHOWCASE_LIMIT) break;
        rows.push(
          ...(await db.lot.findMany({
            where: { AND: [...filters, groups[group]] },
            orderBy: order[group],
            take: SHOWCASE_LIMIT - rows.length,
            select: LOT_SELECT,
          })),
        );
      }
      return { lots: rows.map((row) => toLotCard(row, now)), brands, counts, serverTime: now.toISOString() };
    },

    /** Estado do lote, inclusive agendado e cancelado (R-2.11). Id inexistente ou malformado: 404. */
    async getLotState(id: string): Promise<LotState> {
      const row = await findState(id);
      if (!row) throw lotNotFound();
      return toLotState(row, clock.now());
    },

    /** Lotes do leiloeiro, cancelados no fim (R-2.11). `totalReceivedCents` é 0 até a S05. */
    async myLots(auctioneerId: string): Promise<MyLotsResponse> {
      const now = clock.now();
      const rows = await db.lot.findMany({
        where: { auctioneerId },
        orderBy: { number: "desc" },
        take: MY_LOTS_LIMIT,
        select: LOT_SELECT,
      });
      const rank: Record<LotStatus, number> = { LIVE: 0, CLOSING: 0, SCHEDULED: 1, SOLD: 2, UNSOLD: 2, CANCELLED: 3 };
      const key = (row: LotRow, status: LotStatus) => {
        const t = (date: Date | null) => date?.getTime() ?? 0;
        if (rank[status] === 0) return t(row.endsAt);
        if (rank[status] === 1) return t(row.startsAt);
        if (rank[status] === 2) return -t(row.endsAt);
        return -t(row.cancelledAt);
      };
      const sorted = rows
        .map((row) => ({ row, status: lotStatus(row, now) }))
        .sort((a, b) => rank[a.status] - rank[b.status] || key(a.row, a.status) - key(b.row, b.status));
      return { lots: sorted.map(({ row }) => toLotCard(row, now)), totalReceivedCents: 0, serverTime: now.toISOString() };
    },

    /** Bytes da imagem do item. Único lugar que lê `Item.imageData`. */
    async getItemImage(itemId: string): Promise<{ data: Buffer; mime: string; etag: string }> {
      const item = await db.item.findUnique({ where: { id: itemId }, select: { imageData: true, imageMime: true } });
      if (!item?.imageData || !item.imageMime) throw new AppError("NOT_FOUND", undefined, "Imagem não encontrada.");
      const data = Buffer.from(item.imageData);
      const etag = `"${createHash("sha256").update(data).digest("hex").slice(0, 32)}"`;
      return { data, mime: item.imageMime, etag };
    },
  };
}

export type LotService = ReturnType<typeof makeLotService>;
