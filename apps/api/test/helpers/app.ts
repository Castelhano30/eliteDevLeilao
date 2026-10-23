import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createApp } from "../../src/app";
import { signToken } from "../../src/auth/token";
import { FakeClock } from "../../src/infra/clock";
import { createLogger } from "../../src/infra/logger";

export const TEST_JWT_SECRET = "t".repeat(32);

export const testEnv = {
  NODE_ENV: "test" as const,
  WEB_ORIGIN: "http://localhost:3000",
  JWT_SECRET: TEST_JWT_SECRET,
  AUTH_RATE_LIMIT_MAX: 30,
};

export function makeTestApp(prisma: PrismaClient, overrides: Partial<typeof testEnv> = {}) {
  const clock = new FakeClock("2026-10-23T12:00:00.000Z");
  const app = createApp({ env: { ...testEnv, ...overrides }, db: prisma, logger: createLogger("silent"), clock });
  return { app, clock };
}

export const validRegister = {
  name: "Ana Souza",
  email: "ana@lanceauto.test",
  password: "lance1234",
  role: "BIDDER" as "BIDDER" | "AUCTIONEER",
};

/** Cadastra pela API e devolve o usuário e o token. */
export async function registerUser(
  app: Parameters<typeof request>[0],
  overrides: Partial<typeof validRegister> = {},
) {
  const res = await request(app)
    .post("/auth/register")
    .send({ ...validRegister, ...overrides });
  if (res.status !== 201) throw new Error(`cadastro falhou: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { token: string; user: { id: string; email: string; role: "BIDDER" | "AUCTIONEER" } };
}

export function tokenFor(id: string, role: "BIDDER" | "AUCTIONEER") {
  return signToken(TEST_JWT_SECRET, { id, role });
}
