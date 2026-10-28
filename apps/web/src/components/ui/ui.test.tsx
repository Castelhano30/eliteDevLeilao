import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable } from "./data-table";
import { Field } from "./field";
import { FilterTabs } from "./filter-tabs";
import { IdentityChip } from "./identity-chip";
import { PlacarPosicao } from "../lots/placar-posicao";
import { Logo } from "./logo";
import { LotTag } from "./lot-tag";
import { RefusalMessage } from "./refusal-message";
import { Stamp } from "./stamp";

describe("Field", () => {
  it("liga rótulo, ajuda e erro ao campo", () => {
    const html = renderToStaticMarkup(<Field id="x" label="E-mail" help="Só para entrar." error="Inválido." />);
    expect(html).toContain('<label for="x"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="x-ajuda x-erro"');
    expect(html).toContain('id="x-ajuda"');
    expect(html).toContain('id="x-erro"');
  });

  it("não marca inválido sem erro e mostra prefixo e sufixo", () => {
    const html = renderToStaticMarkup(<Field id="v" label="Valor" prefix="R$" suffix=",00" />);
    expect(html).not.toContain("aria-invalid");
    expect(html).toContain("R$");
    expect(html).toContain(",00");
  });
});

describe("RefusalMessage", () => {
  it("é um alert com ícone escondido e texto", () => {
    const html = renderToStaticMarkup(<RefusalMessage action={{ href: "/carteira", label: "Depositar →" }}>Sem saldo.</RefusalMessage>);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Sem saldo.");
    expect(html).toContain('href="/carteira"');
  });
});

describe("DataTable", () => {
  const html = renderToStaticMarkup(
    <DataTable
      caption="Extrato"
      columns={[
        { key: "a", header: "Tipo", render: (row: { a: string }) => row.a },
        { key: "b", header: "Valor", align: "right", render: () => "R$ 1,00" },
      ]}
      rows={[{ a: "Depósito" }]}
      rowKey={(row) => row.a}
    />,
  );

  it("tem região rolável focável com nome, legenda e cabeçalho com escopo", () => {
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Extrato"');
    expect(html).toContain("<caption");
    expect(html).toContain('scope="col"');
  });
});

describe("FilterTabs", () => {
  it("marca só a aba ativa com aria-pressed e mostra o contador com dois dígitos", () => {
    const html = renderToStaticMarkup(
      <FilterTabs
        label="Filtro"
        value="b"
        onChange={() => undefined}
        tabs={[
          { value: "a", label: "A", count: 3 },
          { value: "b", label: "B" },
        ]}
      />,
    );
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(">03<");
  });
});

describe("IdentityChip", () => {
  it("mostra o papel e nunca um pseudônimo", () => {
    expect(renderToStaticMarkup(<IdentityChip role="leiloeiro" />)).toContain("Leiloeiro");
    expect(renderToStaticMarkup(<IdentityChip role="licitante" />)).toContain("Licitante");
  });
});

