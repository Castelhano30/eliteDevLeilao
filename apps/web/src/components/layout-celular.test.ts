import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");

// Medidos no Chrome com toque (320 a 414px): estes alvos tinham 32 a 43px de largura ou 42px de altura.
describe("alvos de toque de pelo menos 44×44px", () => {
  it("as bolinhas do carrossel têm 44px de largura e a fileira quebra de linha se faltar espaço", () => {
    const source = read("./carrossel-destaques.tsx");
    expect(source).toContain('className="group inline-flex h-11 w-11 items-center justify-center"');
    expect(source).toContain('className="mt-3 flex flex-wrap items-center justify-center gap-2"');
  });

  it("os links do rodapé têm largura mínima de 44px", () => {
    expect(read("./site-footer.tsx")).toContain("inline-flex min-h-alvo min-w-alvo items-center no-underline");
  });

  it("o link \"Painel\" do Criar lote e o nome do lote no Painel têm 44px", () => {
    expect(read("./criar-lote-form.tsx")).toContain('className="inline-flex min-h-alvo min-w-alvo items-center">PAINEL</Link>');
    expect(read("./painel-screen.tsx")).toContain('className="inline-flex min-h-alvo items-center text-[15px] font-bold leading-[1.4]"');
  });
});

describe("linha de status da Vitrine no celular", () => {
  it("os pontos separadores só aparecem de sm em diante: a linha quebra e um ponto ficaria pendurado no fim", () => {
    const source = read("./vitrine.tsx");
    expect(source.match(/<span aria-hidden="true" className="hidden sm:inline">·<\/span>/g)).toHaveLength(3);
    expect(source).not.toContain('<span aria-hidden="true">·</span>');
  });
});
