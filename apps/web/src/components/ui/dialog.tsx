"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";

export interface DialogProps {
  open: boolean;
  /** Chamado ao fechar por Esc ou "Voltar"; fechar nunca age sobre nada. */
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Ação principal da camada: é o único botão ocre (ou o destrutivo). */
  confirm: { label: string; onConfirm: () => void; destrutivo?: boolean; loading?: boolean; loadingText?: string };
  cancelLabel?: string;
}

/**
 * Diálogo modal sobre `<dialog>` nativo: `showModal()` deixa o resto da página inerte,
 * prende o Tab, fecha com Esc e devolve o foco ao elemento de origem. O foco inicial vai ao título.
 */
export function Dialog({ open, onClose, title, children, confirm, cancelLabel = "Voltar" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      titleRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(560px,calc(100%-32px))] rounded-nenhum border-[3px] border-linha bg-papel p-6 text-tinta shadow-painel"
    >
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className="t-cartaz-cartao mb-4">
        {title}
      </h2>
      <div className="t-body">{children}</div>
      <div className="mt-6 flex flex-wrap gap-4">
        <Button variant="secundario" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={confirm.destrutivo ? "secundario" : "primario"}
          destrutivo={confirm.destrutivo}
          loading={confirm.loading}
          loadingText={confirm.loadingText}
          onClick={confirm.onConfirm}
        >
          {confirm.label}
        </Button>
      </div>
    </dialog>
  );
}
