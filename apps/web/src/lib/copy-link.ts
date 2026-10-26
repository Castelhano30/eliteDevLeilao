import { RECEIPT_TEXT, receiptPath } from "@lanceauto/shared";

export type CopyState = "idle" | "copied" | "failed";

/** `{origem}/c/{token}`: o link que o botão copia e o campo de reserva mostra. */
export function receiptUrl(origin: string, token: string): string {
  return `${origin}${receiptPath(token)}`;
}

/** A parte de `navigator.clipboard` que usamos; injetável para o teste. */
export interface ClipboardLike {
  writeText(text: string): Promise<void> | void;
}

/**
 * Copia o link. Negado, sem a API (contexto inseguro) ou lançando: `failed`, e a tela mostra o campo somente leitura
 * para copiar à mão. Nunca rejeita.
 */
export async function copyLink(url: string, clipboard: ClipboardLike | undefined): Promise<Exclude<CopyState, "idle">> {
  try {
    if (!clipboard) return "failed";
    await clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

export function copyLinkLabel(state: CopyState): string {
  return state === "copied" ? RECEIPT_TEXT.copied : state === "failed" ? RECEIPT_TEXT.copyFailed : RECEIPT_TEXT.copyLink;
}
