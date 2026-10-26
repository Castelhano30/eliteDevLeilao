import { readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { SystemClock } from "../src/infra/clock";
import { seedCancelledLot, seedClosedLots, seedLiveBids, seedShowcaseLots, type FixtureCar } from "../src/seed/showcase";
import { makeAuthService } from "../src/services/auth.service";
import { makeWalletService } from "../src/services/wallet.service";

dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

const PASSWORD = "lance1234";
const AUCTIONEER_EMAIL = "leiloeiro@lanceauto.test";

const BRUNO_EMAIL = "bruno@lanceauto.test";
const ANA_EMAIL = "ana@lanceauto.test";
/** Ordem dos 5 lances do lote ao vivo: Bruno, Ana, Bruno, Ana, Bruno (o 2º licitante termina liderando). */
const BID_ORDER = [BRUNO_EMAIL, ANA_EMAIL] as const;

const USERS = [
  { name: "João Pátio", email: AUCTIONEER_EMAIL, role: "AUCTIONEER" as const, depositCents: 0 },
  { name: "Ana Souza", email: ANA_EMAIL, role: "BIDDER" as const, depositCents: 50_000_000 },
  { name: "Bruno Lima", email: BRUNO_EMAIL, role: "BIDDER" as const, depositCents: 30_000_000 },
];

/**
 * Cria as contas de teste, os lotes de demonstração, os 5 lances do lote ao vivo, os dois lotes encerrados e o lote cancelado pelos services da aplicação, nunca por SQL direto.
 * Contas: confere cada uma pelo e-mail e cria só as que faltam. Lotes: só se ainda não houver nenhum
 * (seguro a cada deploy). `--demo` (`npm run seed:demo`) cria um lote ao vivo novo, sem rede.
 */
async function main() {
  const jwtSecret = process.env.JWT_SECRET;
  const auditKey = process.env.AUDIT_HMAC_KEY;
  if (!jwtSecret) throw new Error("JWT_SECRET ausente: o seed usa os mesmos services da API.");
  if (!auditKey) throw new Error("AUDIT_HMAC_KEY ausente: os lotes nascem com genesis e selo.");
  const demo = process.argv.includes("--demo");

  const db = new PrismaClient();
  try {
    const clock = new SystemClock();
    const auth = makeAuthService({ db, clock, jwtSecret });
    const wallet = makeWalletService({ db, clock });
    for (const { depositCents, ...user } of USERS) {
      if (await db.user.findUnique({ where: { email: user.email } })) {
        console.log(`Já existe: ${user.email} (o seed não mexe nela)`);
        continue;
      }
      const { user: created } = await auth.register({ ...user, password: PASSWORD });
      // O seed não publica nada: ninguém está ouvindo, e os eventos do depósito são descartados.
      if (depositCents > 0) await wallet.deposit(created.id, depositCents);
      console.log(`Criado: ${user.email} (${user.role})`);
    }

    const auctioneer = await db.user.findUniqueOrThrow({ where: { email: AUCTIONEER_EMAIL } });
    const cars = JSON.parse(readFileSync(path.join(__dirname, "fipe-fixture.json"), "utf8")) as FixtureCar[];
    await seedShowcaseLots(
      { db, clock, auditKey, auctioneerId: auctioneer.id, cars, baseDir: __dirname, log: (message) => console.log(message) },
      { demo },
    );
    // Roda em todo deploy: chega a um banco já populado (o lote 001 existe, sem lances) e não repete (guarda por bidCount).
    await seedLiveBids({ db, clock, auditKey, bidderEmails: BID_ORDER, log: (message) => console.log(message) });
    // Lotes já encerrados (arrematado com prorrogação e sem lances), pelos services com relógio no passado. Também idempotente.
    await seedClosedLots({
      db,
      clock,
      auditKey,
      auctioneerId: auctioneer.id,
      cars,
      baseDir: __dirname,
      rivalEmail: BRUNO_EMAIL,
      winnerEmail: ANA_EMAIL,
      log: (message) => console.log(message),
    });
    // Lote cancelado de demonstração (dois lances, estorno ao líder e linha CANCEL), pelos mesmos services. Idempotente.
    await seedCancelledLot({
      db,
      clock,
      auditKey,
      auctioneerId: auctioneer.id,
      cars,
      baseDir: __dirname,
      firstBidderEmail: BRUNO_EMAIL,
      leaderEmail: ANA_EMAIL,
      log: (message) => console.log(message),
    });
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
