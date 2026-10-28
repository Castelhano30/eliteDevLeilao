"use client";

import { useReducer, useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { clampIndex, galleryKeyTarget, galleryReducer, initialGalleryState, photoPosition, type GalleryAction } from "@/lib/gallery";
import { assetUrl } from "@/lib/lots";
import { CarIllustration } from "./car-photo";

export interface CarGalleryProps {
  /** Caminhos relativos da API, na ordem de exibição (a primeira é a capa). */
  gallery: string[];
  title: string;
  /** Encerrado: o mesmo véu `painel` a 25% da foto única. */
  dimmed?: boolean;
}

const DOTS = { backgroundImage: "radial-gradient(var(--c-pontos) 1.3px, transparent 1.7px)", backgroundSize: "8px 8px" } as const;

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}

/**
 * Galeria da Sala (lote com mais de uma foto): a foto em destaque em 16:9 com `contain`, setas, miniaturas clicáveis
 * (até 5 colunas, nunca menos de 44 px de alvo) e teclado: ←/→ trocam (com volta), Home/End vão às pontas e
 * Enter/Espaço escolhem a miniatura. A foto de agora é anunciada como "Foto N de M". Foto que não carrega mostra
 * a ilustração naquele lugar, sem derrubar as outras. Sem crédito: foto do aparelho não tem.
 */
export function CarGallery({ gallery, title, dimmed = false }: CarGalleryProps) {
  const count = gallery.length;
  const [{ index, failed }, dispatch] = useReducer((state: typeof initialGalleryState, action: GalleryAction) => galleryReducer(state, action, count), initialGalleryState);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = clampIndex(index, count);
  const sources = gallery.map((path) => assetUrl(path) ?? "");

  const markFailed = (src: string) => dispatch({ type: "failed", src });
  // O erro de carga pode vir antes da hidratação (HTML do servidor), quando o onError ainda não existe: confere ao montar.
  const checkLoaded = (src: string) => (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) markFailed(src);
  };

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = galleryKeyTarget(event.key, current, count);
    if (target === null) return;
    event.preventDefault();
    dispatch({ type: "key", key: event.key });
    // Quem navegava pelas miniaturas segue nelas: o foco acompanha a foto escolhida.
    if (thumbs.current.some((thumb) => thumb === document.activeElement)) thumbs.current[target]?.focus();
  }

  const stageSrc = sources[current]!;
  const stageBroken = failed.has(stageSrc);

  return (
    <section aria-roledescription="galeria" aria-label={`Fotos do ${title}`} onKeyDown={onKeyDown} className="min-w-0">
      <div className="relative flex w-full items-center justify-center overflow-hidden bg-suave" style={{ ...DOTS, aspectRatio: "16 / 9" }}>
        {stageBroken ? (
          <CarIllustration />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- imagem vinda da API (outro domínio), sem otimizador
          <img
            key={stageSrc}
            ref={checkLoaded(stageSrc)}
            src={stageSrc}
            alt={`${photoPosition(current, count)} do ${title}`}
            className="h-full w-full object-contain"
            onError={() => markFailed(stageSrc)}
          />
        )}
        {dimmed ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-painel/25" /> : null}
        <Button
          variant="icone"
          aria-label="Foto anterior"
          className="absolute inset-y-0 left-2 my-auto"
          onClick={() => dispatch({ type: "prev" })}
        >
          <Chevron direction="left" />
        </Button>
        <Button variant="icone" aria-label="Próxima foto" className="absolute inset-y-0 right-2 my-auto" onClick={() => dispatch({ type: "next" })}>
          <Chevron direction="right" />
        </Button>
        <span aria-hidden="true" className="t-mono-rotulo-pequeno absolute bottom-2 right-2 rounded-md bg-papel px-2 py-0.5 tabular-nums text-tinta">
          {current + 1} / {count}
        </span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {photoPosition(current, count)}
      </p>
      <ul aria-label="Miniaturas" className="mt-3 grid list-none grid-cols-5 gap-2 p-0">
        {sources.map((src, position) => {
          const active = position === current;
          return (
            <li key={gallery[position]} className="min-w-0">
              <button
                type="button"
                ref={(node) => {
                  thumbs.current[position] = node;
                }}
                aria-label={photoPosition(position, count)}
                aria-current={active ? "true" : undefined}
                onClick={() => dispatch({ type: "select", index: position })}
                className={`relative block aspect-square min-h-11 w-full overflow-hidden rounded-lg border bg-suave p-0 ${
                  active ? "border-ocre shadow-[0_0_0_1px_var(--c-ocre)]" : "border-borda hover:border-tinta2"
                }`}
              >
                {failed.has(src) ? (
                  <span className="flex h-full w-full items-center justify-center">
                    <CarIllustration />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura vinda da API (outro domínio), sem otimizador
                  <img ref={checkLoaded(src)} src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => markFailed(src)} />
                )}
                {dimmed ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-painel/25" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
