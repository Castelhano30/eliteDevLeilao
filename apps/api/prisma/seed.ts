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

/**
 * Cria as contas de teste pelos services da aplicação, nunca por SQL direto.
 * Confere cada conta pelo e-mail: cria só as que faltam, então rodar de novo não duplica nada
 * e uma conta cadastrada antes do seed (ex.: um smoke em produção) não o impede de rodar.
 */
async function main() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET ausente: o seed usa os mesmos services da API.");

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
