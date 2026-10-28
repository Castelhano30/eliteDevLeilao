import { z } from "zod";
import type { BidDTO } from "./bids";

export const LOT_STATUSES = ["CANCELLED", "SCHEDULED", "LIVE", "CLOSING", "SOLD", "UNSOLD"] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];

/** Rótulo de UX de cada status (C5: CLOSING é só "apurando"). */
export const LOT_STATUS_LABEL: Record<LotStatus, string> = {
  CANCELLED: "Cancelado",
  SCHEDULED: "Agendado",
  LIVE: "Ao vivo",
  CLOSING: "Apurando",
  SOLD: "Arrematado",
  UNSOLD: "Sem lances",
};

type Instant = Date | string;
const toMs = (value: Instant) => (typeof value === "string" ? Date.parse(value) : value.getTime());

export interface LotStatusInput {
  startsAt: Instant;
  endsAt: Instant;
  cancelledAt: Instant | null;
  settledAt: Instant | null;
  bidCount: number;
}

/**
 * Status calculado, nunca gravado (INV-11). `now == startsAt` já é LIVE; `now == endsAt` não é mais LIVE.
 */
export function lotStatus(lot: LotStatusInput, now: Instant): LotStatus {
  const at = toMs(now);
  if (lot.cancelledAt !== null) return "CANCELLED";
  if (at < toMs(lot.startsAt)) return "SCHEDULED";
  if (at < toMs(lot.endsAt)) return "LIVE";
  if (lot.settledAt === null) return "CLOSING";
  return lot.bidCount > 0 ? "SOLD" : "UNSOLD";
}

/** Grupo da Vitrine: "Ao vivo" contém LIVE e CLOSING; "Encerrados", SOLD e UNSOLD. */
export type ShowcaseGroup = "LIVE" | "SCHEDULED" | "ENDED";
export const SHOWCASE_GROUPS = ["LIVE", "SCHEDULED", "ENDED"] as const;

export function showcaseGroup(status: LotStatus): ShowcaseGroup | null {
  if (status === "LIVE" || status === "CLOSING") return "LIVE";
  if (status === "SCHEDULED") return "SCHEDULED";
  if (status === "SOLD" || status === "UNSOLD") return "ENDED";
  return null;
}

/** Sem lances: lance inicial. Com lances: lance atual + incremento. */
export function minimumNextCents(lot: {
  currentBidCents: number | null;
  startingBidCents: number;
  minIncrementCents: number;
}): number {
  return lot.currentBidCents === null ? lot.startingBidCents : lot.currentBidCents + lot.minIncrementCents;
}

export interface LotCard {
  id: string;
  number: number;
  title: string;
  brand: string;
  model: string;
  year: number;
  fuel: string;
  status: LotStatus;
  currentBidCents: number | null;
  startingBidCents: number;
  minIncrementCents: number;
  referencePriceCents: number;
  bidCount: number;
  /** = entryCount (T4); sobe a cada linha da cadeia. */
  version: number;
  startsAt: string;
  endsAt: string;
  originalEndsAt: string;
  cancelledAt: string | null;
  /** Caminho relativo "/items/{itemId}/image"; o web prefixa com a URL da API. */
  imageUrl: string | null;
}

export interface LotStateLot {
  id: string;
  number: number;
  title: string;
  status: LotStatus;
  startingBidCents: number;
  minIncrementCents: number;
  currentBidCents: number | null;
  /** Mínimo aceito agora; o cliente usa este valor e não recalcula. */
  minimumBidCents: number;
  bidCount: number;
  /** Licitantes distintos com lance no lote. */
  bidderCount: number;
  version: number;
  /** Alias de `version`, só leitura. */
  entryCount: number;
  startsAt: string;
  endsAt: string;
  originalEndsAt: string;
  cancelledAt: string | null;
  settledAt: string | null;
  /** Só para `BIDDER` logado; o pseudônimo vale mesmo sem lance dado. */
  myPseudonym: string | null;
  /** 1 + licitantes com lance maior que o meu; `null` sem lance meu. */
  myRank: number | null;
  myBestBidCents: number | null;
  /** Resultado do fechamento; `null` enquanto ao vivo, agendado, apurando ou cancelado (R-5.9). */
  result: LotResult | null;
  /** Token do comprovante: só para o vencedor logado, nunca para outro licitante, o leiloeiro ou visitante (T9). */
  myReceiptToken: string | null;
}

