import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  AUTH_TEXT,
  EVENTS,
  LOT_TEXT,
  buildSearchText,
  lotDateErrors,
  lotStatus,
  normalizeSearch,
  searchTerms,
  type CreateLotInput,
  type CreateLotResponse,
  type DomainEvent,
  type LotListQuery,
  type LotListResponse,
  type LotState,
  type LotStatus,
  type MyLotsResponse,
  type Role,
  type StoredImageStatus,
} from "@lanceauto/shared";
import { genesisHash, sealHash } from "../domain/audit-chain";
import { pseudonymFor } from "../domain/pseudonym";
import { rankFrom } from "../domain/rank";
import { AppError } from "../errors";
import { toDate, type Clock } from "../infra/clock";
import type { CatalogPort } from "../infra/fipe";
import type { DownloadedImage, ImageDownloader } from "../infra/image-store";
import type { Logger } from "../infra/logger";
import type { ImageSuggestionPort } from "../infra/wikipedia";
import { SHOWCASE_ROOM } from "../socket";
import {
  LOT_SELECT,
  summarizeBids,
  toLotCard,
  toLotResult,
  toLotState,
  toMyLotCard,
  type LotRow,
  type LotStateExtras,
} from "./lot-mappers";
import { toNumber } from "./mappers";

export interface CreateLotResult {
  response: CreateLotResponse;
  /** Entregues ao `Publisher` pela rota, só depois do commit (INV-4). */
  events: DomainEvent[];
}

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
const imageNotFound = () => new AppError("NOT_FOUND", undefined, "Imagem não encontrada.");

/** O crédito tem a cara do que a Wikipedia sugere? */
const looksLikeWikiCredit = (credit: string) => credit.startsWith("Foto: Wikipedia");

