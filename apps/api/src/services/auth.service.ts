import bcrypt from "bcryptjs";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  AUTH_TEXT,
  type AuthResponse,
  type LoginInput,
  type MeResponse,
  type RegisterInput,
} from "@lanceauto/shared";
import { signToken } from "../auth/token";
import { AppError } from "../errors";
import type { Clock } from "../infra/clock";
import { toUserDto, toWalletDto } from "./mappers";

const BCRYPT_COST = 10;

export interface AuthServiceDeps {
  db: PrismaClient;
  clock: Clock;
  jwtSecret: string;
}

export function makeAuthService({ db, clock, jwtSecret }: AuthServiceDeps) {
  // Hash de uma senha que ninguém tem: login de e-mail inexistente gasta o mesmo bcrypt (R-1.14).
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = () => (dummyHash ??= bcrypt.hash("senha-que-ninguem-tem", BCRYPT_COST));

  return {
    /** Cria User e Wallet zerada na mesma transação e já devolve o token (R-1.4, R-1.5). */
    async register(input: RegisterInput): Promise<AuthResponse> {
      const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
      try {
        const user = await db.user.create({
          data: {
            name: input.name,
            email: input.email,
            passwordHash,
            role: input.role,
            createdAt: clock.now(),
            wallet: { create: {} },
          },
        });
        return { token: signToken(jwtSecret, user), user: toUserDto(user) };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new AppError("EMAIL_TAKEN", { fields: { email: AUTH_TEXT.emailTaken } }, AUTH_TEXT.emailTaken);
        }
        throw err;
      }
    },

    async login(input: LoginInput): Promise<AuthResponse> {
      const user = await db.user.findUnique({ where: { email: input.email } });
      const ok = await bcrypt.compare(input.password, user?.passwordHash ?? (await getDummyHash()));
      if (!user || !ok) throw new AppError("INVALID_CREDENTIALS", undefined, AUTH_TEXT.invalidCredentials);
      return { token: signToken(jwtSecret, user), user: toUserDto(user) };
    },

    /** Usuário e carteira do token; `sub` órfão (banco recriado) é 401 (R-1.6). */
    async me(userId: string): Promise<MeResponse> {
      const user = await db.user.findUnique({ where: { id: userId }, include: { wallet: true } });
      if (!user?.wallet) throw new AppError("UNAUTHENTICATED", undefined, AUTH_TEXT.unauthenticated);
      return { user: toUserDto(user), wallet: toWalletDto(user.wallet) };
    },
  };
}

export type AuthService = ReturnType<typeof makeAuthService>;
