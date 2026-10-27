import { z } from "zod";
import { LOT_STATUSES, type LotStatus } from "./lots";

/** Rota da auditoria pública de um lote (S08). */
export function auditPath(lotId: string): string {
  return `/lotes/${lotId}/auditoria`;
}

export const AUDIT_ROW_STATUSES = ["OK", "MISMATCH", "BROKEN_LINK"] as const;
export const AUDIT_VERDICT_CODES = ["OK", "BROKEN_AT", "SEAL_MISMATCH", "RECEIPT_MISMATCH"] as const;
export const AUDIT_CONSISTENCY_ISSUES = ["RECEIPT_MISSING", "RECEIPT_AMOUNT", "RECEIPT_UNEXPECTED", "CANCEL_FLAG"] as const;

/** Uma linha da cadeia. `hash` é sempre o GRAVADO; não há campo de valor original nem de hash esperado (R-8.7). */
export const auditRowDtoSchema = z.object({
  seq: z.number().int(),
  kind: z.enum(["BID", "CANCEL"]),
  /** "Licitante 7F3A"; `null` na linha CANCEL. */
  pseudonym: z.string().nullable(),
  /** `true` só com token do dono da linha. `bidderId` nunca sai do servidor. */
  mine: z.boolean(),
  amountCents: z.number().int().nullable(),
  at: z.string(),
  hash: z.string(),
  status: z.enum(AUDIT_ROW_STATUSES),
});
export type AuditRowDto = z.infer<typeof auditRowDtoSchema>;

/** `GET /lots/:id/audit`. Sem `userId`, nome, e-mail, `leaderId` nem o token do comprovante (T9, INV-13). */
export const auditViewSchema = z.object({
  lot: z.object({
    id: z.string(),
    number: z.number().int(),
    title: z.string(),
    brand: z.string(),
    model: z.string(),
    year: z.number().int(),
    status: z.enum(LOT_STATUSES),
    startsAt: z.string(),
    endsAt: z.string(),
    originalEndsAt: z.string(),
    /** Só lances: a linha CANCEL não conta. */
    bidCount: z.number().int(),
    imageUrl: z.string().nullable(),
  }),
  entries: z.array(auditRowDtoSchema),
  verdict: z.object({
    code: z.enum(AUDIT_VERDICT_CODES),
    firstBad: z
      .object({
        seq: z.number().int(),
        expectedSeq: z.number().int(),
        reason: z.enum(["SEQ_GAP", "PREV_LINK", "HASH"]),
      })
      .nullable(),
    okCount: z.number().int(),
    foundCount: z.number().int(),
    /** O que o selo do lote registra (`entryCount`). */
    registeredCount: z.number().int(),
    sealOk: z.boolean(),
    /** `true` se há `Receipt` ou se o lote vendido deveria ter um (R-8.16). */
    receiptChecked: z.boolean(),
    receiptOk: z.boolean().nullable(),
    consistencyIssue: z.enum(AUDIT_CONSISTENCY_ISSUES).nullable(),
  }),
  /** `lot.lastHash` gravado. */
  finalHash: z.string(),
  /** Sem token: o link do comprovante é só do vencedor (T9). */
  receipt: z.object({ finalHash: z.string(), receiptCode: z.string() }).nullable(),
  verifiedAt: z.string(),
  serverTime: z.string(),
});
export type AuditView = z.infer<typeof auditViewSchema>;
export type AuditRowStatus = AuditRowDto["status"];
export type AuditConsistencyIssue = (typeof AUDIT_CONSISTENCY_ISSUES)[number];

