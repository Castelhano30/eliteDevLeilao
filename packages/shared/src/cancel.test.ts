import { describe, expect, it } from "vitest";
import {
  CANCEL_TEXT,
  cancelDialogBody,
  cancelDialogTitle,
  cancelDoneMessage,
  cancelLotSchema,
  cancelledAtLabel,
  lotChangedMessage,
  newBidMessage,
  pluralBids,
} from "./cancel";

describe("cancelLotSchema", () => {
  it("aceita inteiros de 0 até o maior seguro", () => {
    expect(cancelLotSchema.safeParse({ confirmEntryCount: 0 }).success).toBe(true);
    expect(cancelLotSchema.safeParse({ confirmEntryCount: 7 }).success).toBe(true);
    expect(cancelLotSchema.safeParse({ confirmEntryCount: Number.MAX_SAFE_INTEGER }).success).toBe(true);
  });

  it.each([
    ["ausente", {}],
    ["negativo", { confirmEntryCount: -1 }],
    ["fracionário", { confirmEntryCount: 1.5 }],
    ["acima do seguro", { confirmEntryCount: Number.MAX_SAFE_INTEGER + 2 }],
    ["texto", { confirmEntryCount: "2" }],
    ["nulo", { confirmEntryCount: null }],
  ])("recusa %s com a mensagem do campo", (_name, body) => {
    const result = cancelLotSchema.safeParse(body);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe(CANCEL_TEXT.invalidCount);
  });
});

describe("plural e textos do cancelamento", () => {
  it("pluralBids concorda com o número", () => {
    expect(pluralBids(0)).toBe("0 lances");
    expect(pluralBids(1)).toBe("1 lance");
    expect(pluralBids(2)).toBe("2 lances");
  });

  it("título do diálogo: com lances (singular e plural) e sem lances", () => {
    expect(cancelDialogTitle(19, 2)).toBe("Cancelar o lote 019 com 2 lances?");
    expect(cancelDialogTitle(19, 1)).toBe("Cancelar o lote 019 com 1 lance?");
    expect(cancelDialogTitle(19, 0)).toBe("Cancelar o lote 019?");
  });

  it("texto do diálogo muda com a existência de lances", () => {
    expect(cancelDialogBody(0)).toBe("Ninguém deu lance ainda.");
    expect(cancelDialogBody(3)).toBe(
      "O saldo comprometido de quem lidera volta para ele, e o cancelamento fica registrado no histórico da auditoria.",
    );
  });

  it("LOT_CHANGED: singular, plural e zero", () => {
    expect(lotChangedMessage(3)).toBe("Entrou lance enquanto você decidia. Agora são 3 lances. Confirme de novo.");
    expect(lotChangedMessage(1)).toBe("Entrou lance enquanto você decidia. Agora é 1 lance. Confirme de novo.");
    expect(lotChangedMessage(0)).toBe("Entrou lance enquanto você decidia. Agora não há lances. Confirme de novo.");
  });

  it("confirmação do Painel: com e sem estorno", () => {
    expect(cancelDoneMessage(19, null)).toBe("Lote 019 cancelado.");
    expect(cancelDoneMessage(19, 2_050_000)).toBe("Lote 019 cancelado. Estorno de R$ 20.500,00 devolvido a quem liderava.");
  });

  it("aviso de lance novo concorda com o número", () => {
    expect(newBidMessage(3)).toBe("Chegou lance novo: agora são 3 lances.");
    expect(newBidMessage(1)).toBe("Chegou lance novo: agora é 1 lance.");
  });

  it("cancelledAtLabel: dd/mm às HH:mm:ss em Brasília (UTC−3), virando o dia", () => {
    expect(cancelledAtLabel("2026-10-26T20:36:12.967Z")).toBe("Cancelado em 26/10 às 17:36:12");
    expect(cancelledAtLabel("2026-10-27T02:05:09.000Z")).toBe("Cancelado em 26/10 às 23:05:09");
  });

  it("mensagens fixas da §8", () => {
    expect(CANCEL_TEXT.roleNotAllowed).toBe("Só leiloeiros cancelam lotes.");
    expect(CANCEL_TEXT.forbidden).toBe("Este lote é de outro leiloeiro. Só o dono pode cancelar.");
    expect(CANCEL_TEXT.notFound).toBe("Esse lote não existe mais.");
    expect(CANCEL_TEXT.lotCancelled).toBe("Este lote já foi cancelado.");
    expect(CANCEL_TEXT.lotEnded).toBe("Martelo já bateu. Este lote não pode mais ser cancelado.");
    expect(CANCEL_TEXT.networkAmbiguous).toBe("Não deu para falar com o pátio. Confira o lote antes de tentar de novo.");
  });
});
