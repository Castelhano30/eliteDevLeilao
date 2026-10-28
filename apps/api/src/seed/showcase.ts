import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { cleanBrand, formatLotNumber, type CatalogOption } from "@lanceauto/shared";
import { FakeClock, toDate, type Clock } from "../infra/clock";
import { carNotFound, type CatalogPort } from "../infra/fipe";
import type { DownloadedImage } from "../infra/image-store";
import { makeAuthService } from "../services/auth.service";
import { makeBidService } from "../services/bid.service";
import { makeCancelService } from "../services/cancel.service";
import { makeLotService } from "../services/lot.service";
import { makeSettlementService } from "../services/settlement.service";
import { makeWalletService } from "../services/wallet.service";

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

export async function readFixtureImage(baseDir: string, car: FixtureCar): Promise<DownloadedImage | null> {
  if (!car.image) return null;
  const mime = MIME_BY_EXTENSION[path.extname(car.image).toLowerCase()];
  if (!mime) return null;
  return { data: await readFile(path.join(baseDir, car.image)), mime };
}

/** A imagem do fixture como lista de uma foto (a capa), ou lista vazia para a ilustração padrão. */
export async function readFixtureImages(baseDir: string, car: FixtureCar): Promise<DownloadedImage[]> {
  const image = await readFixtureImage(baseDir, car);
  return image ? [image] : [];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const SEED_PASSWORD = "lance1234";
export const SEED_SKIPPED_MESSAGE = "seed ignorado: já existem usuários";
/** Valor-base de `seed:demo`: Ana e Bruno ficam com pelo menos isto disponível antes dos lances (R-9.5). */
export const DEMO_BASE_CENTS = 10_000_000;

export const SEED_ACCOUNTS = {
  auctioneer: { name: "Seu João", email: "leiloeiro@lanceauto.test", role: "AUCTIONEER" as const, depositCents: 0 },
  ana: { name: "Ana", email: "ana@lanceauto.test", role: "BIDDER" as const, depositCents: 50_000_000 },
  bruno: { name: "Bruno", email: "bruno@lanceauto.test", role: "BIDDER" as const, depositCents: 30_000_000 },
};

/** Chave fixa do `pg_advisory_xact_lock`: um seed por vez, em qualquer processo. */
const ADVISORY_LOCK_KEY = 7_309_001;
/** O seed cria 3 contas (bcrypt) e cinco lotes: folga larga para a transação que segura o lock. */
const LOCK_TRANSACTION_MS = 300_000;

const TITLES: Record<string, string> = {
  "uno-2010": "Fiat Uno Mille Way 2010",
  "civic-2012": "Honda Civic LXS 2012",
  "corolla-2015": "Toyota Corolla XEi 2015",
  "hilux-2017": "Toyota Hilux CD SRV 2017",
  "gol-gti-1996": "Volkswagen Gol GTI 1996",
  "onix-2020": "Chevrolet Onix 2020",
  "hb20-2019": "Hyundai HB20 Comfort 2019",
};
const titleOf = (car: FixtureCar) => TITLES[car.key] ?? `${cleanBrand(car.brandName)} ${car.modelName} ${car.year}`;

/** Lotes passados e o agendado: valores fixos, coerentes com a referência FIPE de cada carro. */
const PLAN = {
  sold: { key: "civic-2012", daysAgo: 3, startingBidCents: 5_000_000, minIncrementCents: 250_000 },
  unsold: { key: "gol-gti-1996", daysAgo: 2, startingBidCents: 4_000_000, minIncrementCents: 100_000 },
  cancelled: { key: "onix-2020", startingBidCents: 2_000_000, minIncrementCents: 50_000 },
  scheduled: { key: "corolla-2015", startingBidCents: 6_000_000, minIncrementCents: 100_000 },
  live: { key: "uno-2010" },
} as const;

/** Quantos lances o lote ao vivo recebe: alternados, número ímpar, então quem abre termina na frente. */
const LIVE_BID_COUNT = 5;

export interface SeedDeps {
  db: PrismaClient;
  /** Relógio de verdade: o seed recua um `FakeClock` a partir dele para fabricar o passado. */
  clock: Clock;
  auditKey: string;
  jwtSecret: string;
  cars: FixtureCar[];
  /** Pasta de onde saem as imagens do fixture (`prisma/`). */
  baseDir: string;
  log?: (message: string) => void;
}

export interface SeedResult {
  skipped: boolean;
  /** Caminho do comprovante de demonstração (`/c/{token}`), quando o seed o criou. */
  receiptPath: string | null;
}

/** Roda `work` com o advisory lock: o segundo processo espera aqui e vê o banco já semeado. */
async function withSeedLock<T>(db: PrismaClient, work: () => Promise<T>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`;
      return work();
    },
    { maxWait: LOCK_TRANSACTION_MS, timeout: LOCK_TRANSACTION_MS },
  );
}

function lotServiceFor(deps: SeedDeps, clock: Clock) {
  // Sem rede: o catálogo é o fixture e nenhuma imagem é buscada nem baixada.
  return makeLotService({
    db: deps.db,
    clock,
    auditKey: deps.auditKey,
    catalog: makeFixtureCatalog(deps.cars, clock),
    images: { suggest: async () => ({ status: "NOT_FOUND" }) },
    imageStore: { download: async () => null },
  });
}

function carOf(deps: SeedDeps, key: string): FixtureCar {
  const car = deps.cars.find((c) => c.key === key);
  if (!car) throw new Error(`fipe-fixture.json sem o carro ${key}`);
  return car;
}

interface LotTerms {
  startingBidCents: number;
  minIncrementCents: number;
}

/** Lance inicial ≈ 60% da referência FIPE, arredondado a R$ 500; incremento R$ 500 (ou R$ 1.000 acima de R$ 30.000). */
export function liveLotTerms(referencePriceCents: number): LotTerms {
  const startingBidCents = Math.max(50_000, Math.round((referencePriceCents * 0.6) / 50_000) * 50_000);
  return { startingBidCents, minIncrementCents: startingBidCents < 3_000_000 ? 50_000 : 100_000 };
}

async function createLotAt(
  deps: SeedDeps,
  lots: ReturnType<typeof lotServiceFor>,
  auctioneerId: string,
  car: FixtureCar,
  terms: LotTerms,
  window: { startsAt: number; endsAt: number },
  allowPast: boolean,
) {
  const { response } = await lots.createLot(
    auctioneerId,
    {
      brandId: car.brandId,
      modelId: car.modelId,
      yearId: car.yearId,
      title: titleOf(car),
      startingBidCents: terms.startingBidCents,
      minIncrementCents: terms.minIncrementCents,
      startsAt: toDate(window.startsAt).toISOString(),
      endsAt: toDate(window.endsAt).toISOString(),
      imageCredit: car.imageCredit ?? undefined,
      imageCreditUrl: car.imageCreditUrl ?? undefined,
    },
    { allowPast, images: await readFixtureImages(deps.baseDir, car) },
  );
  return { id: response.lot.id, number: response.lot.number, title: response.lot.title };
}

/** Coloca o lance pelo `placeBid` da API; recusa aborta o seed com a mensagem do servidor. */
async function placeSeedBid(
  bids: ReturnType<typeof makeBidService>,
  lot: { id: string; number: number },
  bid: { userId: string; amountCents: number; expectedCurrentCents: number | null },
) {
  try {
    await bids.placeBid(bid.userId, "BIDDER", lot.id, { amountCents: bid.amountCents, expectedCurrentCents: bid.expectedCurrentCents });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Seed: lance de ${bid.amountCents} centavos no lote ${formatLotNumber(lot.number)} foi recusado (${reason}).`);
  }
}

