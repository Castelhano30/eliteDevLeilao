import { Router } from "express";
import type { Db } from "../infra/prisma";

export function healthRouter(db: Db): Router {
  const router = Router();

  router.get("/health", async (req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: true });
    } catch (err) {
      req.log.error({ err }, "banco indisponível no /health");
      res.status(503).json({ ok: false, db: false });
    }
  });

  return router;
}
