import type { ReactNode } from "react";
import { Button } from "./button";

export interface FeedbackStateProps {
  variant: "carregando" | "vazio" | "erro";
  /** Texto da região; "Carregando…" é o padrão do carregando. */
  children?: ReactNode;
  /** No erro, mostra o botão secundário "Tentar novamente". */
  onRetry?: () => void;
  className?: string;
}

/** Estado de região: carregando, vazio ou erro. Sempre texto, nunca só cor. */
export function FeedbackState({ variant, children, onRetry, className = "" }: FeedbackStateProps) {
  const isError = variant === "erro";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`t-body border-[3px] border-dashed border-tracejado bg-papel p-6 ${
        isError ? "text-ferrugem" : "text-tinta2"
      } ${className}`.trim()}
    >
      <p>{children ?? (variant === "carregando" ? "Carregando…" : null)}</p>
      {isError && onRetry ? (
        <div className="mt-4">
          <Button variant="secundario" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
