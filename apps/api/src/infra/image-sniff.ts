import type { LotUploadMime } from "@lanceauto/shared";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((value, index) => bytes[offset + index] === value);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/**
 * Tipo da imagem pelos bytes reais (magic bytes): JPEG, PNG ou WebP; qualquer outra coisa é `null`.
 * Nunca olha `Content-Type` nem nome de arquivo, que o cliente escolhe como quiser.
 */
export function sniffImageType(bytes: Uint8Array): LotUploadMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  return null;
}
