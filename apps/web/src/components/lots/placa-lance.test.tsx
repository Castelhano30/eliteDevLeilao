import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlacaLance } from "./placa-lance";

describe("PlacaLance", () => {
  const html = renderToStaticMarkup(<PlacaLance cents={4_150_000} label="LANCE ATUAL" />);

  it("anuncia o valor inteiro no aria-label e esconde as placas dos leitores", () => {
    expect(html).toContain('role="img" aria-label="Lance atual R$ 41.500,00"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("cada dígito é uma placa de painel com 6px de raio e linha central de 2px; o ponto de milhar não vira placa", () => {
    expect(html.match(/rounded-md bg-painel/g)).toHaveLength(5);
    expect(html.match(/h-\[2px\]/g)).toHaveLength(5);
    expect(html).not.toContain("rounded-placa");
    expect(html).toContain("var(--f-digito-placa)");
    expect(html).toContain("var(--f-linha-central-placa)");
  });

  it("só vira quando o valor muda: a primeira pintura fica parada", () => {
    expect(html).not.toContain("la-vira");
  });

  it("rótulo, prefixo R$ e sufixo ,00", () => {
    expect(html).toContain(">LANCE ATUAL<");
    expect(html).toContain(">R$<");
    expect(html).toContain(">,00<");
  });
});
