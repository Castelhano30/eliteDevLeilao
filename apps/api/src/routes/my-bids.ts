import { Router } from "express";
import { MY_BIDS_TEXT } from "@lanceauto/shared";
import type { AuthMiddleware } from "../middleware/auth";
import type { MyBidsService } from "../services/my-bids.service";

/** `GET /me/bids`: os arremates do licitante logado (S07). A rota do Painel é `/my/lots`, não confundir. */
export function myBidsRouter(auth: AuthMiddleware, myBids: MyBidsService): Router {
  const router = Router();

  router.get("/me/bids", auth.requireAuth, auth.requireRole("BIDDER", MY_BIDS_TEXT.roleNotAllowed), async (req, res) => {
    // Tem o token do comprovante do dono: nenhum cache compartilhado guarda isto.
    res.setHeader("Cache-Control", "no-store");
    res.json(await myBids.list(req.user!.id));
  });

  return router;
}
