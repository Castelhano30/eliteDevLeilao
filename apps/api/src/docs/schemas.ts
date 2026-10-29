import { z } from "zod";
import {
  BIDDER_LOT_STATES,
  LEDGER_KINDS,
  LOT_STATUSES,
  ROLES,
  auditViewSchema,
  errorEnvelopeSchema,
  type AuditView,
  type AuthResponse,
  type BidDTO,
  type BrandListResponse,
  type CatalogListResponse,
  type CatalogPreviewResponse,
  type CreateLotResponse,
  type DepositResponse,
  type LeadingLotDto,
  type LedgerEntryDto,
  type LotCard,
  type LotListResponse,
  type LotResult,
  type LotState,
  type LotStateCar,
  type LotStateLot,
  type LotSummary,
  type MeResponse,
  type MyBidItem,
  type MyBidsResponse,
  type MyLotCard,
  type MyLotResult,
  type MyLotsResponse,
  type PlaceBidResponse,
  type ReceiptCar,
  type ReceiptDTO,
  type UserDto,
  type WalletDto,
  type WalletPageDto,
} from "@lanceauto/shared";
import { registry } from "./registry";

/**
 * Esquemas de SAÍDA. Os contratos do shared são `interface`; aqui cada um ganha um zod amarrado ao tipo nos dois
 * sentidos em tempo de compilação: campo novo, removido ou de tipo diferente no shared quebra o `typecheck` até a
 * documentação acompanhar.
 */
function bind<T>() {
  return <S extends z.ZodType<T>>(
    name: string,
    schema: S,
    // Se o tipo do shared não cabe no esquema (campo faltando aqui), este parâmetro vira `never` e a chamada não compila.
    ..._reverse: [T] extends [z.output<S>] ? [] : [never]
  ): S => registry.register(name, schema);
}

const cents = (description: string) => z.number().int().describe(`${description} Em centavos inteiros.`);
const centsOrNull = (description: string) => cents(description).nullable();
const instant = (description: string) =>
  z.string().openapi({ format: "date-time", example: "2026-10-29T18:30:00.000Z" }).describe(`${description} ISO 8601 em UTC.`);
const instantOrNull = (description: string) => instant(description).nullable();
const id = (description: string) => z.string().describe(description);

// ---------------------------------------------------------------------------------------------------------------
// Erro, saúde

/** Envelope de erro de INV-16, o mesmo `errorEnvelopeSchema` do shared. */
export const errorEnvelopeDoc = registry.register(
  "ErrorEnvelope",
  errorEnvelopeSchema.describe(
    "Todo erro sai neste envelope, com mensagem em pt-BR. `details` varia: `{fields: {campo: mensagem}}` em VALIDATION " +
      "e EMAIL_TAKEN, `{minimumCents, currentBidCents, reason}` em BELOW_MINIMUM, `{availableCents}` em " +
      "INSUFFICIENT_BALANCE, `{startsAt}` em LOT_NOT_STARTED, `{entryCount}` em LOT_CHANGED.",
  ),
);

export const healthOkSchema = registry.register(
  "HealthOk",
  z.object({ ok: z.literal(true), db: z.literal(true) }).describe("Processo e banco respondendo."),
);
export const healthDownSchema = registry.register(
  "HealthDown",
  z.object({ ok: z.literal(false), db: z.literal(false) }).describe("O processo responde, mas o banco não."),
);

// ---------------------------------------------------------------------------------------------------------------
// Conta e carteira

export const userSchema = bind<UserDto>()(
  "User",
  z.object({
    id: id("Id do usuário."),
    name: z.string(),
    email: z.string(),
    role: z.enum(ROLES).describe("BIDDER é o licitante; AUCTIONEER, o leiloeiro. Um papel por conta."),
  }),
);

export const authResponseSchema = bind<AuthResponse>()(
  "AuthResponse",
  z.object({ token: z.string().describe("JWT para o cabeçalho `Authorization: Bearer`."), user: userSchema }),
);

export const walletSchema = bind<WalletDto>()(
  "Wallet",
  z
    .object({
      totalCents: cents("Saldo total."),
      committedCents: cents("Comprometido: o valor dos lances que hoje lideram."),
      availableCents: cents("Disponível = total − comprometido."),
    })
    .describe("Carteira simulada do licitante."),
);

export const meResponseSchema = bind<MeResponse>()("MeResponse", z.object({ user: userSchema, wallet: walletSchema }));

