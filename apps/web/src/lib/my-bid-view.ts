import {
  AUDIT_TEXT,
  auditPath,
  copyLinkAriaLabel,
  formatLotNumber,
  lotStatus,
  MY_BIDS_TEXT,
  receiptPath,
  RECEIPT_TEXT,
  type MyBidItem,
} from "@lanceauto/shared";

/** Selo do ingresso: o placar de posição (ganhando, superado ou neutro "apurando") ou o carimbo do estado final. */
export type MyBidSeal =
  | { kind: "placar"; tone: "verde" | "ferrugem" | "neutro"; title: string; sub: string | null }
  | { kind: "stamp"; variant: "arrematado" | "perdido" | "cancelado" };

export type MyBidAction =
  | { kind: "room" | "cover" | "receipt" | "audit"; label: string; ariaLabel: string; href: string }
  | { kind: "copy"; label: string; ariaLabel: string; token: string };

export interface MyBidValue {
  label: string;
  cents: number;
}

export interface MyBidView {
  /** Derivado do relógio do servidor: o lote passou do fim e ainda não liquidou (R-7.3). Não é um estado de negócio. */
  closing: boolean;
  seal: MyBidSeal;
  sentence: string;
  ownPseudonym: string;
  values: MyBidValue[];
  actions: MyBidAction[];
}

/** Caminho do comprovante do lote (`/c/{token}`). */
export function receiptHref(token: string): string {
  return receiptPath(token);
}

/**
 * "Apurando" é só rótulo (INV-1): o `state` segue `LEADING`/`OUTBID` vindo do servidor e o cliente só decide se o
 * lote já passou do fim, com `lotStatus` e o relógio do servidor. O status do cartão (`CLOSING` na hora da resposta)
 * também vale, porque o tempo só anda para a frente. Estado final nunca é apurando.
 */
function isClosing(entry: MyBidItem, nowMs: number): boolean {
  if (entry.state !== "LEADING" && entry.state !== "OUTBID") return false;
  if (entry.lot.status === "CLOSING") return true;
  // Relógio ainda não acertado: não decide nada. `settledAt` é nulo em todo `LEADING`/`OUTBID` (R-7.2).
  return nowMs > 0 && lotStatus({ ...entry.lot, settledAt: null }, new Date(nowMs)) === "CLOSING";
}

function placar(text: string): { title: string; sub: string } {
  const [title = text, sub = ""] = text.split(" · ");
  return { title, sub };
}

/**
 * O que o ingresso mostra para cada estado (S07 §8 e §9): selo, frase, valores e ações, tudo puro. `nowMs` é o
 * relógio do servidor; só o rótulo "apurando" depende dele. O nome acessível de cada ação leva o número e o título
 * do lote, então é único na lista inteira.
 */
export function myBidView(entry: MyBidItem, nowMs: number): MyBidView {
  const { lot } = entry;
  const where = `lote ${formatLotNumber(lot.number)}, ${lot.title}`;
  const room: MyBidAction = { kind: "room", label: "Ir para a sala", ariaLabel: `Ir para a sala do ${where}`, href: `/lotes/${lot.id}` };
  const audit: MyBidAction = {
    kind: "audit",
    label: AUDIT_TEXT.checkOnAudit,
    ariaLabel: `${AUDIT_TEXT.checkOnAudit} do ${where}`,
    href: auditPath(lot.id),
  };
  const lotCents = lot.currentBidCents ?? entry.myBestBidCents;
  const mine: MyBidValue = { label: "SEU MAIOR LANCE", cents: entry.myBestBidCents };
  const closing = isClosing(entry, nowMs);
  const rank = entry.myRank ?? 1;
  const base = { closing, ownPseudonym: MY_BIDS_TEXT.ownPseudonym(entry.myPseudonym) };

  if (closing) {
    return {
      ...base,
      seal: { kind: "placar", tone: "neutro", title: MY_BIDS_TEXT.closingSeal, sub: null },
      sentence: MY_BIDS_TEXT.closingSentence,
      values: [mine, { label: "LANCE ATUAL", cents: lotCents }],
      actions: [room],
    };
  }

  switch (entry.state) {
    case "LEADING":
      return {
        ...base,
        seal: { kind: "placar", tone: "verde", ...placar(MY_BIDS_TEXT.leadingSeal(entry.bidderCount)) },
        sentence: MY_BIDS_TEXT.leadingSentence(entry.myBestBidCents),
        values: [mine, { label: "LANCE ATUAL", cents: lotCents }],
        actions: [room],
      };
    case "OUTBID":
      return {
        ...base,
        seal: { kind: "placar", tone: "ferrugem", ...placar(MY_BIDS_TEXT.outbidSeal(rank, entry.bidderCount)) },
        sentence: MY_BIDS_TEXT.outbidSentence(entry.myBestBidCents, rank, entry.bidderCount),
        values: [mine, { label: "LANCE ATUAL", cents: lotCents }],
        actions: [{ kind: "cover", label: "Cobrir lance", ariaLabel: `Cobrir lance no ${where}`, href: `/lotes/${lot.id}` }],
      };
    case "WON": {
      // Liquidação cria o Receipt na mesma transação; sem token é defeito: não desenha botão que não leva a nada.
      const token = entry.receiptToken;
      return {
        ...base,
        seal: { kind: "stamp", variant: "arrematado" },
        sentence: MY_BIDS_TEXT.wonSentence(lotCents),
        values: [mine, { label: "VALOR FINAL", cents: lotCents }],
        actions: token
          ? [
              { kind: "receipt", label: "Ver comprovante", ariaLabel: `Ver comprovante do ${where}`, href: receiptHref(token) },
              { kind: "copy", label: RECEIPT_TEXT.copyLink, ariaLabel: `${copyLinkAriaLabel(lot.number)}, ${lot.title}`, token },
            ]
          : [],
      };
    }
    case "LOST":
      return {
        ...base,
        seal: { kind: "stamp", variant: "perdido" },
        sentence: MY_BIDS_TEXT.lostSentence(entry.winnerPseudonym ?? "Outro licitante", lotCents, entry.myBestBidCents),
        values: [mine, { label: "VALOR FINAL", cents: lotCents }],
        actions: [audit],
      };
    case "CANCELLED":
      return {
        ...base,
        seal: { kind: "stamp", variant: "cancelado" },
        sentence: MY_BIDS_TEXT.cancelledSentence(entry.refundedCents !== null),
        values: [mine, { label: "ÚLTIMO LANCE", cents: lotCents }],
        actions: [audit],
      };
  }
}
