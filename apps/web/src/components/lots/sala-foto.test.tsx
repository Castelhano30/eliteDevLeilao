import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SalaFoto, type SalaFotoProps } from "./sala-foto";

const base = { imageUrl: "/items/abc/image", gallery: [] as string[], imageCredit: "Foto: Fulano", imageCreditUrl: null };
const render = (car: Partial<SalaFotoProps["car"]> = {}, dimmed = false) =>
  renderToStaticMarkup(<SalaFoto car={{ ...base, ...car }} title="Fiat Uno" dimmed={dimmed} />);

describe("SalaFoto: galeria ou foto única", () => {
  const two = ["/items/abc/image", "/items/abc/images/1"];

  it("2 ou mais fotos: galeria, sem legenda de crédito", () => {
    const html = render({ gallery: two });
    expect(html).toContain('aria-roledescription="galeria"');
    expect(html).not.toContain("<figcaption");
    expect(html).not.toContain("Foto: Fulano");
  });

  it("galeria de lote encerrado leva o véu; a de lote aberto não", () => {
    expect(render({ gallery: two }, true)).toContain("bg-painel/25");
    expect(render({ gallery: two }, false)).not.toContain("bg-painel/25");
  });

  it("0 ou 1 foto: CarPhoto de sempre, com o crédito da URL", () => {
    for (const gallery of [[], ["/items/abc/image"]]) {
      const html = render({ gallery });
      expect(html).not.toContain("galeria");
      expect(html).toContain("<figure");
      expect(html).toContain("Foto: Fulano");
    }
  });

  it("sem imagem nenhuma: a ilustração, sem galeria", () => {
    const html = render({ imageUrl: null, gallery: [], imageCredit: null });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("galeria");
  });

  it("1 foto de lote encerrado: o véu continua no CarPhoto", () => {
    expect(render({ gallery: ["/items/abc/image"] }, true)).toContain("bg-painel/25");
  });
});
