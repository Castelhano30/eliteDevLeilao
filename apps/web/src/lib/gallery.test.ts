import { describe, expect, it } from "vitest";
import { clampIndex, galleryKeyTarget, galleryReducer, hasGallery, photoPosition } from "./gallery";

describe("galleryKeyTarget", () => {
  it("setas esquerda e direita trocam a foto, com volta nas pontas", () => {
    expect(galleryKeyTarget("ArrowRight", 0, 3)).toBe(1);
    expect(galleryKeyTarget("ArrowRight", 2, 3)).toBe(0);
    expect(galleryKeyTarget("ArrowLeft", 1, 3)).toBe(0);
    expect(galleryKeyTarget("ArrowLeft", 0, 3)).toBe(2);
  });

  it("Home e End vão às pontas", () => {
    expect(galleryKeyTarget("Home", 3, 5)).toBe(0);
    expect(galleryKeyTarget("End", 1, 5)).toBe(4);
  });

  it("Enter, Espaço, Tab e letras ficam com o navegador; com menos de duas fotos não há o que navegar", () => {
    for (const key of ["Enter", " ", "Tab", "a", "ArrowUp"]) expect(galleryKeyTarget(key, 0, 3)).toBeNull();
    expect(galleryKeyTarget("ArrowRight", 0, 1)).toBeNull();
    expect(galleryKeyTarget("End", 0, 0)).toBeNull();
  });
});

describe("rótulos e regra da galeria", () => {
  it("Foto N de M, e galeria só com mais de uma foto", () => {
    expect(photoPosition(0, 3)).toBe("Foto 1 de 3");
    expect(photoPosition(4, 5)).toBe("Foto 5 de 5");
    expect(hasGallery([])).toBe(false);
    expect(hasGallery(["/items/x/images/0"])).toBe(false);
    expect(hasGallery(["/items/x/images/0", "/items/x/images/1"])).toBe(true);
  });
});

describe("galleryReducer: transições", () => {
  const at = (index: number, failed: string[] = []) => ({ index, failed: new Set(failed) });

  it("próxima e anterior dão a volta nas pontas", () => {
    expect(galleryReducer(at(2), { type: "next" }, 3).index).toBe(0);
    expect(galleryReducer(at(0), { type: "prev" }, 3).index).toBe(2);
    expect(galleryReducer(at(1), { type: "next" }, 3).index).toBe(2);
    expect(galleryReducer(at(1), { type: "prev" }, 3).index).toBe(0);
  });

  it("miniatura escolhe a foto; índice fora da lista é ignorado", () => {
    expect(galleryReducer(at(0), { type: "select", index: 3 }, 5).index).toBe(3);
    const state = at(1);
    expect(galleryReducer(state, { type: "select", index: 5 }, 5)).toBe(state);
    expect(galleryReducer(state, { type: "select", index: -1 }, 5)).toBe(state);
  });

  it("teclas: setas, Home e End mudam o índice; outras teclas devolvem o mesmo estado", () => {
    expect(galleryReducer(at(0), { type: "key", key: "ArrowLeft" }, 4).index).toBe(3);
    expect(galleryReducer(at(1), { type: "key", key: "Home" }, 4).index).toBe(0);
    expect(galleryReducer(at(1), { type: "key", key: "End" }, 4).index).toBe(3);
    const state = at(2);
    expect(galleryReducer(state, { type: "key", key: "Enter" }, 4)).toBe(state);
  });

  it("foto que falha entra no conjunto sem repetir e sem mexer no índice", () => {
    const once = galleryReducer(at(1), { type: "failed", src: "a" }, 3);
    expect([...once.failed]).toEqual(["a"]);
    expect(once.index).toBe(1);
    expect(galleryReducer(once, { type: "failed", src: "a" }, 3)).toBe(once);
    expect([...galleryReducer(once, { type: "failed", src: "b" }, 3).failed]).toEqual(["a", "b"]);
  });

  it("com menos de duas fotos nada navega; índice velho é contido na lista", () => {
    const state = at(0);
    expect(galleryReducer(state, { type: "next" }, 1)).toBe(state);
    expect(galleryReducer(state, { type: "prev" }, 1)).toBe(state);
    expect(clampIndex(7, 3)).toBe(2);
    expect(clampIndex(-1, 3)).toBe(0);
    expect(galleryReducer(at(9), { type: "next" }, 3).index).toBe(0);
  });
});
