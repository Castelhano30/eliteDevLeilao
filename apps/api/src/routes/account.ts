import { Router } from "express";
import { AUTH_TEXT, depositInputSchema } from "@lanceauto/shared";
import type { AuthMiddleware } from "../middleware/auth";
import type { AuthService } from "../services/auth.service";
import type { WalletService } from "../services/wallet.service";
import { parseBody } from "./auth";

/** `/me` e `/wallet`: rotas do usuário logado. `requireAuth` garante `req.user`. */
export function accountRouter(auth: AuthMiddleware, authService: AuthService, walletService: WalletService): Router {
  const router = Router();

  router.get("/me", auth.requireAuth, async (req, res) => {
    res.json(await authService.me(req.user!.id));
  });

  router.get("/wallet", auth.requireAuth, async (req, res) => {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    res.json(await walletService.page(req.user!.id, cursor));
  });

  router.post(
    "/wallet/deposits",
    auth.requireAuth,
    auth.requireRole("BIDDER", AUTH_TEXT.depositRoleNotAllowed),
    async (req, res) => {
      const { amountCents } = parseBody(depositInputSchema, req.body);
      res.status(201).json(await walletService.deposit(req.user!.id, amountCents));
    },
  );

  return router;
}