export type LotOutcome = "SOLD" | "UNSOLD";

export interface LotResult {
  outcome: LotOutcome;
  finalBidCents: number | null;
  /** Pseudônimo do vencedor NAQUELE lote; `null` sem lances. */
  winnerPseudonym: string | null;
  /** O martelo é `endsAt` (com prorrogações), não `settledAt` (R-5.6). */
  hammerAt: string;
  settledAt: string;
}

export interface LotStateCar {
  brand: string;
  model: string;
  year: number;
  fuel: string;
  referencePriceCents: number;
  referenceMonth: string;
  imageUrl: string | null;
  /**
   * Fotos da galeria, caminhos relativos na ordem de exibição: a capa é "/items/{itemId}/image" (igual a `imageUrl`)
   * e as demais "/items/{itemId}/images/{posição}". Vazio sem imagem. A Sala só monta a galeria com mais de uma foto.
   */
  gallery: string[];
  imageCredit: string | null;
  imageCreditUrl: string | null;
}

export interface LotState {
  serverTime: string;
  lot: LotStateLot;
  car: LotStateCar;
  /** Só `kind=BID`, do mais novo para o mais antigo. */
  bids: BidDTO[];
}

export type StoredImageStatus = "STORED" | "NONE" | "FAILED";

export interface CreateLotResponse extends LotState {
  imageStatus: StoredImageStatus;
}

/** Marcas do seletor da Vitrine: as da FIPE mais as dos lotes publicados, sem repetir. */
export interface BrandListResponse {
  brands: string[];
}

export interface LotListResponse {
  lots: LotCard[];
  brands: string[];
  counts: { live: number; scheduled: number; ended: number };
  serverTime: string;
}

/** Resultado de um lote encerrado do leiloeiro (linha do Painel). */
export interface MyLotResult {
  outcome: LotOutcome;
  finalBidCents: number | null;
  winnerPseudonym: string | null;
  referencePriceCents: number;
  settledAt: string;
}

export interface MyLotCard extends LotCard {
  /** `null` até o fechamento. */
  resultado: MyLotResult | null;
  /**
   * Estorno devolvido ao líder quando o lote foi cancelado (= `currentBidCents` se havia lances); `null` sem
   * lances ou sem cancelamento (S06 R-6.4). O momento do cancelamento está em `cancelledAt` (do `LotCard`).
   */
  refundedCents: number | null;
}

export interface MyLotsResponse {
  lots: MyLotCard[];
  totalReceivedCents: number;
  serverTime: string;
}

/** Fotos do aparelho no `POST /lots` multipart (a primeira é a capa). */
export const LOT_IMAGE_MAX_COUNT = 5;
/** Teto por foto, no navegador (depois da redução) e no servidor (defesa). */
export const LOT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
/** Teto do corpo multipart inteiro. */
export const LOT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
/** Teto do campo `payload` (o JSON do lote) no multipart. */
export const LOT_PAYLOAD_MAX_BYTES = 64 * 1024;
/** Só estes tipos valem no envio de fotos, conferidos pelos bytes. */
export const LOT_UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type LotUploadMime = (typeof LOT_UPLOAD_MIME_TYPES)[number];
/** Redução no navegador antes de enviar: lado maior e qualidade do JPEG (nunca amplia). */
export const LOT_IMAGE_RESIZE_MAX_SIDE = 1600;
export const LOT_IMAGE_RESIZE_QUALITY = 0.85;

const MEGABYTE = 1024 * 1024;