describe("Stamp", () => {
  const all = ["ao-vivo", "agendado", "encerrando", "arrematado", "sem-lances", "integro", "adulterado", "cancelado", "perdido"] as const;

  it("carrega o status em texto, sem depender da cor", () => {
    expect(renderToStaticMarkup(<Stamp variant="integro" />)).toContain("Íntegro");
    expect(renderToStaticMarkup(<Stamp variant="arrematado" />)).toContain("Arrematado");
    expect(renderToStaticMarkup(<Stamp variant="encerrando" />)).toContain("Ao vivo");
    expect(renderToStaticMarkup(<Stamp variant="agendado" label="ABRE QUI 18:00" />)).toContain("ABRE QUI 18:00");
  });

  it.each(all)("%s: pílula sem inclinação nem contorno duplo, com ícone escondido dos leitores", (variant) => {
    const html = renderToStaticMarkup(<Stamp variant={variant} />);
    expect(html).toContain("rounded-full");
    expect(html).toContain("t-selo");
    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain("max-w-full");
    expect(html).toMatch(/aria-hidden="true"/);
    // Sem inclinação no estilo do selo (o martelo tem um rotate interno no SVG, que não conta).
    expect(html).not.toMatch(/style="[^"]*transform|outline|border-\[4px\]|rounded-nenhum|t-carimbo/);
  });

  it("só o Ao vivo tem o ponto pulsante; o encerrando usa o relógio com alerta, sem pulso", () => {
    expect(renderToStaticMarkup(<Stamp variant="ao-vivo" />)).toContain("la-pulsa");
    expect(renderToStaticMarkup(<Stamp variant="cancelado" />)).not.toContain("la-pulsa");
    const encerrando = renderToStaticMarkup(<Stamp variant="encerrando" />);
    expect(encerrando).not.toContain("la-pulsa");
    expect(encerrando).toContain("<svg");
  });

  it.each([
    ["ao-vivo", "bg-aoVivo", "text-sobreAoVivo"],
    ["agendado", "bg-selecionado", "text-ocreTexto"],
    ["encerrando", "bg-alertaSuave", "text-alerta"],
    ["integro", "bg-verdeSuave", "text-verde"],
    ["adulterado", "bg-falha", "text-ferrugem"],
    ["cancelado", "bg-falha", "text-ferrugem"],
    ["arrematado", "bg-tinta", "text-fundo"],
  ] as const)("%s: fundo %s e texto %s", (variant, bg, text) => {
    const html = renderToStaticMarkup(<Stamp variant={variant} />);
    expect(html).toContain(bg);
    expect(html).toContain(text);
  });

  it("Sem lances e Perdido: neutros, com fio tracejado, ícone de traço e texto tinta2", () => {
    for (const variant of ["sem-lances", "perdido"] as const) {
      const html = renderToStaticMarkup(<Stamp variant={variant} />);
      expect(html).toContain("border-dashed");
      expect(html).toContain("border-linha");
      expect(html).toContain("text-tinta2");
    }
    expect(renderToStaticMarkup(<Stamp variant="perdido" />)).toContain("Perdido");
  });

  it("os selos tintados levam fio de 1px na cor do estado a 35% ou 40%", () => {
    expect(renderToStaticMarkup(<Stamp variant="integro" />)).toContain("border-verde/35");
    expect(renderToStaticMarkup(<Stamp variant="cancelado" />)).toContain("border-ferrugem/35");
    expect(renderToStaticMarkup(<Stamp variant="encerrando" />)).toContain("border-alerta/40");
    expect(renderToStaticMarkup(<Stamp variant="agendado" />)).toContain("border-ocre/30");
  });

  it("animate usa la-bate e assenta sem inclinação", () => {
    const html = renderToStaticMarkup(<Stamp variant="arrematado" animate />);
    expect(html).toContain("la-bate");
    expect(html).toContain("--rot:0deg");
  });
});

describe("Stamp (tamanho)", () => {
  it("padrão e pequeno têm 28px (Sala e cartão de lote); tabela tem 24px", () => {
    expect(renderToStaticMarkup(<Stamp variant="arrematado" />)).toContain("h-7");
    expect(renderToStaticMarkup(<Stamp variant="arrematado" size="pequeno" />)).toContain("h-7");
    const tabela = renderToStaticMarkup(<Stamp variant="arrematado" size="tabela" />);
    expect(tabela).toContain("h-6");
    expect(tabela).not.toContain("h-7");
  });

  it("carimbo: cartão de 12px, borda de 2px, fundo tintado, 28 a 40px/800 e -3° (sem inclinação em reduced-motion pela classe)", () => {
    const html = renderToStaticMarkup(<Stamp variant="integro" size="carimbo" animate />);
    for (const token of ["rounded-xl", "border-2", "bg-verdeSuave", "border-verde", "la-carimbo", "font-extrabold", "uppercase", "text-[length:clamp(28px,8vw,40px)]"]) {
      expect(html).toContain(token);
    }
    expect(html).toContain("--rot:-3deg");
    expect(html).toContain("la-bate");
    expect(html).not.toContain("rounded-full");
  });

  it("carimbo de arrematado: fio e texto tinta sobre azul suave, com martelo", () => {
    const html = renderToStaticMarkup(<Stamp variant="arrematado" size="carimbo" />);
    expect(html).toContain("border-tinta");
    expect(html).toContain("bg-suave");
    expect(html).toContain("text-tinta");
  });
});

