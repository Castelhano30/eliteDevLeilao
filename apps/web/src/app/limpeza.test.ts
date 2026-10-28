import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guarda da etapa 16 (DESIGN 7): o estilo "Manual de pátio" não volta. Lê as fontes (sem testes) e confere o que sobra, com a lista
// exata das exceções que o DESIGN prevê: o picote, o carimbo, a etiqueta do lote, o logo, o avatar e o selo "Sem lances" tracejado.
const SRC = path.resolve(__dirname, "..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
const sources = files(SRC).map((file) => ({ name: path.relative(SRC, file).replaceAll("\\", "/"), text: readFileSync(file, "utf8") }));
const using = (re: RegExp) => sources.filter((s) => re.test(s.text)).map((s) => s.name).sort();
const tailwind = readFileSync(path.resolve(SRC, "../tailwind.config.mjs"), "utf8");

describe("Limpeza final: nada do estilo antigo", () => {
  it("nenhum canto reto: o token rounded-nenhum e o raio 0 não existem mais", () => {
    expect(using(/rounded-nenhum/)).toEqual([]);
    expect(tailwind).not.toMatch(/nenhum:\s*"0"/);
  });

  it("nenhuma borda de 3 ou 4px", () => {
    expect(using(/border-\[3px\]|border-\[4px\]|border-4\b|border-[xytblr]-4\b/)).toEqual([]);
  });

  it("nenhuma sombra dura: sem drop-shadow deslocado nem box-shadow de 'N px N px 0'", () => {
    expect(using(/drop-shadow\(\d|boxShadow:\s*"\d+px \d+px 0|\d+px \d+px 0 var\(--c-sombra\)|var\(--c-sombra\)\s*\)/)).toEqual([]);
    expect(using(/\bshadow-sombra\b|\bborder-sombra\b/)).toEqual([]);
  });

  it("o tracejado só sobra no picote (canhoto e recibo) e no selo 'Sem lances'", () => {
    expect(using(/border-dashed/)).toEqual(["components/my-bids/bid-ticket.tsx", "components/ui/perforation.tsx", "components/ui/stamp.tsx"]);
    expect(using(/border-tracejado/)).toEqual(["components/my-bids/bid-ticket.tsx", "components/ui/perforation.tsx"]);
  });

  it("a borda de 2px só aparece onde o DESIGN a prevê (picote, avatar, logo, etiqueta do lote e carimbo)", () => {
    expect(using(/\bborder-2\b|\bborder-[xytblr]-2\b/)).toEqual([
      "components/my-bids/bid-ticket.tsx",
      "components/profile-menu.tsx",
      "components/ui/logo.tsx",
      "components/ui/lot-tag.tsx",
      "components/ui/perforation.tsx",
      "components/ui/stamp.tsx",
    ]);
  });

  it("as classes tipográficas de cartaz e placar (26 e 30px em caixa-alta) saíram", () => {
    expect(using(/t-cartaz-|t-placar/)).toEqual([]);
  });

  it("nenhum hover em ferrugem fora do botão de perigo e do secundário destrutivo", () => {
    expect(using(/hover:[^\s"`]*ferrugem|hover:!text-ferrugem/)).toEqual(["components/ui/button.tsx"]);
  });
});
