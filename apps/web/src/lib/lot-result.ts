import { formatBRL, type LotState } from "@lanceauto/shared";
import { clockTime } from "./format";
import type { BandText, Viewer } from "./lot-state";

type Lot = LotState["lot"];

/** Estados da Sala depois do martelo (S05 §9.1). */
export type LotResultView =
  | { kind: "apurando" }
  | {
      kind: "arrematou";
      band: BandText;
      sentence: string;
      /** Vai para `/c/{token}`: é o servidor quem diz que este viewer venceu. */
      receiptToken: string;
      stamp: "arrematado";
      backToShowcase: false;
    }
  | {
      kind: "nao-venceu";
      band: BandText;
      /** Só para quem participou; os outros não recebem frase. */
      sentence: string | null;
      stamp: "arrematado";
      backToShowcase: boolean;
    }
  | {
      kind: "sem-lances";
      band: BandText;
      sentence: string;
      stamp: "sem-lances";
      backToShowcase: boolean;
    };

/**
 * Apurando: o servidor ainda não liquidou (`CLOSING`) ou o lote já aparece encerrado (evento `lot:closed`) mas o
 * `GET` com o resultado ainda não chegou. Em ambos a Sala consulta de 3 em 3 s até o `result` vir.
 */
export function isAwaitingResult(lot: Pick<Lot, "status" | "result">): boolean {
  return lot.status === "CLOSING" || ((lot.status === "SOLD" || lot.status === "UNSOLD") && lot.result === null);
}

/**
 * Decide o que a Sala mostra depois do martelo, só com o que o servidor mandou. Quem venceu é o `myReceiptToken`:
 * comparar pseudônimos erraria numa colisão de 4 hex. Devolve `null` enquanto o lote não terminou (ao vivo,
 * agendado ou cancelado têm tela própria).
 */
export function decideLotResult(
  lot: Pick<Lot, "status" | "title" | "result" | "myReceiptToken" | "myBestBidCents">,
  viewer: Viewer,
): LotResultView | null {
  if (lot.status !== "SOLD" && lot.status !== "UNSOLD" && lot.status !== "CLOSING") return null;
  const { result } = lot;
  if (result === null || isAwaitingResult(lot)) return { kind: "apurando" };

  const watcher = viewer === null || viewer.role === "AUCTIONEER";
  if (result.outcome === "UNSOLD") {
    return {
      kind: "sem-lances",
      band: { title: "Martelo batido", sub: "Este lote encerrou sem lances" },
      sentence: "Ninguém quis. Lote fechado sem vencedor.",
      stamp: "sem-lances",
      backToShowcase: watcher,
    };
  }

  const money = formatBRL(result.finalBidCents ?? 0);
  if (lot.myReceiptToken !== null) {
    return {
      kind: "arrematou",
      band: { title: "Você arrematou", sub: `Martelo batido às ${clockTime(result.hammerAt)} · ${money}` },
      sentence: `Você levou o ${lot.title} por ${money}. O valor saiu do saldo e o comprovante já tem link público.`,
      receiptToken: lot.myReceiptToken,
      stamp: "arrematado",
      backToShowcase: false,
    };
  }
  const participated = !watcher && lot.myBestBidCents !== null;
  return {
    kind: "nao-venceu",
    band: { title: "Martelo batido", sub: `${result.winnerPseudonym ?? "Licitante"} levou por ${money}` },
    sentence: participated ? "Seu saldo foi liberado quando seu lance foi superado." : null,
    stamp: "arrematado",
    backToShowcase: watcher,
  };
}
