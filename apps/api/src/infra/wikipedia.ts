import { performance } from "node:perf_hooks";
import {
  isVehicleExtract,
  wikiCredit,
  wikiTitleCandidates,
  wikiTitlePath,
  type ImageSuggestionStatus,
  type SuggestedImage,
} from "@lanceauto/shared";
import { ExternalUnavailableError, type ExternalCache } from "./external-cache";
import { EXTERNAL_TIMEOUT_MS, getJson } from "./http";

export type ImageSuggestion =
  | { status: Extract<ImageSuggestionStatus, "FOUND">; image: SuggestedImage }
  | { status: Exclude<ImageSuggestionStatus, "FOUND"> };

/** Porta da sugestão de foto. Falha nunca é erro: vira `UNAVAILABLE`. */
export interface ImageSuggestionPort {
  suggest(brand: string, model: string): Promise<ImageSuggestion>;
}

export interface WikipediaOptions {
  baseUrl: string;
  userAgent: string;
  cache: ExternalCache;
  timeoutMs?: number;
  /** Teto total da busca de imagem (5 s, orçamento do preview). */
  budgetMs?: number;
}

/** Largura da miniatura pedida: bem abaixo do limite de download. */
export const THUMB_WIDTH = 1280;

interface Summary {
  type?: unknown;
  title?: unknown;
  extract?: unknown;
  thumbnail?: { source?: unknown };
  originalimage?: { source?: unknown; width?: unknown };
  content_urls?: { desktop?: { page?: unknown } };
}

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/**
 * URL da foto: a original se tiver até 1280 px (e não for SVG); senão a miniatura reescrita para 1280 px
 * (`/thumb/…/1280px-…`, sem a query); sem miniatura, a original só até 1600 px.
 */
export function pickImageUrl(summary: Summary): string | null {
  const original = str(summary.originalimage?.source);
  const width = typeof summary.originalimage?.width === "number" ? summary.originalimage.width : Infinity;
  const isSvg = original !== null && /\.svg$/i.test(original);
  if (original && !isSvg && width <= THUMB_WIDTH) return original;
  const thumb = str(summary.thumbnail?.source);
  if (thumb) {
    const clean = thumb.split("?")[0] ?? thumb;
    if (/\/thumb\/.+\/\d+px-[^/]+$/.test(clean)) return clean.replace(/\/\d+px-([^/]+)$/, `/${THUMB_WIDTH}px-$1`);
    return clean;
  }
  if (original && !isSvg && width <= 1600) return original;
  return null;
}

/**
 * Adaptador do resumo da Wikipedia em português. Tenta os candidatos de `wikiTitleCandidates` em ordem,
 * 1 tentativa por candidato, teto total de 5 s; falha de rede em qualquer um encerra com `UNAVAILABLE`.
 */
export function makeWikipedia({ baseUrl, userAgent, cache, timeoutMs = EXTERNAL_TIMEOUT_MS, budgetMs = 5_000 }: WikipediaOptions): ImageSuggestionPort {
  const base = baseUrl.replace(/\/+$/, "");
  const headers = { "User-Agent": userAgent, "Api-User-Agent": userAgent };

  return {
    async suggest(brand, model) {
      const candidates = wikiTitleCandidates(brand, model);
      const started = performance.now();
      for (const [index, title] of candidates.entries()) {
        const remaining = budgetMs - (performance.now() - started);
        if (remaining <= 0) return { status: "UNAVAILABLE" };
        const url = `${base}/api/rest_v1/page/summary/${wikiTitlePath(title)}`;
        let summary: Summary;
        try {
          const hit = await cache.get(url, () => getJson(url, { headers, timeoutMs: Math.min(timeoutMs, remaining), attempts: 1 }));
          if (!hit.result.found) continue;
          summary = (hit.result.value ?? {}) as Summary;
        } catch (err) {
          if (err instanceof ExternalUnavailableError) return { status: "UNAVAILABLE" };
          throw err;
        }
        if (summary.type === "disambiguation") continue;
        // Só o modelo ("Gol") pode cair em outra coisa: exige um resumo que fale de veículo.
        const modelOnly = candidates.length > 1 && index === candidates.length - 1;
        if (modelOnly && !isVehicleExtract(str(summary.extract))) continue;
        const imageUrl = pickImageUrl(summary);
        const page = str(summary.content_urls?.desktop?.page);
        if (!imageUrl || !page) continue;
        return {
          status: "FOUND",
          image: { url: imageUrl, credit: wikiCredit((str(summary.title) ?? title).replace(/_/g, " ")), creditUrl: page },
        };
      }
      return { status: "NOT_FOUND" };
    },
  };
}
