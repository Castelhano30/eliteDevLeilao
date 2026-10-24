import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { cleanBrand, formatLotNumber, type CatalogOption } from "@lanceauto/shared";
import { toDate, type Clock } from "../infra/clock";
import { carNotFound, type CatalogPort } from "../infra/fipe";
import type { DownloadedImage } from "../infra/image-store";
import { makeBidService } from "../services/bid.service";
import { makeLotService } from "../services/lot.service";

/** Um carro do `prisma/fipe-fixture.json`, no formato do detalhe normalizado da FIPE (S8: sem rede). */
export interface FixtureCar {
  key: string;
  brandId: string;
  modelId: string;
  yearId: string;
  brandName: string;
  modelName: string;
  year: number;
  fuel: string;
  codeFipe: string;
  priceCents: number;
  referenceMonth: string;
  /** Caminho relativo a `prisma/` (ex. "seed-images/uno.jpg") ou `null` para a ilustração padrão. */
  image: string | null;
  imageCredit: string | null;
  imageCreditUrl: string | null;
}

/** `CatalogPort` servido pelo fixture: o seed cria lotes pelo mesmo `createLot` da API, sem chamar a FIPE. */
export function makeFixtureCatalog(cars: FixtureCar[], clock: Clock): CatalogPort {
  const unique = <T extends CatalogOption>(items: T[]) => [...new Map(items.map((item) => [item.id, item])).values()];
  return {
    async brands() {
      return unique(cars.map((car) => ({ id: car.brandId, name: cleanBrand(car.brandName) })));
    },
    async models(brandId) {
      return unique(cars.filter((car) => car.brandId === brandId).map((car) => ({ id: car.modelId, name: car.modelName })));
    },
    async years(brandId, modelId) {
      return cars
        .filter((car) => car.brandId === brandId && car.modelId === modelId)
        .map((car) => ({ id: car.yearId, name: `${car.year} ${car.fuel}` }));
    },
    async detail(brandId, modelId, yearId) {
      const car = cars.find((c) => c.brandId === brandId && c.modelId === modelId && c.yearId === yearId);
      if (!car) throw carNotFound();
      return {
        car: {
          brand: cleanBrand(car.brandName),
          model: car.modelName,
          year: car.year,
          fuel: car.fuel,
          referencePriceCents: car.priceCents,
          referenceMonth: car.referenceMonth,
          codeFipe: car.codeFipe,
        },
        raw: { ...car, source: "fipe-fixture.json" },
        fetchedAt: clock.now(),
      };
    },
  };
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function readFixtureImage(baseDir: string, car: FixtureCar): Promise<DownloadedImage | null> {
  if (!car.image) return null;
  const mime = MIME_BY_EXTENSION[path.extname(car.image).toLowerCase()];
  if (!mime) return null;
  return { data: await readFile(path.join(baseDir, car.image)), mime };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Lotes PROVISÓRIOS da S02: a S09 reescreve o seed final (001 arrematado … 005 ao vivo). */
const PLAN = {
  live: { key: "uno-2010", title: "Fiat Uno Mille Way 2010", startsIn: -HOUR, endsIn: 30 * DAY, startingBidCents: 1_500_000, minIncrementCents: 50_000 },
  scheduled: { key: "corolla-2015", title: "Toyota Corolla XEi 2015", startsIn: 2 * DAY, endsIn: 3 * DAY, startingBidCents: 6_000_000, minIncrementCents: 100_000 },
} as const;

export interface SeedShowcaseDeps {
  db: PrismaClient;
  clock: Clock;
  auditKey: string;
  auctioneerId: string;
  cars: FixtureCar[];
  /** Pasta de onde saem as imagens do fixture (`prisma/`). */
  baseDir: string;
  log?: (message: string) => void;
}

/**
 * Cria os lotes de demonstração pelo `createLot` (genesis e selo válidos), com `allowPast` (T11).
 * `demo: false` (seed normal) só cria se ainda não houver lote nenhum: seguro a cada deploy.
 * `demo: true` (`npm run seed:demo`) cria um lote ao vivo novo, com datas relativas a agora.
 */
export async function seedShowcaseLots(deps: SeedShowcaseDeps, { demo = false } = {}): Promise<number[]> {
  const { db, clock, auditKey, auctioneerId, cars, baseDir, log = () => undefined } = deps;
  if (!demo && (await db.lot.count()) > 0) {
    log("Já existem lotes: o seed não cria os de demonstração.");
    return [];
  }
  const lots = makeLotService({
    db,
    clock,
    auditKey,
    catalog: makeFixtureCatalog(cars, clock),
    images: { suggest: async () => ({ status: "NOT_FOUND" }) },
    imageStore: { download: async () => null },
  });
  const plans = demo ? [PLAN.live] : [PLAN.live, PLAN.scheduled];
  const numbers: number[] = [];
  for (const plan of plans) {
    const car = cars.find((c) => c.key === plan.key);
    if (!car) throw new Error(`fipe-fixture.json sem o carro ${plan.key}`);
    const now = clock.now().getTime();
    const created = await lots.createLot(
      auctioneerId,
      {
        brandId: car.brandId,
        modelId: car.modelId,
        yearId: car.yearId,
        title: plan.title,
        startingBidCents: plan.startingBidCents,
        minIncrementCents: plan.minIncrementCents,
        startsAt: toDate(now + plan.startsIn).toISOString(),
        endsAt: toDate(now + plan.endsIn).toISOString(),
        imageCredit: car.imageCredit ?? undefined,
        imageCreditUrl: car.imageCreditUrl ?? undefined,
      },
      { allowPast: true, image: await readFixtureImage(baseDir, car) },
    );
    numbers.push(created.lot.number);
    log(`Lote ${formatLotNumber(created.lot.number)} criado: ${plan.title} (${created.lot.status})`);
  }
  return numbers;
}

export interface SeedLiveBidsDeps {
  db: PrismaClient;
  clock: Clock;
  auditKey: string;
  /** E-mails na ordem dos lances: o primeiro abre, o último termina liderando. */
  bidderEmails: readonly string[];
  log?: (message: string) => void;
}

/** Quantos lances o seed dá no lote ao vivo: alternados entre os dois licitantes, o segundo termina na frente. */
const SEED_BID_COUNT = 5;

/**
 * Dá 5 lances alternados no lote ao vivo do plano, pelo mesmo `placeBid` da API (a cadeia nasce válida).
 * Idempotente: só age se o lote existir, estiver ao vivo e ainda não tiver lance, o que também o faz chegar a um banco
 * já populado (o seed dos lotes só roda com o banco vazio). Recusa de lance aborta o seed com a mensagem do servidor.
 */
export async function seedLiveBids(deps: SeedLiveBidsDeps): Promise<number> {
  const { db, clock, auditKey, bidderEmails, log = () => undefined } = deps;
  const lot = await db.lot.findFirst({ where: { title: PLAN.live.title }, orderBy: { number: "asc" } });
  if (!lot) {
    log(`Sem o lote "${PLAN.live.title}": o seed não dá lances.`);
    return 0;
  }
  if (lot.bidCount > 0) {
    log(`O lote ${formatLotNumber(lot.number)} já tem lances: o seed não repete.`);
    return 0;
  }
  const users = await db.user.findMany({ where: { email: { in: [...bidderEmails] } }, select: { id: true, email: true } });
  const idByEmail = new Map(users.map((user) => [user.email, user.id]));
  const bids = makeBidService({ db, clock, auditKey });
  let expected: number | null = null;
  let amount = Number(lot.startingBidCents);
  for (let index = 0; index < SEED_BID_COUNT; index++) {
    const email = bidderEmails[index % bidderEmails.length]!;
    const userId = idByEmail.get(email);
    if (!userId) throw new Error(`Seed de lances: a conta ${email} não existe.`);
    try {
      await bids.placeBid(userId, "BIDDER", lot.id, { amountCents: amount, expectedCurrentCents: expected });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Seed de lances: ${email} deu ${amount} centavos no lote ${lot.number} e foi recusado (${reason}).`);
    }
    expected = amount;
    amount += Number(lot.minIncrementCents);
  }
  log(`Lote ${formatLotNumber(lot.number)}: ${SEED_BID_COUNT} lances registrados pelo placeBid.`);
  return SEED_BID_COUNT;
}
