import { describe, expect, it } from "vitest";
import { paginar } from "./paginacao";

describe("paginar", () => {
  const itens = Array.from({ length: 9 }, (_, i) => i + 1);

  it("quatro por página: o quinto vai para a segunda e o nono para a terceira", () => {
    expect(paginar(itens, 0, 4)).toMatchObject({ atual: 0, paginas: 3, items: [1, 2, 3, 4] });
    expect(paginar(itens, 1, 4).items).toEqual([5, 6, 7, 8]);
    expect(paginar(itens, 2, 4).items).toEqual([9]);
  });

  it("até uma página cheia é uma página só, e lista vazia também", () => {
    expect(paginar(itens.slice(0, 4), 0, 4).paginas).toBe(1);
    expect(paginar([], 0, 4)).toEqual({ items: [], atual: 0, paginas: 1 });
  });

  it("página fora do que existe é limitada", () => {
    expect(paginar(itens, 9, 4).atual).toBe(2);
    expect(paginar(itens, -3, 4).atual).toBe(0);
  });
});
