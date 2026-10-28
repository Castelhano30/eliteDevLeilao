"use client";

import { useId } from "react";
import { formatBRL } from "@lanceauto/shared";
import { Dialog } from "@/components/ui/dialog";
import { RefusalMessage } from "@/components/ui/refusal-message";

export interface DepositConfirmDialogProps {
  open: boolean;
  /** Valor a depositar, em centavos; fica guardado enquanto o diálogo fecha, para o conteúdo não piscar vazio. */
  cents: number | null;
  /** Saldo disponível de hoje (em centavos), para mostrar quanto fica depois do depósito. */
  availableCents?: number;
  sending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmação do depósito, desenhada como uma tela de sistema financeiro. É só moldura: nenhum dinheiro real se move,
 * e o diálogo diz isso de cara. Quem grava o depósito é o `POST /wallet/deposits`, disparado pelo "Confirmar".
 */
export function DepositConfirmDialog({ open, cents, availableCents, sending, error, onConfirm, onClose }: DepositConfirmDialogProps) {
  const bodyId = useId();
  const rows: [label: string, value: string][] = [
    ["Forma de pagamento", "Pix (simulado)"],
    ["Destino", "Carteira LanceAuto"],
    ["Taxa", formatBRL(0)],
  ];

  return (
    <Dialog
      open={open && cents !== null}
      onClose={onClose}
      title="Confirmar depósito"
      describedBy={bodyId}
      dismissible={!sending}
      confirm={{ label: "Confirmar depósito", onConfirm, loading: sending, loadingText: "Processando…" }}
      cancelLabel="Cancelar"
    >
      <div id={bodyId} className="space-y-4">
        <p className="rounded-xl border border-borda bg-suave px-4 py-3 text-[14px] leading-snug">
          <strong className="t-mono-rotulo mb-1 block">Simulação</strong>
          Nenhum dinheiro de verdade é movimentado. O saldo da LanceAuto é fictício e serve só para dar lances.
        </p>
        <div className="rounded-xl border border-borda p-4">
          <p className="t-mono-rotulo">Valor do depósito</p>
          <p className="mt-1 break-all text-[32px] font-extrabold leading-[1.1] tabular-nums">{cents === null ? "" : formatBRL(cents)}</p>
        </div>
        <dl className="m-0 space-y-2 text-[15px]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <dt className="text-tinta2">{label}</dt>
              <dd className="m-0 font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
          {availableCents !== undefined && cents !== null ? (
            <div className="flex items-baseline justify-between gap-4 border-t border-borda pt-2">
              <dt className="text-tinta2">Disponível após o depósito</dt>
              <dd className="m-0 whitespace-nowrap font-bold tabular-nums">{formatBRL(availableCents + cents)}</dd>
            </div>
          ) : null}
        </dl>
        {error ? <RefusalMessage>{error}</RefusalMessage> : null}
      </div>
    </Dialog>
  );
}
