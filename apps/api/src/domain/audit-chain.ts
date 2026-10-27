import { createHmac, timingSafeEqual } from "node:crypto";

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

/** Linha da cadeia como o banco a devolve, já em `number`/`Date` (S08 §4). */
export interface AuditRow {
  seq: number;
  kind: "BID" | "CANCEL";
  pseudonym: string | null;
  amountCents: number | null;
  at: Date;
  prevHash: string;
  hash: string;
}

/** O que a verificação lê do lote; `bidCount`, `settledAt` e `cancelledAt` servem só à consistência (R-8.16). */
export interface AuditLot {
  id: string;
  startsAt: Date;
  startingBidCents: number;
  minIncrementCents: number;
  entryCount: number;
  lastHash: string;
  seal: string;
  bidCount: number;
  settledAt: Date | null;
  cancelledAt: Date | null;
}

export type RowStatus = "OK" | "MISMATCH" | "BROKEN_LINK";
export type BreakReason = "SEQ_GAP" | "PREV_LINK" | "HASH";
export type ConsistencyIssue = "RECEIPT_MISSING" | "RECEIPT_AMOUNT" | "RECEIPT_UNEXPECTED" | "CANCEL_FLAG";

export interface ChainResult {
  verdict: "OK" | "BROKEN_AT" | "SEAL_MISMATCH" | "RECEIPT_MISMATCH";
  firstBad: { seq: number; expectedSeq: number; reason: BreakReason } | null;
  /** Mesmo tamanho e ordem de `rows`. */
  rowStatus: RowStatus[];
  foundCount: number;
  registeredCount: number;
  sealOk: boolean;
  /** `null` = sem comprovante; compara só o hash final. */
  receiptOk: boolean | null;
  consistencyIssue: ConsistencyIssue | null;
}

/** Igualdade de hashes sem vazar onde diferem; tamanho diferente = diferente (R-8.4). */
function eq(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Refaz a conta da cadeia do primeiro ao último lance e compara com o gravado, com o selo e com o comprovante
 * (S08 §4). Puro: sem banco, sem relógio. `rows` já vem em `seq` ascendente. Precedência do veredito:
 * `BROKEN_AT` → `SEAL_MISMATCH` → `RECEIPT_MISMATCH` → `OK` (R-8.5). Nunca devolve hash recalculado nem valor original.
 */
export function verifyChain(
  key: string,
  lot: AuditLot,
  rows: AuditRow[],
  receipt: { finalHash: string; amountCents: number } | null,
): ChainResult {
  const genesis = genesisHash(key, lot);
  let expectedPrev = genesis;
  let firstBad: ChainResult["firstBad"] = null;
  const rowStatus: RowStatus[] = [];

  // for…of (não forEach): o TS estreitaria `firstBad` para null depois de um callback.
  for (const [i, row] of rows.entries()) {
    if (firstBad) {
      rowStatus.push("BROKEN_LINK");
      continue;
    }
    const expectedSeq = i + 1;
    let reason: BreakReason | null = null;
    if (row.seq !== expectedSeq) reason = "SEQ_GAP";
    else if (!eq(row.prevHash, expectedPrev)) reason = "PREV_LINK";
    else if (!eq(row.hash, entryHash(key, { lotId: lot.id, ...row }))) reason = "HASH";
    if (reason) {
      firstBad = { seq: row.seq, expectedSeq, reason };
      rowStatus.push("MISMATCH");
    } else {
      expectedPrev = row.hash;
      rowStatus.push("OK");
    }
  }

  // Ponta = hash GRAVADO da última linha (ou o genesis, sem linhas).
  const tip = rows.length > 0 ? rows[rows.length - 1]!.hash : genesis;
  const sealOk =
    eq(lot.seal, sealHash(key, lot.id, lot.entryCount, lot.lastHash)) &&
    lot.entryCount === rows.length &&
    eq(lot.lastHash, tip);
  const receiptOk = receipt ? eq(receipt.finalHash, lot.lastHash) : null;

  // R-8.16: o que o hash não alcança.
  const last = rows[rows.length - 1];
  const lastBid = [...rows].reverse().find((row) => row.kind === "BID");
  const cancelOnlyLast = rows.every((row, i) => row.kind !== "CANCEL" || i === rows.length - 1);
  const cancelFlagOk = cancelOnlyLast && (lot.cancelledAt !== null) === (last?.kind === "CANCEL");
  let consistencyIssue: ConsistencyIssue | null = null;
  if (!cancelFlagOk) consistencyIssue = "CANCEL_FLAG";
  else if (lot.settledAt && !lot.cancelledAt) {
    if (lot.bidCount > 0 && !receipt) consistencyIssue = "RECEIPT_MISSING";
    else if (lot.bidCount > 0 && receipt && receipt.amountCents !== lastBid?.amountCents) consistencyIssue = "RECEIPT_AMOUNT";
    else if (lot.bidCount === 0 && receipt) consistencyIssue = "RECEIPT_UNEXPECTED";
  }

  const verdict: ChainResult["verdict"] = firstBad
    ? "BROKEN_AT"
    : !sealOk || consistencyIssue === "CANCEL_FLAG"
      ? "SEAL_MISMATCH"
      : receiptOk === false || consistencyIssue !== null
        ? "RECEIPT_MISMATCH"
        : "OK";
  return { verdict, firstBad, rowStatus, foundCount: rows.length, registeredCount: lot.entryCount, sealOk, receiptOk, consistencyIssue };
}