describe("PlacarPosicao", () => {
  it("tom neutro: suave com fio, sem ícone, só o título quando não há subtítulo", () => {
    const html = renderToStaticMarkup(<PlacarPosicao tone="neutro" title="APURANDO" />);
    expect(html).toContain("APURANDO");
    expect(html).toContain("border-borda bg-suave text-tinta");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain('<p class="mt-1');
  });

  it("verde e ferrugem seguem com o subtítulo", () => {
    expect(renderToStaticMarkup(<PlacarPosicao tone="verde" title="VOCÊ ESTÁ GANHANDO" sub="1º de 2" />)).toContain("1º de 2");
    expect(renderToStaticMarkup(<PlacarPosicao tone="ferrugem" title="X" sub="2º de 2" />)).toContain("bg-ferrugem");
  });
});

describe("LotTag", () => {
  it("mostra o número com três dígitos", () => {
    expect(renderToStaticMarkup(<LotTag number={18} />)).toContain(">018<");
  });

  it("aceita texto, como NOVO", () => {
    expect(renderToStaticMarkup(<LotTag number="NOVO" />)).toContain(">NOVO<");
  });

  it("a versão em linha tem 28px, a altura do selo, sem laço nem inclinação", () => {
    const html = renderToStaticMarkup(<LotTag number={18} size="linha" />);
    expect(html).toContain("inline-flex h-7");
    expect(html).toContain(">LOTE<");
    expect(html).toContain(">018<");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("rotate");
    expect(renderToStaticMarkup(<Stamp variant="ao-vivo" />)).toContain("h-7");
  });

  it("o laço fica dentro da caixa e a caixa reserva o espaço dele", () => {
    const html = renderToStaticMarkup(<LotTag number={18} />);
    // Nenhum deslocamento negativo à esquerda: o laço não passa da borda do componente.
    expect(html).toMatch(/left:0(px)?;top:-18px/);
    expect(html).not.toMatch(/left:-\d/);
    expect(html).toContain("padding:18px 4px 6px 2px");
  });

  it("contorno de 2px: azul profundo (token) nas abertas e neutro linha nas encerradas, com furo e cordão no mesmo traço", () => {
    const aberta = renderToStaticMarkup(<LotTag number={18} />);
    expect(aberta).toContain("padding:2px");
    expect(aberta).toContain("background:var(--c-etiqueta-contorno)");
    expect(aberta).toContain("border-color:var(--c-etiqueta-contorno)");
    expect(aberta).toContain('stroke-width="2"');
    const encerrada = renderToStaticMarkup(<LotTag number={18} tone="papel" />);
    expect(encerrada).toContain("background:var(--c-linha)");
    expect(encerrada).toContain("border-color:var(--c-linha)");
    expect(encerrada).not.toContain("etiqueta-contorno");
  });

  it("o recorte chanfrado fica e o miolo acompanha o contorno de 2px", () => {
    const html = renderToStaticMarkup(<LotTag number={18} />);
    expect(html).toContain("polygon(18px 0");
    expect(html).toContain("polygon(17px 0");
  });

  it("o tamanho compacto reduz o número, o LOTE e o respiro", () => {
    const compacto = renderToStaticMarkup(<LotTag number={18} size="compacto" />);
    expect(compacto).toContain("font-size:28px");
    expect(compacto).toContain("text-[10px]");
    expect(compacto).toContain("pb-1 pl-8 pr-[14px] pt-[6px]");
    expect(renderToStaticMarkup(<LotTag number={18} />)).not.toContain("font-size:28px");
  });
});

describe("Logo", () => {
  // A placa é clara nos dois temas: nada dela usa token que escurece no tema noite.
  it.each(["tela", "manual"] as const)("%s: usa só as cores fixas da placa", (size) => {
    const html = renderToStaticMarkup(<Logo size={size} />);
    expect(html).toContain("bg-logoPapel");
    expect(html).toContain("border-logoTinta");
    // `!`: a regra global `a { color }` fica fora de layer e venceria a utility sem ele.
    expect(html).toContain("!text-logoTinta");
    expect(html).not.toMatch(/\b(bg-papel|border-tinta|text-tinta|bg-tinta)\b/);
  });
});
