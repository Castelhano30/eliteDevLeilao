import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CANCEL_TEXT, lotChangedMessage } from "@lanceauto/shared";
import { cancelDialogReducer, initialCancelDialog, type CancelDialogState } from "@/lib/cancel-dialog";
import { CancelDialog } from "./cancel-dialog";

const LOT = { number: 19, title: "Hilux SRX 2020", currentBidCents: 2_050_000 };
const render = (state: CancelDialogState, lot = LOT) =>
  renderToStaticMarkup(<CancelDialog open lot={lot} state={state} onConfirm={() => undefined} onClose={() => undefined} />);

describe("CancelDialog (S06 §10)", () => {
  it("com lances: título com plural, meta com lance atual, texto de estorno e aviso de irreversível", () => {
    const html = render(initialCancelDialog(2));
    expect(html).toContain("Cancelar o lote 019 com 2 lances?");
    expect(html).toContain("Hilux SRX 2020 · 2 lances · lance atual R$ 20.500,00");
    expect(html).toContain(CANCEL_TEXT.bodyWithBids);
    expect(html).toContain(CANCEL_TEXT.irreversible);
    expect(html).toContain(CANCEL_TEXT.newBidWarning);
    expect(html).not.toContain(CANCEL_TEXT.bodyNoBids);
  });

  it("singular: 1 lance", () => {
    expect(render(initialCancelDialog(1))).toContain("Cancelar o lote 019 com 1 lance?");
  });

  it("sem lances: título simples, 'Ninguém deu lance ainda.' e sem a frase de estorno nem 'lance atual'", () => {
    const html = render(initialCancelDialog(0), { ...LOT, currentBidCents: null });
    expect(html).toContain("Cancelar o lote 019?");
    expect(html).toContain(CANCEL_TEXT.bodyNoBids);
    expect(html).not.toContain(CANCEL_TEXT.bodyWithBids);
    expect(html).not.toContain("lance atual");
    expect(html).toContain("0 lances");
  });

  it("é um diálogo modal nomeado pelo título e descrito pelo texto", () => {
    const html = render(initialCancelDialog(2));
    expect(html).toMatch(/<dialog[^>]*aria-modal="true"/);
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    const describedBy = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(labelledBy && html).toContain(`id="${labelledBy}"`);
    expect(describedBy && html).toContain(`id="${describedBy}"`);
  });

  it("botões: Voltar e Cancelar o lote; no envio 'Cancelando…' e os dois ficam inertes", () => {
    const idle = render(initialCancelDialog(2));
    expect(idle).toContain(">Voltar<");
    expect(idle).toContain(">Cancelar o lote<");
    expect(idle).not.toContain("aria-disabled");

    const sending = render(cancelDialogReducer(initialCancelDialog(2), { type: "submit" }));
    expect(sending).toContain("Cancelando…");
    expect((sending.match(/aria-disabled="true"/g) ?? []).length).toBe(2);
  });

  it("LOT_CHANGED: título com a contagem nova e a recusa em role=alert; o diálogo segue com os botões ativos", () => {
    const state = cancelDialogReducer(cancelDialogReducer(initialCancelDialog(2), { type: "submit" }), { type: "changed", entryCount: 3 });
    const html = render(state);
    expect(html).toContain("Cancelar o lote 019 com 3 lances?");
    expect(html).toMatch(/role="alert"[^>]*>[\s\S]*Entrou lance enquanto você decidia/);
    expect(html).toContain(lotChangedMessage(3));
    expect(html).not.toContain("aria-disabled");
  });

  it("falha de rede ambígua mostra a mensagem da §8 em role=alert", () => {
    const state = cancelDialogReducer(cancelDialogReducer(initialCancelDialog(2), { type: "submit" }), { type: "failed", message: CANCEL_TEXT.networkAmbiguous });
    expect(render(state)).toContain(CANCEL_TEXT.networkAmbiguous);
  });

  it("lance novo com o diálogo aberto: contagem atualizada e aviso polite, sem alert", () => {
    const html = render(cancelDialogReducer(initialCancelDialog(0), { type: "bids", bidCount: 1 }));
    expect(html).toContain("Cancelar o lote 019 com 1 lance?");
    expect(html).toContain("Chegou lance novo: agora é 1 lance.");
    expect(html).not.toContain('role="alert"');
  });

  it("nunca mostra pseudônimo, nome, e-mail nem id de quem lidera", () => {
    const html = render(initialCancelDialog(2));
    expect(html).not.toMatch(/Licitante [0-9A-F]{4}/);
    expect(html).not.toContain("@");
    expect(html).not.toMatch(/líder (é|chama)/i);
  });
});
