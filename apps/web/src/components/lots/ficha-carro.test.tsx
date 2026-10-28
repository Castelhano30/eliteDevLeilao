import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LotState } from "@lanceauto/shared";
import { FichaCarro } from "./ficha-carro";

const car = { brand: "Fiat", model: "Uno Mille Way 1.0 Flex", year: 2010, fuel: "Flex", referencePriceCents: 1980000, referenceMonth: "2026-10" } as LotState["car"];
const render = (over: Partial<LotState["car"]> = {}) => renderToStaticMarkup(<FichaCarro car={{ ...car, ...over }} />);

describe("FichaCarro", () => {
  it("cartão arredondado no padrão do painel, com quatro dados em lista de definição", () => {
    const html = render();
    expect(html).toContain("rounded-2xl border border-borda bg-papel");
    expect(html.match(/<dt /g)).toHaveLength(5);
    for (const rotulo of ["Marca", "Modelo", "Ano", "Combustível", "Preço de referência"]) expect(html).toContain(`>${rotulo}</dt>`);
    for (const valor of ["Fiat", "Uno Mille Way 1.0 Flex", "2010", "Flex"]) expect(html).toContain(`>${valor}</dd>`);
  });

  it("os ícones são decorativos, um por dado", () => {
    const html = render();
    expect(html.match(/<svg aria-hidden="true"/g)).toHaveLength(4);
  });

  it("valores de 18px e preço de referência em destaque com a fonte", () => {
    const html = render();
    expect(html.match(/text-\[18px\] font-semibold/g)).toHaveLength(4);
    expect(html).toContain("text-[28px] font-bold");
    expect(html).toContain("FONTE: TABELA FIPE");
  });

  it("combustível ausente vira travessão", () => {
    expect(render({ fuel: "" })).toContain(">—</dd>");
  });
});
