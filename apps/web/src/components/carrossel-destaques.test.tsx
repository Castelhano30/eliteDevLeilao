import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CarrosselDestaques, INTERVALO_CARROSSEL_MS, SLIDES_VITRINE, indiceDaRolagem, indiceVizinho } from "./carrossel-destaques";

describe("carrossel de destaques: lógica", () => {
  it("cada imagem fica entre 10 e 15 segundos", () => {
    expect(INTERVALO_CARROSSEL_MS).toBeGreaterThanOrEqual(10_000);
    expect(INTERVALO_CARROSSEL_MS).toBeLessThanOrEqual(15_000);
  });

  it("o próximo e o anterior dão a volta nas pontas", () => {
    expect(indiceVizinho(0, 2, 1)).toBe(1);
    expect(indiceVizinho(1, 2, 1)).toBe(0);
    expect(indiceVizinho(0, 2, -1)).toBe(1);
    expect(indiceVizinho(2, 3, -1)).toBe(1);
    expect(indiceVizinho(0, 0, 1)).toBe(0);
  });

  it("o slide atual sai da posição da rolagem e fica dentro dos limites", () => {
    expect(indiceDaRolagem(0, 1000, 2)).toBe(0);
    expect(indiceDaRolagem(499, 1000, 2)).toBe(0);
    expect(indiceDaRolagem(501, 1000, 2)).toBe(1);
    expect(indiceDaRolagem(5000, 1000, 2)).toBe(1);
    expect(indiceDaRolagem(-20, 1000, 2)).toBe(0);
    expect(indiceDaRolagem(300, 0, 2)).toBe(0);
  });
});

describe("carrossel de destaques: marcação", () => {
  const html = renderToStaticMarkup(<CarrosselDestaques />);

  it("é uma região de carrossel nomeada, com um grupo por slide", () => {
    expect(html).toContain('aria-roledescription="carrossel"');
    expect(html).toContain('aria-label="Destaques da Vitrine"');
    expect(html.match(/aria-roledescription="slide"/g)).toHaveLength(SLIDES_VITRINE.length);
    expect(html).toContain('aria-label="1 de 2"');
    expect(html).toContain('aria-label="2 de 2"');
  });

  it("as artes têm texto alternativo com a mensagem escrita nelas", () => {
    for (const slide of SLIDES_VITRINE) {
      expect(slide.alt.length).toBeGreaterThan(40);
      expect(html).toContain(slide.src);
    }
    expect(SLIDES_VITRINE[0]!.alt).toMatch(/Participe de leilões/);
    expect(SLIDES_VITRINE[1]!.alt).toMatch(/Como funciona/);
  });

  it("só a primeira imagem carrega com prioridade; as dimensões evitam salto de layout", () => {
    expect(html.match(/loading="eager"/g)).toHaveLength(1);
    expect(html.match(/loading="lazy"/g)).toHaveLength(SLIDES_VITRINE.length - 1);
    expect(html.match(/width="1800" height="601"/g)).toHaveLength(SLIDES_VITRINE.length);
  });

  it("tem setas, um ponto por imagem e o botão de pausa, todos com nome acessível", () => {
    expect(html).toContain('aria-label="Imagem anterior"');
    expect(html).toContain('aria-label="Próxima imagem"');
    expect(html).toContain('aria-label="Ir para a imagem 1 de 2"');
    expect(html).toContain('aria-label="Ir para a imagem 2 de 2"');
    expect(html).toContain('aria-label="Pausar a troca automática"');
    expect(html).toContain('aria-current="true"');
  });

  it("com uma imagem só, não mostra controles", () => {
    const um = renderToStaticMarkup(<CarrosselDestaques slides={SLIDES_VITRINE.slice(0, 1)} />);
    expect(um).not.toContain("Próxima imagem");
  });
});
