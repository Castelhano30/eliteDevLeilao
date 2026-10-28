import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarraDePaginas } from "./barra-de-paginas";

const render = (atual: number, paginas: number) =>
  renderToStaticMarkup(<BarraDePaginas label="Páginas do teste" atual={atual} paginas={paginas} onChange={() => {}} />);

describe("BarraDePaginas", () => {
  it("uma página só não mostra nada", () => {
    expect(render(0, 1)).toBe("");
  });

  it("mostra a página atual e deixa inerte o botão da ponta", () => {
    const primeira = render(0, 3);
    expect(primeira).toContain('aria-label="Páginas do teste"');
    expect(primeira).toContain("Página 1 de 3");
    expect(primeira).toMatch(/<button[^>]* disabled=""[^>]*>Anterior/);
    expect(primeira).not.toMatch(/<button[^>]* disabled=""[^>]*>Próxima/);
    const ultima = render(2, 3);
    expect(ultima).toMatch(/<button[^>]* disabled=""[^>]*>Próxima/);
    expect(ultima).not.toMatch(/<button[^>]* disabled=""[^>]*>Anterior/);
  });
});
