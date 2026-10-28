import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CarPhoto } from "./car-photo";

const render = (props: Partial<Parameters<typeof CarPhoto>[0]> = {}) =>
  renderToStaticMarkup(<CarPhoto imageUrl="https://exemplo.test/uno.jpg" title="Fiat Uno" size="cartao" {...props} />);

describe("CarPhoto: cartão", () => {
  it("200px de altura, cantos de cima herdados do cartão, fundo suave com pontos e contain", () => {
    const html = render();
    expect(html).toContain("height:200px");
    expect(html).not.toContain("176");
    expect(html).toContain('<figure class="m-0 rounded-t-[inherit]"');
    expect(html).toContain("overflow-hidden rounded-t-[inherit] bg-suave");
    expect(html).toContain("radial-gradient(var(--c-pontos)");
    expect(html).toContain("object-contain");
    expect(html).toContain('loading="lazy"');
  });

  it("a foto tem texto alternativo e não leva legenda no cartão", () => {
    const html = render({ credit: "Foto: Fulano" });
    expect(html).toContain('alt="Foto do Fiat Uno"');
    expect(html).not.toContain("<figcaption");
  });

  it("sem foto: silhueta de carro em tinta sobre suave, escondida dos leitores", () => {
    const html = render({ imageUrl: null });
    expect(html).not.toContain("<img");
    expect(html).toMatch(/<svg aria-hidden="true"[^>]*stroke="var\(--c-tinta\)"/);
    expect(html).toContain("bg-suave");
    expect(html).toContain('fill="var(--c-suave)"');
  });
});

describe("CarPhoto: véu dos encerrados", () => {
  it("encerrado: véu painel a 25% sobre a foto, decorativo e sem pegar o clique", () => {
    const html = render({ dimmed: true });
    expect(html).toContain('<span aria-hidden="true" class="pointer-events-none absolute inset-0 bg-painel/25"></span>');
  });

  it("o véu não usa opacity, para o contraste dos textos em volta não mudar", () => {
    expect(render({ dimmed: true })).not.toContain("opacity");
    expect(render({ dimmed: true, imageUrl: null })).not.toContain("opacity");
  });

  it("sem encerrar não há véu", () => {
    expect(render()).not.toContain("bg-painel/25");
  });

  it("o véu fica dentro da moldura, que é relative e recorta nos cantos herdados", () => {
    const html = render({ dimmed: true });
    expect(html.indexOf("relative flex")).toBeGreaterThan(-1);
    expect(html.indexOf("bg-painel/25")).toBeGreaterThan(html.indexOf("<img"));
  });
});

describe("CarPhoto: Sala e prévia", () => {
  it("16:9 fluido e legenda com crédito", () => {
    const html = render({ size: "sala", showCaption: true, credit: "Foto: Fulano" });
    expect(html).toContain("aspect-ratio:16 / 9");
    expect(html).not.toContain("height:200px");
    expect(html).toContain("<figcaption");
    expect(html).toContain("Foto: Fulano");
    expect(html).not.toContain('loading="lazy"');
  });

  it("sem foto na Sala: nenhuma legenda; a explicação do estado fica na prévia", () => {
    expect(render({ size: "sala", showCaption: true, imageUrl: null })).not.toContain("<figcaption");
    expect(render({ size: "previa", showCaption: true, imageUrl: null })).toContain("Pintado à mão pelo pátio");
  });

  it("o crédito da foto continua na Sala", () => {
    expect(render({ size: "sala", showCaption: true, credit: "Foto: Fulano" })).toContain("Foto: Fulano");
  });
});
