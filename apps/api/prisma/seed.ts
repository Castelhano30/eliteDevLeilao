import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { SystemClock } from "../src/infra/clock";
import { makeAuthService } from "../src/services/auth.service";
import { makeWalletService } from "../src/services/wallet.service";

dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

const PASSWORD = "lance1234";

const USERS = [
  { name: "João Pátio", email: "leiloeiro@lanceauto.test", role: "AUCTIONEER" as const, depositCents: 0 },
  { name: "Ana Souza", email: "ana@lanceauto.test", role: "BIDDER" as const, depositCents: 50_000_000 },
  { name: "Bruno Lima", email: "bruno@lanceauto.test", role: "BIDDER" as const, depositCents: 30_000_000 },
];

/** Cria as contas de teste pelos services da aplicação, nunca por SQL direto. */
async function main() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET ausente: o seed usa os mesmos services da API.");

  const db = new PrismaClient();
  try {
    if ((await db.user.count()) > 0) {
      console.log("Já existem usuários neste banco: o seed não roda de novo.");
      return;
    }
    const clock = new SystemClock();
    const auth = makeAuthService({ db, clock, jwtSecret });
    const wallet = makeWalletService({ db, clock });
    for (const { depositCents, ...user } of USERS) {
      const { user: created } = await auth.register({ ...user, password: PASSWORD });
      if (depositCents > 0) await wallet.deposit(created.id, depositCents);
      console.log(`Criado: ${user.email} (${user.role})`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