interface Bidders {
  /** Abre o lote ao vivo e, com 5 lances alternados, termina na frente. */
  openerId: string;
  /** Cobre o primeiro e fica superado. */
  rivalId: string;
}

/** Deposita a diferença para o disponível chegar a `DEMO_BASE_CENTS` (entra no extrato como depósito). */
async function topUpToBase(deps: SeedDeps, userId: string): Promise<number> {
  const wallet = await deps.db.wallet.findUniqueOrThrow({ where: { userId } });
  const available = Number(wallet.totalCents - wallet.committedCents);
  if (available >= DEMO_BASE_CENTS) return 0;
  const missing = DEMO_BASE_CENTS - available;
  await makeWalletService({ db: deps.db, clock: deps.clock }).deposit(userId, missing);
  return missing;
}

/**
 * Lote ao vivo de demonstração: começa agora, fecha em 30 dias e recebe 5 lances de Ana e Bruno pelo `placeBid`
 * (Bruno abre e termina na frente, para a Ana entrar vendo "superado"). Compartilhada pelo lote 005 do seed
 * e pelo `seed:demo`. Antes dos lances, recompõe o saldo dos dois (R-9.5).
 */
export async function buildLiveDemoLot(
  deps: SeedDeps,
  { auctioneerId, bidders, car }: { auctioneerId: string; bidders: Bidders; car: FixtureCar },
) {
  for (const userId of [bidders.openerId, bidders.rivalId]) {
    const deposited = await topUpToBase(deps, userId);
    if (deposited > 0) deps.log?.(`Saldo recomposto: depósito de ${deposited} centavos.`);
  }
  const now = deps.clock.now().getTime();
  const terms = liveLotTerms(car.priceCents);
  const lot = await createLotAt(deps, lotServiceFor(deps, deps.clock), auctioneerId, car, terms, { startsAt: now, endsAt: now + 30 * DAY }, false);
  const bids = makeBidService({ db: deps.db, clock: deps.clock, auditKey: deps.auditKey });
  let expected: number | null = null;
  for (let index = 0; index < LIVE_BID_COUNT; index++) {
    const amountCents: number = terms.startingBidCents + index * terms.minIncrementCents;
    const userId = index % 2 === 0 ? bidders.openerId : bidders.rivalId;
    await placeSeedBid(bids, lot, { userId, amountCents, expectedCurrentCents: expected });
    expected = amountCents;
  }
  return lot;
}

