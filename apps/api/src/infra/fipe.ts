import { CATALOG_TEXT, cleanBrand, parseBRL, parseReferenceMonth, type CatalogCar, type CatalogOption } from "@lanceauto/shared";
import { AppError } from "../errors";
import { ExternalUnavailableError, type ExternalCache } from "./external-cache";
import { EXTERNAL_TIMEOUT_MS, getJson } from "./http";

export interface CarDetail {
  car: CatalogCar;
  /** Resposta bruta do detalhe, gravada em `Item.rawData`. */
  raw: unknown;
  /** Quando a entrada foi buscada na FIPE (a do cache, se veio dele). */
  fetchedAt: Date;
}

/** Porta do catálogo de carros: a FIPE implementa em produção, o fixture no seed. */
export interface CatalogPort {
  brands(): Promise<CatalogOption[]>;
  models(brandId: string): Promise<CatalogOption[]>;
  years(brandId: string, modelId: string): Promise<CatalogOption[]>;
  detail(brandId: string, modelId: string, yearId: string): Promise<CarDetail>;
}

export const fipeUnavailable = () => new AppError("EXTERNAL_UNAVAILABLE", { source: "FIPE" }, CATALOG_TEXT.fipeUnavailable);
export const carNotFound = () => new AppError("NOT_FOUND", undefined, CATALOG_TEXT.notFound);

export interface FipeOptions {
  baseUrl: string;
  token?: string;
  cache: ExternalCache;
  timeoutMs?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function toOptions(body: unknown): CatalogOption[] {
  if (!Array.isArray(body)) throw new ExternalUnavailableError();
  return body
    .filter(isRecord)
    .filter((row) => (typeof row.code === "string" || typeof row.code === "number") && typeof row.name === "string")
    .map((row) => ({ id: String(row.code), name: String(row.name) }));
}

/** "2015-1" → 2015. */
export function yearFromYearId(yearId: string): number {
  return Number.parseInt(yearId, 10);
}

/** Detalhe da FIPE v2 → formato interno. Único lugar que conhece o formato da FIPE. */
export function normalizeFipeDetail(body: unknown, yearId: string): CatalogCar {
  if (!isRecord(body)) throw new ExternalUnavailableError();
  const { brand, model, fuel, codeFipe, price, referenceMonth } = body;
  const priceCents = typeof price === "string" ? parseBRL(price) : null;
  const year = yearFromYearId(yearId);
  if (typeof brand !== "string" || typeof model !== "string" || typeof codeFipe !== "string" || priceCents === null || !Number.isInteger(year)) {
    throw new ExternalUnavailableError();
  }
  return {
    brand: cleanBrand(brand),
    model,
    year,
    fuel: typeof fuel === "string" ? fuel : "",
    referencePriceCents: priceCents,
    referenceMonth: typeof referenceMonth === "string" ? parseReferenceMonth(referenceMonth) : "",
    codeFipe,
  };
}

/** Adaptador da FIPE v2 (`/cars/...`), com cache, timeout de 4 s e uma repetição (R-2.1, R-2.2). */
export function makeFipeCatalog({ baseUrl, token, cache, timeoutMs = EXTERNAL_TIMEOUT_MS }: FipeOptions): CatalogPort {
  const base = baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = token ? { "X-Subscription-Token": token } : {};
  const seg = (value: string) => encodeURIComponent(value);

  async function read(path: string) {
    const url = `${base}${path}`;
    try {
      const hit = await cache.get(url, () => getJson(url, { headers, timeoutMs }));
      if (!hit.result.found) throw carNotFound();
      return { body: hit.result.value, fetchedAt: hit.fetchedAt };
    } catch (err) {
      if (err instanceof ExternalUnavailableError) throw fipeUnavailable();
      throw err;
    }
  }

  async function list(path: string): Promise<CatalogOption[]> {
    const { body } = await read(path);
    try {
      return toOptions(body);
    } catch {
      throw fipeUnavailable();
    }
  }

  return {
    async brands() {
      const items = (await list("/cars/brands")).map((item) => ({ id: item.id, name: cleanBrand(item.name) }));
      return items.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },
    models(brandId) {
      return list(`/cars/brands/${seg(brandId)}/models`);
    },
    async years(brandId, modelId) {
      const items = await list(`/cars/brands/${seg(brandId)}/models/${seg(modelId)}/years`);
      // "Zero Km" vem como 32000-*: não é ano.
      return items.filter((item) => !item.id.startsWith("32000"));
    },
    async detail(brandId, modelId, yearId) {
      // "Zero Km" (32000-*) não é ano: gravaria um Item com ano 32000.
      if (yearId.startsWith("32000")) throw carNotFound();
      const { body, fetchedAt } = await read(`/cars/brands/${seg(brandId)}/models/${seg(modelId)}/years/${seg(yearId)}`);
      try {
        return { car: normalizeFipeDetail(body, yearId), raw: body, fetchedAt };
      } catch {
        throw fipeUnavailable();
      }
    },
  };
}
