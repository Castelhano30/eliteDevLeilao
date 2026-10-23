const SAFE_PATH = /^\/[A-Za-z0-9/_\-.?=&%]*$/;

/**
 * Aceita só caminhos internos para o `?next=`. Fecha `//evil.com`, `https://evil.com`, `/\evil.com`
 * (o navegador trata `\` como `/`) e o equivalente codificado `/%5Cevil.com`. Devolve `null` se não servir.
 */
export function sanitizeNext(next: string | null | undefined): string | null {
  if (!next || !SAFE_PATH.test(next)) return null;
  if (next.startsWith("//") || next.includes("://") || next.includes("\\")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return null;
  }
  // eslint-disable-next-line no-control-regex
  if (decoded.startsWith("//") || decoded.includes("\\") || /[\u0000-\u001f\u007f]/.test(decoded)) return null;
  return next;
}
