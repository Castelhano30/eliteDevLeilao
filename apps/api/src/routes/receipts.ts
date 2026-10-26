import { Router } from "express";
import type { ReceiptService } from "../services/receipt.service";

/** Comprovante público: quem tem o link vê, quem não tem não adivinha (R-5.12). Sempre sem cache. */
export function receiptsRouter(receipts: ReceiptService): Router {
  const router = Router();

  router.get("/receipts/:token", async (req, res) => {
    // Antes de qualquer resposta, inclusive o 404: nenhum proxy guarda o papel de ninguém.
    res.setHeader("Cache-Control", "no-store");
    res.json(await receipts.getByToken(String(req.params.token ?? "")));
  });

  return router;
}
