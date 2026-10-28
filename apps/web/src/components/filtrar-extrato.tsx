"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { RefusalMessage } from "@/components/ui/refusal-message";
import { descreverPeriodo, periodoInvertido } from "@/lib/extrato";

export interface FiltrarExtratoProps {
  /** Período aplicado, em "AAAA-MM-DD"; vazio é lado aberto. */
  de: string;
  ate: string;
  onApply: (de: string, ate: string) => void;
  onClear: () => void;
}

function FunilIcone() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />
    </svg>
  );
}

/**
 * Filtro do extrato: o botão "Filtrar" abre um pop-up com as datas "De" e "Até". Com um filtro aplicado, o período
 * aparece ao lado, com "Limpar filtros" para voltar a mostrar tudo. As datas do pop-up só valem ao "Aplicar".
 */
export function FiltrarExtrato({ de, ate, onApply, onClear }: FiltrarExtratoProps) {
  const [open, setOpen] = useState(false);
  const [rascunhoDe, setRascunhoDe] = useState(de);
  const [rascunhoAte, setRascunhoAte] = useState(ate);
  const [error, setError] = useState<string | null>(null);
  const ativo = de !== "" || ate !== "";

  const abrir = () => {
    // O pop-up sempre abre no que está aplicado: quem cancelou da outra vez não encontra data solta.
    setRascunhoDe(de);
    setRascunhoAte(ate);
    setError(null);
    setOpen(true);
  };

  const aplicar = () => {
    if (periodoInvertido(rascunhoDe, rascunhoAte)) {
      setError("A data inicial vem depois da final. Ajuste o período.");
      return;
    }
    onApply(rascunhoDe, rascunhoAte);
    setOpen(false);
  };

  const limpar = () => {
    onClear();
    setOpen(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="secundario" size="compacto" onClick={abrir} aria-haspopup="dialog" className="gap-2">
          <FunilIcone />
          Filtrar
        </Button>
        {ativo ? (
          <>
            <p className="t-mono-dado rounded-full border border-ocreTexto bg-selecionado px-3 py-1 text-ocreTexto">{descreverPeriodo(de, ate)}</p>
            <Button variant="fantasma" size="compacto" onClick={onClear}>
              Limpar filtros
            </Button>
          </>
        ) : null}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Filtrar extrato"
        confirm={{ label: "Aplicar filtro", onConfirm: aplicar }}
        cancelLabel="Cancelar"
      >
        <div className="space-y-4">
          <p className="t-body-nota">Escolha o período das movimentações. Deixe um dos campos vazio para não limitar aquele lado.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="De"
              type="date"
              value={rascunhoDe}
              max={rascunhoAte || undefined}
              onChange={(event) => {
                setRascunhoDe(event.target.value);
                setError(null);
              }}
            />
            <Field
              label="Até"
              type="date"
              value={rascunhoAte}
              min={rascunhoDe || undefined}
              onChange={(event) => {
                setRascunhoAte(event.target.value);
                setError(null);
              }}
            />
          </div>
          {error ? <RefusalMessage>{error}</RefusalMessage> : null}
          {ativo || rascunhoDe !== "" || rascunhoAte !== "" ? (
            <Button variant="fantasma" size="compacto" onClick={limpar}>
              Limpar filtros
            </Button>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
