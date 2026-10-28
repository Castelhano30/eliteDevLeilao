"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resizePhoto } from "./image-resize";
import { ingestMessages, ingestPhotos, makeCover, removePhoto, type LotPhoto } from "./lot-photos";

export interface LotPhotos {
  photos: LotPhoto[];
  /** Reduzindo as fotos escolhidas (uma por vez). */
  busy: boolean;
  /** Avisos do último "Escolher fotos"; somem na próxima escolha. */
  messages: string[];
  add: (files: File[]) => Promise<void>;
  makeCover: (id: string) => void;
  remove: (id: string) => void;
  /** Descarta tudo (trocou de modo) e solta os `blob:`. */
  clear: () => void;
}

const revoke = (photos: LotPhoto[]) => {
  for (const photo of photos) URL.revokeObjectURL(photo.previewUrl);
};

/** Fotos escolhidas no aparelho: reduz, guarda e solta cada `blob:` ao remover, ao limpar e ao sair da tela. */
export function useLotPhotos(): LotPhotos {
  const [photos, setPhotos] = useState<LotPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  // Espelho do estado para o laço assíncrono ver a contagem de agora, não a do render em que a escolha começou.
  const current = useRef<LotPhoto[]>([]);
  const adding = useRef(false);
  // Época: sobe ao limpar e ao desmontar; uma escolha em andamento que a vê mudar descarta o resultado (nada de foto fantasma nem blob: solto).
  const epoch = useRef(0);

  const commit = useCallback((next: LotPhoto[]) => {
    current.current = next;
    setPhotos(next);
  }, []);

  useEffect(
    () => () => {
      epoch.current += 1;
      revoke(current.current);
      current.current = [];
    },
    [],
  );

  const add = useCallback(
    async (files: File[]) => {
      if (adding.current || files.length === 0) return;
      adding.current = true;
      const startedAt = epoch.current;
      setBusy(true);
      setMessages([]);
      try {
        const result = await ingestPhotos(files, current.current.length, resizePhoto);
        if (epoch.current !== startedAt) return;
        const fresh: LotPhoto[] = result.accepted.map(({ file, blob }) => ({
          id: crypto.randomUUID(),
          name: file.name,
          blob,
          previewUrl: URL.createObjectURL(blob),
        }));
        commit([...current.current, ...fresh]);
        setMessages(ingestMessages(result));
      } finally {
        adding.current = false;
        setBusy(false);
      }
    },
    [commit],
  );

  return {
    photos,
    busy,
    messages,
    add,
    makeCover: (id) => commit(makeCover(current.current, id)),
    remove: (id) => {
      const gone = current.current.filter((photo) => photo.id === id);
      revoke(gone);
      commit(removePhoto(current.current, id));
    },
    clear: () => {
      epoch.current += 1;
      revoke(current.current);
      commit([]);
      setMessages([]);
    },
  };
}
