import type { RequestHandler } from "express";
import { AUTH_TEXT, ROLE_LABEL, type Role } from "@lanceauto/shared";
import { AppError } from "../errors";
import { verifyToken, type AuthUser } from "../auth/token";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Preenchido por `requireAuth` e, quando o token é válido, por `optionalAuth`. */
      user?: AuthUser;
    }
  }
}

function bearer(header: string | undefined): string | null {
  const match = /^Bearer (.+)$/.exec(header ?? "");
  return match?.[1] ?? null;
}

export interface AuthMiddleware {
  /** Exige token válido; sem ele, `UNAUTHENTICATED` 401. */
  requireAuth: RequestHandler;
  /** Exige o papel; deve vir depois de `requireAuth`. */
  requireRole(role: Role, message?: string): RequestHandler;
  /** Lê o token se existir e valer; ausente, inválido ou expirado vira visitante, sem 401 (R-1.11). */
  optionalAuth: RequestHandler;
}

export function makeAuth(jwtSecret: string): AuthMiddleware {
  const read = (header: string | undefined) => verifyToken(jwtSecret, bearer(header));

  return {
    requireAuth(req, _res, next) {
      const user = read(req.headers.authorization);
      if (!user) return next(new AppError("UNAUTHENTICATED", undefined, AUTH_TEXT.unauthenticated));
      req.user = user;
      next();
    },
    requireRole(role, message) {
      return (req, _res, next) => {
        if (!req.user) return next(new AppError("UNAUTHENTICATED", undefined, AUTH_TEXT.unauthenticated));
        if (req.user.role !== role) {
          return next(new AppError("ROLE_NOT_ALLOWED", undefined, message ?? `Essa ação é de ${ROLE_LABEL[role]}.`));
        }
        next();
      };
    },
    optionalAuth(req, _res, next) {
      const user = read(req.headers.authorization);
      if (user) req.user = user;
      next();
    },
  };
}