export const ledgerEntrySchema = bind<LedgerEntryDto>()(
  "LedgerEntry",
  z.object({
    id: id("Id da linha do extrato."),
    kind: z
      .enum(LEDGER_KINDS)
      .describe(
        "DEPOSIT (depósito), HOLD (lance líder comprometeu saldo), RELEASE (lance superado), REFUND (estorno por " +
          "cancelamento), SALE_DEBIT (débito do vencedor), SALE_CREDIT (crédito do leiloeiro).",
      ),
    amountCents: cents("Valor do movimento."),
    lotId: z.string().nullable().describe("Lote do movimento; nulo no depósito."),
    lotNumber: z.number().int().nullable().describe("Número do lote (3 dígitos na tela); nulo sem `lotId`."),
    totalAfterCents: cents("Saldo total depois do movimento."),
    committedAfterCents: cents("Comprometido depois do movimento."),
    createdAt: instant("Quando o movimento foi gravado."),
  }),
);

const leadingLotSchema = bind<LeadingLotDto>()(
  "LeadingLot",
  z.object({
    lotId: id("Id do lote."),
    number: z.number().int(),
    title: z.string(),
    committedCents: cents("Valor comprometido neste lote."),
  }),
);

export const walletPageSchema = bind<WalletPageDto>()(
  "WalletPage",
  walletSchema.extend({
    entries: z.array(ledgerEntrySchema).describe("Extrato, do movimento mais novo para o mais antigo."),
    nextCursor: z.string().nullable().describe("Passe em `cursor` para a página seguinte; nulo na última."),
    leadingLots: z.array(leadingLotSchema).describe("Lotes em que o licitante lidera agora."),
  }),
);

export const depositResponseSchema = bind<DepositResponse>()(
  "DepositResponse",
  z.object({ wallet: walletSchema, entry: ledgerEntrySchema }),
);

// ---------------------------------------------------------------------------------------------------------------
// Catálogo (FIPE)

const catalogOptionSchema = z.object({ id: z.string().describe("Id da FIPE."), name: z.string() });

export const catalogListSchema = bind<CatalogListResponse>()(
  "CatalogList",
  z.object({ items: z.array(catalogOptionSchema) }),
);

export const catalogPreviewSchema = bind<CatalogPreviewResponse>()(
  "CatalogPreview",
  z.object({
    car: z.object({
      brand: z.string(),
      model: z.string(),
      year: z.number().int(),
      fuel: z.string(),
      referencePriceCents: cents("Preço de referência da FIPE."),
      referenceMonth: z.string().describe("`YYYY-MM`, ou o texto cru da FIPE se o formato for outro."),
      codeFipe: z.string(),
    }),
    suggestedImage: z
      .object({
        url: z.string(),
        credit: z.string().describe("Crédito sugerido para a foto."),
        creditUrl: z.string(),
      })
      .optional()
      .describe("Sugestão da Wikipedia; ausente quando não há foto."),
    imageStatus: z
      .enum(["FOUND", "NOT_FOUND", "UNAVAILABLE"])
      .describe("FOUND: há sugestão. NOT_FOUND: a Wikipedia não tem foto. UNAVAILABLE: a Wikipedia não respondeu."),
  }),
);

// ---------------------------------------------------------------------------------------------------------------
// Lotes

const lotStatusSchema = registry.register(
  "LotStatus",
  z
    .enum(LOT_STATUSES)
    .describe(
      "Calculado pelo servidor, nunca gravado: CANCELLED, SCHEDULED (agendado), LIVE (ao vivo), CLOSING (apurando: " +
        "o fim passou e a liquidação ainda não rodou), SOLD (arrematado), UNSOLD (sem lances).",
    ),
);

export const lotCardSchema = bind<LotCard>()(
  "LotCard",
  z.object({
    id: id("Id do lote."),
    number: z.number().int().describe("Número sequencial do lote."),
    title: z.string(),
    brand: z.string(),
    model: z.string(),
    year: z.number().int(),
    fuel: z.string(),
    status: lotStatusSchema,
    currentBidCents: centsOrNull("Lance atual; nulo sem lances."),
    startingBidCents: cents("Lance inicial."),
    minIncrementCents: cents("Incremento mínimo."),
    referencePriceCents: cents("Preço de referência da FIPE."),
    bidCount: z.number().int(),
    version: z.number().int().describe("Igual a `entryCount`; sobe a cada linha da cadeia de auditoria."),
    startsAt: instant("Início."),
    endsAt: instant("Fim atual, com prorrogações."),
    originalEndsAt: instant("Fim original, imutável."),
    cancelledAt: instantOrNull("Cancelamento; nulo se não foi cancelado."),
    imageUrl: z.string().nullable().describe("Caminho relativo `/items/{itemId}/image`; nulo sem foto."),
  }),
);

const lotResultSchema = bind<LotResult>()(
  "LotResult",
  z.object({
    outcome: z.enum(["SOLD", "UNSOLD"]),
    finalBidCents: centsOrNull("Lance vencedor; nulo sem lances."),
    winnerPseudonym: z.string().nullable().describe("Pseudônimo do vencedor NAQUELE lote; nulo sem lances."),
    hammerAt: instant("O martelo é o `endsAt` (com prorrogações), não o `settledAt`."),
    settledAt: instant("Quando a liquidação rodou."),
  }),
);