/** Carros que cabem nos R$ 100.000 do valor-base com 5 lances (o último pesa `inicial + 4 × incremento`). */
function demoEligibleCars(cars: FixtureCar[]): FixtureCar[] {
  return cars.filter((car) => {
    const terms = liveLotTerms(car.priceCents);
    return terms.startingBidCents + (LIVE_BID_COUNT - 1) * terms.minIncrementCents <= DEMO_BASE_CENTS;
  });
}

async function accountIds(db: PrismaClient) {
  const users = await db.user.findMany({
    where: { email: { in: Object.values(SEED_ACCOUNTS).map((account) => account.email) } },
    select: { id: true, email: true },
  });
  const idOf = (email: string) => users.find((user) => user.email === email)?.id;
  return {
    auctioneerId: idOf(SEED_ACCOUNTS.auctioneer.email),
    anaId: idOf(SEED_ACCOUNTS.ana.email),
    brunoId: idOf(SEED_ACCOUNTS.bruno.email),
  };
}

/**
 * Seed final (S09 §11): 3 contas e 5 lotes, tudo pelos services da aplicação (nunca por SQL direto), com um
 * `FakeClock` para o passado. 001 arrematado pela Ana (4 lances, o último prorroga), 002 sem lances, 003 cancelado
 * (Bruno líder, estorno), 004 agendado, 005 ao vivo por 30 dias com 5 lances (Bruno na frente).
 * Seguro a cada deploy: com o lock, se já há usuários sai sem fazer nada (R-9.4). Nunca apaga dados.
 */
