import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CarGallery } from "./car-gallery";

const gallery = ["/items/abc/images/0", "/items/abc/images/1", "/items/abc/images/2"];
const render = (props: Partial<Parameters<typeof CarGallery>[0]> = {}) => renderToStaticMarkup(<CarGallery gallery={gallery} title="Fiat Uno" {...props} />);

describe("CarGallery", () => {
  it("destaque 16:9 com a capa, alt Foto N de M do título e contain", () => {
    const html = render();
    expect(html).toContain("aspect-ratio:16 / 9");
    expect(html).toContain('alt="Foto 1 de 3 do Fiat Uno"');
    expect(html).toMatch(/src="[^"]*\/items\/abc\/images\/0"/);
    expect(html).toContain("object-contain");
  });

  it("uma miniatura clicável por foto, com rótulo Foto N de M e a primeira marcada como atual", () => {
    const html = render();
    expect(html.match(/aria-label="Foto \d de 3"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Foto 1 de 3" aria-current="true"');
    expect(html).not.toContain('aria-label="Foto 2 de 3" aria-current');
    expect(html).toContain("grid-cols-5");
    expect(html).toContain("min-h-11");
  });

  it("setas, região viva com a foto de agora e rótulo da galeria", () => {
    const html = render();
    expect(html).toContain('aria-label="Foto anterior"');
    expect(html).toContain('aria-label="Próxima foto"');
    expect(html).toContain('role="status" aria-live="polite">Foto 1 de 3</p>');
    expect(html).toContain('aria-label="Fotos do Fiat Uno"');
  });

  it("as setas não se centram por translate: o :active do botão (translate-y-px) as tiraria de sob o ponteiro e o clique se perderia", () => {
    const html = render();
    const arrows = html.match(/<button[^>]*aria-label="(?:Foto anterior|Próxima foto)"[^>]*>/g) ?? [];
    expect(arrows).toHaveLength(2);
    for (const arrow of arrows) expect(arrow).not.toMatch(/-translate-y-/);
  });

  it("sem crédito nem legenda: foto do aparelho não tem", () => {
    const html = render();
    expect(html).not.toContain("<figcaption");
    expect(html).not.toContain("Foto:");
  });

  it("encerrado leva o véu painel a 25%; aberto não", () => {
    expect(render({ dimmed: true })).toContain("bg-painel/25");
    expect(render()).not.toContain("bg-painel/25");
  });
});
