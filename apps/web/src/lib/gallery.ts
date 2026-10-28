/**
 * Para onde a tecla leva a galeria: ←/→ andam uma foto (com volta nas pontas), Home/End vão à primeira e à última.
 * Outra tecla (inclusive Enter e Espaço, que o botão da miniatura já trata) devolve `null`: nada a fazer.
 */
export function galleryKeyTarget(key: string, index: number, count: number): number | null {
  if (count < 2) return null;
  switch (key) {
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "ArrowRight":
      return (index + 1) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** "Foto N de M", dito pelo leitor de tela a cada troca e usado no `alt` e no rótulo das miniaturas. */
export const photoPosition = (index: number, count: number) => `Foto ${index + 1} de ${count}`;

/** Só há galeria com mais de uma foto; com uma ou nenhuma, a Sala fica como sempre foi. */
export const hasGallery = (gallery: readonly string[]) => gallery.length > 1;

/** Estado da galeria: foto em destaque e as fontes que falharam ao carregar. */
export interface GalleryState {
  index: number;
  failed: ReadonlySet<string>;
}

export type GalleryAction =
  | { type: "next" }
  | { type: "prev" }
  | { type: "select"; index: number }
  | { type: "key"; key: string }
  | { type: "failed"; src: string };

export const initialGalleryState: GalleryState = { index: 0, failed: new Set() };

/** Índice que vale agora: nunca passa do fim, mesmo se a lista encolher. */
export const clampIndex = (index: number, count: number) => Math.max(0, Math.min(index, count - 1));

/** Transição pura da galeria (setas com volta, miniatura, Home/End e foto que falha). */
export function galleryReducer(state: GalleryState, action: GalleryAction, count: number): GalleryState {
  const current = clampIndex(state.index, count);
  switch (action.type) {
    case "next":
      return count < 2 ? state : { ...state, index: (current + 1) % count };
    case "prev":
      return count < 2 ? state : { ...state, index: (current - 1 + count) % count };
    case "select":
      return action.index < 0 || action.index >= count ? state : { ...state, index: action.index };
    case "key": {
      const target = galleryKeyTarget(action.key, current, count);
      return target === null ? state : { ...state, index: target };
    }
    case "failed":
      return state.failed.has(action.src) ? state : { ...state, failed: new Set(state.failed).add(action.src) };
  }
}
