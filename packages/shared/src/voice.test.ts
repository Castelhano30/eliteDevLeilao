import { describe, expect, it } from "vitest";
import * as shared from "./index";

/** Coleta as frases das constantes de texto (objetos e listas de strings); funções e regex ficam de fora. */
function collect(value: unknown, path: string, out: [string, string][]): void {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((item, i) => collect(item, `${path}[${i}]`, out));
  else if (value !== null && typeof value === "object" && !(value instanceof RegExp)) {
    for (const [key, item] of Object.entries(value)) collect(item, `${path}.${key}`, out);
  }
}

const TEXT_EXPORTS = Object.entries(shared).filter(([name]) => /(_TEXT|_LABEL|_NOTE|_MESSAGE)S?$/.test(name));

describe("voz do pátio nos textos de interface (INV-18, AC-9.21)", () => {
  const sentences: [string, string][] = [];
  for (const [name, value] of TEXT_EXPORTS) collect(value, name, sentences);

  it("encontra as constantes de texto", () => {
    expect(TEXT_EXPORTS.length).toBeGreaterThan(10);
    expect(sentences.length).toBeGreaterThan(100);
  });

  it("nenhuma frase tem exclamação", () => {
    expect(sentences.filter(([, text]) => text.includes("!")).map(([path]) => path)).toEqual([]);
  });

  it("nenhuma frase tem emoji", () => {
    expect(sentences.filter(([, text]) => /\p{Extended_Pictographic}/u.test(text)).map(([path]) => path)).toEqual([]);
  });
});
