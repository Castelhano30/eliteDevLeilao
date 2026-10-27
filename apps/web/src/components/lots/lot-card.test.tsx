import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LotCard as LotCardDto, LotStatus } from "@lanceauto/shared";
import { LotCard } from "./lot-card";

function card(status: LotStatus): LotCardDto {
  return {
    id: "lote-1",
    number: 5,
    title: "Fiat Uno Mille Way 2010",
    brand: "Fiat",
    model: "Uno",
    year: 2010,
    fuel: "Flex",
    currentBidCents: null,
    startingBidCents: 1_000_000,
    minIncrementCents: 50_000,
    referencePriceCents: 2_000_000,
    bidCount: 0,
    version: 0,
    startsAt: "2026-10-23T10:00:00.000Z",
    endsAt: "2026-10-24T10:00:00.000Z",
    originalEndsAt: "2026-10-24T10:00:00.000Z",
    cancelledAt: null,
    imageUrl: null,
    status,
  } as LotCardDto;
}

describe("LotCard: etiqueta e carimbos não cobrem a foto", () => {
  it("a etiqueta fica numa faixa própria, acima da foto, e não flutua sobre o cartão", () => {
    const html = renderToStaticMarkup(<LotCard card={card("SCHEDULED")} />);
    expect(html).not.toContain("translateY(-55%)");
    expect(html).not.toMatch(/class="absolute left-5 top-0/);
    expect(html.indexOf(">LOTE<")).toBeLessThan(html.indexOf("<figure"));
  });

  it("agendado: o chip de data fica na faixa da etiqueta, não sobre a foto", () => {
    const html = renderToStaticMarkup(<LotCard card={card("SCHEDULED")} />);
    expect(html).not.toContain("absolute right-3 top-3");
    expect(html.indexOf("ABRE ")).toBeGreaterThan(-1);
    expect(html.indexOf("ABRE ")).toBeLessThan(html.indexOf("<figure"));
  });

  it("ao vivo: o carimbo AO VIVO fica na faixa, ao lado da etiqueta", () => {
    const html = renderToStaticMarkup(<LotCard card={card("LIVE")} serverTime="2026-10-23T12:00:00.000Z" />);
    expect(html).not.toContain("absolute right-3 top-3");
    expect(html.indexOf("Ao vivo")).toBeLessThan(html.indexOf("<figure"));
  });

  it.each(["SOLD", "UNSOLD"] as const)("%s: o carimbo é pequeno e sem largura fixa, para caber na foto", (status) => {
    const html = renderToStaticMarkup(<LotCard card={card(status)} />);
    expect(html).not.toContain("w-[184px]");
    expect(html).toContain("font-size:20px");
    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain("max-w-[calc(100%-24px)]");
  });
});
