import { Router } from "express";
import type { AuthMiddleware } from "../middleware/auth";
import { makeRateLimiter } from "../middleware/rate-limit";
import type { AuditService } from "../services/audit.service";

/**
 * `GET /lots/:id/audit`: a auditoria pública (S08). Qualquer pessoa, sem login; o token é opcional e só serve para
 * marcar as linhas do próprio usuário. Recalcula HMAC a cada chamada, então limita a 60/min por IP (R-8.17; o IP
 * real vem do `trust proxy` em produção). Nunca vai para cache (R-8.2).
 */
export function auditRouter(auth: AuthMiddleware, audit: AuditService): Router {
  const router = Router();

  router.get(
    "/lots/:id/audit",
    makeRateLimiter({ windowMs: 60_000, max: 60 }),
    auth.optionalAuth,
    async (req, res) => {
      // Antes de qualquer resposta, inclusive o 404.
      res.setHeader("Cache-Control", "no-store");
      res.json(await audit.verify(String(req.params.id ?? ""), req.user?.id ?? null));
    },
  );

  return router;
}
