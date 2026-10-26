import { describe, expect, it } from "vitest";
import {
  INITIAL_OPENING_CHECKS,
  OPENING_CHECKS,
  nextOpeningCheck,
  applyShortcut,
  deriveSituation,
  initialField,
  lockedFooter,
  minimumText,
  ordinal,
  plural,
  situationText,
  syncField,
} from "./lot-state";


describe("ordinal e plural", () => {
  it("ordinal", () => {
    expect(ordinal(1)).toBe("1º");
    expect(ordinal(12)).toBe("12º");
  });
  it("plural escolhe a palavra pelo número", () => {
    expect(plural(1, "lance")).toBe("lance");
    expect(plural(0, "lance")).toBe("lances");
    expect(plural(2, "lance")).toBe("lances");
    expect(plural(2, "papel", "papéis")).toBe("papéis");
  });
});

describe("deriveSituation (viewer × estado)", () => {
  const live = { status: "LIVE" as const, bidderCount: 4, minimumBidCents: 3_100_000 };

  it("visitante assiste", () => {
    const s = deriveSituation({ ...live, myRank: null, myBestBidCents: null }, null)!;
    expect(s).toEqual({ kind: "visitor", minimumCents: 3_100_000 });
    expect(situationText(s)).toEqual({ title: "Você está assistindo", sub: "Sem conta você vê tudo, só não pode levantar a mão." });
  });

  it("leiloeiro é espectador", () => {
    const s = deriveSituation({ ...live, myRank: null, myBestBidCents: null }, { role: "AUCTIONEER" })!;
    expect(situationText(s).title).toBe("Leiloeiros não podem dar lances");
  });

  it("licitante que nunca deu lance: nunca vira '0º maior'", () => {
    const s = deriveSituation({ ...live, myRank: null, myBestBidCents: null }, { role: "BIDDER" })!;
    expect(s.kind).toBe("none");
    const text = situationText(s);
    expect(text).toEqual({ title: "Você ainda não deu lance", sub: "Mínimo aceito R$ 31.000,00." });
    expect(`${text.title} ${text.sub}`).not.toMatch(/0º/);
    expect(lockedFooter(s)).toBe("Nada travado neste lote");
  });

  it("líder: ganhando, 1º de N, com o valor travado", () => {
    const s = deriveSituation({ ...live, myRank: 1, myBestBidCents: 3_000_000 }, { role: "BIDDER" })!;
    expect(situationText(s)).toEqual({ title: "Você está ganhando", sub: "1º de 4" });
    expect(lockedFooter(s)).toBe("R$ 30.000,00 travados neste lote");
  });

  it("superado: posição do maior lance dele entre os N", () => {
    const s = deriveSituation({ ...live, myRank: 2, myBestBidCents: 3_000_000 }, { role: "BIDDER" })!;
    expect(situationText(s)).toEqual({ title: "Você foi superado", sub: "Seu lance (R$ 30.000,00) é o 2º maior de 4" });
    expect(lockedFooter(s)).toBe("Nada travado neste lote");
  });

  it("apurando vale para todos; agendado, cancelado e encerrado não têm faixa", () => {
    expect(deriveSituation({ ...live, status: "CLOSING", myRank: 1, myBestBidCents: 1 }, { role: "BIDDER" })).toEqual({ kind: "closing" });
    expect(situationText({ kind: "closing" })).toEqual({ title: "Martelo batido", sub: "Apurando o resultado…" });
    for (const status of ["SCHEDULED", "CANCELLED", "SOLD", "UNSOLD"] as const) {
      expect(deriveSituation({ ...live, status, myRank: null, myBestBidCents: null }, null)).toBeNull();
    }
  });
});

describe("campo de lance", () => {
  it("começa no mínimo, sem estar editado", () => {
    expect(initialField(3_100_000)).toEqual({ text: "31.000", dirty: false });
    expect(initialField(1_500_000)).toEqual({ text: "15.000", dirty: false });
  });

  it("acompanha o mínimo enquanto não editado", () => {
    expect(syncField(initialField(3_100_000), 3_200_000)).toEqual({ text: "32.000", dirty: false });
  });

  it("depois de editado, mantém o que foi digitado", () => {
    const edited = { text: "31.250", dirty: true };
    expect(syncField(edited, 3_200_000)).toBe(edited);
  });

  it("mínimo com centavos arredonda para cima, para o campo nunca ficar abaixo", () => {
    expect(minimumText(1_000_050)).toBe("10.001");
  });

  it("atalho soma ao valor do campo, não ao lance atual, e marca como editado", () => {
    expect(applyShortcut({ text: "31.000", dirty: false }, 1_000, 3_100_000)).toEqual({ text: "32.000", dirty: true });
    expect(applyShortcut({ text: "31.000", dirty: true }, 500, 3_100_000)).toEqual({ text: "31.500", dirty: true });
  });

  it("atalho com campo vazio parte do mínimo", () => {
    expect(applyShortcut({ text: "", dirty: true }, 500, 3_100_000)).toEqual({ text: "31.500", dirty: true });
    expect(applyShortcut({ text: "", dirty: true }, 5_000, 3_100_000)).toEqual({ text: "36.000", dirty: true });
  });

  it("atalho respeita o limite de 13 dígitos", () => {
    const next = applyShortcut({ text: "9.999.999.999.999", dirty: true }, 500, 100);
    expect(next.text.replace(/\D/g, "")).toHaveLength(13);
  });
});

describe("nextOpeningCheck", () => {
  it("a carga que já estava na tela não conta como conferência", () => {
    const { next, keepPolling } = nextOpeningCheck(INITIAL_OPENING_CHECKS, 1_000);
    expect(next).toEqual({ seenAt: 1_000, count: 0 });
    expect(keepPolling).toBe(true);
  });

  it("reavaliar o intervalo sem resposta nova (cada render) não gasta tentativa", () => {
    let current = nextOpeningCheck(INITIAL_OPENING_CHECKS, 1_000).next;
    for (let render = 0; render < 50; render++) current = nextOpeningCheck(current, 1_000).next;
    expect(current.count).toBe(0);
  });

  it("com limite próprio, para na resposta que o atinge", () => {
    let step = nextOpeningCheck(INITIAL_OPENING_CHECKS, 0, 3);
    for (let check = 1; check <= 3; check++) {
      step = nextOpeningCheck(step.next, check * 3_000, 3);
      expect(step.keepPolling).toBe(check < 3);
    }
  });

  it("cada resposta nova do servidor conta uma e, na décima, para de insistir", () => {
    let step = nextOpeningCheck(INITIAL_OPENING_CHECKS, 0);
    for (let check = 1; check <= OPENING_CHECKS; check++) {
      step = nextOpeningCheck(step.next, check * 2_000);
      expect(step.next.count).toBe(check);
      expect(step.keepPolling).toBe(check < OPENING_CHECKS);
    }
  });
});
