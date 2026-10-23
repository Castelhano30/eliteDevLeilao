import { homeFor, type Role } from "@lanceauto/shared";

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

/** Áreas privadas e o papel que pode abri-las (a nav e as guardas seguem a mesma tabela). */
const ROLE_AREAS: { prefix: string; role: Role }[] = [
  { prefix: "/carteira", role: "BIDDER" },
  { prefix: "/arremates", role: "BIDDER" },
  { prefix: "/painel", role: "AUCTIONEER" },
];

/** Para onde ir depois de entrar: o `next` limpo, se existir e o papel puder abri-lo; senão a home do papel. */
export function destinationAfterLogin(role: Role, next: string | null | undefined): string {
  const clean = sanitizeNext(next);
  if (!clean) return homeFor(role);
  const path = clean.split("?")[0] ?? clean;
  const area = ROLE_AREAS.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`));
  return area && area.role !== role ? homeFor(role) : clean;
}
