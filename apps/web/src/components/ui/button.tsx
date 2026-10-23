import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primario" | "secundario" | "desabilitado" | "atalho";

const BASE = "inline-flex items-center justify-center rounded-nenhum min-h-botao select-none";
const PRESS = "active:translate-x-[3px] active:translate-y-[3px] active:shadow-botao-ativo";

/** Classes de cada variante; o SkipLink reaproveita as do secundário num `<a>`. */
export function buttonClasses(variant: ButtonVariant, destrutivo = false): string {
  switch (variant) {
    case "primario":
      return `${BASE} t-botao-primario bg-ocre text-sobreOcre border-[3px] border-tinta shadow-botao px-[26px] pt-[10px] pb-[8px] ${PRESS}`;
    case "secundario":
      return `${BASE} t-botao bg-papel ${destrutivo ? "text-ferrugem" : "text-tinta"} border-[3px] border-tinta shadow-botao px-[22px] pt-[10px] pb-[8px] ${PRESS}`;
    case "desabilitado":
      return `${BASE} t-botao bg-suave text-tinta2 border-[3px] border-dashed border-tinta2 px-[22px] pt-[10px] pb-[8px] cursor-default`;
    case "atalho":
      return "inline-flex items-center justify-center rounded-nenhum min-h-alvo t-mono bg-transparent text-tinta border-2 border-linha px-3";
  }
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Só no secundário: texto em ferrugem. */
  destrutivo?: boolean;
  /** "Enviando": o botão fica inerte sem trocar para a variante desabilitada. */
  loading?: boolean;
  loadingText?: string;
}

export function Button({
  variant = "secundario",
  destrutivo = false,
  loading = false,
  loadingText,
  className = "",
  disabled,
  onClick,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabledVariant = variant === "desabilitado";
  return (
    <button
      type={type}
      className={`${buttonClasses(variant, destrutivo)} ${className}`.trim()}
      disabled={disabled || isDisabledVariant}
      aria-disabled={loading || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
