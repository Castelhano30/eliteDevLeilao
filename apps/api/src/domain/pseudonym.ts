import { pseudoHash } from "./audit-chain";

/** "Licitante 7F3A": 4 hex do HMAC(usuário, lote). Muda de lote para lote; colisão de 4 hex é aceita (INV-13). */
export function pseudonymFor(key: string, userId: string, lotId: string): string {
  return `Licitante ${pseudoHash(key, userId, lotId).slice(0, 4).toUpperCase()}`;
}
