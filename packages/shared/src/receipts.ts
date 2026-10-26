import { formatLotNumber } from "./catalog";

/** Token do comprovante: 24 bytes aleatórios em base64url = 32 caracteres (INV-13). */
export const RECEIPT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function isReceiptToken(value: string): boolean {
  return RECEIPT_TOKEN_PATTERN.test(value);
}

/** "018-7Q2K": número do lote com 3 dígitos e os 4 primeiros caracteres do token em caixa alta. */
export function receiptCode(lotNumber: number, token: string): string {
  return `${formatLotNumber(lotNumber)}-${token.slice(0, 4).toUpperCase()}`;
}

export interface ReceiptCar {
  title: string;
  brand: string;
  model: string;
  year: number;
  fuel: string;
  referencePriceCents: number;
  /** Mês do snapshot da FIPE ("2026-10" ou o texto cru); o web formata. */
  referenceMonth: string;
  imageUrl: string | null;
  imageCredit: string | null;
}

/**
 * Comprovante público (`GET /receipts/:token`). Nunca leva `winnerId`, `userId`, nome, e-mail, `rawData` da FIPE
 * nem o token: quem chama já o tem (T9, INV-13).
 */
export interface ReceiptDTO {
  lotNumber: number;
  receiptCode: string;
  /** Só para montar a futura rota de auditoria (S08). */
  lotId: string;
  car: ReceiptCar;
  amountCents: number;
  bidCount: number;
  /** `endsAt > originalEndsAt`. */
  extended: boolean;
  /** O martelo é `lot.endsAt`, nunca `settledAt` (R-5.6). */
  hammerAt: string;
  settledAt: string;
  winnerPseudonym: string;
  /** HMAC-SHA256 em 64 hex minúsculos = `lot.lastHash`. */
  finalHash: string;
  auditUrl: string;
}

export const RECEIPT_TEXT = {
  notFoundTitle: "Comprovante não encontrado",
  notFoundBody: "Esse papel não existe, ou já foi para a gaveta.",
  backToShowcase: "Voltar à vitrine",
  copyLink: "Copiar link",
  copied: "Link copiado",
  copyFailed: "Não deu para copiar. Selecione o link e copie à mão.",
  networkError: "Não deu para carregar o comprovante.",
  retry: "Tentar novamente",
  privacyNote: "Nome e e-mail do arrematante não aparecem aqui. Em cada lote ele vira um Licitante diferente.",
  publicPage: "PÁGINA PÚBLICA · NÃO PRECISA DE LOGIN",
  hashLabel: "HASH FINAL · HMAC-SHA256",
} as const;

/** Quanto o botão "Link copiado" fica na tela. */
export const COPIED_LABEL_MS = 2_200;

export function copyLinkAriaLabel(lotNumber: number): string {
  return `Copiar link do comprovante do lote ${formatLotNumber(lotNumber)}`;
}

/** Caminho do comprovante no web. */
export function receiptPath(token: string): string {
  return `/c/${token}`;
}
