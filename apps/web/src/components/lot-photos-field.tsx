"use client";

import { useId, useRef } from "react";
import { LOT_IMAGE_MAX_COUNT, LOT_UPLOAD_MIME_TYPES } from "@lanceauto/shared";
import { Button } from "@/components/ui/button";
import type { LotPhoto } from "@/lib/lot-photos";

export interface LotPhotosFieldProps {
  id: string;
  photos: LotPhoto[];
  busy: boolean;
  /** Avisos da última escolha (fotos recusadas, vagas que acabaram). */
  messages: string[];
  /** "Sem foto" marcado: tudo inerte, as fotos escolhidas ficam guardadas. */
  disabled?: boolean;
  error?: string;
  onAdd: (files: File[]) => void;
  onMakeCover: (id: string) => void;
  onRemove: (id: string) => void;
}

/**
 * Fotos do aparelho no Criar lote (grupo "02 A imagem", modo "Enviar fotos"): botão que abre o seletor (sem `capture`,
 * então o celular oferece câmera e galeria), contagem "N de 5", miniaturas com a capa marcada, "Tornar capa" e "Remover".
 */
export function LotPhotosField({ id, photos, busy, messages, disabled = false, error, onAdd, onMakeCover, onRemove }: LotPhotosFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const errorId = error ? `${baseId}-erro` : undefined;
  const full = photos.length >= LOT_IMAGE_MAX_COUNT;

  return (
    <div className={disabled ? "opacity-50" : undefined}>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          id={id}
          variant="secundario"
          disabled={disabled || full}
          loading={busy}
          loadingText="Reduzindo as fotos…"
          aria-describedby={errorId}
          aria-invalid={error ? true : undefined}
          onClick={() => inputRef.current?.click()}
        >
          {photos.length === 0 ? "Escolher fotos" : "Escolher mais fotos"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={LOT_UPLOAD_MIME_TYPES.join(",")}
          multiple
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // Zera o seletor: escolher o mesmo arquivo de novo (depois de remover) precisa disparar o `change`.
            event.target.value = "";
            onAdd(files);
          }}
        />
        <p className="t-mono-rotulo" aria-live="polite">
          {photos.length} de {LOT_IMAGE_MAX_COUNT}
        </p>
      </div>
      <p className="t-body-nota mt-2">JPEG, PNG ou WebP. A primeira foto é a capa; as fotos são reduzidas antes de subir.</p>

      {photos.length > 0 ? (
        <ul aria-label="Fotos escolhidas" className="mt-4 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="min-w-0 rounded-xl border border-borda bg-suave p-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-papel">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:), sem otimizador */}
                <img src={photo.previewUrl} alt={`Foto ${index + 1} de ${photos.length}`} className="h-full w-full object-contain" />
                {index === 0 ? (
                  <span className="t-mono-rotulo-pequeno absolute left-1 top-1 rounded-md border border-ocreBorda bg-ocre px-2 py-0.5 text-sobreOcre">CAPA</span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {index > 0 ? (
                  <Button variant="secundario" size="compacto" disabled={disabled} aria-label={`Tornar capa (foto ${index + 1})`} onClick={() => onMakeCover(photo.id)}>
                    Tornar capa
                  </Button>
                ) : null}
                <Button variant="secundario" size="compacto" destrutivo disabled={disabled} aria-label={`Remover (foto ${index + 1})`} onClick={() => onRemove(photo.id)}>
                  Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div role="status" aria-live="polite">
        {messages.map((message, index) => (
          <p key={`${index}-${message}`}className="t-body-nota mt-3 !text-ferrugem">
            {message}
          </p>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="t-body-nota mt-3 !text-ferrugem">
          {error}
        </p>
      ) : null}
    </div>
  );
}
