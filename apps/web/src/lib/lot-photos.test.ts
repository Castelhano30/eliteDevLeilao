import { describe, expect, it } from "vitest";
import { LOT_TEXT } from "@lanceauto/shared";
import { PhotoError } from "./image-resize";
import { buildLotForm, imageBodyFields, ingestMessages, ingestPhotos, makeCover, needsDiscardConfirmation, photoFileName, planImageSubmit, removePhoto } from "./lot-photos";

const photos = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((photo) => photo.id);
const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });

describe("tornar capa e remover", () => {
  it("a foto 3 vai à posição 1 e as demais mantêm a ordem relativa", () => {
    expect(ids(makeCover(photos("a", "b", "c", "d"), "c"))).toEqual(["c", "a", "b", "d"]);
  });

  it("tornar capa a que já é capa, ou um id que não existe, não muda nada", () => {
    const list = photos("a", "b");
    expect(ids(makeCover(list, "a"))).toEqual(["a", "b"]);
    expect(makeCover(list, "z")).toBe(list);
  });

  it("remover a capa passa a vez à próxima; remover a única esvazia", () => {
    expect(ids(removePhoto(photos("a", "b", "c"), "a"))).toEqual(["b", "c"]);
    expect(removePhoto(photos("a"), "a")).toEqual([]);
  });
});

describe("ingestPhotos: uma por vez, até 5", () => {
  const ok = async (f: File) => new Blob([f.name]);

  it("3 escolhidas, mais 4 novas: entram 2, as demais ficam de fora com o aviso", async () => {
    const opened: string[] = [];
    const result = await ingestPhotos(["1", "2", "3", "4"].map(file), 3, async (f) => {
      opened.push(f.name);
      return ok(f);
    });
    expect(result.accepted.map((entry) => entry.file.name)).toEqual(["1", "2"]);
    expect(result.overflow).toBe(true);
    // As que não cabem nem chegam a ser abertas (memória do celular).
    expect(opened).toEqual(["1", "2"]);
    expect(ingestMessages(result)).toEqual([LOT_TEXT.imagesOverflow]);
  });

  it("arquivo inválido é recusado com o nome na frase e os outros entram", async () => {
    const resize = async (f: File) => {
      if (f.name === "ruim.gif") throw new PhotoError("unreadable");
      return ok(f);
    };
    const result = await ingestPhotos([file("a.jpg"), file("ruim.gif"), file("b.jpg")], 0, resize);
    expect(result.accepted.map((entry) => entry.file.name)).toEqual(["a.jpg", "b.jpg"]);
    expect(result.failures).toEqual(["Não deu para ler ruim.gif. Use JPEG, PNG ou WebP."]);
    expect(result.overflow).toBe(false);
  });

  it("foto que passa de 4 MB mesmo reduzida: Cada foto aceita até 4 MB.", async () => {
    const result = await ingestPhotos([file("enorme.jpg")], 0, async () => {
      throw new PhotoError("toobig");
    });
    expect(result.failures).toEqual([LOT_TEXT.imageTooBig]);
    expect(result.accepted).toEqual([]);
  });

  it("recusa não ocupa vaga: 5 boas com 1 ruim no meio enchem as 5", async () => {
    const resize = async (f: File) => {
      if (f.name === "x") throw new Error("qualquer erro");
      return ok(f);
    };
    const result = await ingestPhotos(["a", "x", "b", "c", "d", "e"].map(file), 0, resize);
    expect(result.accepted.map((entry) => entry.file.name)).toEqual(["a", "b", "c", "d", "e"]);
    expect(result.failures).toHaveLength(1);
    expect(result.overflow).toBe(false);
  });
});

describe("buildLotForm e troca de modo", () => {
  it("payload com o JSON e partes images na ordem da galeria, com nome só de rótulo", async () => {
    const form = buildLotForm({ title: "Corolla" }, [{ blob: new Blob(["um"]) }, { blob: new Blob(["dois"]) }]);
    expect(form.get("payload")).toBe('{"title":"Corolla"}');
    const images = form.getAll("images") as File[];
    expect(images.map((image) => image.name)).toEqual([photoFileName(0), photoFileName(1)]);
    expect(await Promise.all(images.map((image) => image.text()))).toEqual(["um", "dois"]);
  });

  it("só pergunta ao sair de Enviar fotos para URL com fotos escolhidas", () => {
    expect(needsDiscardConfirmation("upload", "url", 3)).toBe(true);
    expect(needsDiscardConfirmation("upload", "url", 0)).toBe(false);
    expect(needsDiscardConfirmation("url", "upload", 0)).toBe(false);
    expect(needsDiscardConfirmation("url", "upload", 2)).toBe(false);
  });
});

describe("decisão do envio (imagem do corpo e do multipart)", () => {
  const url = { imageUrl: "https://x.test/a.jpg", imageCredit: "Foto: Fulano", imageCreditUrl: "https://x.test/c" };

  it("modo URL leva imageUrl e crédito no corpo JSON", () => {
    expect(imageBodyFields("url", false, url)).toEqual(url);
    expect(planImageSubmit("url", false, 0)).toEqual({ kind: "json" });
    // Fotos escolhidas e esquecidas no modo URL nunca viram multipart.
    expect(planImageSubmit("url", false, 3)).toEqual({ kind: "json" });
  });

  it("modo fotos: corpo sem imageUrl nem crédito, e multipart só com fotos", () => {
    expect(imageBodyFields("upload", false, url)).toEqual({});
    expect(planImageSubmit("upload", false, 2)).toEqual({ kind: "multipart" });
    expect(planImageSubmit("upload", false, 5)).toEqual({ kind: "multipart" });
  });

  it("modo fotos sem nenhuma: não envia e devolve a frase de falta de fotos", () => {
    expect(planImageSubmit("upload", false, 0)).toEqual({ kind: "missing", error: LOT_TEXT.imagesRequired });
  });

  it("Sem foto volta ao JSON, em qualquer modo e mesmo com fotos guardadas, sem campos de imagem", () => {
    for (const mode of ["url", "upload"] as const) {
      expect(imageBodyFields(mode, true, url)).toEqual({});
      expect(planImageSubmit(mode, true, 0)).toEqual({ kind: "json" });
      expect(planImageSubmit(mode, true, 4)).toEqual({ kind: "json" });
    }
  });
});
