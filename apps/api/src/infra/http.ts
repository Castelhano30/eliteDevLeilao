import { ExternalUnavailableError, type CachedResult } from "./external-cache";

export interface GetJsonOptions {
  headers?: Record<string, string>;
  /** Por tentativa. Padrão 4 s (R-2.2). */
  timeoutMs?: number;
  /** 2 = uma repetição; só em erro de rede, timeout ou 5xx. */
  attempts?: number;
}

export const EXTERNAL_TIMEOUT_MS = 4_000;

async function discard(res: Response): Promise<void> {
  await res.body?.cancel().catch(() => undefined);
}

/**
 * GET de JSON numa fonte externa. 404 vira "não achou" (cacheável). 429 e os demais 4xx não repetem
 * (repetir 429 queima a cota da FIPE); rede, timeout e 5xx repetem até `attempts`.
 * Esgotado, lança `ExternalUnavailableError`.
 */
export async function getJson(
  url: string,
  { headers = {}, timeoutMs = EXTERNAL_TIMEOUT_MS, attempts = 2 }: GetJsonOptions = {},
): Promise<CachedResult<unknown>> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      continue; // rede ou timeout
    }
    if (res.status === 404) {
      await discard(res);
      return { found: false };
    }
    if (res.status === 429) {
      await discard(res);
      throw new ExternalUnavailableError("RATE_LIMITED");
    }
    if (res.status >= 500) {
      await discard(res);
      continue;
    }
    if (!res.ok) {
      await discard(res);
      throw new ExternalUnavailableError();
    }
    try {
      return { found: true, value: (await res.json()) as unknown };
    } catch {
      throw new ExternalUnavailableError();
    }
  }
  throw new ExternalUnavailableError();
}