export const LOT_TEXT = {
  idsRequired: "Escolha marca, modelo e ano.",
  titleRequired: "Dê um título ao lote.",
  titleTooLong: "O título aceita até 120 caracteres.",
  startingBid: "O lance inicial precisa ser de pelo menos R$ 1,00.",
  minIncrement: "O incremento precisa ser de pelo menos R$ 1,00.",
  startsAtRequired: "Informe o início.",
  startsAtPast: "O início não pode estar no passado.",
  endsAtRequired: "Informe o fim.",
  endsAtTooSoon: "O fim precisa ser pelo menos 5 minutos depois do início.",
  urlInvalid: "Use um endereço http ou https válido.",
  creditTooLong: "O crédito aceita até 200 caracteres.",
  statusInvalid: "Filtro de status inválido. Use LIVE, SCHEDULED ou ENDED.",
  notFoundTitle: "Lote não encontrado.",
  notFoundBody: "Esse lote não existe, ou já foi para a gaveta.",
  cancelledBody: "O leiloeiro cancelou este lote. Nada foi vendido e todo saldo travado voltou.",
  imagesBoth: "Escolha uma URL ou fotos do aparelho. As duas juntas não valem.",
  imagesTooMany: `Envie no máximo ${LOT_IMAGE_MAX_COUNT} fotos.`,
  imageTooBig: `Cada foto aceita até ${LOT_IMAGE_MAX_BYTES / MEGABYTE} MB.`,
  imageType: "Use fotos JPEG, PNG ou WebP.",
  uploadTooLarge: `As fotos passaram de ${LOT_UPLOAD_MAX_BYTES / MEGABYTE} MB no total. Envie menos fotos.`,
  payloadMissing: "Os dados do lote não chegaram completos. Tente de novo.",
  imagesRequired: "Escolha ao menos uma foto ou use a ilustração padrão do pátio.",
  imagesOverflow: `Só cabem ${LOT_IMAGE_MAX_COUNT} fotos. As demais ficaram de fora.`,
  imageUnreadable: (name: string) => `Não deu para ler ${name}. Use JPEG, PNG ou WebP.`,
  discardPhotosTitle: (count: number) =>
    count === 1 ? "A foto escolhida será descartada." : `As ${count} fotos escolhidas serão descartadas.`,
  discardPhotosBody: "Voltando para a URL, as fotos que você escolheu não vão junto no lote.",
  discardPhotosConfirm: "Descartar fotos",
  discardPhotosKeep: "Manter fotos",
} as const;

export const LOT_TITLE_MAX = 120;
export const IMAGE_URL_MAX = 2048;
export const IMAGE_CREDIT_MAX = 200;
export const IMAGE_CREDIT_URL_MAX = 500;
/** Duração mínima do lote e tolerância do início (R-2.7, Q2 do SPEC). */
export const LOT_MIN_DURATION_MS = 5 * 60 * 1000;
export const LOT_START_TOLERANCE_MS = 60 * 1000;

/** Só `http:` e `https:` (nunca `javascript:` nem `data:`). */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const ISO_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?Z$/;

/** O `Date` "corrige" 31/02 para 03/03 e 24:00 para o dia seguinte; aqui a data tem que existir como escrita. */
function isRealIsoUtc(value: string): boolean {
  const match = ISO_UTC.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map((part) => Number(part ?? 0));
  const back = new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!, second!));
  return (
    back.getUTCFullYear() === year &&
    back.getUTCMonth() === month! - 1 &&
    back.getUTCDate() === day &&
    back.getUTCHours() === hour &&
    back.getUTCMinutes() === minute &&
    back.getUTCSeconds() === second
  );
}

const isoUtc = (message: string) => z.string({ error: message }).refine(isRealIsoUtc, message);

const catalogId = z
  .string({ error: LOT_TEXT.idsRequired })
  .trim()
  .min(1, LOT_TEXT.idsRequired)
  .max(40, LOT_TEXT.idsRequired)
  .regex(/^[\w-]+$/, LOT_TEXT.idsRequired);

