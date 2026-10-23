import { Router } from "express";
import type { ZodType } from "zod";
import { fieldErrors, loginInputSchema, registerInputSchema } from "@lanceauto/shared";
import { AppError } from "../errors";
import { makeRateLimiter } from "../middleware/rate-limit";
import type { AuthService } from "../services/auth.service";

/** Valida o corpo com o schema compartilhado; erro vira `VALIDATION` com `details.fields` (INV-16). */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw new AppError("VALIDATION", { fields: fieldErrors(result.error) });
  return result.data;
}

export function authRouter(service: AuthService, authRateLimitMax: number): Router {
  const router = Router();
  router.use("/auth", makeRateLimiter({ windowMs: 60_000, max: authRateLimitMax }));

  router.post("/auth/register", async (req, res) => {
    res.status(201).json(await service.register(parseBody(registerInputSchema, req.body)));
  });

  router.post("/auth/login", async (req, res) => {
    res.json(await service.login(parseBody(loginInputSchema, req.body)));
  });

  return router;
}
