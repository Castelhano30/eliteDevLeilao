import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DepositConfirmDialog } from "./deposit-confirm-dialog";

function render(props: Partial<Parameters<typeof DepositConfirmDialog>[0]> = {}) {
  return renderToStaticMarkup(
    <DepositConfirmDialog open cents={10_000_000} availableCents={48_500_000} sending={false} error={null} onConfirm={() => {}} onClose={() => {}} {...props} />,
  );
}

describe("DepositConfirmDialog", () => {
  it("diz de cara que é simulação e mostra valor, forma, taxa e o disponível depois", () => {
    const html = render();
    expect(html).toContain("Confirmar depósito");
    expect(html).toContain("Nenhum dinheiro de verdade é movimentado");
    expect(html).toContain("R$ 100.000,00");
    expect(html).toContain("Pix (simulado)");
    expect(html).toContain("R$ 0,00");
    expect(html).toContain("R$ 585.000,00");
  });

  it("sem saldo carregado não inventa o disponível depois", () => {
    expect(render({ availableCents: undefined })).not.toContain("Disponível após o depósito");
  });

  it("enviando: o botão vira Processando… e a recusa do servidor aparece dentro do diálogo", () => {
    expect(render({ sending: true })).toContain("Processando…");
    expect(render({ error: "Informe um valor inteiro entre R$ 1,00 e R$ 10.000.000,00." })).toContain("Informe um valor inteiro");
  });

  it("sem valor não mostra valor nem o disponível depois", () => {
    const html = render({ cents: null });
    expect(html).not.toContain("R$ 100.000,00");
    expect(html).not.toContain("Disponível após o depósito");
  });
});
