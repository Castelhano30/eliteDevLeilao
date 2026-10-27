import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccessTabs } from "./access-tabs";

const html = renderToStaticMarkup(
  <AccessTabs
    label="Acesso"
    value="entrar"
    onChange={() => undefined}
    tabs={[
      { id: "criar", label: "Criar conta", panel: <p>painel criar</p> },
      { id: "entrar", label: "Entrar", panel: <p>painel entrar</p> },
    ]}
  />,
);

describe("AccessTabs", () => {
  it("mantém tablist, tab e tabpanel com a aba ativa como única na ordem de Tab", () => {
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(2);
    expect(html).toMatch(/aria-selected="true"[^>]*tabindex="0"/);
    expect(html).toMatch(/aria-selected="false"[^>]*tabindex="-1"/);
    expect(html).toContain("hidden");
  });

  it("trilho de 12px em azul suave; aba ativa em papel com texto azul e nível 1", () => {
    expect(html).toContain("rounded-xl bg-suave p-1");
    expect(html).toContain("bg-papel text-ocreTexto shadow-cartao");
    expect(html).toContain("text-tinta2");
  });

  it("o painel é um cartão de 16px com fio borda e nível 1, sem a sombra dura", () => {
    expect(html).toContain("rounded-2xl border border-borda bg-papel");
    expect(html).not.toMatch(/rounded-nenhum|border-\[3px\]|8px_8px_0/);
  });
});