export async function runSeed(deps: SeedDeps): Promise<SeedResult> {
  const { db, log = () => undefined } = deps;
  return withSeedLock(db, async () => {
    if ((await db.user.count()) > 0) {
      log(SEED_SKIPPED_MESSAGE);
      return { skipped: true, receiptPath: null };
    }
    const realNow = deps.clock.now().getTime();
    // As contas e os depósitos nascem antes do primeiro lote (3 dias atrás): o extrato fica em ordem cronológica.
    const fake = new FakeClock(toDate(realNow - 4 * DAY));
    const auth = makeAuthService({ db, clock: fake, jwtSecret: deps.jwtSecret });
    const wallet = makeWalletService({ db, clock: fake });
    const ids = new Map<string, string>();
    for (const { depositCents, ...account } of Object.values(SEED_ACCOUNTS)) {
      const { user } = await auth.register({ ...account, password: SEED_PASSWORD });
      if (depositCents > 0) await wallet.deposit(user.id, depositCents);
      ids.set(account.email, user.id);
      log(`Criado: ${account.email} (${account.role})`);
    }
    const auctioneerId = ids.get(SEED_ACCOUNTS.auctioneer.email)!;
    const anaId = ids.get(SEED_ACCOUNTS.ana.email)!;
    const brunoId = ids.get(SEED_ACCOUNTS.bruno.email)!;

    const pastLots = lotServiceFor(deps, fake);
    const bids = makeBidService({ db, clock: fake, auditKey: deps.auditKey });
    const settlement = makeSettlementService({ db, clock: fake });
    const announce = (what: string, lot: { number: number; title: string }) => log(`Lote ${formatLotNumber(lot.number)} ${what}: ${lot.title}.`);
    const bidAll = async (lot: { id: string; number: number }, planned: { userId: string; amountCents: number; expectedCurrentCents: number | null; at: number }[]) => {
      for (const { at, ...bid } of planned) {
        fake.set(toDate(at));
        await placeSeedBid(bids, lot, bid);
      }
    };

    // 001: encerrado e arrematado pela Ana. O último lance cai a 40 s do fim e prorroga em +2 min.
    {
      const plan = PLAN.sold;
      const start = realNow - plan.daysAgo * DAY;
      fake.set(toDate(start));
      const lot = await createLotAt(deps, pastLots, auctioneerId, carOf(deps, plan.key), plan, { startsAt: start, endsAt: start + HOUR }, true);
      const first = plan.startingBidCents;
      const step = plan.minIncrementCents;
      await bidAll(lot, [
        { userId: brunoId, amountCents: first, expectedCurrentCents: null, at: start + 5 * MINUTE },
        { userId: anaId, amountCents: first + step, expectedCurrentCents: first, at: start + 15 * MINUTE },
        { userId: brunoId, amountCents: first + 2 * step, expectedCurrentCents: first + step, at: start + 30 * MINUTE },
        { userId: anaId, amountCents: first + 3 * step, expectedCurrentCents: first + 2 * step, at: start + HOUR - 40_000 },
      ]);
      const extended = await db.lot.findUniqueOrThrow({ where: { id: lot.id }, select: { endsAt: true } });
      fake.set(toDate(extended.endsAt.getTime() + 1_000));
      const outcome = await settlement.settleLot(lot.id);
      if (outcome.result !== "SOLD") throw new Error(`Seed: o lote ${formatLotNumber(lot.number)} não foi liquidado (${outcome.result}).`);
      announce("arrematado", lot);
    }

    // 002: encerrado sem lances.
    {
      const plan = PLAN.unsold;
      const start = realNow - plan.daysAgo * DAY;
      fake.set(toDate(start));
      const lot = await createLotAt(deps, pastLots, auctioneerId, carOf(deps, plan.key), plan, { startsAt: start, endsAt: start + HOUR }, true);
      fake.set(toDate(start + HOUR + 1_000));
      const outcome = await settlement.settleLot(lot.id);
      if (outcome.result !== "UNSOLD") throw new Error(`Seed: o lote ${formatLotNumber(lot.number)} não fechou sem lances (${outcome.result}).`);
      announce("encerrado sem lances", lot);
    }

    // 003: ao vivo há 2 h, a Ana abre, o Bruno cobre e lidera, e o leiloeiro cancela: estorno ao Bruno e linha CANCEL.
    {
      const plan = PLAN.cancelled;
      const start = realNow - 2 * HOUR;
      fake.set(toDate(start));
      const lot = await createLotAt(deps, pastLots, auctioneerId, carOf(deps, plan.key), plan, { startsAt: start, endsAt: start + 10 * DAY }, true);
      await bidAll(lot, [
        { userId: anaId, amountCents: plan.startingBidCents, expectedCurrentCents: null, at: start + 20 * MINUTE },
        { userId: brunoId, amountCents: plan.startingBidCents + plan.minIncrementCents, expectedCurrentCents: plan.startingBidCents, at: start + 30 * MINUTE },
      ]);
      fake.set(toDate(start + HOUR));
      await makeCancelService({ db, clock: fake, auditKey: deps.auditKey }).cancelLot(auctioneerId, lot.id, 2);
      announce("cancelado", lot);
    }

    // 004 e 005 usam o relógio de verdade e a validação normal de datas.
    {
      const plan = PLAN.scheduled;
      const start = deps.clock.now().getTime() + 2 * DAY;
      const lot = await createLotAt(deps, lotServiceFor(deps, deps.clock), auctioneerId, carOf(deps, plan.key), plan, { startsAt: start, endsAt: start + DAY }, false);
      announce("agendado", lot);
    }
    const live = await buildLiveDemoLot(deps, { auctioneerId, bidders: { openerId: brunoId, rivalId: anaId }, car: carOf(deps, PLAN.live.key) });
    announce("ao vivo", live);

    const sold = await db.receipt.findFirst({ orderBy: { issuedAt: "asc" }, select: { token: true } });
    const receiptPath = sold ? `/c/${sold.token}` : null;
    if (receiptPath) log(`Comprovante de demonstração: ${receiptPath}`);
    return { skipped: false, receiptPath };
  });
}

/**
 * `npm run seed:demo`: cria um lote ao vivo NOVO (30 dias, 5 lances de Ana e Bruno) sem tocar nos demais e recompõe o
 * saldo dos dois até o valor-base (R-9.5). Precisa das contas do seed.
 */
export async function runSeedDemo(deps: SeedDeps): Promise<{ id: string; number: number; title: string }> {
  const { db, log = () => undefined } = deps;
  return withSeedLock(db, async () => {
    const { auctioneerId, anaId, brunoId } = await accountIds(db);
    if (!auctioneerId || !anaId || !brunoId) throw new Error("As contas de teste não existem: rode `npm run seed` antes do seed:demo.");
    const eligible = demoEligibleCars(deps.cars);
    if (eligible.length === 0) throw new Error("fipe-fixture.json sem carro que caiba no valor-base do seed:demo.");
    const car = eligible[(await db.lot.count()) % eligible.length]!;
    const lot = await buildLiveDemoLot(deps, { auctioneerId, bidders: { openerId: brunoId, rivalId: anaId }, car });
    log(`Lote ${formatLotNumber(lot.number)} criado: ${lot.title} (ao vivo por 30 dias).`);
    return lot;
  });
}
