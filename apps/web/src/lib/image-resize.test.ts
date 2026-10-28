import { afterEach, describe, expect, it, vi } from "vitest";
import { LOT_IMAGE_MAX_BYTES } from "@lanceauto/shared";
import { PhotoError, fitWithin, isAcceptedPhoto, resizePhoto } from "./image-resize";

describe("fitWithin: a conta das dimensões", () => {
  it("foto de celular 4000x3000 vira 1600x1200 (lado maior em 1600, mesma proporção)", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it("nunca amplia: 800x600 e o limite exato 1600 saem como entraram", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 900)).toEqual({ width: 1600, height: 900 });
    expect(fitWithin(1, 1)).toEqual({ width: 1, height: 1 });
  });

  it("arredonda para inteiros e nunca zera um lado (panorâmica extrema)", () => {
    expect(fitWithin(5000, 7)).toEqual({ width: 1600, height: 2 });
    expect(fitWithin(10_000, 1)).toEqual({ width: 1600, height: 1 });
    const odd = fitWithin(4001, 3001);
    expect(Number.isInteger(odd.width) && Number.isInteger(odd.height)).toBe(true);
  });
});

describe("isAcceptedPhoto: porta da frente", () => {
  it("JPEG, PNG e WebP passam; GIF, SVG, PDF e HEIC não", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "IMAGE/JPEG"]) expect(isAcceptedPhoto({ type, name: "x" })).toBe(true);
    for (const type of ["image/gif", "image/svg+xml", "application/pdf", "image/heic", "text/html"]) {
      expect(isAcceptedPhoto({ type, name: "foto.jpg" })).toBe(false);
    }
  });

  it("tipo vazio: vale a extensão", () => {
    expect(isAcceptedPhoto({ type: "", name: "IMG_1.JPG" })).toBe(true);
    expect(isAcceptedPhoto({ type: "", name: "a.webp" })).toBe(true);
    expect(isAcceptedPhoto({ type: "", name: "a.gif" })).toBe(false);
    expect(isAcceptedPhoto({ type: "", name: "semextensao" })).toBe(false);
  });
});

describe("resizePhoto (canvas simulado)", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Instala `createImageBitmap` e `document.createElement("canvas")` falsos; devolve o que foi desenhado. */
  function stubBrowser(source: { width: number; height: number } | "falha", encoded: Blob | null) {
    const calls = { fills: [] as string[], drawn: null as unknown, canvas: { width: 0, height: 0 }, encode: null as unknown[] | null, closed: false };
    vi.stubGlobal("createImageBitmap", async (_file: Blob, options: unknown) => {
      calls.encode = [options];
      if (source === "falha") throw new Error("não decodifica");
      return { ...source, close: () => (calls.closed = true) };
    });
    const canvas = {
      get width() {
        return calls.canvas.width;
      },
      set width(value: number) {
        calls.canvas.width = value;
      },
      get height() {
        return calls.canvas.height;
      },
      set height(value: number) {
        calls.canvas.height = value;
      },
      getContext: () => ({
        set fillStyle(value: string) {
          calls.fills.push(value);
        },
        fillRect: (...args: number[]) => calls.fills.push(`rect:${args.join(",")}`),
        drawImage: (...args: unknown[]) => (calls.drawn = args.slice(1)),
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
      }),
      toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => {
        calls.encode = [...(calls.encode ?? []), type, quality];
        callback(encoded);
      },
    };
    vi.stubGlobal("document", { createElement: () => canvas });
    return calls;
  }

  const file = (name = "foto.jpg", type = "image/jpeg") => new File(["x"], name, { type });

  it("4000x3000: regrava em 1600x1200, fundo branco, orientação do EXIF, JPEG 0,85, e solta o bitmap", async () => {
    const jpeg = new Blob([new Uint8Array(300_000)], { type: "image/jpeg" });
    const calls = stubBrowser({ width: 4000, height: 3000 }, jpeg);
    const out = await resizePhoto(file());
    expect(out).toBe(jpeg);
    expect(calls.canvas).toEqual({ width: 1600, height: 1200 });
    expect(calls.fills).toEqual(["#ffffff", "rect:0,0,1600,1200"]);
    expect(calls.drawn).toEqual([0, 0, 1600, 1200]);
    expect(calls.encode).toEqual([{ imageOrientation: "from-image" }, "image/jpeg", 0.85]);
    expect(calls.closed).toBe(true);
  });

  it("800x600 não é ampliada", async () => {
    const calls = stubBrowser({ width: 800, height: 600 }, new Blob(["j"]));
    await resizePhoto(file("a.png", "image/png"));
    expect(calls.canvas).toEqual({ width: 800, height: 600 });
  });

  it("GIF e SVG são recusados sem decodificar", async () => {
    const calls = stubBrowser({ width: 10, height: 10 }, new Blob(["j"]));
    await expect(resizePhoto(file("a.gif", "image/gif"))).rejects.toMatchObject({ kind: "unreadable" });
    await expect(resizePhoto(file("a.svg", "image/svg+xml"))).rejects.toBeInstanceOf(PhotoError);
    expect(calls.encode).toBeNull();
  });

  it("arquivo corrompido (não decodifica nem no img) vira ilegível", async () => {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined });
    vi.stubGlobal(
      "Image",
      class {
        decoding = "";
        src = "";
        decode = async () => {
          throw new Error("quebrado");
        };
      },
    );
    stubBrowser("falha", null);
    await expect(resizePhoto(file())).rejects.toMatchObject({ kind: "unreadable" });
  });

  it("depois de reduzida, acima de 4 MB: recusada por tamanho", async () => {
    stubBrowser({ width: 1000, height: 1000 }, new Blob([new Uint8Array(LOT_IMAGE_MAX_BYTES + 1)]));
    await expect(resizePhoto(file())).rejects.toMatchObject({ kind: "toobig" });
  });

  it("exatamente 4 MB passa; o canvas que não gera nada é ilegível", async () => {
    stubBrowser({ width: 1000, height: 1000 }, new Blob([new Uint8Array(LOT_IMAGE_MAX_BYTES)]));
    await expect(resizePhoto(file())).resolves.toBeInstanceOf(Blob);
    stubBrowser({ width: 1000, height: 1000 }, null);
    await expect(resizePhoto(file())).rejects.toMatchObject({ kind: "unreadable" });
  });

  it("dimensão zero é ilegível", async () => {
    stubBrowser({ width: 0, height: 0 }, new Blob(["j"]));
    await expect(resizePhoto(file())).rejects.toMatchObject({ kind: "unreadable" });
  });
});
