import { describe, expect, it } from "vitest";
import {
  BIDDER_LOT_STATES,
  MY_BIDS_TEXT,
  bidderLotState,
  transitionAnnouncement,
  type BidderLotState,
} from "./my-bids";

const ME = "user-me";
const OTHER = "user-other";
const AT = "2026-10-27T12:00:00.000Z";

describe("bidderLotState (R-7.2, AC-7.12)", () => {
  type Leader = "eu" | "outro" | "ninguém";
  const leaderId = (who: Leader) => (who === "eu" ? ME : who === "outro" ? OTHER : null);

  // cancelledAt × settledAt × leaderId: as 12 combinações e o estado de cada uma.
  const table: Array<[boolean, boolean, Leader, BidderLotState]> = [
    [false, false, "eu", "LEADING"],
    [false, false, "outro", "OUTBID"],
    [false, false, "ninguém", "OUTBID"],
    [false, true, "eu", "WON"],
    [false, true, "outro", "LOST"],
    [false, true, "ninguém", "LOST"],
    [true, false, "eu", "CANCELLED"],
    [true, false, "outro", "CANCELLED"],
    [true, false, "ninguém", "CANCELLED"],
    [true, true, "eu", "CANCELLED"],
    [true, true, "outro", "CANCELLED"],
    [true, true, "ninguém", "CANCELLED"],
  ];

  it.each(table)("cancelado=%s liquidado=%s líder=%s → %s", (cancelled, settled, leader, expected) => {
    const lot = { cancelledAt: cancelled ? AT : null, settledAt: settled ? AT : null, leaderId: leaderId(leader) };
    expect(bidderLotState(lot, ME)).toBe(expected);
  });

  it("cancelledAt vence tudo, inclusive quando eu liderava e o lote constava liquidado", () => {
    expect(bidderLotState({ cancelledAt: AT, settledAt: AT, leaderId: ME }, ME)).toBe("CANCELLED");
  });

  it("nunca devolve LOST para lote cancelado", () => {
    for (const settled of [null, AT])
      for (const leader of [ME, OTHER, null])
        expect(bidderLotState({ cancelledAt: AT, settledAt: settled, leaderId: leader }, ME)).not.toBe("LOST");
  });

  it("aceita Date, string ISO e nulo nas datas", () => {
    const date = new Date(AT);
    expect(bidderLotState({ cancelledAt: date, settledAt: null, leaderId: ME }, ME)).toBe("CANCELLED");
    expect(bidderLotState({ cancelledAt: null, settledAt: date, leaderId: ME }, ME)).toBe("WON");
    expect(bidderLotState({ cancelledAt: null, settledAt: AT, leaderId: OTHER }, ME)).toBe("LOST");
  });

  it("não usa o relógio: a apuração (fim passado, sem liquidar) continua LEADING ou OUTBID", () => {
    expect(bidderLotState({ cancelledAt: null, settledAt: null, leaderId: ME }, ME)).toBe("LEADING");
    expect(bidderLotState({ cancelledAt: null, settledAt: null, leaderId: OTHER }, ME)).toBe("OUTBID");
  });

  it("lista os cinco estados", () => {
    expect([...BIDDER_LOT_STATES]).toEqual(["LEADING", "OUTBID", "WON", "LOST", "CANCELLED"]);
  });
});

describe("MY_BIDS_TEXT (S07 §8)", () => {
  it("traz os textos canônicos da fatia", () => {
    expect(MY_BIDS_TEXT.title).toBe("MEUS ARREMATES");
    expect(MY_BIDS_TEXT.empty).toBe("Nada aqui. Ou você é muito prudente, ou ainda não chegou a hora.");
    expect(MY_BIDS_TEXT.emptyAction).toBe("Ver a vitrine");
    expect(MY_BIDS_TEXT.emptyTab).toBe("Nenhum lote nesta aba. Troque de aba para ver o resto.");
    expect(MY_BIDS_TEXT.loading).toBe("Carregando…");
    expect(MY_BIDS_TEXT.loadError).toBe("Não deu para carregar seus arremates.");
    expect(MY_BIDS_TEXT.retry).toBe("Tentar novamente");
    expect(MY_BIDS_TEXT.stale).toBe("Lista possivelmente desatualizada.");
    expect(MY_BIDS_TEXT.roleNotAllowed).toBe("Meus arremates é coisa de licitante.");
    expect(MY_BIDS_TEXT.closingSeal).toBe("APURANDO");
    expect(MY_BIDS_TEXT.closingSentence).toBe("Martelo batido. Apurando o resultado…");
  });

  it("monta as frases de cada estado com valor exato em reais", () => {
    expect(MY_BIDS_TEXT.leadingSentence(3_350_000)).toBe(
      "Seu lance de R$ 33.500,00 está na frente. Esse valor está travado neste lote.",
    );
    expect(MY_BIDS_TEXT.leadingSeal(1)).toBe("VOCÊ ESTÁ GANHANDO · 1º de 1");
    expect(MY_BIDS_TEXT.outbidSeal(2, 4)).toBe("VOCÊ FOI SUPERADO · 2º de 4");
    expect(MY_BIDS_TEXT.outbidSentence(2_800_000, 2, 3)).toBe("Seu lance (R$ 28.000,00) é o 2º maior de 3");
    expect(MY_BIDS_TEXT.wonSentence(3_350_000)).toBe("Você arrematou por R$ 33.500,00.");
    expect(MY_BIDS_TEXT.lostSentence("Licitante 7F3A", 3_350_000, 3_000_000)).toBe(
      "Licitante 7F3A levou por R$ 33.500,00. Seu maior lance foi R$ 30.000,00.",
    );
    expect(MY_BIDS_TEXT.ownPseudonym("Licitante 7F3A")).toBe("Neste lote você é Licitante 7F3A.");
  });

  it("cancelado: só acrescenta o estorno quando eu liderava", () => {
    expect(MY_BIDS_TEXT.cancelledSentence(false)).toBe("O leiloeiro cancelou este lote. Nada foi vendido.");
    expect(MY_BIDS_TEXT.cancelledSentence(true)).toBe(
      "O leiloeiro cancelou este lote. Nada foi vendido. O saldo que estava travado voltou para você.",
    );
  });
});

describe("transitionAnnouncement (§8, decisão 7)", () => {
  it("anuncia os quatro casos da fatia, com o número do lote em 3 dígitos", () => {
    expect(transitionAnnouncement("LEADING", "OUTBID", 18)).toBe("Lote 018: você foi superado.");
    expect(transitionAnnouncement("LEADING", "WON", 18)).toBe("Lote 018: você arrematou.");
    expect(transitionAnnouncement("OUTBID", "LOST", 7)).toBe("Lote 007: não foi desta vez.");
    expect(transitionAnnouncement("OUTBID", "CANCELLED", 120)).toBe("Lote 120: cancelado.");
  });

  it("voltar a LEADING e ficar no mesmo estado não anunciam", () => {
    expect(transitionAnnouncement("OUTBID", "LEADING", 18)).toBeNull();
    for (const state of BIDDER_LOT_STATES) expect(transitionAnnouncement(state, state, 18)).toBeNull();
  });
});