const cents = (message: string) => z.number({ error: message }).int(message).min(100, message);

/** "" e espaços contam como ausente nos campos opcionais de imagem. */
const optionalText = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), schema.optional());

/** Corpo de `POST /lots` sem as regras que dependem do relógio. */
export const createLotBaseSchema = z.object({
  brandId: catalogId,
  modelId: catalogId,
  yearId: catalogId,
  title: z
    .string({ error: LOT_TEXT.titleRequired })
    .trim()
    .min(1, LOT_TEXT.titleRequired)
    .max(LOT_TITLE_MAX, LOT_TEXT.titleTooLong),
  startingBidCents: cents(LOT_TEXT.startingBid),
  minIncrementCents: cents(LOT_TEXT.minIncrement),
  startsAt: isoUtc(LOT_TEXT.startsAtRequired),
  endsAt: isoUtc(LOT_TEXT.endsAtRequired),
  imageUrl: optionalText(
    z.string({ error: LOT_TEXT.urlInvalid }).trim().max(IMAGE_URL_MAX, LOT_TEXT.urlInvalid).refine(isHttpUrl, LOT_TEXT.urlInvalid),
  ),
  imageCredit: optionalText(z.string({ error: LOT_TEXT.creditTooLong }).trim().max(IMAGE_CREDIT_MAX, LOT_TEXT.creditTooLong)),
  imageCreditUrl: optionalText(
    z
      .string({ error: LOT_TEXT.urlInvalid })
      .trim()
      .max(IMAGE_CREDIT_URL_MAX, LOT_TEXT.urlInvalid)
      .refine(isHttpUrl, LOT_TEXT.urlInvalid),
  ),
});

export type CreateLotInput = z.infer<typeof createLotBaseSchema>;

const validIso = (value: unknown): value is string => typeof value === "string" && isRealIsoUtc(value);

/** Regras de data que dependem do relógio: início ≥ agora − 60 s e fim ≥ início + 5 min (R-2.7). */
export function lotDateErrors(input: { startsAt?: unknown; endsAt?: unknown }, nowMs: number): Record<string, string> {
  const fields: Record<string, string> = {};
  if (validIso(input.startsAt) && Date.parse(input.startsAt) < nowMs - LOT_START_TOLERANCE_MS) {
    fields.startsAt = LOT_TEXT.startsAtPast;
  }
  if (validIso(input.startsAt) && validIso(input.endsAt)) {
    if (Date.parse(input.endsAt) - Date.parse(input.startsAt) < LOT_MIN_DURATION_MS) fields.endsAt = LOT_TEXT.endsAtTooSoon;
  }
  return fields;
}

export type CreateLotValidation = { ok: true; data: CreateLotInput } | { ok: false; fields: Record<string, string> };

/**
 * Validação completa de `POST /lots`, igual no web e na API. `nowMs` vem do relógio do chamador
 * (API: `clock.now()`; web: relógio do servidor). Todos os campos com erro voltam juntos.
 */
export function validateCreateLot(body: unknown, nowMs: number): CreateLotValidation {
  const raw = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const parsed = createLotBaseSchema.safeParse(raw);
  const fields: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!(key in fields)) fields[key] = issue.message;
    }
  }
  for (const [key, message] of Object.entries(lotDateErrors(raw, nowMs))) {
    if (!(key in fields)) fields[key] = message;
  }
  if (parsed.success && Object.keys(fields).length === 0) return { ok: true, data: parsed.data };
  return { ok: false, fields };
}

/** Query de `GET /lots`. */
export const lotListQuerySchema = z.object({
  status: z.enum(SHOWCASE_GROUPS, { error: LOT_TEXT.statusInvalid }).optional(),
  q: z.string({ error: "Busca inválida." }).optional(),
  brand: z.string({ error: "Marca inválida." }).optional(),
});
export type LotListQuery = z.infer<typeof lotListQuerySchema>;
