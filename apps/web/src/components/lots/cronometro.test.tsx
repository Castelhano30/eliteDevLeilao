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

describe("Cronometro: cor dos dígitos", () => {
  it.each(["sala", "cartao"] as const)("%s: dígitos brancos fora do alerta", (size) => {
    const html = renderToStaticMarkup(
      <Cronometro status="LIVE" startsAt="2026-10-23T10:00:00.000Z" endsAt="2026-10-23T15:00:00.000Z" size={size} serverTime="2026-10-23T12:00:00.000Z" />,
    );
    expect(html).toContain("color:var(--c-led-digito)");
    expect(html).not.toContain("color:var(--c-led)");
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

  it("os tamanhos sala e cartão mudam só a fonte (a da sala encolhe em tela estreita, para não passar do painel)", () => {
    expect(render(9 * MIN, "sala")).toContain("font-size:clamp(32px, 10vw, 44px)");
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

describe("Cronometro: pele da Rev. 05", () => {
  const SERVER_NOW = "2026-10-23T12:00:00.000Z";
  const at = (offsetMs: number) => new Date(Date.parse(SERVER_NOW) + offsetMs).toISOString();
  const SEC = 1_000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;

  function render(opts: { status?: "LIVE" | "SCHEDULED" | "CLOSING" | "SOLD" | "UNSOLD" | "CANCELLED"; endsInMs?: number; originalEndsInMs?: number; size?: "sala" | "cartao" } = {}) {
    const { status = "LIVE", size = "cartao" } = opts;
    // Agendado conta até o início (daqui a 1 h) e o fim original é o fim: não há prorrogação.
    const endsInMs = status === "SCHEDULED" ? 2 * HOUR : (opts.endsInMs ?? 30 * MIN);
    const originalEndsInMs = status === "SCHEDULED" ? endsInMs : (opts.originalEndsInMs ?? endsInMs);
    return renderToStaticMarkup(
      <Cronometro status={status} startsAt={at(status === "SCHEDULED" ? HOUR : -HOUR)} endsAt={at(endsInMs)} originalEndsAt={at(originalEndsInMs)} size={size} serverTime={SERVER_NOW} />,
    );
  }
  const border = (html: string) => /style="border:([^"]*)"/.exec(html)?.[1];
  const labelOf = (html: string) => /<span class="inline-flex items-center gap-1 text-\[12px\][^>]*>(.*?)<\/span><div/.exec(html)?.[1] ?? "";

  it("display de 12px de raio sobre o painel; cartão com padding 8/12 e Sala com 10/14", () => {
    const cartao = render({ size: "cartao" });
    expect(cartao).toContain("rounded-xl");
    expect(cartao).toContain("bg-painel");
    expect(cartao).toContain("px-3 py-2");
    expect(cartao).not.toMatch(/rounded-nenhum|relative inline-flex/);
    expect(render({ size: "sala" })).toContain("px-[14px] py-[10px]");
  });

  it("rótulo de 12px/700 em caixa-alta; dígitos em 700 com tabular-nums e sem quebra", () => {
    const html = render();
    expect(html).toContain("text-[12px] font-bold uppercase");
    expect(html).toContain("la-mostrador");
    expect(html).toMatch(/role="timer"[^>]*class="la-mostrador relative whitespace-nowrap font-bold leading-none"/);
  });

  it("normal: fio de 1px linha, rótulo RESTAM (cartão) ou TEMPO RESTANTE (Sala), sem ícone", () => {
    const cartao = render();
    expect(border(cartao)).toBe("1px solid var(--c-linha)");
    expect(labelOf(cartao)).toBe("RESTAM");
    expect(cartao).not.toContain("<svg");
    expect(labelOf(render({ size: "sala" }))).toBe("TEMPO RESTANTE");
  });

  it("últimos 2 min: borda de 2px em ledAlerta, rótulo em ledAlerta com ícone de alerta e dígitos pulsando", () => {
    const html = render({ endsInMs: 95 * SEC });
    expect(border(html)).toBe("2px solid var(--c-led-alerta)");
    expect(html).toContain("ÚLTIMOS 2 MIN");
    expect(html).toMatch(/<span class="inline-flex[^"]*"[^>]*style="color:var\(--c-led-alerta\)"><svg aria-hidden="true"/);
    expect(html.match(/la-pulsa/g)).toHaveLength(1);
    expect(html).not.toContain("--c-ferrugem");
  });

  it("prorrogado: rótulo PRORROGADO, fio de 1px e o selo +2 MIN", () => {
    const html = render({ endsInMs: 30 * MIN, originalEndsInMs: 10 * MIN });
    expect(labelOf(html)).toBe("PRORROGADO");
    expect(border(html)).toBe("1px solid var(--c-linha)");
    expect(html).toContain("+2 MIN");
  });

  it("prorrogado nos últimos 2 min: rótulo, ícone e borda de alerta mais o selo", () => {
    const html = render({ endsInMs: 90 * SEC, originalEndsInMs: -5 * MIN });
    expect(html).toContain("ÚLTIMOS 2 MIN");
    expect(border(html)).toBe("2px solid var(--c-led-alerta)");
    expect(html).toContain("+2 MIN");
    expect(html).toContain("<svg");
  });

  it("+2 MIN entra no fluxo, na linha dos dígitos e depois deles: sem position absolute, sem rotação e fora do rótulo", () => {
    const html = render({ endsInMs: 30 * MIN, originalEndsInMs: 10 * MIN });
    expect(html).not.toMatch(/absolute"[^>]*>\+2 MIN|rotate|right:-14|top:-14/);
    const row = /<div class="flex flex-wrap items-center gap-x-2 gap-y-1">(.*)<\/div><\/div>$/.exec(html)?.[1] ?? "";
    expect(row).toContain('role="timer"');
    expect(row.indexOf("+2 MIN")).toBeGreaterThan(row.indexOf('role="timer"'));
    expect(labelOf(html)).not.toContain("+2 MIN");
    for (const token of ["inline-flex", "shrink-0", "rounded-full", "bg-led", "text-painel", "font-extrabold", "text-[12px]"]) expect(html).toContain(token);
  });

  it("o selo tem 20px no cartão e 24px na Sala", () => {
    const opts = { endsInMs: 30 * MIN, originalEndsInMs: 10 * MIN };
    expect(render({ ...opts, size: "cartao" })).toContain("text-painel h-5");
    expect(render({ ...opts, size: "sala" })).toContain("text-painel h-6");
  });

  it.each([
    ["CLOSING", 30 * MIN],
    ["LIVE", -5 * SEC],
  ] as const)("apurando (%s com o fim passado): borda de 2px em ledAlerta, rótulo APURANDO…, 00:00 sem pulso", (status, endsInMs) => {
    const html = render({ status, endsInMs });
    expect(labelOf(html)).toBe("APURANDO…");
    expect(border(html)).toBe("2px solid var(--c-led-alerta)");
    expect(html).not.toContain("la-pulsa");
    expect(html).toContain('aria-label="Tempo restante 00:00"');
    expect(html).not.toContain("<svg");
  });

  it.each(["SOLD", "UNSOLD"] as const)("%s: ENCERRADO, 00:00 e fio de 1px", (status) => {
    const html = render({ status });
    expect(labelOf(html)).toBe("ENCERRADO");
    expect(border(html)).toBe("1px solid var(--c-linha)");
  });

  it("agendado: ABRE EM com fio de 1px e sem selo", () => {
    const html = render({ status: "SCHEDULED" });
    expect(labelOf(html)).toBe("ABRE EM");
    expect(border(html)).toBe("1px solid var(--c-linha)");
    expect(html).not.toContain("+2 MIN");
  });
});
