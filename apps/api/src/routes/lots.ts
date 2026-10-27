import { Router, type Request } from "express";
import {
  BID_TEXT,
  CANCEL_TEXT,
  CATALOG_TEXT,
  LOT_TEXT,
  cancelLotSchema,
  fieldErrors,
  lotListQuerySchema,
  placeBidSchema,
  validateCreateLot,
} from "@lanceauto/shared";
import { AppError } from "../errors";
import type { Clock } from "../infra/clock";
import type { Publisher } from "../infra/publisher";
import type { AuthMiddleware } from "../middleware/auth";
import { makeRateLimiter } from "../middleware/rate-limit";
import type { BidService } from "../services/bid.service";
import type { CancelService } from "../services/cancel.service";
import type { CatalogService } from "../services/catalog.service";
import type { LotService } from "../services/lot.service";
import { parseBody } from "./auth";

const param = (req: Request, name: string) => String(req.params[name] ?? "");

/** `If-None-Match` casa com o ETag? Aceita `*`, `W/"…"` e lista separada por vírgula. */
export function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header
    .split(",")
    .map((tag) => tag.trim().replace(/^W\//, ""))
    .some((tag) => tag === "*" || tag === etag);
}

/**
 * Ids da FIPE: só letras, dígitos, `_` e `-` (até 40). Um `..` reescreveria o caminho na FIPE e gastaria cota.
 * Inválido vira `VALIDATION` com a mensagem de §6.2.
 */
function catalogIds<K extends string>(ids: Record<K, string>): Record<K, string> {
  const invalid = Object.fromEntries(
    Object.entries<string>(ids)
      .filter(([, value]) => !/^[\w-]{1,40}$/.test(value))
      .map(([key]) => [key, LOT_TEXT.idsRequired]),
  );
  if (Object.keys(invalid).length > 0) throw new AppError("VALIDATION", { fields: invalid });
  return ids;
}

/** `/catalog/*`: só leiloeiro, 120 req/min por usuário. */
export function catalogRouter(auth: AuthMiddleware, catalog: CatalogService): Router {
  const router = Router();
  router.use(
    "/catalog",
    auth.requireAuth,
    auth.requireRole("AUCTIONEER", CATALOG_TEXT.roleNotAllowed),
    makeRateLimiter({ windowMs: 60_000, max: 120, keyGenerator: (req) => `catalog:${req.user?.id ?? "?"}` }),
  );

  router.get("/catalog/brands", async (_req, res) => {
    res.json(await catalog.brands());
  });
  router.get("/catalog/brands/:brandId/models", async (req, res) => {
    const { brandId } = catalogIds({ brandId: param(req, "brandId") });
    res.json(await catalog.models(brandId));
  });
  router.get("/catalog/brands/:brandId/models/:modelId/years", async (req, res) => {
    const { brandId, modelId } = catalogIds({ brandId: param(req, "brandId"), modelId: param(req, "modelId") });
    res.json(await catalog.years(brandId, modelId));
  });
  router.get("/catalog/preview", async (req, res) => {
    const pick = (name: string) => (typeof req.query[name] === "string" ? (req.query[name] as string).trim() : "");
    const ids = catalogIds({ brandId: pick("brandId"), modelId: pick("modelId"), yearId: pick("yearId") });
    res.json(await catalog.preview(ids.brandId, ids.modelId, ids.yearId));
  });

  return router;
}

/** Lotes: criação (leiloeiro), Vitrine e Sala (públicas), Painel (leiloeiro) e imagem do item. */
export function lotsRouter(
  auth: AuthMiddleware,
  lots: LotService,
  bids: BidService,
  cancel: CancelService,
  clock: Clock,
  publisher: Publisher,
): Router {
  const router = Router();

  // Cada criação pode baixar até 4 MB e gravar em BYTEA: 10/min por leiloeiro (S09, deferred-work da S02).
  router.post(
    "/lots",
    auth.requireAuth,
    auth.requireRole("AUCTIONEER", CATALOG_TEXT.roleNotAllowed),
    makeRateLimiter({ windowMs: 60_000, max: 10, keyGenerator: (req) => `create-lot:${req.user?.id ?? "?"}` }),
    async (req, res) => {
    // Corpo e datas antes de qualquer chamada externa (§6.2).
    const result = validateCreateLot(req.body, clock.now().getTime());
    if (!result.ok) throw new AppError("VALIDATION", { fields: result.fields });
    const { response, events } = await lots.createLot(req.user!.id, result.data);
    publisher.publish(events);
    res.status(201).json(response);
    },
  );

  router.get("/lots", async (req, res) => {
    const parsed = lotListQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new AppError("VALIDATION", { fields: fieldErrors(parsed.error) });
    res.json(await lots.listLots(parsed.data));
  });

  // Token opcional: inválido ou expirado vira visitante, sem 401 (R-1.11).
  router.get("/lots/:id", auth.optionalAuth, async (req, res) => {
    res.json(await lots.getLotState(param(req, "id"), req.user));
  });

  // Lance: 30/min por usuário. O leiloeiro também chega ao service e é barrado na checagem de papel (INV-8).
  router.post(
    "/lots/:id/bids",
    auth.requireAuth,
    makeRateLimiter({
      windowMs: 60_000,
      max: 30,
      keyGenerator: (req) => `bids:${req.user?.id ?? "?"}`,
      message: BID_TEXT.rateLimited,
    }),
    async (req, res) => {
      const input = parseBody(placeBidSchema, req.body);
      const { response, events } = await bids.placeBid(req.user!.id, req.user!.role, param(req, "id"), input);
      // Só depois do commit: se o service lançou, nada chega aqui (R-3.11). O publisher é guardado (R-4.2).
      publisher.publish(events);
      res.status(201).json(response);
    },
  );

  // Cancelar: só o leiloeiro dono (o service confere). Eventos só depois do commit (INV-4).
  router.post(
    "/lots/:id/cancel",
    auth.requireAuth,
    auth.requireRole("AUCTIONEER", CANCEL_TEXT.roleNotAllowed),
    async (req, res) => {
      const { confirmEntryCount } = parseBody(cancelLotSchema, req.body);
      const { response, events } = await cancel.cancelLot(req.user!.id, param(req, "id"), confirmEntryCount);
      publisher.publish(events);
      res.json(response);
    },
  );

  router.get("/my/lots", auth.requireAuth, auth.requireRole("AUCTIONEER", CATALOG_TEXT.roleNotAllowed), async (req, res) => {
    res.json(await lots.myLots(req.user!.id));
  });

  router.get("/items/:id/image", async (req, res) => {
    const id = param(req, "id");
    const image = await lots.getItemImageMeta(id);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("ETag", image.etag);
    // O web vive em outro domínio: a imagem precisa poder ser embutida lá.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Revalidação responde 304 sem ler o blob; aceita ETag fraco (W/) e lista separada por vírgula.
    if (etagMatches(req.headers["if-none-match"], image.etag)) {
      res.status(304).end();
      return;
    }
    res.type(image.mime).send(await lots.getItemImageData(id));
  });

  return router;
}
