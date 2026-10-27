import {
  AUDIT_TEXT,
  brasiliaParts,
  formatBrasilia,
  formatLotNumber,
  type AuditRowDto,
  type AuditRowStatus,
  type AuditView,
} from "@lanceauto/shared";

/** O "Verificando" dura no mínimo isto, para ser perceptível (S08 §9 e §16.2). */
export const MIN_VERIFYING_MS = 400;

export type RowIcon = "check" | "x" | "broken";

export interface RowStatusView {
  label: string;
  icon: RowIcon;
  /**
   * Cor do texto. Nunca é a única pista (rótulo, ícone e borda dizem o mesmo). "NÃO CONFERE" fica em tinta: ferrugem
   * sobre o fundo `falha` da própria linha dá 3,8:1 no tema noite, abaixo do piso de 4,5:1.
   */
  tone: "verde" | "ferrugem" | "tinta";
  /** Cor do ícone (decorativo, `aria-hidden`). */
  iconTone: "verde" | "ferrugem";
  /** Borda esquerda de 6 px da linha. */
  border: "verde" | "ferrugem";
  /** Fundo `falha` só na primeira linha que não confere. */
  highlight: boolean;
  /** Elo quebrado: os dados da linha esmaecem a 85% (o protótipo usava 62%); a Situação não esmaece. */
  faded: boolean;
}

const ROW_STATUS: Record<AuditRowStatus, Omit<RowStatusView, "label">> = {
  OK: { icon: "check", tone: "verde", iconTone: "verde", border: "verde", highlight: false, faded: false },
  MISMATCH: { icon: "x", tone: "tinta", iconTone: "ferrugem", border: "ferrugem", highlight: true, faded: false },
  BROKEN_LINK: { icon: "broken", tone: "ferrugem", iconTone: "ferrugem", border: "ferrugem", highlight: false, faded: true },
};

export function rowStatusView(status: AuditRowStatus): RowStatusView {
  return { label: AUDIT_TEXT.rowStatus[status], ...ROW_STATUS[status] };
}

/** "09": a posição na cadeia sempre com 2 dígitos. */
export function lineNumber(seq: number): string {
  return String(seq).padStart(2, "0");
}

/** "25/10 12:04:09": o horário da linha, em Brasília, com segundos. */
export function rowTimeLabel(iso: string): string {
  const p = brasiliaParts(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.day)}/${pad(p.month)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/** "2015 · LANCES: 5 · ARREMATADO": o status em texto, nunca só cor ou carimbo. */
export function lotMetaLine(lot: Pick<AuditView["lot"], "year" | "bidCount" | "status">): string {
  return `${lot.year} · LANCES: ${lot.bidCount} · ${AUDIT_TEXT.statusMeta[lot.status]}`;
}

export function auditTitle(lotNumber: number): string {
  return `Auditoria do lote ${formatLotNumber(lotNumber)} · LanceAuto`;
}

/** "Verificado em 25/10/2026 12:04:09 (Brasília)". */
export function verifiedAtLabel(verifiedAt: string): string {
  return AUDIT_TEXT.verifiedAt(formatBrasilia(verifiedAt, "seconds"));
}

export type BidderCell =
  | { kind: "bid"; pseudonym: string; mine: boolean; note: null }
  | { kind: "cancel"; label: string; note: string | null };

/** Conteúdo da coluna Licitante. `hadBids`: o lote tinha ao menos um lance quando foi cancelado. */
export function bidderCell(row: AuditRowDto, hadBids = false): BidderCell {
  if (row.kind === "CANCEL") {
    return { kind: "cancel", label: AUDIT_TEXT.cancelRow, note: hadBids ? AUDIT_TEXT.cancelRowNote : null };
  }
  return { kind: "bid", pseudonym: row.pseudonym ?? "", mine: row.mine, note: null };
}

export interface CounterView {
  inChain: number;
  inSeal: number;
  /** "NA CORRENTE" e "NO SELO" ficam em ferrugem quando o selo não fecha. */
  chainAlert: boolean;
  sealAlert: boolean;
  receiptShown: boolean;
  receiptAlert: boolean;
}

export function counterView(verdict: AuditView["verdict"], { hasReceipt }: { hasReceipt: boolean }): CounterView {
  const sealBroken = verdict.code === "SEAL_MISMATCH";
  return {
    inChain: verdict.foundCount,
    inSeal: verdict.registeredCount,
    chainAlert: sealBroken,
    sealAlert: sealBroken,
    receiptShown: hasReceipt,
    receiptAlert: hasReceipt && (verdict.code === "RECEIPT_MISMATCH" || verdict.receiptOk === false),
  };
}

export interface HashToggleView {
  text: string;
  /** Nome acessível único: "ver hash inteiro da linha 09". */
  ariaLabel: string;
  /** `id` do elemento que o botão expande. */
  controls: string;
  expanded: boolean;
}

/** `what`: de quem é o hash ("da linha 09", "final", "do comprovante"). */
export function hashToggle(controls: string, what: string, expanded: boolean): HashToggleView {
  return {
    text: expanded ? AUDIT_TEXT.collapse : AUDIT_TEXT.showFull,
    ariaLabel: expanded ? AUDIT_TEXT.collapseLabel(what) : AUDIT_TEXT.showFullLabel(what),
    controls,
    expanded,
  };
}

export type AuditScreenState = "verifying" | "result" | "stale" | "error" | "notfound";

/**
 * Qual das telas da §9 vale agora. Verificando esconde carimbo e frase (também no "Verificar de novo"); erro com
 * resultado anterior mantém o resultado marcado "DESATUALIZADO".
 */
export function auditScreenState(input: { hasData: boolean; isFetching: boolean; isError: boolean; notFound: boolean }): AuditScreenState {
  if (input.notFound) return "notfound";
  if (!input.hasData) return input.isError && !input.isFetching ? "error" : "verifying";
  if (input.isFetching) return "verifying";
  return input.isError ? "stale" : "result";
}

/** Clique repetido em "Verificar de novo" durante a verificação é ignorado: uma chamada só (AC-8.24). */
export function shouldStartVerify(isFetching: boolean): boolean {
  return !isFetching;
}
