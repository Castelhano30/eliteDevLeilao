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

export interface EntryHashInput {
  lotId: string;
  seq: number;
  kind: "BID" | "CANCEL";
  /** `null` na linha CANCEL: entra como texto vazio. */
  pseudonym: string | null;
  amountCents: bigint | number | null;
  /** O `Date` gravado: entra em ISO UTC com ms. */
  at: Date;
  prevHash: string;
}

/** `HMAC(key, "v1|entry|{lotId}|{seq}|{kind}|{pseudonym}|{amountCents}|{at}|{prevHash}")`. Chave sempre primeiro (T5). */
export function entryHash(key: string, entry: EntryHashInput): string {
  const amount = entry.amountCents === null ? "" : entry.amountCents.toString();
  return hmac(
    key,
    `v1|entry|${entry.lotId}|${entry.seq}|${entry.kind}|${entry.pseudonym ?? ""}|${amount}|${entry.at.toISOString()}|${entry.prevHash}`,
  );
}

/** `HMAC(key, "v1|pseudo|{userId}|{lotId}")`: base do pseudônimo por lote. */
export function pseudoHash(key: string, userId: string, lotId: string): string {
  return hmac(key, `v1|pseudo|${userId}|${lotId}`);
}