const bidSchema = bind<BidDTO>()(
  "Bid",
  z
    .object({
      seq: z.number().int().describe("Posição na cadeia de auditoria do lote."),
      kind: z.literal("BID"),
      pseudonym: z.string().describe("`Licitante XXXX`: muda de lote para lote. Nunca identifica o usuário."),
      amountCents: cents("Valor do lance."),
      at: instant("Quando o lance foi aceito."),
    })
    .describe("Lance como o público o vê."),
);

const lotStateLotSchema = bind<LotStateLot>()(
  "LotStateLot",
  z.object({
    id: id("Id do lote."),
    number: z.number().int(),
    title: z.string(),
    status: lotStatusSchema,
    startingBidCents: cents("Lance inicial."),
    minIncrementCents: cents("Incremento mínimo."),
    currentBidCents: centsOrNull("Lance atual; nulo sem lances."),
    minimumBidCents: cents("Mínimo aceito agora: o cliente usa este valor e não recalcula."),
    bidCount: z.number().int(),
    bidderCount: z.number().int().describe("Licitantes distintos com lance no lote."),
    version: z.number().int(),
    entryCount: z.number().int().describe("Alias de `version`."),
    startsAt: instant("Início."),
    endsAt: instant("Fim atual, com prorrogações."),
    originalEndsAt: instant("Fim original."),
    cancelledAt: instantOrNull("Cancelamento."),
    settledAt: instantOrNull("Liquidação."),
    myPseudonym: z.string().nullable().describe("Só para licitante logado; vale mesmo sem lance dado."),
    myRank: z.number().int().nullable().describe("1 + licitantes com lance maior que o meu; nulo sem lance meu."),
    myBestBidCents: centsOrNull("Meu maior lance no lote."),
    result: lotResultSchema.nullable().describe("Nulo enquanto agendado, ao vivo, apurando ou cancelado."),
    myReceiptToken: z
      .string()
      .nullable()
      .describe(
        "Token do comprovante: só vai ao vencedor logado. Para visitante, leiloeiro e outros licitantes é sempre nulo.",
      ),
  }),
);

const lotStateCarSchema = bind<LotStateCar>()(
  "LotStateCar",
  z.object({
    brand: z.string(),
    model: z.string(),
    year: z.number().int(),
    fuel: z.string(),
    referencePriceCents: cents("Preço de referência da FIPE."),
    referenceMonth: z.string(),
    imageUrl: z.string().nullable().describe("Caminho relativo da capa."),
    gallery: z
      .array(z.string())
      .describe("Caminhos relativos na ordem de exibição: a capa é `/items/{itemId}/image`; as demais, `/items/{itemId}/images/{posição}`."),
    imageCredit: z.string().nullable(),
    imageCreditUrl: z.string().nullable(),
  }),
);

export const lotStateSchema = bind<LotState>()(
  "LotState",
  z.object({
    serverTime: instant("Relógio do servidor, a verdade de tempo."),
    lot: lotStateLotSchema,
    car: lotStateCarSchema,
    bids: z.array(bidSchema).describe("Só lances, do mais novo para o mais antigo."),
  }),
);

export const createLotResponseSchema = bind<CreateLotResponse>()(
  "CreateLotResponse",
  lotStateSchema.extend({
    imageStatus: z
      .enum(["STORED", "NONE", "FAILED"])
      .describe("STORED: a foto foi guardada. NONE: o lote ficou sem foto. FAILED: a foto não pôde ser baixada."),
  }),
);

export const brandListSchema = bind<BrandListResponse>()(
  "BrandList",
  z.object({ brands: z.array(z.string()).describe("Marcas da FIPE mais as dos lotes publicados, sem repetir.") }),
);

export const lotListSchema = bind<LotListResponse>()(
  "LotList",
  z.object({
    lots: z.array(lotCardSchema),
    brands: z.array(z.string()),
    counts: z.object({ live: z.number().int(), scheduled: z.number().int(), ended: z.number().int() }),
    serverTime: instant("Relógio do servidor."),
  }),
);

const myLotResultSchema = bind<MyLotResult>()(
  "MyLotResult",
  z.object({
    outcome: z.enum(["SOLD", "UNSOLD"]),
    finalBidCents: centsOrNull("Lance vencedor."),
    winnerPseudonym: z.string().nullable(),
    referencePriceCents: cents("Preço de referência da FIPE."),
    settledAt: instant("Liquidação."),
  }),
);