export function makeLotService({ db, clock, auditKey, catalog, images, imageStore, logger }: LotServiceDeps) {
  /**
   * Crédito gravado. Crédito com cara de Wikipedia só vale se a URL for a sugerida para o carro, e aí o texto e o
   * link gravados são os da sugestão, nunca os do corpo (evita atribuição falsa e link de crédito arbitrário).
   * Sem confirmação (imagem trocada, Wikipedia fora), o crédito é limpo.
   */
  async function resolveCredit(input: CreateLotInput, brand: string, model: string) {
    if (!input.imageCredit || !looksLikeWikiCredit(input.imageCredit)) {
      return { credit: input.imageCredit ?? null, creditUrl: input.imageCreditUrl ?? null };
    }
    try {
      const suggestion = await images.suggest(brand, model);
      if (suggestion.status === "FOUND" && suggestion.image.url === input.imageUrl) {
        return { credit: suggestion.image.credit, creditUrl: suggestion.image.creditUrl };
      }
    } catch {
      // sem confirmação: limpa
    }
    return { credit: null, creditUrl: null };
  }

  async function findState(id: string): Promise<LotRow | null> {
    return db.lot.findUnique({ where: { id }, select: LOT_SELECT });
  }

  return {
    /**
     * Cria o lote (R-2.3 a R-2.8): detalhe da FIPE de novo (via cache), download da imagem fora da transação,
     * e uma inserção de `Item` + `Lot` com genesis e selo. Nenhuma chamada externa dentro da transação.
     */
    async createLot(auctioneerId: string, input: CreateLotInput, options: CreateLotOptions = {}): Promise<CreateLotResult> {
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
      const noCredit = { credit: null, creditUrl: null };
      const { credit, creditUrl } =
        image === null
          ? noCredit
          : options.image !== undefined
            ? { credit: input.imageCredit ?? null, creditUrl: input.imageCreditUrl ?? null }
            : await resolveCredit(input, car.brand, car.model);

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
                imageCredit: credit,
                imageCreditUrl: creditUrl,
                rawData: (detail.raw ?? {}) as Prisma.InputJsonValue,
                fetchedAt: detail.fetchedAt,
              },
            },
          },
          select: LOT_SELECT,
        });
        const created = clock.now();
        return {
          response: { ...toLotState(row, created), imageStatus },
          // A Vitrine ao vivo: o cartão do lote novo, para quem está na sala `showcase` (INV-4, só depois do commit).
          events: [{ type: EVENTS.SHOWCASE_LOT, room: SHOWCASE_ROOM, payload: toLotCard(row, created) }],
        };
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

    /**
     * Estado do lote, inclusive agendado e cancelado (R-2.11). Id inexistente ou malformado: 404.
     * Lê o lote primeiro e os lances com `seq <= entryCount` desse mesmo instante: o lance atual nunca aparece sem a
     * sua linha no histórico (AC-3.43), porque lote e lance são gravados na mesma transação.
     * `viewer` (token válido) só muda a posição pessoal; `BIDDER` recebe pseudônimo, posição e melhor lance.
     */
    async getLotState(id: string, viewer?: { id: string; role: Role }): Promise<LotState> {
      const row = await findState(id);
      if (!row) throw lotNotFound();
      const now = clock.now();
      const bidRows = await db.bid.findMany({
        where: { lotId: id, kind: "BID", seq: { lte: row.entryCount } },
        orderBy: { seq: "desc" },
        select: { seq: true, kind: true, pseudonym: true, amountCents: true, at: true, bidderId: true },
      });
      const { bids, bestByBidder } = summarizeBids(bidRows);
      // O comprovante só existe para lote arrematado; o token só sai para o vencedor logado (T9).
      const receipt =
        row.settledAt !== null && row.cancelledAt === null && row.bidCount > 0
          ? await db.receipt.findUnique({ where: { lotId: id }, select: { winnerId: true, token: true, pseudonym: true } })
          : null;
      const isBidder = viewer?.role === "BIDDER";
      const position = isBidder ? rankFrom(bestByBidder, viewer.id) : null;
      const extras: LotStateExtras = {
        bids,
        bidderCount: bestByBidder.size,
        myPseudonym: isBidder ? pseudonymFor(auditKey, viewer.id, id) : null,
        myRank: position?.rank ?? null,
        myBestBidCents: position?.myBestBidCents ?? null,
        result: toLotResult(row, receipt?.pseudonym ?? null),
        myReceiptToken: receipt !== null && viewer !== undefined && receipt.winnerId === viewer.id ? receipt.token : null,
      };
      return toLotState(row, now, extras);
    },

    /**
     * Lotes do leiloeiro, cancelados no fim (R-2.11). Cada encerrado traz o `resultado`; `totalReceivedCents` é a
     * soma dos `SALE_CREDIT` dele (R-5.8): lote cancelado ou sem lances não entra.
     */
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
      const soldIds = sorted.filter(({ status }) => status === "SOLD").map(({ row }) => row.id);
      const receipts = await db.receipt.findMany({ where: { lotId: { in: soldIds } }, select: { lotId: true, pseudonym: true } });
      const pseudonymByLot = new Map(receipts.map((receipt) => [receipt.lotId, receipt.pseudonym]));
      const received = await db.ledgerEntry.aggregate({
        where: { userId: auctioneerId, kind: "SALE_CREDIT" },
        _sum: { amountCents: true },
      });
      return {
        lots: sorted.map(({ row }) => toMyLotCard(row, now, pseudonymByLot.get(row.id) ?? null)),
        totalReceivedCents: toNumber(received._sum.amountCents ?? 0n),
        serverTime: now.toISOString(),
      };
    },

    /**
     * Metadados da imagem do item, sem ler o blob. O snapshot é imutável, então o ETag sai do próprio id
     * e a revalidação (304) nunca toca em `imageData`.
     */
    async getItemImageMeta(itemId: string): Promise<{ mime: string; etag: string }> {
      const item = await db.item.findUnique({ where: { id: itemId }, select: { imageMime: true } });
      if (!item?.imageMime) throw imageNotFound();
      return { mime: item.imageMime, etag: `"img-${itemId}"` };
    },

    /** Bytes da imagem do item. Único lugar que lê `Item.imageData`. */
    async getItemImageData(itemId: string): Promise<Buffer> {
      const item = await db.item.findUnique({ where: { id: itemId }, select: { imageData: true } });
      if (!item?.imageData) throw imageNotFound();
      return Buffer.from(item.imageData);
    },
  };
}

export type LotService = ReturnType<typeof makeLotService>;
