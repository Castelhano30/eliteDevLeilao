import { z } from "zod";
import {
  AUTH_TEXT,
  BID_TEXT,
  MY_BIDS_TEXT,
  belowMinimumMessage,
  insufficientBalanceMessage,
  lotEndedMessage,
  lotNotStartedMessage,
  placeBidSchema,
} from "@lanceauto/shared";
import { registry } from "../registry";
import { myBidsSchema, placeBidResponseSchema } from "../schemas";
import { REQUIRES_AUTH, TAGS, errorResponses } from "./common";

const placeBidBody = registry.register(
  "PlaceBidInput",
  placeBidSchema.describe("`amountCents` é o lance; `expectedCurrentCents` é o último lance que o cliente viu (`null` se não havia)."),
);

export function registerBidPaths(): void {
  registry.registerPath({
    method: "post",
    path: "/lots/{id}/bids",
    tags: [TAGS.bids],
    summary: "Dá um lance",
    description:
      "Num único passo e numa única transação: trava o lote, valida, compromete o saldo de quem lidera, libera o do " +
      "superado e grava o lance na cadeia de auditoria. Um lance nos últimos 2 minutos leva o fim a `agora + 2 min`, " +
      "sem teto. Sem atualização otimista: o servidor é a verdade de tempo, saldo e valor.\n\n" +
      "**Ordem das recusas:** `LOT_CANCELLED`, `LOT_NOT_STARTED`, `LOT_ENDED`, `BELOW_MINIMUM`, `ALREADY_WINNING`, " +
      "`ROLE_NOT_ALLOWED`, `INSUFFICIENT_BALANCE`. O leiloeiro (`AUCTIONEER`) chega até a checagem de papel e é barrado " +
      "com `ROLE_NOT_ALLOWED`. `expectedCurrentCents` é o último lance que o cliente viu (`null` se não havia): " +
      "se estiver desatualizado, `BELOW_MINIMUM` volta com `details.reason` `OUTDATED`. Limite de 30 lances por minuto por usuário.",
    security: REQUIRES_AUTH,
    request: {
      params: z.object({ id: z.string().describe("Id do lote.").openapi({ example: "cm2x7q1ab0000lot" }) }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: placeBidBody,
            example: { amountCents: 3_050_000, expectedCurrentCents: 3_000_000 },
          },
        },
      },
    },
    responses: {
      201: { description: "Lance aceito.", content: { "application/json": { schema: placeBidResponseSchema } } },
      ...errorResponses(
        { code: "VALIDATION", details: { fields: { amountCents: BID_TEXT.invalidAmount } } },
        { code: "UNAUTHENTICATED", message: AUTH_TEXT.unauthenticated },
        { code: "ROLE_NOT_ALLOWED", message: BID_TEXT.roleNotAllowed },
        { code: "NOT_FOUND", message: "Lote não encontrado." },
        { code: "LOT_CANCELLED", message: BID_TEXT.lotCancelled },
        { code: "LOT_NOT_STARTED", message: lotNotStartedMessage("2026-11-02T13:00:00.000Z"), details: { startsAt: "2026-11-02T13:00:00.000Z" } },
        { code: "LOT_ENDED", message: lotEndedMessage("2026-11-02T15:00:00.000Z") },
        { code: "ALREADY_WINNING", message: BID_TEXT.alreadyWinning },
        {
          code: "BELOW_MINIMUM",
          message: belowMinimumMessage("MINIMUM", 3_050_000),
          details: { minimumCents: 3_050_000, currentBidCents: 3_000_000, reason: "MINIMUM" },
        },
        {
          code: "INSUFFICIENT_BALANCE",
          message: insufficientBalanceMessage(1_000_000),
          details: { availableCents: 1_000_000 },
        },
        "PAYLOAD_TOO_LARGE",
        { code: "RATE_LIMITED", message: BID_TEXT.rateLimited },
      ),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/me/bids",
    tags: [TAGS.bids],
    summary: "Meus arremates",
    description:
      "**Papel exigido: `BIDDER`.** Os lotes em que o licitante deu lance, cada um como ganhando (`LEADING`), superado " +
      "(`OUTBID`), arrematado (`WON`), perdido (`LOST`) ou cancelado (`CANCELLED`). Em `WON` traz o `receiptToken` do " +
      "próprio vencedor. A resposta nunca vai para cache compartilhado (`Cache-Control: no-store`).",
    security: REQUIRES_AUTH,
    responses: {
      200: {
        description: "Arremates do licitante.",
        headers: { "Cache-Control": { description: "`no-store`.", schema: { type: "string" } } },
        content: { "application/json": { schema: myBidsSchema } },
      },
      ...errorResponses(
        { code: "UNAUTHENTICATED", message: AUTH_TEXT.unauthenticated },
        { code: "ROLE_NOT_ALLOWED", message: MY_BIDS_TEXT.roleNotAllowed },
      ),
    },
  });
}
