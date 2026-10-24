import { createHmac } from "node:crypto";

/** HMAC-SHA256 em hex minúsculo (cadeia v1, INV-12). */
function hmac(key: string, message: string): string {
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}

export interface GenesisInput {
  id: string;
  /** O `Date` já parseado: o genesis usa `toISOString()` (ms e `Z`), igual ao recálculo a partir do banco (T5). */
  startsAt: Date;
  startingBidCents: bigint | number;
  minIncrementCents: bigint | number;
}

/** `HMAC(key, "v1|genesis|{lotId}|{startsAt}|{startingBidCents}|{minIncrementCents}")`. Chave sempre primeiro (T5). */
export function genesisHash(key: string, lot: GenesisInput): string {
  return hmac(
    key,
    `v1|genesis|${lot.id}|${lot.startsAt.toISOString()}|${lot.startingBidCents.toString()}|${lot.minIncrementCents.toString()}`,
  );
}

/** `HMAC(key, "v1|seal|{lotId}|{entryCount}|{lastHash}")`. */
export function sealHash(key: string, lotId: string, entryCount: number, lastHash: string): string {
  return hmac(key, `v1|seal|${lotId}|${entryCount}|${lastHash}`);
}