export const myLotCardSchema = bind<MyLotCard>()(
  "MyLotCard",
  lotCardSchema.extend({
    resultado: myLotResultSchema.nullable().describe("Nulo até o fechamento."),
    refundedCents: centsOrNull("Estorno devolvido ao líder quando o lote foi cancelado; nulo sem lances ou sem cancelamento."),
  }),
);

export const myLotsSchema = bind<MyLotsResponse>()(
  "MyLots",
  z.object({
    lots: z.array(myLotCardSchema),
    totalReceivedCents: cents("Soma das vendas liquidadas do leiloeiro; cancelados não entram."),
    serverTime: instant("Relógio do servidor."),
  }),
);

// ---------------------------------------------------------------------------------------------------------------
// Lances

const lotSummarySchema = bind<LotSummary>()(
  "LotSummary",
  z.object({
    id: id("Id do lote."),
    status: lotStatusSchema,
    currentBidCents: centsOrNull("Lance atual."),
    minimumBidCents: cents("Mínimo aceito depois deste lance."),
    bidCount: z.number().int(),
    bidderCount: z.number().int(),
    version: z.number().int(),
    entryCount: z.number().int().describe("Alias de `version`."),
    endsAt: instant("Fim atual."),
    originalEndsAt: instant("Fim original."),
    extended: z.boolean().describe("O lote já foi prorrogado em algum momento (`endsAt` > `originalEndsAt`)."),
    myRank: z.number().int().nullable(),
    myBestBidCents: centsOrNull("Meu maior lance."),
    myPseudonym: z.string().nullable(),
  }),
);

export const placeBidResponseSchema = bind<PlaceBidResponse>()(
  "PlaceBidResponse",
  z.object({
    bid: bidSchema,
    lot: lotSummarySchema,
    wallet: walletSchema,
    serverTime: instant("Relógio do servidor."),
  }),
);

// ---------------------------------------------------------------------------------------------------------------
// Comprovante, Meus arremates, Auditoria

const receiptCarSchema = bind<ReceiptCar>()(
  "ReceiptCar",
  z.object({
    title: z.string(),
    brand: z.string(),
    model: z.string(),
    year: z.number().int(),
    fuel: z.string(),
    referencePriceCents: cents("Preço de referência da FIPE."),
    referenceMonth: z.string().describe("`MM/YYYY`, ou o texto cru quando a origem não informa mês numérico."),
    imageUrl: z.string().nullable(),
    imageCredit: z.string().nullable(),
  }),
);

export const receiptSchema = bind<ReceiptDTO>()(
  "Receipt",
  z
    .object({
      lotNumber: z.number().int(),
      receiptCode: z.string().describe("Número do lote e 4 caracteres do token, por exemplo `018-7Q2K`."),
      lotId: id("Id do lote, para montar a rota da auditoria."),
      car: receiptCarSchema,
      amountCents: cents("Valor arrematado."),
      bidCount: z.number().int(),
      extended: z.boolean().describe("O lote foi prorrogado."),
      hammerAt: instant("O martelo é o `endsAt` do lote."),
      settledAt: instant("Liquidação."),
      winnerPseudonym: z.string().describe("Pseudônimo do vencedor NAQUELE lote."),
      finalHash: z.string().describe("HMAC-SHA256 em 64 hex minúsculos: o `lastHash` do lote."),
      auditUrl: z.string(),
    })
    .describe("Comprovante público. Nunca leva usuário, nome, e-mail nem o token."),
);

const myBidItemSchema = bind<MyBidItem>()(
  "MyBidItem",
  z.object({
    lot: lotCardSchema,
    state: z
      .enum(BIDDER_LOT_STATES)
      .describe("LEADING (ganhando), OUTBID (superado), WON (arrematado), LOST (perdido), CANCELLED (cancelado)."),
    myBestBidCents: cents("Meu maior lance no lote."),
    myPseudonym: z.string().describe("Meu pseudônimo neste lote."),
    myRank: z.number().int().nullable().describe("Só em LEADING e OUTBID."),
    bidderCount: z.number().int(),
    winnerPseudonym: z.string().nullable().describe("Só em WON e LOST."),
    receiptToken: z.string().nullable().describe("Só em WON: o token do comprovante do próprio vencedor."),
    refundedCents: centsOrNull("Só em CANCELLED em que eu liderava: o saldo que voltou."),
  }),
);

export const myBidsSchema = bind<MyBidsResponse>()(
  "MyBids",
  z.object({ items: z.array(myBidItemSchema), serverTime: instant("Relógio do servidor.") }),
);

/** O `auditViewSchema` do shared já é zod; só ganha nome e descrição. */
export const auditSchema = bind<AuditView>()(
  "AuditView",
  auditViewSchema.describe(
    "Auditoria pública: refaz o HMAC-SHA256 de cada linha da cadeia a cada chamada. Sem usuário, nome, e-mail nem token.",
  ),
);
