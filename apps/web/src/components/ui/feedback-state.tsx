import type { ReactNode } from "react";
import { Button } from "./button";
import { Notice } from "./notice";

/** Texto padrão do estado "carregando"; o esqueleto do cartão de lote o repete em `sr-only`. */
export const LOADING_TEXT = "Carregando…";

export interface FeedbackStateProps {
  variant: "carregando" | "vazio" | "erro";
  /** Texto da região; "Carregando…" é o padrão do carregando. */
  children?: ReactNode;
  /** No erro, mostra o botão secundário "Tentar novamente". */
  onRetry?: () => void;
  className?: string;
}

/**
 * Estado de região (DESIGN 4.9): carregando e vazio são um bloco centrado com fio sólido `borda`, `rounded-xl` e fundo `suave`;
 * a falha usa o aviso de erro, com "Tentar novamente" secundário. Sempre texto, nunca só cor.
 */
export function FeedbackState({ variant, children, onRetry, className = "" }: FeedbackStateProps) {
  if (variant === "erro") {
    return (
      <Notice
        kind="erro"
        className={className}
        footer={
          onRetry ? (
            <Button variant="secundario" onClick={onRetry}>
              Tentar novamente
            </Button>
          ) : undefined
        }
      >
        {children}
      </Notice>
    );
  }
  return (
    <div role="status" className={`t-body rounded-xl border border-borda bg-suave p-6 text-center text-tinta2 ${className}`.trim()}>
      <p>{children ?? (variant === "carregando" ? LOADING_TEXT : null)}</p>
    </div>
  );
}
