import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable } from "./data-table";
import { Field } from "./field";
import { FilterTabs } from "./filter-tabs";
import { IdentityChip } from "./identity-chip";
import { PlacarPosicao } from "../lots/placar-posicao";
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
  it("carrega o status em texto, sem depender da cor", () => {
    expect(renderToStaticMarkup(<Stamp variant="integro" />)).toContain("Íntegro");
    expect(renderToStaticMarkup(<Stamp variant="sem-lances" />)).toContain("dashed");
  });

  it("só o Ao vivo tem o ponto pulsante", () => {
    expect(renderToStaticMarkup(<Stamp variant="ao-vivo" />)).toContain("la-pulsa");
    expect(renderToStaticMarkup(<Stamp variant="cancelado" />)).not.toContain("la-pulsa");
  });

  it("animate usa la-bate e assenta em -6°", () => {
    const html = renderToStaticMarkup(<Stamp variant="arrematado" animate />);
    expect(html).toContain("la-bate");
    expect(html).toContain("rotate(-6deg)");
  });

  it("Perdido: tinta2, tracejado, sem contorno e inclinado em -2° (S07 §9)", () => {
    const html = renderToStaticMarkup(<Stamp variant="perdido" />);
    expect(html).toContain("Perdido");
    expect(html).toContain("4px dashed var(--c-tinta2)");
    expect(html).toContain("rotate(-2deg)");
    expect(html).not.toContain("outline");
  });

  it("Cancelado segue sólido, com contorno, em -4°", () => {
    const html = renderToStaticMarkup(<Stamp variant="cancelado" />);
    expect(html).toContain("4px solid var(--c-tinta2)");
    expect(html).toContain("rotate(-4deg)");
    expect(html).toContain("outline");
  });
});

describe("PlacarPosicao", () => {
  it("tom neutro: tinta sobre fundo, só o título quando não há subtítulo", () => {
    const html = renderToStaticMarkup(<PlacarPosicao tone="neutro" title="APURANDO" />);
    expect(html).toContain("APURANDO");
    expect(html).toContain("bg-tinta");
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

  it("o laço fica dentro da caixa e a caixa reserva o espaço dele", () => {
    const html = renderToStaticMarkup(<LotTag number={18} />);
    // Nenhum deslocamento negativo à esquerda: o laço não passa da borda do componente.
    expect(html).toMatch(/left:0(px)?;top:-18px/);
    expect(html).not.toMatch(/left:-\d/);
    expect(html).toContain("padding:18px 4px 6px 2px");
  });

  it("o tamanho compacto reduz só o número", () => {
    expect(renderToStaticMarkup(<LotTag number={18} size="compacto" />)).toContain("font-size:36px");
    expect(renderToStaticMarkup(<LotTag number={18} />)).not.toContain("font-size:36px");
  });
});

describe("Stamp", () => {
  it("o tamanho pequeno usa 20 px e não quebra linha", () => {
    const small = renderToStaticMarkup(<Stamp variant="arrematado" size="pequeno" />);
    expect(small).toContain("font-size:20px");
    expect(small).toContain("whitespace-nowrap");
    const normal = renderToStaticMarkup(<Stamp variant="arrematado" />);
    expect(normal).not.toContain("font-size:20px");
    expect(normal).not.toContain("whitespace-nowrap");
  });
});
