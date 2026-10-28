import { LOT_IMAGE_MAX_BYTES, LOT_IMAGE_RESIZE_MAX_SIDE, LOT_IMAGE_RESIZE_QUALITY, LOT_UPLOAD_MIME_TYPES } from "@lanceauto/shared";

/** Por que a foto não entrou: `unreadable` (tipo fora da lista ou não decodifica) ou `toobig` (passou de 4 MB mesmo reduzida). */
export type PhotoFailure = "unreadable" | "toobig";

export class PhotoError extends Error {
  constructor(readonly kind: PhotoFailure) {
    super(kind);
    this.name = "PhotoError";
  }
}

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Cabe o lado maior em `maxSide` sem mexer na proporção e sem nunca ampliar: foto menor que o limite sai com as
 * dimensões que tem. Sempre inteiros e pelo menos 1 px.
 */
export function fitWithin(width: number, height: number, maxSide: number = LOT_IMAGE_RESIZE_MAX_SIDE): Dimensions {
  const longest = Math.max(width, height);
  if (!(longest > maxSide)) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const EXTENSION_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const ALLOWED: readonly string[] = LOT_UPLOAD_MIME_TYPES;

/**
 * JPEG, PNG ou WebP, pelo tipo que o aparelho informa (ou pela extensão, quando o tipo vem vazio). GIF, SVG, PDF e
 * HEIC ficam de fora sem tentar decodificar. É só a porta da frente: o servidor confere de novo, pelos bytes.
 */
export function isAcceptedPhoto(file: { type: string; name: string }): boolean {
  const type = file.type.trim().toLowerCase();
  if (type !== "") return ALLOWED.includes(type);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED.includes(EXTENSION_TYPES[extension] ?? "");
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/** `createImageBitmap` respeita a orientação EXIF; sem ele, o `<img>` (que os navegadores também giram sozinhos). */
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // cai no <img> abaixo; se ele também falhar, a foto é ilegível
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoError("unreadable");
  }
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", LOT_IMAGE_RESIZE_QUALITY));
}

/**
 * Reduz uma foto no navegador: lado maior ≤ 1600 px (nunca amplia), JPEG qualidade 0,85, orientação EXIF respeitada,
 * fundo branco sob transparência. Regravar em canvas sempre tira o EXIF (inclusive o GPS) da foto que fica pública.
 * Uma foto por vez, para não estourar a memória do celular.
 */
export async function resizePhoto(file: File): Promise<Blob> {
  if (!isAcceptedPhoto(file)) throw new PhotoError("unreadable");
  const decoded = await decode(file);
  try {
    if (!(decoded.width > 0 && decoded.height > 0)) throw new PhotoError("unreadable");
    const { width, height } = fitWithin(decoded.width, decoded.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new PhotoError("unreadable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await toJpeg(canvas);
    if (!blob || blob.size === 0) throw new PhotoError("unreadable");
    if (blob.size > LOT_IMAGE_MAX_BYTES) throw new PhotoError("toobig");
    return blob;
  } finally {
    decoded.release();
  }
}
