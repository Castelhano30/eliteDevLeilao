import type { CatalogListResponse, CatalogPreviewResponse } from "@lanceauto/shared";
import type { CatalogPort } from "../infra/fipe";
import type { ImageSuggestionPort } from "../infra/wikipedia";

export interface CatalogServiceDeps {
  catalog: CatalogPort;
  images: ImageSuggestionPort;
}

/** Catálogo para o Criar lote. FIPE é obrigatória; a Wikipedia nunca é erro (vira `imageStatus`). */
export function makeCatalogService({ catalog, images }: CatalogServiceDeps) {
  return {
    async brands(): Promise<CatalogListResponse> {
      return { items: await catalog.brands() };
    },
    async models(brandId: string): Promise<CatalogListResponse> {
      return { items: await catalog.models(brandId) };
    },
    async years(brandId: string, modelId: string): Promise<CatalogListResponse> {
      return { items: await catalog.years(brandId, modelId) };
    },
    async preview(brandId: string, modelId: string, yearId: string): Promise<CatalogPreviewResponse> {
      const { car } = await catalog.detail(brandId, modelId, yearId);
      const suggestion = await images.suggest(car.brand, car.model).catch(() => ({ status: "UNAVAILABLE" as const }));
      if (suggestion.status === "FOUND") return { car, suggestedImage: suggestion.image, imageStatus: "FOUND" };
      return { car, imageStatus: suggestion.status };
    },
  };
}

export type CatalogService = ReturnType<typeof makeCatalogService>;
