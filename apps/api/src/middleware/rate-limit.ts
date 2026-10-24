import rateLimit from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import { AppError } from "../errors";

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  /** Texto do envelope de `RATE_LIMITED`; sem ele vale o padrão. */
  message?: string;
}

/** `RATE_LIMIT_DISABLED=1` desliga todos os limitadores (usado nos testes). Lido a cada requisição. */
const isDisabled = () => process.env.RATE_LIMIT_DISABLED === "1";

/** Limitador reutilizável; estourado, responde `RATE_LIMITED` no envelope padrão. */
export function makeRateLimiter({ windowMs, max, keyGenerator, skip, message }: RateLimiterOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    skip: (req) => isDisabled() || (skip?.(req) ?? false),
    handler: (_req, _res, next) => next(new AppError("RATE_LIMITED", undefined, message)),
  });
}
