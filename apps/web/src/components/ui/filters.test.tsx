import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FilterTabs } from "./filter-tabs";
import { SearchField } from "./search-field";
import { SelectField } from "./select-field";

const tabs = [
  { value: "ALL", label: "Todos" },
  { value: "LIVE", label: "Ao vivo" },
  { value: "SCHEDULED", label: "Agendados" },
  { value: "ENDED", label: "Encerrados" },
];
const renderTabs = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<FilterTabs label="Status" tabs={tabs} value="LIVE" onChange={() => undefined} {...props} />);

describe("FilterTabs: controle segmentado", () => {
  it("é um grupo nomeado com um botão aria-pressed por segmento, na ordem dada, e só o ativo marcado", () => {
    const html = renderTabs();
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Status"');
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(3);
    expect(html).not.toContain('role="tab"');
    const order = tabs.map((tab) => html.indexOf(`>${tab.label}<`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((index) => index > 0)).toBe(true);
  });

  it("trilho de pílula de 44px com fio linha sobre papel; segmento de 36px, pílula, 14/600 em caixa normal", () => {
    const html = renderTabs();
    for (const token of ["h-11", "rounded-full", "border-linha", "bg-papel"]) expect(html).toContain(token);
    for (const token of ["h-9", "rounded-full", "px-[14px]", "t-filtro", "whitespace-nowrap", "flex-auto"]) expect(html).toContain(token);
    expect(html).not.toMatch(/rounded-nenhum|border-\[3px\]|uppercase/);
  });

  it("área clicável de 44px por pseudo-elemento", () => {
    expect(renderTabs()).toContain("before:-inset-y-1");
  });

  it("estados: hover em selecionado com texto azul, selecionado em azul principal com borda do tema, hover do selecionado em ocreHover", () => {
    const html = renderTabs();
    expect(html).toContain("not-disabled:not-aria-pressed:hover:bg-selecionado");
    expect(html).toContain("not-disabled:not-aria-pressed:hover:text-ocreTextoHover");
    expect(html).toContain("aria-pressed:bg-ocre");
    expect(html).toContain("aria-pressed:text-sobreOcre");
    expect(html).toContain("aria-pressed:border-ocreBorda");
    expect(html).toContain("aria-pressed:shadow-botao");
    expect(html).toContain("not-disabled:aria-pressed:hover:bg-ocreHover");
    expect(html).toContain("not-disabled:active:translate-y-px");
  });

  it("desabilitado e selecionado+desabilitado têm visual próprio", () => {
    const html = renderTabs();
    expect(html).toContain("disabled:text-tinta2");
    expect(html).toContain("disabled:cursor-not-allowed");
    expect(html).toContain("disabled:aria-pressed:bg-papel");
    expect(html).toContain("disabled:aria-pressed:border-linha");
    expect(html).toContain("disabled:aria-pressed:text-tinta2");
  });

  it("o invólucro dá 6px de folga ao anel de foco e rola na horizontal sem barra", () => {
    const html = renderTabs();
    for (const token of ["-m-1.5", "p-1.5", "w-fit", "overflow-x-auto", "max-w-full", "[scrollbar-width:none]"]) expect(html).toContain(token);
  });

  it("contador: badge de 20px, tabular-nums e dois dígitos; className chega ao invólucro", () => {
    const html = renderTabs({ tabs: [{ value: "ALL", label: "Todos", count: 3 }], value: "ALL", className: "w-full" });
    expect(html).toContain(">03<");
    for (const token of ["h-5", "min-w-5", "rounded-full", "tabular-nums", "text-[12px]", "group-aria-pressed:bg-white/20"]) expect(html).toContain(token);
    expect(html).toMatch(/class="-m-1\.5[^"]* w-full"/);
  });
});

describe("SearchField", () => {
  const html = renderToStaticMarkup(<SearchField id="busca" label="Buscar" value="" onChange={() => undefined} placeholder="Marca, modelo, ano…" />);

  it("rótulo ligado ao campo, type=search e placeholder", () => {
    expect(html).toContain('<label for="busca"');
    expect(html).toContain("t-rotulo-campo");
    expect(html).toContain('type="search"');
    expect(html).toContain('id="busca"');
    expect(html).toContain('placeholder="Marca, modelo, ano…"');
  });

  it("44px, 12px de raio, papel, fio linha, hover tinta2 e borda foco no foco", () => {
    for (const token of ["h-11", "rounded-xl", "bg-papel", "border-linha", "hover:border-tinta2", "focus-visible:border-foco", "text-[16px]"]) expect(html).toContain(token);
    expect(html).toContain("disabled:bg-suave");
    expect(html).not.toMatch(/rounded-nenhum|border-2|bg-fundo/);
  });

  it("lupa de 18px escondida dos leitores, a 14px da borda, com o texto a partir dos 42px e azul no foco", () => {
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"[^>]*width="18"[^>]*height="18"/);
    expect(html).toContain("left-[14px]");
    expect(html).toContain("!pl-[42px]");
    expect(html).toContain("group-focus-within:text-ocreTexto");
    expect(html).toContain("pointer-events-none");
  });
});

describe("SelectField", () => {
  const html = renderToStaticMarkup(
    <SelectField id="marca" label="Marca" value="" onChange={() => undefined}>
      <option value="">Todas</option>
      <option value="Fiat">Fiat</option>
    </SelectField>,
  );

  it("select nativo ligado ao rótulo, com as opções dadas", () => {
    expect(html).toContain('<label for="marca"');
    expect(html).toContain("<select");
    expect(html).toContain('id="marca"');
    expect(html).toContain(">Todas<");
    expect(html).toContain(">Fiat<");
  });

  it("mesma caixa da busca, sem a seta do navegador e com folga de 40px para o chevron", () => {
    for (const token of ["h-11", "rounded-xl", "bg-papel", "border-linha", "appearance-none", "!pr-10"]) expect(html).toContain(token);
  });

  it("chevron próprio de 16px, decorativo e sem pegar o clique", () => {
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"[^>]*width="16"[^>]*height="16"/);
    expect(html).toContain("pointer-events-none");
    expect(html).toContain("right-[14px]");
  });
});
