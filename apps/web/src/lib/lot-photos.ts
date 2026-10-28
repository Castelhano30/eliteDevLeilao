import { LOT_IMAGE_MAX_COUNT, LOT_TEXT } from "@lanceauto/shared";
import { PhotoError } from "./image-resize";

/** Foto já reduzida, pronta para o envio e para a miniatura (`previewUrl` é um `blob:`). */
export interface LotPhoto {
  id: string;
  /** Nome só para a tela e para as mensagens; o servidor nunca recebe nem grava nome de arquivo. */
  name: string;
  blob: Blob;
  previewUrl: string;
}

/** Leva a foto à frente (vira a capa); as demais mantêm a ordem relativa. */
export function makeCover<T extends { id: string }>(photos: T[], id: string): T[] {
  const picked = photos.find((photo) => photo.id === id);
  if (!picked) return photos;
  return [picked, ...photos.filter((photo) => photo.id !== id)];
}

/** Tira a foto; se era a capa, a próxima assume. */
export function removePhoto<T extends { id: string }>(photos: T[], id: string): T[] {
  return photos.filter((photo) => photo.id !== id);
}

export interface Ingested {
  /** As fotos que entram, na ordem em que foram escolhidas. */
  accepted: { file: File; blob: Blob }[];
  /** Uma frase por foto recusada. */
  failures: string[];
  /** Escolheu mais do que cabe: as demais ficaram de fora. */
  overflow: boolean;
}

/**
 * Passa as fotos escolhidas pela redução, uma por vez (na memória do celular só cabe uma foto grande de cada vez).
 * Recusa a ilegível sem derrubar as outras; ao encher as vagas, o resto nem é aberto.
 */
export async function ingestPhotos(
  files: File[],
  alreadyChosen: number,
  resize: (file: File) => Promise<Blob>,
  max: number = LOT_IMAGE_MAX_COUNT,
): Promise<Ingested> {
  const result: Ingested = { accepted: [], failures: [], overflow: false };
  for (const file of files) {
    if (alreadyChosen + result.accepted.length >= max) {
      result.overflow = true;
      break;
    }
    try {
      result.accepted.push({ file, blob: await resize(file) });
    } catch (error) {
      result.failures.push(error instanceof PhotoError && error.kind === "toobig" ? LOT_TEXT.imageTooBig : LOT_TEXT.imageUnreadable(file.name));
    }
  }
  return result;
}

/** Avisos do último "Escolher fotos": as recusas e, se passou do limite, a frase das fotos que ficaram de fora. */
export function ingestMessages(result: Pick<Ingested, "failures" | "overflow">): string[] {
  return [...result.failures, ...(result.overflow ? [LOT_TEXT.imagesOverflow] : [])];
}

/** Nome do arquivo que vai no multipart; só serve de rótulo, o servidor o ignora. */
export const photoFileName = (position: number) => `foto-${position + 1}.jpg`;

/**
 * Corpo do envio com fotos: o JSON do lote no campo `payload` e as fotos nas partes `images`, na ordem da galeria
 * (a primeira é a capa).
 */
export function buildLotForm(payload: unknown, photos: Pick<LotPhoto, "blob">[]): FormData {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  photos.forEach((photo, position) => form.append("images", photo.blob, photoFileName(position)));
  return form;
}

/** Quem vai ao ar: o modo de envio de fotos só vale com o lote com imagem. */
export type ImageMode = "url" | "upload";

/** Qual aviso aparece ao trocar de modo: só pergunta quando há fotos para perder. */
export function needsDiscardConfirmation(from: ImageMode, to: ImageMode, photoCount: number): boolean {
  return from === "upload" && to === "url" && photoCount > 0;
}

/** Campos de imagem da URL (modo URL); no modo de fotos ou com "Sem foto" nada disso vai no corpo. */
export interface UrlImageFields {
  imageUrl?: string;
  imageCredit?: string;
  imageCreditUrl?: string;
}

/** Foto do aparelho vai nas partes `images`; URL e fotos nunca vão juntas, e o crédito é só da URL. */
export function imageBodyFields(mode: ImageMode, noPhoto: boolean, url: UrlImageFields): UrlImageFields {
  return noPhoto || mode === "upload" ? {} : url;
}

/** O que o "Agendar lote" faz com a imagem: JSON puro, multipart com as fotos, ou não envia (modo fotos sem nenhuma). */
export type ImageSubmitPlan = { kind: "json" } | { kind: "multipart" } | { kind: "missing"; error: string };

export function planImageSubmit(mode: ImageMode, noPhoto: boolean, photoCount: number): ImageSubmitPlan {
  if (noPhoto || mode === "url") return { kind: "json" };
  return photoCount > 0 ? { kind: "multipart" } : { kind: "missing", error: LOT_TEXT.imagesRequired };
}
