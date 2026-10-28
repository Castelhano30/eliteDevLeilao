"use client";

import { useEffect, useRef, useState } from "react";
import { COPIED_LABEL_MS, copyLinkAriaLabel } from "@lanceauto/shared";
import { buttonClasses, type ButtonSize } from "@/components/ui/button";
import { copyLink, copyLinkLabel, receiptUrl, type CopyState } from "@/lib/copy-link";

export interface BotaoCopiarLinkProps {
  token: string;
  lotNumber: number;
  /** Nome acessível inteiro, com o título do lote (Meus arremates); sem ele vale "Copiar link do comprovante do lote NNN". */
  ariaLabel?: string;
  className?: string;
  /** Tamanho do botão; o padrão serve ao comprovante, o compacto às listas. */
  tamanho?: ButtonSize;
}

/**
 * "Copiar link" do comprovante (§10): copia {origem}/c/{token}. Sucesso: "Link copiado" por 2,2 s. Falha da área de
 * transferência: a mensagem de copiar à mão e um campo somente leitura com o link já selecionado. A região
 * aria-live anuncia o resultado; o nome acessível só carrega o lote enquanto o botão diz "Copiar link".
 */
export function BotaoCopiarLink({ token, lotNumber, ariaLabel, className = "", tamanho = "padrao" }: BotaoCopiarLinkProps) {
  const [state, setState] = useState<CopyState>("idle");
  const [url, setUrl] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (state === "failed") {
      field.current?.focus();
      field.current?.select();
    }
  }, [state]);

  async function copy() {
    clearTimeout(timer.current);
    const link = receiptUrl(window.location.origin, token);
    setUrl(link);
    const outcome = await copyLink(link, typeof navigator === "undefined" ? undefined : navigator.clipboard);
    setState(outcome);
    if (outcome === "copied") timer.current = setTimeout(() => setState("idle"), COPIED_LABEL_MS);
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={state === "idle" ? (ariaLabel ?? copyLinkAriaLabel(lotNumber)) : undefined}
        className={buttonClasses("secundario", false, tamanho)}
      >
        {copyLinkLabel(state)}
      </button>
      {state === "failed" ? (
        <input
          ref={field}
          readOnly
          value={url}
          aria-label="Link do comprovante"
          onFocus={(event) => event.currentTarget.select()}
          className="mt-3 h-12 w-full rounded-xl border border-linha bg-papel px-3 text-[14px] text-tinta focus-visible:border-foco"
        />
      ) : null}
      {/* A mensagem do botão não é lida sozinha quando troca; esta região a anuncia uma vez. */}
      <p className="sr-only" role="status" aria-live="polite">
        {state === "idle" ? "" : copyLinkLabel(state)}
      </p>
    </div>
  );
}