/** Textos da Auditoria (S08 §8). Os marcados "texto a revisar" na fatia seguem para a revisão de voz da S09. */
export const AUDIT_TEXT = {
  legend: "AUDITORIA PÚBLICA · NÃO PRECISA DE LOGIN",
  verifying: "Refazendo a conta, elo por elo…",
  verifyAgain: "Verificar de novo",
  verifyingButton: "Verificando…",
  verifiedAt: (formatted: string) => `Verificado em ${formatted} (Brasília)`,
  emptyChain: "Sem lances, sem corrente para conferir.",
  notFoundTitle: "Lote não encontrado",
  notFoundBody: "Esse papel não existe, ou já foi para a gaveta.",
  backToShowcase: "Voltar à vitrine",
  networkError: "Não deu para conferir agora.",
  retry: "Tentar novamente",
  stale: "DESATUALIZADO",
  cancelRow: "Cancelado pelo leiloeiro",
  cancelRowNote: "Saldo comprometido do líder estornado",
  mine: "VOCÊ",
  rowStatus: { OK: "CONFERE", MISMATCH: "NÃO CONFERE", BROKEN_LINK: "ELO QUEBRADO" } satisfies Record<AuditRowStatus, string>,
  statusMeta: {
    LIVE: "AO VIVO",
    SCHEDULED: "AGENDADO",
    CLOSING: "EM APURAÇÃO",
    SOLD: "ARREMATADO",
    UNSOLD: "SEM LANCES",
    CANCELLED: "CANCELADO",
  } satisfies Record<LotStatus, string>,
  columns: { seq: "Nº", bidder: "Licitante", amount: "Valor", at: "Horário", hash: "Hash", status: "Situação" },
  counters: {
    inChain: "LINHAS NA CORRENTE",
    inSeal: "REGISTRADAS NO SELO",
    finalHash: "HASH FINAL",
    receiptHash: "HASH DO COMPROVANTE",
  },
  showFull: "ver inteiro",
  collapse: "recolher",
  showFullLabel: (what: string) => `ver hash inteiro ${what}`,
  collapseLabel: (what: string) => `recolher hash ${what}`,
  viewRoom: "Ver sala do lote",
  viewReceipt: "Ver comprovante do lote",
  auditThisLot: "Auditar este lote",
  verifyOnAudit: "Verificar na auditoria",
  auditLot: "Auditar lote",
  auditLotPanel: "Auditoria do lote",
  checkOnAudit: "Conferir na auditoria",
  verifyingLive: "Verificando.",
  howTitle: "Como a gente confere",
  how: [
    "Cada lance guarda o hash do lance anterior. Mexeu num, o elo seguinte deixa de fechar.",
    "O hash é um HMAC-SHA256: uma conta que só se refaz com uma chave secreta guardada no servidor, nunca no banco.",
    "Quem confere é o servidor, não o seu navegador. Ao abrir esta página ele refaz a conta do primeiro ao último lance e compara com o selo do lote e com o comprovante.",
  ],
} as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "ab12cd…ef90": 6 primeiros e 4 últimos. Hash curto demais não se abrevia. */
export function abbreviateHash(hash: string): string {
  if (hash.length <= 11) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

type Verdict = AuditView["verdict"];

function hasCancelRow(view: AuditView): boolean {
  return view.entries.some((entry) => entry.kind === "CANCEL");
}

/** "lance(s)" vira "registro(s)" quando a cadeia tem a linha CANCEL (§8). */
function noun(view: AuditView, count: number): string {
  const cancel = hasCancelRow(view);
  return count === 1 ? (cancel ? "registro" : "lance") : cancel ? "registros" : "lances";
}

const verb = (count: number) => (count === 1 ? "confere" : "conferem");

/** Sujeito da frase de selo: quantas linhas existem e conferem entre si. */
function lineSubject(count: number, found: boolean): string {
  if (count === 0) return "Não há linhas na corrente";
  if (count === 1) return found ? "A única linha encontrada confere" : "A única linha confere";
  return `As ${count} linhas ${found ? "encontradas " : ""}conferem entre si`;
}

const RECEIPT_ISSUE_SENTENCE = {
  RECEIPT_MISSING: "A corrente e o selo conferem, mas este lote consta como arrematado e o comprovante não existe.",
  RECEIPT_AMOUNT: "A corrente e o selo conferem, mas o valor do comprovante não é o do último lance.",
  RECEIPT_UNEXPECTED: "A corrente e o selo conferem, mas existe um comprovante para um lote que fechou sem lances.",
} as const;

function cancelFlagSentence(found: number): string {
  return `${lineSubject(found, false)}, mas o cancelamento do lote e a corrente não concordam.`;
}

function sealSentence(verdict: Verdict): string {
  const found = verdict.foundCount;
  const registered = verdict.registeredCount;
  if (registered > found) {
    const missing = registered - found;
    return `${lineSubject(found, true)}, mas o selo do lote registra ${registered}. ${missing === 1 ? "Falta" : "Faltam"} ${missing} no fim da corrente.`;
  }
  if (registered < found) {
    const extra = found - registered;
    return `${lineSubject(found, true)}, mas o selo do lote registra ${registered}. Há ${extra} ${extra === 1 ? "linha" : "linhas"} além do que o selo registra.`;
  }
  if (found === 0) return "Não há linhas na corrente, mas o selo do lote não bate com o estado inicial gravado.";
  return `${lineSubject(found, false)}, mas o selo do lote não bate com a contagem e o hash final gravados.`;
}

/** A frase do veredito, exata como a §8 (a caixa de veredito e o anúncio partem dela). */
export function verdictSentence(view: AuditView): string {
  const { verdict } = view;
  const found = verdict.foundCount;
  switch (verdict.code) {
    case "OK":
      if (found === 0) {
        return view.lot.status === "CANCELLED"
          ? "Sem lances, sem corrente para conferir. O lote foi cancelado antes do primeiro lance."
          : "Sem lances, sem corrente para conferir. O estado inicial do lote e o selo conferem.";
      }
      if (hasCancelRow(view)) {
        return `${found} de ${found} ${noun(view, found)} ${verb(found)} e o hash final bate com o selo do lote. O lote foi cancelado e o cancelamento está na corrente.`;
      }
      return view.receipt
        ? `${found} de ${found} ${noun(view, found)} ${verb(found)} e o hash final é o mesmo do comprovante. Ninguém mexeu em nada depois do martelo.`
        : `${found} de ${found} ${noun(view, found)} ${verb(found)} e o hash final bate com o selo do lote. O lote ainda não fechou: a conta vale para este instante.`;
    case "BROKEN_AT": {
      const line = pad2(verdict.firstBad?.seq ?? 0);
      let text = `${verdict.okCount} de ${found} ${noun(view, found)} ${verb(found)}. A corrente quebra na linha ${line}.`;
      if (verdict.receiptOk === false) text += " O hash final também não bate com o comprovante.";
      else if (verdict.receiptOk === true) {
        text += ` O hash final continua igual ao do comprovante, mas a linha ${line} não gera o hash guardado para ela.`;
      }
      return text;
    }
    case "SEAL_MISMATCH":
      return verdict.consistencyIssue === "CANCEL_FLAG" ? cancelFlagSentence(found) : sealSentence(verdict);
    case "RECEIPT_MISMATCH":
      return verdict.consistencyIssue && verdict.consistencyIssue !== "CANCEL_FLAG"
        ? RECEIPT_ISSUE_SENTENCE[verdict.consistencyIssue]
        : "A corrente e o selo conferem, mas o hash final do comprovante é outro. O comprovante foi alterado ou não pertence a este lote.";
  }
}

/** Banner `role="alert"` (§8), só quando o veredito não é OK. */
export function problemBanner(view: AuditView): string | null {
  const { verdict } = view;
  switch (verdict.code) {
    case "OK":
      return null;
    case "BROKEN_AT": {
      const bad = verdict.firstBad;
      if (!bad) return null;
      const line = pad2(bad.seq);
      if (bad.reason === "SEQ_GAP") return `Linha ${line}: a sequência pulou. Era esperada a linha ${pad2(bad.expectedSeq)}.`;
      if (bad.reason === "PREV_LINK") return `Linha ${line}: o elo com a linha anterior não fecha.`;
      const badRow = view.entries.find((entry) => entry.status === "MISMATCH");
      return `Linha ${line}: o ${badRow?.kind === "CANCEL" ? "registro" : "lance"} gravado não gera o hash guardado para ele.`;
    }
    case "SEAL_MISMATCH":
      return verdict.consistencyIssue === "CANCEL_FLAG"
        ? cancelFlagSentence(verdict.foundCount)
        : "O selo do lote não fecha com a corrente. Nenhuma linha existente está errada, mas faltam ou sobram registros.";
    case "RECEIPT_MISMATCH":
      return verdict.consistencyIssue && verdict.consistencyIssue !== "CANCEL_FLAG"
        ? RECEIPT_ISSUE_SENTENCE[verdict.consistencyIssue]
        : "O hash do comprovante não é o hash final deste lote.";
  }
}

/** O que a região viva anuncia quando a verificação termina. */
export function verdictAnnouncement(view: AuditView): string {
  const { verdict } = view;
  if (verdict.code !== "OK") return `Veredito: adulterado. ${verdictSentence(view)}`;
  const found = verdict.foundCount;
  if (found === 0) return `Veredito: íntegro. ${AUDIT_TEXT.emptyChain}`;
  return `Veredito: íntegro. ${found} de ${found} ${noun(view, found)} ${verb(found)}.`;
}
