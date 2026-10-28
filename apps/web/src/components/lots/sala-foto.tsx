import type { LotStateCar } from "@lanceauto/shared";
import { hasGallery } from "@/lib/gallery";
import { CarGallery } from "./car-gallery";
import { CarPhoto } from "./car-photo";

export interface SalaFotoProps {
  car: Pick<LotStateCar, "imageUrl" | "gallery" | "imageCredit" | "imageCreditUrl">;
  title: string;
  /** Encerrado: véu sobre a foto ou a galeria. */
  dimmed?: boolean;
}

/**
 * Imagem da Sala: galeria só com mais de uma foto (sem crédito: foto do aparelho não tem); com uma ou nenhuma,
 * a foto única de sempre, com o crédito da URL quando houver.
 */
export function SalaFoto({ car, title, dimmed = false }: SalaFotoProps) {
  if (hasGallery(car.gallery)) return <CarGallery gallery={car.gallery} title={title} dimmed={dimmed} />;
  return <CarPhoto imageUrl={car.imageUrl} title={title} size="sala" showCaption credit={car.imageCredit} creditUrl={car.imageCreditUrl} dimmed={dimmed} />;
}
