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
  /** `false` durante um envio: Esc e "Voltar" ficam inertes até a resposta chegar. Padrão `true`. */
  dismissible?: boolean;
  /** `id` do trecho que descreve o diálogo (`aria-describedby`). */
  describedBy?: string;
}

/**
 * Diálogo modal sobre `<dialog>` nativo (DESIGN 4.10): `showModal()` deixa o resto da página inerte,
 * prende o Tab, fecha com Esc e devolve o foco ao elemento de origem. O foco inicial vai ao título. Ações à direita, empilhadas no celular,
 * com a principal por último.
 */
export function Dialog({ open, onClose, title, children, confirm, cancelLabel = "Voltar", dismissible = true, describedBy }: DialogProps) {
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
      aria-describedby={describedBy}
      aria-modal="true"
      onCancel={(event) => {
        // O `<dialog>` fecharia sozinho no Esc; quem fecha é o `open` do pai, e nunca no meio de um envio.
        event.preventDefault();
        if (dismissible) onClose();
      }}
      className="m-auto w-[min(560px,calc(100%-32px))] rounded-2xl border border-borda bg-papel p-6 text-tinta shadow-modal"
    >
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className="mb-4 text-[20px] font-extrabold leading-tight">
        {title}
      </h2>
      <div className="t-body">{children}</div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="secundario" onClick={onClose} loading={!dismissible} className="w-full sm:w-auto">
          {cancelLabel}
        </Button>
        <Button
          variant={confirm.destrutivo ? "secundario" : "primario"}
          destrutivo={confirm.destrutivo}
          loading={confirm.loading}
          loadingText={confirm.loadingText}
          className="w-full sm:w-auto"
          onClick={confirm.onConfirm}
        >
          {confirm.label}
        </Button>
      </div>
    </dialog>
  );
}
