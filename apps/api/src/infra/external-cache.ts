import type { Clock } from "./clock";
import type { Logger } from "./logger";

/** A fonte externa não respondeu (rede, timeout, 5xx) ou recusou por cota (429). Nunca entra no cache (R-2.1). */
export class ExternalUnavailableError extends Error {
  /** `status`: o HTTP recebido (401/403 de token, 5xx esgotado); ausente em falha de rede ou timeout. */
  constructor(
    readonly reason: "UNAVAILABLE" | "RATE_LIMITED" = "UNAVAILABLE",
    readonly status?: number,
  ) {
    super(reason === "RATE_LIMITED" ? "fonte externa recusou por limite de requisições" : "fonte externa indisponível");
    this.name = "ExternalUnavailableError";
  }
}

/** Só sucesso e "não achou" são cacheados. */
export type CachedResult<T> = { found: true; value: T } | { found: false };

export interface CacheRead<T> {
  result: CachedResult<T>;
  /** Quando a entrada foi realmente buscada na fonte (não "agora", se veio do cache). */
  fetchedAt: Date;
  stale: boolean;
}

interface Entry {
  result: CachedResult<unknown>;
  fetchedAt: Date;
}

export interface ExternalCacheOptions {
  clock: Clock;
  logger?: Logger;
  /** Nome da fonte, para o log. */
  source: string;
  ttlMs?: number;
  maxEntries?: number;
}

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 500;

/**
 * Cache em memória por chave (a URL), com TTL medido pelo `Clock`, teto de entradas (descarta a mais antiga)
 * e single-flight. Falha com entrada vencida serve a vencida e loga `warn`; sem entrada, a falha sobe.
 * Zera quando o servidor reinicia.
 */
export class ExternalCache {
  private readonly entries = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<Entry>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(private readonly options: ExternalCacheOptions) {
    this.ttlMs = options.ttlMs ?? CACHE_TTL_MS;
    this.maxEntries = options.maxEntries ?? CACHE_MAX_ENTRIES;
  }

  get size(): number {
    return this.entries.size;
  }

  async get<T>(key: string, load: () => Promise<CachedResult<T>>): Promise<CacheRead<T>> {
    const current = this.entries.get(key);
    const now = this.options.clock.now().getTime();
    if (current && now - current.fetchedAt.getTime() < this.ttlMs) {
      return { result: current.result as CachedResult<T>, fetchedAt: current.fetchedAt, stale: false };
    }

    let pending = this.inflight.get(key);
    if (!pending) {
      pending = load()
        .then((result) => {
          const entry: Entry = { result, fetchedAt: this.options.clock.now() };
          this.store(key, entry);
          return entry;
        })
        .finally(() => this.inflight.delete(key));
      this.inflight.set(key, pending);
    }

    try {
      const entry = await pending;
      return { result: entry.result as CachedResult<T>, fetchedAt: entry.fetchedAt, stale: false };
    } catch (err) {
      if (current) {
        this.options.logger?.warn({ source: this.options.source, key, err }, "fonte externa falhou; servindo cache vencido");
        return { result: current.result as CachedResult<T>, fetchedAt: current.fetchedAt, stale: true };
      }
      throw err;
    }
  }

  private store(key: string, entry: Entry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
