"use client";

import { useState, type ReactNode } from "react";
import { assetUrl, safeHref } from "@/lib/lots";

export interface CarPhotoProps {
  /** Caminho relativo da API (snapshot) ou URL absoluta (prévia do Criar lote). */
  imageUrl: string | null;
  title: string;
  /** "cartao": 200 px de altura e cantos de cima herdados do cartão; "sala"/"previa": 16:9 fluido. */
  size: "cartao" | "sala" | "previa";
  /** Legendas aparecem na Sala e na prévia; nunca no cartão (evita link aninhado). */
  showCaption?: boolean;
  credit?: string | null;
  creditUrl?: string | null;
  /** Prévia: carrega a URL digitada sem mandar o Referer. */
  noReferrer?: boolean;
  /** Encerrado: véu `painel` a 25% sobre a foto. Escurece nos dois temas e não usa `opacity`, então o texto em volta não perde contraste. */
  dimmed?: boolean;
}

/** Silhueta única de carro (o dado não traz carroceria), em `tinta` sobre `suave`. Decorativa. */
function CarIllustration() {
  return (
    <svg aria-hidden="true" viewBox="0 0 320 140" className="h-[70%] w-[70%]" fill="none" stroke="var(--c-tinta)" strokeWidth="5" strokeLinejoin="round">
      <path d="M20 104 L20 82 Q22 70 40 66 L88 58 L124 30 Q132 24 146 24 L214 24 Q228 24 238 34 L268 62 L292 68 Q302 72 302 84 L302 104 Z" />
      <path d="M134 36 L118 60 L178 60 L178 36 Z M190 36 L190 60 L250 60 L228 38 Q224 36 218 36 Z" strokeWidth="4" />
      <circle cx="84" cy="106" r="20" fill="var(--c-suave)" />
      <circle cx="244" cy="106" r="20" fill="var(--c-suave)" />
      <circle cx="84" cy="106" r="7" />
      <circle cx="244" cy="106" r="7" />
    </svg>
  );
}

/**
 * Foto do veículo (§10.2): `contain` sobre fundo pontilhado, nunca recorta nem distorce. Sem imagem ou com erro de
 * carga, a ilustração padrão com a legenda do estado. A proporção é reservada para não haver salto de layout.
 */
export function CarPhoto({ imageUrl, title, size, showCaption = false, credit, creditUrl, noReferrer = false, dimmed = false }: CarPhotoProps) {
  const src = assetUrl(imageUrl);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const broken = src !== null && failedSrc === src;
  const showImage = src !== null && !broken;
  const frame = size === "cartao" ? { height: 200 } : { aspectRatio: "16 / 9" };
  const link = safeHref(creditUrl);

  let caption: ReactNode = null;
  if (showCaption) {
    // Na Sala só o crédito aparece (a licença da foto o exige); a explicação do estado fica na prévia do Criar lote.
    if (!src) caption = size === "previa" ? "Pintado à mão pelo pátio: o leiloeiro não mandou foto" : null;
    else if (broken) caption = size === "previa" ? "Imagem ilustrativa" : null;
    else if (credit) caption = link ? <a href={link} rel="noopener noreferrer" target="_blank">{credit}</a> : credit;
  }

  return (
    <figure className="m-0 rounded-t-[inherit]">
      <div
        className="relative flex w-full items-center justify-center overflow-hidden rounded-t-[inherit] bg-suave"
        style={{
          ...frame,
          backgroundImage: "radial-gradient(var(--c-pontos) 1.3px, transparent 1.7px)",
          backgroundSize: "8px 8px",
        }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem vinda da API (outro domínio), sem otimizador
          <img
            src={src}
            alt={`Foto do ${title}`}
            className="h-full w-full object-contain"
            referrerPolicy={noReferrer ? "no-referrer" : undefined}
            loading={size === "cartao" ? "lazy" : undefined}
            onError={() => setFailedSrc(src)}
          />
        ) : (
          <CarIllustration />
        )}
        {dimmed ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-painel/25" /> : null}
      </div>
      {caption ? <figcaption className="t-body-legenda mt-2 text-tinta2">{caption}</figcaption> : null}
    </figure>
  );
}
