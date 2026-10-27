import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primario" | "secundario" | "fantasma" | "perigo" | "desabilitado" | "atalho" | "icone";

/** Padrão: 44px, 12px de raio. Compacto: 40px (44px com ponteiro grosso), 8px, cabeçalho e tabelas. Sala: 56px, largura total. */
export type ButtonSize = "padrao" | "compacto" | "sala";

// Classes literais, nunca montadas por concatenação: o Tailwind só gera o que lê escrito no arquivo.
// `not-disabled:not-aria-busy:` mantém hover e pressionado fora do botão inerte ou carregando; `!` nas cores vence a regra global `a { color }` nos links-botão.
const BASE =
  "inline-flex items-center justify-center gap-2 border text-center select-none no-underline transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out aria-busy:cursor-progress not-disabled:not-aria-busy:active:translate-y-px";
const INERTE = "disabled:cursor-not-allowed disabled:border-borda disabled:bg-suave disabled:!text-tinta2 disabled:shadow-none";

const SIZE: Record<ButtonSize, string> = {
  padrao: "min-h-botao rounded-xl px-5 py-3",
  compacto: "min-h-10 rounded-lg px-4 py-2 text-[14px] font-semibold leading-none whitespace-nowrap pointer-coarse:min-h-11",
  sala: "min-h-14 w-full rounded-xl px-5 py-3 text-[18px] font-bold leading-none",
};

const PRIMARIO =
  "bg-ocre border-ocreBorda !text-sobreOcre shadow-botao not-disabled:not-aria-busy:hover:bg-ocreHover not-disabled:not-aria-busy:active:bg-ocreAtivo not-disabled:not-aria-busy:active:shadow-botao-ativo";
const SECUNDARIO =
  "bg-transparent border-botaoBorda !text-botaoTexto not-disabled:not-aria-busy:hover:border-botaoBordaHover not-disabled:not-aria-busy:hover:bg-suave";
const SECUNDARIO_PERIGO = "bg-transparent border-ferrugem !text-ferrugem not-disabled:not-aria-busy:hover:bg-falha";
const FANTASMA = "bg-transparent border-transparent !text-ocreTexto not-disabled:not-aria-busy:hover:bg-selecionado";
const PERIGO = "bg-ferrugem border-transparent !text-sobreCor not-disabled:not-aria-busy:hover:bg-ferrugem/90";

/** Classes de cada variante; o SkipLink e os links-botão reaproveitam num `<a>`. `destrutivo` pinta o secundário de ferrugem (perigo secundário); a variante `perigo` é a sólida. */
export function buttonClasses(variant: ButtonVariant, destrutivo = false, size: ButtonSize = "padrao"): string {
  // A tipografia de classe `.t-*` fica fora do compacto e da sala, que levam o tamanho próprio (classe fora de layer vence a utility).
  const tipo = (cls: string) => (size === "padrao" ? cls : "");
  switch (variant) {
    case "primario":
      return `${BASE} ${SIZE[size]} ${tipo("t-botao-primario")} ${PRIMARIO} ${INERTE}`;
    case "secundario":
      return `${BASE} ${SIZE[size]} ${tipo("t-botao")} ${destrutivo ? SECUNDARIO_PERIGO : SECUNDARIO} ${INERTE}`;
    case "fantasma":
      return `${BASE} ${SIZE[size]} ${tipo("t-botao")} ${FANTASMA} ${INERTE}`;
    case "perigo":
      return `${BASE} ${SIZE[size]} ${tipo("t-botao-primario")} ${PERIGO} ${INERTE}`;
    case "desabilitado":
      return `${BASE} ${SIZE[size]} ${tipo("t-botao")} cursor-not-allowed border-borda bg-suave !text-tinta2 shadow-none`;
    case "atalho":
      return `${BASE} t-botao tabular-nums min-h-alvo rounded-full px-4 border-linha bg-transparent text-tinta not-disabled:not-aria-busy:not-aria-pressed:hover:bg-suave aria-pressed:border-botaoBordaHover aria-pressed:bg-selecionado ${INERTE}`;
    case "icone":
      return `${BASE} h-11 w-11 shrink-0 rounded-full border-linha bg-papel text-tinta not-disabled:not-aria-busy:hover:bg-suave ${INERTE}`;
  }
}

/** Anel de 16px antes do texto de `loadingText`. Decorativo: o estado vai por `aria-busy` e pelo texto. */
function Spinner() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 animate-spin">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Só no secundário: borda e texto em ferrugem. */
  destrutivo?: boolean;
  /** "Enviando": o botão fica inerte sem trocar para a variante desabilitada. */
  loading?: boolean;
  loadingText?: string;
}

export function Button({
  variant = "secundario",
  size = "padrao",
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
      className={`${buttonClasses(variant, destrutivo, size)} ${className}`.trim()}
      disabled={disabled || isDisabledVariant}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      {loading && loadingText ? (
        // O rótulo de repouso segue na mesma célula, invisível, para o botão não encolher ao carregar.
        <span className="inline-grid">
          <span className="invisible col-start-1 row-start-1 inline-flex items-center justify-center gap-2">{children}</span>
          <span className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2">
            <Spinner />
            {loadingText}
          </span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
