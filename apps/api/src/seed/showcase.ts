import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { cleanBrand, formatLotNumber, type CatalogOption } from "@lanceauto/shared";
import { FakeClock, toDate, type Clock } from "../infra/clock";
import { carNotFound, type CatalogPort } from "../infra/fipe";
import type { DownloadedImage } from "../infra/image-store";
import { makeBidService } from "../services/bid.service";
import { makeCancelService } from "../services/cancel.service";
import { makeLotService } from "../services/lot.service";
import { makeSettlementService } from "../services/settlement.service";

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
    numbers.push(created.response.lot.number);
    log(`Lote ${formatLotNumber(created.response.lot.number)} criado: ${plan.title} (${created.response.lot.status})`);
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
  // Lote cancelado ou vencido recusaria o lance e derrubaria o seed: pula com aviso (deferred-work da S03).
  if (lot.cancelledAt !== null) {
    log(`O lote ${formatLotNumber(lot.number)} foi cancelado: o seed não dá lances.`);
    return 0;
  }
  if (lot.endsAt.getTime() <= clock.now().getTime()) {
    log(`O lote ${formatLotNumber(lot.number)} já encerrou: o seed não dá lances.`);
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

const MINUTE = 60_000;

/** Lotes já encerrados do seed (S05 §11): um arrematado, com prorrogação, e um sem lances. */
const CLOSED = {
  sold: { key: "civic-2012", title: "Honda Civic LXS 2012", daysAgo: 3, startingBidCents: 5_000_000, minIncrementCents: 250_000 },
  unsold: { key: "gol-gti-1996", title: "Volkswagen Gol GTI 1996", daysAgo: 2, startingBidCents: 4_000_000, minIncrementCents: 100_000 },
} as const;

export interface SeedClosedLotsDeps {
  db: PrismaClient;
  /** Relógio de verdade: o seed recua um `FakeClock` a partir dele. */
  clock: Clock;
  auditKey: string;
  auctioneerId: string;
  cars: FixtureCar[];
  baseDir: string;
  /** O rival abre e cobre os lances; o vencedor dá o último, dentro dos 2 minutos finais (prorroga). */
  rivalEmail: string;
  winnerEmail: string;
  log?: (message: string) => void;
}

export interface SeedClosedLotsResult {
  created: number;
  /** Caminho do comprovante de demonstração (`/c/{token}`) do lote arrematado, se existir. */
  receiptPath: string | null;
}

/**
 * Cria os lotes encerrados pelos MESMOS services da aplicação (create lot, bid, settle) com um `FakeClock` no
 * passado, nunca por insert direto: a cadeia HMAC nasce válida (PRD S9). Arrematado (3 dias atrás): 4 lances
 * alternados, o último a 40 s do fim, que prorroga em +2 min; depois o relógio passa do novo fim e `settleLot`
 * liquida. Sem lances (2 dias atrás): cria, avança o relógio e liquida como `UNSOLD`.
 * Retoma por título: valida o prefixo de lances gravado e completa as etapas pendentes.
 */
export async function seedClosedLots(deps: SeedClosedLotsDeps): Promise<SeedClosedLotsResult> {
  const { db, clock, auditKey, auctioneerId, cars, baseDir, log = () => undefined } = deps;
  const fake = new FakeClock(clock.now());
  const lots = makeLotService({
    db,
    clock: fake,
    auditKey,
    catalog: makeFixtureCatalog(cars, fake),
    images: { suggest: async () => ({ status: "NOT_FOUND" }) },
    imageStore: { download: async () => null },
  });
  const bids = makeBidService({ db, clock: fake, auditKey });
  const settlement = makeSettlementService({ db, clock: fake });
  const realNow = clock.now().getTime();
  let created = 0;

  async function createPast(plan: (typeof CLOSED)[keyof typeof CLOSED]) {
    const car = cars.find((c) => c.key === plan.key);
    if (!car) throw new Error(`fipe-fixture.json sem o carro ${plan.key}`);
    fake.set(toDate(realNow - plan.daysAgo * 24 * 60 * MINUTE));
    const start = fake.now().getTime();
    const { response } = await lots.createLot(
      auctioneerId,
      {
        brandId: car.brandId,
        modelId: car.modelId,
        yearId: car.yearId,
        title: plan.title,
        startingBidCents: plan.startingBidCents,
        minIncrementCents: plan.minIncrementCents,
        startsAt: toDate(start).toISOString(),
        endsAt: toDate(start + 60 * MINUTE).toISOString(),
        imageCredit: car.imageCredit ?? undefined,
        imageCreditUrl: car.imageCreditUrl ?? undefined,
      },
      { allowPast: true, image: await readFixtureImage(baseDir, car) },
    );
    created += 1;
    return { id: response.lot.id, number: response.lot.number, start };
  }

  async function receiptPathOf(lotId: string): Promise<string | null> {
    const receipt = await db.receipt.findUnique({ where: { lotId }, select: { token: true } });
    return receipt ? `/c/${receipt.token}` : null;
  }

  const existingSold = await db.lot.findFirst({ where: { title: CLOSED.sold.title }, select: { id: true, number: true, startsAt: true, bidCount: true, settledAt: true } });
  let receiptPath: string | null = null;
  if (existingSold?.settledAt) {
    receiptPath = await receiptPathOf(existingSold.id);
    if (!receiptPath) throw new Error(`Seed dos encerrados: lote ${existingSold.number} liquidado sem comprovante.`);
    log(`Lote ${formatLotNumber(existingSold.number)} (${CLOSED.sold.title}) já existe: o seed não refaz.`);
  } else {
    const users = await db.user.findMany({
      where: { email: { in: [deps.rivalEmail, deps.winnerEmail] } },
      select: { id: true, email: true },
    });
    const idOf = (email: string) => {
      const id = users.find((user) => user.email === email)?.id;
      if (!id) throw new Error(`Seed dos encerrados: a conta ${email} não existe.`);
      return id;
    };
    const rival = idOf(deps.rivalEmail);
    const winner = idOf(deps.winnerEmail);
    const plan = CLOSED.sold;
    const lot = existingSold
      ? { id: existingSold.id, number: existingSold.number, start: existingSold.startsAt.getTime() }
      : await createPast(plan);
    const bid = async (userId: string, amountCents: number, expected: number | null, at: number) => {
      fake.set(toDate(at));
      try {
        await bids.placeBid(userId, "BIDDER", lot.id, { amountCents, expectedCurrentCents: expected });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Seed dos encerrados: lance de ${amountCents} centavos no lote ${lot.number} foi recusado (${reason}).`);
      }
    };
    const step = plan.minIncrementCents;
    const first = plan.startingBidCents;
    const planned = [
      { userId: rival, amount: first, expected: null, at: lot.start + 5 * MINUTE },
      { userId: winner, amount: first + step, expected: first, at: lot.start + 15 * MINUTE },
      { userId: rival, amount: first + 2 * step, expected: first + step, at: lot.start + 30 * MINUTE },
      // A 40 s do fim: prorroga em +2 min.
      { userId: winner, amount: first + 3 * step, expected: first + 2 * step, at: lot.start + 60 * MINUTE - 40_000 },
    ];
    const recorded = await db.bid.findMany({ where: { lotId: lot.id }, orderBy: { seq: "asc" }, select: { bidderId: true, amountCents: true } });
    if (recorded.length > planned.length || recorded.some((row, index) => row.bidderId !== planned[index]!.userId || Number(row.amountCents) !== planned[index]!.amount)) {
      throw new Error(`Seed dos encerrados: lances do lote ${lot.number} divergem do plano; revisão manual necessária.`);
    }
    for (const plannedBid of planned.slice(recorded.length)) {
      await bid(plannedBid.userId, plannedBid.amount, plannedBid.expected, plannedBid.at);
    }
    const extended = await db.lot.findUniqueOrThrow({ where: { id: lot.id }, select: { endsAt: true } });
    fake.set(toDate(extended.endsAt.getTime() + 1_000));
    const outcome = await settlement.settleLot(lot.id);
    if (outcome.result !== "SOLD") throw new Error(`Seed dos encerrados: o lote ${lot.number} não foi liquidado (${outcome.result}).`);
    receiptPath = await receiptPathOf(lot.id);
    log(`Lote ${formatLotNumber(lot.number)} arrematado: ${plan.title}.`);
  }

  const existingUnsold = await db.lot.findFirst({ where: { title: CLOSED.unsold.title }, select: { id: true, number: true, startsAt: true, settledAt: true, bidCount: true } });
  if (existingUnsold?.settledAt) {
    if (existingUnsold.bidCount !== 0) throw new Error(`Seed dos encerrados: lote ${existingUnsold.number} tem lances; revisão manual necessária.`);
    log(`Lote "${CLOSED.unsold.title}" já existe: o seed não refaz.`);
  } else {
    const lot = existingUnsold
      ? { id: existingUnsold.id, number: existingUnsold.number, start: existingUnsold.startsAt.getTime() }
      : await createPast(CLOSED.unsold);
    if (existingUnsold?.bidCount) throw new Error(`Seed dos encerrados: lote ${lot.number} tem lances; revisão manual necessária.`);
    fake.set(toDate(lot.start + 60 * MINUTE + 1_000));
    const outcome = await settlement.settleLot(lot.id);
    if (outcome.result !== "UNSOLD") throw new Error(`Seed dos encerrados: o lote ${lot.number} não fechou sem lances (${outcome.result}).`);
    log(`Lote ${formatLotNumber(lot.number)} encerrado sem lances: ${CLOSED.unsold.title}.`);
  }

  if (receiptPath) log(`Comprovante de demonstração: ${receiptPath}`);
  return { created, receiptPath };
}

/** Lote "cancelado de demonstração" (S06 §11): ao vivo há 2 h, dois lances, cancelado com estorno ao líder. */
const CANCELLED_DEMO = {
  key: "onix-2020",
  title: "Chevrolet Onix 2020",
  startingBidCents: 2_000_000,
  minIncrementCents: 50_000,
} as const;

export interface SeedCancelledLotDeps {
  db: PrismaClient;
  /** Relógio de verdade: o seed recua um `FakeClock` a partir dele. */
  clock: Clock;
  auditKey: string;
  auctioneerId: string;
  cars: FixtureCar[];
  baseDir: string;
  /** Licitante 1: abre com o lance inicial e é superado. */
  firstBidderEmail: string;
  /** Licitante 2: cobre, lidera e é o estornado no cancelamento. */
  leaderEmail: string;
  log?: (message: string) => void;
}

/**
 * Cria o lote cancelado pelos MESMOS services da aplicação (`createLot`, `placeBid`, `cancelLot`) com um `FakeClock`
 * em `agora − 2 h`: lance de R$ 20.000,00 aos 20 min, de R$ 20.500,00 aos 30 min e cancelamento aos 60 min com
 * `confirmEntryCount = 2`. Termina com o estorno ao licitante 2 e a linha CANCEL `seq = 3` na cadeia; o comprometido
 * de cada carteira volta a ser só o que ela lidera em lote ao vivo. Retoma por título: completa lances e cancelamento.
 */
export async function seedCancelledLot(deps: SeedCancelledLotDeps): Promise<{ created: number }> {
  const { db, clock, auditKey, auctioneerId, cars, baseDir, log = () => undefined } = deps;
  const plan = CANCELLED_DEMO;
  const existing = await db.lot.findFirst({
    where: { title: plan.title },
    select: { id: true, number: true, startsAt: true, cancelledAt: true },
  });
  if (existing?.cancelledAt) {
    log(`Lote ${formatLotNumber(existing.number)} (${plan.title}) já existe cancelado: o seed não refaz.`);
    return { created: 0 };
  }

  const users = await db.user.findMany({
    where: { email: { in: [deps.firstBidderEmail, deps.leaderEmail] } },
    select: { id: true, email: true },
  });
  const idOf = (email: string) => {
    const id = users.find((user) => user.email === email)?.id;
    if (!id) throw new Error(`Seed do cancelado: a conta ${email} não existe.`);
    return id;
  };
  const first = idOf(deps.firstBidderEmail);
  const leader = idOf(deps.leaderEmail);

  const fake = new FakeClock(clock.now());
  const start = existing ? existing.startsAt.getTime() : clock.now().getTime() - 2 * HOUR;
  let created = 0;
  let lot: { id: string; number: number };
  if (existing) {
    lot = { id: existing.id, number: existing.number };
  } else {
    const car = cars.find((c) => c.key === plan.key);
    if (!car) throw new Error(`fipe-fixture.json sem o carro ${plan.key}`);
    const lots = makeLotService({
      db,
      clock: fake,
      auditKey,
      catalog: makeFixtureCatalog(cars, fake),
      images: { suggest: async () => ({ status: "NOT_FOUND" }) },
      imageStore: { download: async () => null },
    });
    fake.set(toDate(start));
    const { response } = await lots.createLot(
      auctioneerId,
      {
        brandId: car.brandId,
        modelId: car.modelId,
        yearId: car.yearId,
        title: plan.title,
        startingBidCents: plan.startingBidCents,
        minIncrementCents: plan.minIncrementCents,
        startsAt: toDate(start).toISOString(),
        endsAt: toDate(start + 10 * DAY).toISOString(),
        imageCredit: car.imageCredit ?? undefined,
        imageCreditUrl: car.imageCreditUrl ?? undefined,
      },
      { allowPast: true, image: await readFixtureImage(baseDir, car) },
    );
    lot = { id: response.lot.id, number: response.lot.number };
    created = 1;
  }

  const bids = makeBidService({ db, clock: fake, auditKey });
  const planned = [
    { userId: first, amount: plan.startingBidCents, expected: null, at: start + 20 * MINUTE },
    { userId: leader, amount: plan.startingBidCents + plan.minIncrementCents, expected: plan.startingBidCents, at: start + 30 * MINUTE },
  ];
  const recorded = await db.bid.findMany({ where: { lotId: lot.id }, orderBy: { seq: "asc" }, select: { bidderId: true, amountCents: true } });
  if (recorded.length > planned.length || recorded.some((row, index) => row.bidderId !== planned[index]!.userId || Number(row.amountCents) !== planned[index]!.amount)) {
    throw new Error(`Seed do cancelado: lances do lote ${lot.number} divergem do plano; revisão manual necessária.`);
  }
  for (const next of planned.slice(recorded.length)) {
    fake.set(toDate(next.at));
    try {
      await bids.placeBid(next.userId, "BIDDER", lot.id, { amountCents: next.amount, expectedCurrentCents: next.expected });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Seed do cancelado: lance de ${next.amount} centavos no lote ${lot.number} foi recusado (${reason}).`);
    }
  }

  const cancel = makeCancelService({ db, clock: fake, auditKey });
  fake.set(toDate(start + 60 * MINUTE));
  await cancel.cancelLot(auctioneerId, lot.id, planned.length);
  log(`Lote ${formatLotNumber(lot.number)} cancelado: ${plan.title} (2 lances, estorno ao líder).`);
  return { created };
}
