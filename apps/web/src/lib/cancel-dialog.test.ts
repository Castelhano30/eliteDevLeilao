import { describe, expect, it } from "vitest";
import { CANCEL_TEXT, lotChangedMessage } from "@lanceauto/shared";
import { cancelDialogReducer, confirmCountOf, describeCancelFailure, initialCancelDialog, isDismissible } from "./cancel-dialog";

describe("estado do diálogo de cancelamento (S06 §10)", () => {
  const open = (bidCount: number) => initialCancelDialog(bidCount);

  it("abre em idle com a contagem do Painel e sem mensagem", () => {
    expect(open(2)).toEqual({ status: "idle", bidCount: 2, message: null });
  });

  it("idle → submitting → changed (LOT_CHANGED atualiza a contagem e mostra a mensagem) → submitting", () => {
    let state = cancelDialogReducer(open(2), { type: "submit" });
    expect(state.status).toBe("submitting");

    state = cancelDialogReducer(state, { type: "changed", entryCount: 3 });
    expect(state).toEqual({ status: "changed", bidCount: 3, message: lotChangedMessage(3) });

    state = cancelDialogReducer(state, { type: "submit" });
    expect(state).toEqual({ status: "submitting", bidCount: 3, message: null });
  });

  it("falha de rede ambígua → error com a mensagem da §8, sem trocar a contagem; tentar de novo volta a submitting", () => {
    let state = cancelDialogReducer(open(2), { type: "submit" });
    state = cancelDialogReducer(state, { type: "failed", message: CANCEL_TEXT.networkAmbiguous });
    expect(state).toEqual({ status: "error", bidCount: 2, message: CANCEL_TEXT.networkAmbiguous });
    expect(cancelDialogReducer(state, { type: "submit" }).status).toBe("submitting");
  });

  it("a contagem acompanha os eventos do mesmo lote, para cima, enquanto o diálogo não está enviando", () => {
    let state = cancelDialogReducer(open(2), { type: "bids", bidCount: 3 });
    expect(state.bidCount).toBe(3);
    expect(state.message).toBe("Chegou lance novo: agora são 3 lances.");
    // evento atrasado não volta a contagem
    state = cancelDialogReducer(state, { type: "bids", bidCount: 2 });
    expect(state.bidCount).toBe(3);
    // em changed a mensagem de recusa não é trocada pelo aviso de lance novo
    const changed = cancelDialogReducer(cancelDialogReducer(open(2), { type: "submit" }), { type: "changed", entryCount: 3 });
    expect(cancelDialogReducer(changed, { type: "bids", bidCount: 4 })).toEqual({ ...changed, bidCount: 4 });
    // durante o envio a contagem enviada não muda sob os pés do usuário
    const sending = cancelDialogReducer(state, { type: "submit" });
    expect(cancelDialogReducer(sending, { type: "bids", bidCount: 9 }).bidCount).toBe(3);
  });

  it("a contagem que sai no corpo é sempre a que o diálogo mostra", () => {
    expect(confirmCountOf(open(0))).toBe(0);
    expect(confirmCountOf(cancelDialogReducer(open(2), { type: "bids", bidCount: 4 }))).toBe(4);
    expect(confirmCountOf(cancelDialogReducer(cancelDialogReducer(open(2), { type: "submit" }), { type: "changed", entryCount: 5 }))).toBe(5);
  });

  it("Esc e Voltar só valem fora do envio", () => {
    expect(isDismissible(open(1))).toBe(true);
    expect(isDismissible(cancelDialogReducer(open(1), { type: "submit" }))).toBe(false);
    expect(isDismissible(cancelDialogReducer(cancelDialogReducer(open(1), { type: "submit" }), { type: "changed", entryCount: 2 }))).toBe(true);
  });

  it("não envia duas vezes: submit durante o envio é ignorado", () => {
    const sending = cancelDialogReducer(open(1), { type: "submit" });
    expect(cancelDialogReducer(sending, { type: "submit" })).toBe(sending);
  });
});

describe("mapeamento do erro do cancelamento para a mensagem da §8", () => {
  const envelope = (code: string, message: string, details?: unknown) => ({ code, message, details }) as never;

  it("LOT_CHANGED: mantém o diálogo aberto e leva a contagem real", () => {
    expect(describeCancelFailure(409, envelope("LOT_CHANGED", "texto do servidor", { entryCount: 4 }))).toEqual({
      kind: "changed",
      entryCount: 4,
      message: lotChangedMessage(4),
    });
  });

  it.each([
    ["LOT_CANCELLED", 409, CANCEL_TEXT.lotCancelled],
    ["LOT_ENDED", 409, CANCEL_TEXT.lotEnded],
    ["FORBIDDEN", 403, CANCEL_TEXT.forbidden],
    ["NOT_FOUND", 404, CANCEL_TEXT.notFound],
    ["ROLE_NOT_ALLOWED", 403, CANCEL_TEXT.roleNotAllowed],
  ])("%s fecha o diálogo, refaz a lista e mostra o aviso", (code, status, message) => {
    expect(describeCancelFailure(status, envelope(code, "texto do servidor"))).toEqual({ kind: "close", message, refetchList: true });
  });

  it("falha de rede (sem resposta) é ambígua: mantém o diálogo, mensagem da §8 e confere o lote antes de tentar de novo", () => {
    expect(describeCancelFailure(null, null)).toEqual({ kind: "ambiguous", message: CANCEL_TEXT.networkAmbiguous });
  });

  it("erro inesperado do servidor mantém o diálogo com a mensagem que ele mandou", () => {
    expect(describeCancelFailure(500, envelope("INTERNAL", "Algo travou do nosso lado."))).toEqual({
      kind: "error",
      message: "Algo travou do nosso lado.",
    });
  });

  it("VALIDATION mostra a mensagem do campo", () => {
    expect(
      describeCancelFailure(400, envelope("VALIDATION", "Confira os campos.", { fields: { confirmEntryCount: "Informe a contagem de lances que você viu." } })),
    ).toEqual({ kind: "error", message: "Informe a contagem de lances que você viu." });
  });
});
