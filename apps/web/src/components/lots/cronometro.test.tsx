import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Cronometro } from "./cronometro";

describe("Cronometro", () => {
  it.each(["CLOSING", "SOLD", "UNSOLD"] as const)("%s expõe Tempo restante 00:00", (status) => {
    const html = renderToStaticMarkup(
      <Cronometro status={status} startsAt="2026-10-23T10:00:00.000Z" endsAt="2026-10-23T11:00:00.000Z" size="sala" />,
    );
    expect(html).toContain('role="timer" aria-label="Tempo restante 00:00"');
  });
});

describe("Cronometro: mostrador fantasma", () => {
  const SERVER_NOW = "2026-10-23T12:00:00.000Z";
  const at = (offsetMs: number) => new Date(Date.parse(SERVER_NOW) + offsetMs).toISOString();
  const SEC = 1_000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  function render(endsInMs: number, size: "sala" | "cartao", originalEndsInMs = endsInMs) {
    return renderToStaticMarkup(
      <Cronometro
        status="LIVE"
        startsAt={at(-HOUR)}
        endsAt={at(endsInMs)}
        originalEndsAt={at(originalEndsInMs)}
        size={size}
        serverTime={SERVER_NOW}
      />,
    );
  }
  const ghostOf = (html: string) => /data-ghost="([^"]*)"/.exec(html)?.[1];
  const realOf = (html: string) => />([^<>]*)<\/span><\/span><span class="sr-only"/.exec(html)?.[1];

  // Cada caso é um formato que o relógio mostra: dias, horas e minutos.
  it.each([
    ["26d 10:18:34", 26 * DAY + 10 * HOUR + 18 * MIN + 34 * SEC, "88d 88:88:88"],
    ["03:07:41", 3 * HOUR + 7 * MIN + 41 * SEC, "88:88:88"],
    ["09:05", 9 * MIN + 5 * SEC, "88:88"],
  ])("%s: o fantasma troca só os dígitos por 8 e tem o mesmo tamanho do texto", (text, endsInMs, ghost) => {
    for (const size of ["sala", "cartao"] as const) {
      const html = render(endsInMs, size);
      expect(realOf(html)).toBe(text);
      expect(ghostOf(html)).toBe(ghost);
      expect(ghostOf(html)).toHaveLength(text.length);
      expect(ghostOf(html)?.replace(/8/g, "0")).toBe(text.replace(/\d/g, "0"));
    }
  });

  it("últimos 2 min: o texto real pulsa e o fantasma continua parado", () => {
    const html = render(95 * SEC, "sala");
    expect(realOf(html)).toBe("01:35");
    expect(ghostOf(html)).toBe("88:88");
    expect(html).toContain("animation:la-pulsa 1s infinite");
    expect(html.match(/la-pulsa/g)).toHaveLength(1);
  });

  it("os tamanhos sala e cartão mudam só a fonte", () => {
    expect(render(9 * MIN, "sala")).toContain("font-size:44px");
    expect(render(9 * MIN, "cartao")).toContain("font-size:24px");
  });

  it("não muda a acessibilidade: role timer no contêiner, texto e fantasma escondidos do leitor", () => {
    const html = render(26 * DAY + 10 * HOUR + 18 * MIN + 34 * SEC, "sala");
    expect(html).toContain('role="timer" aria-label="Tempo restante 26d 10:18:40"');
    expect(html).toMatch(/<span aria-hidden="true" data-ghost="[^"]*" class="la-segmentos-apagados/);
    expect(html).toMatch(/<span aria-hidden="true" class="relative"/);
  });

  it("prorrogado: o selo +2 MIN aparece sem mexer no fantasma", () => {
    const html = render(95 * SEC, "cartao", -5 * MIN);
    expect(html).toContain("+2 MIN");
    expect(ghostOf(html)).toBe("88:88");
  });
});

describe("Cronometro: CSS do fantasma", () => {
  const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

  // O "8" é mais largo que o "1" numa fonte proporcional: sem algarismos tabulares o fantasma passa da largura
  // do texto real e, sem `nowrap`, quebra no espaço ("88d" / "88:88:88"), aparecendo como um segundo mostrador.
  it("o mostrador usa algarismos tabulares", () => {
    expect(css).toMatch(/\.la-mostrador\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });

  it("o fantasma nunca quebra linha", () => {
    expect(css).toMatch(/\.la-segmentos-apagados\s*\{[^}]*white-space:\s*nowrap/);
  });

  it("o contêiner do relógio usa essas classes", () => {
    const html = renderToStaticMarkup(
      <Cronometro status="LIVE" startsAt="2026-10-23T11:00:00.000Z" endsAt="2026-10-23T13:00:00.000Z" size="sala" serverTime="2026-10-23T12:00:00.000Z" />,
    );
    expect(html).toContain("la-mostrador");
    expect(html).toContain("whitespace-nowrap");
  });
});
