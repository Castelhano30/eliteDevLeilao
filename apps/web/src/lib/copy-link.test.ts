import { describe, expect, it, vi } from "vitest";
import { COPIED_LABEL_MS, RECEIPT_TEXT } from "@lanceauto/shared";
import { copyLink, copyLinkLabel, receiptUrl } from "./copy-link";

const TOKEN = "rmCOx9-zRVzAWbP8HWzNk6TAW9zgGZxC";

describe("receiptUrl", () => {
  it("junta a origem do navegador ao caminho do comprovante", () => {
    expect(receiptUrl("https://lanceauto.example", TOKEN)).toBe(`https://lanceauto.example/c/${TOKEN}`);
    expect(receiptUrl("http://localhost:3100", TOKEN)).toBe(`http://localhost:3100/c/${TOKEN}`);
  });
});

describe("copyLink", () => {
  it("com permissão, grava o link na área de transferência e diz que copiou", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyLink("https://x/c/t", { writeText })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://x/c/t");
  });

  it("permissão negada vira falha, sem estourar", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("negado", "NotAllowedError"));
    await expect(copyLink("https://x/c/t", { writeText })).resolves.toBe("failed");
  });

  it("falha também quando a API de área de transferência não existe (contexto inseguro) ou lança na hora", async () => {
    await expect(copyLink("https://x/c/t", undefined)).resolves.toBe("failed");
    const writeText = vi.fn(() => {
      throw new Error("síncrono");
    });
    await expect(copyLink("https://x/c/t", { writeText })).resolves.toBe("failed");
  });
});

describe("copyLinkLabel", () => {
  it("o botão diz 'Copiar link', 'Link copiado' e, na falha, a mensagem de copiar à mão", () => {
    expect(copyLinkLabel("idle")).toBe(RECEIPT_TEXT.copyLink);
    expect(copyLinkLabel("copied")).toBe(RECEIPT_TEXT.copied);
    expect(copyLinkLabel("failed")).toBe(RECEIPT_TEXT.copyFailed);
  });

  it("o rótulo de sucesso dura 2,2 s", () => {
    expect(COPIED_LABEL_MS).toBe(2_200);
  });
});
