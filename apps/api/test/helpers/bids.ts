import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { expect } from "vitest";
import type { DomainEvent } from "@lanceauto/shared";
import { entryHash, genesisHash, sealHash } from "../../src/domain/audit-chain";
import type { Publisher } from "../../src/infra/publisher";
import { registerUser, testEnv } from "./app";

type App = Parameters<typeof request>[0];

export interface TestUser {
  id: string;
  email: string;
  auth: string;
}

/** Licitante com saldo (depósito pela API) ou leiloeiro sem saldo, já com token. */
export async function makeUser(
  app: App,
  name: string,
  { role = "BIDDER", depositCents = 0 }: { role?: "BIDDER" | "AUCTIONEER"; depositCents?: number } = {},
): Promise<TestUser> {
  const email = `${name.toLowerCase()}@lanceauto.test`;
  const { token, user } = await registerUser(app, { role, email, name });
  const auth = `Bearer ${token}`;
  if (depositCents > 0) {
    const deposit = await request(app).post("/wallet/deposits").set("Authorization", auth).send({ amountCents: depositCents });
    if (deposit.status !== 201) throw new Error(`depósito falhou: ${deposit.status}`);
  }
  return { id: user.id, email, auth };
}

/** `POST /lots/:id/bids`. `expected` omitido = `null` (sem lance atual visto). */
export function postBid(app: App, user: TestUser, lotId: string, amountCents: number, expected: number | null = null) {
  return request(app)
    .post(`/lots/${lotId}/bids`)
    .set("Authorization", user.auth)
    .send({ amountCents, expectedCurrentCents: expected });
}

/** Publisher que guarda o que recebe, para conferir o que sai depois do commit. */
export class RecordingPublisher implements Publisher {
  readonly batches: DomainEvent[][] = [];
  publish(events: DomainEvent[]): void {
    this.batches.push(events);
  }
  get events(): DomainEvent[] {
    return this.batches.flat();
  }
}

/** Chaves que nunca podem aparecer numa resposta pública (INV-13) nem num evento (o token do comprovante, T9). */
export const FORBIDDEN_KEYS = ["userId", "bidderId", "leaderId", "auctioneerId", "email", "name", "passwordHash", "token"];

export function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) collectKeys(item, keys);
  else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      keys.add(key);
      collectKeys(item, keys);
    }
  }
  return keys;
}

/**
 * Invariantes de um lote depois de qualquer sequência de lances: linhas contíguas, cadeia e selo recomputados,
 * lance atual estritamente crescente, líder = autor do último, e por carteira `HOLD − RELEASE` deste lote igual ao
 * que ela tem comprometido nele (o lance atual, só para o líder). Também vale o CHECK das carteiras.
 */
export async function assertLotInvariants(prisma: PrismaClient, lotId: string): Promise<void> {
  const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
  const rows = await prisma.bid.findMany({ where: { lotId }, orderBy: { seq: "asc" } });

  expect(rows.map((row) => row.seq)).toEqual(rows.map((_, index) => index + 1));
  expect(lot.entryCount).toBe(rows.length);
  expect(lot.bidCount).toBe(rows.filter((row) => row.kind === "BID").length);

  let prevHash = genesisHash(testEnv.AUDIT_HMAC_KEY, lot);
  let lastAmount = 0n;
  for (const row of rows) {
    expect(row.prevHash).toBe(prevHash);
    expect(row.hash).toBe(
      entryHash(testEnv.AUDIT_HMAC_KEY, {
        lotId,
        seq: row.seq,
        kind: row.kind,
        pseudonym: row.pseudonym,
        amountCents: row.amountCents,
        at: row.at,
        prevHash: row.prevHash,
      }),
    );
    if (row.kind === "BID") {
      expect(row.amountCents! > lastAmount).toBe(true);
      lastAmount = row.amountCents!;
    }
    prevHash = row.hash;
  }
  expect(lot.lastHash).toBe(prevHash);
  expect(lot.seal).toBe(sealHash(testEnv.AUDIT_HMAC_KEY, lotId, rows.length, prevHash));

  const bids = rows.filter((row) => row.kind === "BID");
  const last = bids[bids.length - 1];
  expect(lot.currentBidCents).toBe(last ? last.amountCents : null);
  expect(lot.leaderId).toBe(last ? last.bidderId : null);
  expect(lot.originalEndsAt.getTime()).toBeLessThanOrEqual(lot.endsAt.getTime());

  const entries = await prisma.ledgerEntry.findMany({ where: { lotId }, orderBy: { seq: "asc" } });
  const net = new Map<string, bigint>();
  for (const entry of entries) {
    const sign = entry.kind === "HOLD" ? 1n : entry.kind === "RELEASE" ? -1n : 0n;
    net.set(entry.userId, (net.get(entry.userId) ?? 0n) + sign * entry.amountCents);
  }
  for (const [userId, committed] of net) {
    expect(committed).toBe(userId === lot.leaderId ? (lot.currentBidCents ?? 0n) : 0n);
  }
  if (lot.leaderId) expect(net.get(lot.leaderId)).toBe(lot.currentBidCents);

  const wallets = await prisma.wallet.findMany();
  for (const wallet of wallets) {
    expect(wallet.committedCents >= 0n).toBe(true);
    expect(wallet.totalCents >= wallet.committedCents).toBe(true);
    const latest = await prisma.ledgerEntry.findFirst({ where: { userId: wallet.userId }, orderBy: { seq: "desc" } });
    if (latest) {
      expect(latest.totalAfter).toBe(wallet.totalCents);
      expect(latest.committedAfter).toBe(wallet.committedCents);
    }
  }
}
