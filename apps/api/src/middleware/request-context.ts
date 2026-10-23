import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { Logger } from "../infra/logger";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
    }
  }
}

/** Dá a cada requisição um `requestId` (também no header `X-Request-Id`) e um logger filho. */
export function requestContext(logger: Logger): RequestHandler {
  return (req, res, next) => {
    req.id = randomUUID();
    req.log = logger.child({ requestId: req.id });
    res.setHeader("X-Request-Id", req.id);
    next();
  };
}
