"use client";

import { useId, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from "react";

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix" | "size"> {
  label: string;
  /** Ajuda vai em `aria-describedby`, nunca dentro do rótulo. */
  help?: string;
  /** Mensagem do erro; liga `aria-invalid` e a borda ferrugem. O valor digitado é mantido. */
  error?: string;
  /** Marca o campo como inválido (borda ferrugem e `aria-invalid`) sem mensagem própria, quando a mensagem está em outro lugar. */
  invalid?: boolean;
  /** Campo composto: prefixo fixo (ex. "R$"), em Plex Mono. */
  prefix?: ReactNode;
  /** Campo composto: sufixo fixo (ex. ",00"). */
  suffix?: ReactNode;
  /** Ids de fora do campo que também o descrevem (ex.: a recusa colada ao botão). */
  describedBy?: string;
  /** Transforma o texto digitado antes de chegar ao `onChange`. */
  mask?: (raw: string) => string;
}

/** Campo com rótulo sempre visível. Com prefixo/sufixo vira o campo de valor (lance e depósito). */
export function Field({ label, help, error, invalid, prefix, suffix, mask, describedBy: extraDescribedBy, id, className = "", onChange, disabled, ...rest }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const helpId = help ? `${inputId}-ajuda` : undefined;
  const errorId = error ? `${inputId}-erro` : undefined;
  const describedBy = [helpId, errorId, extraDescribedBy].filter(Boolean).join(" ") || undefined;
  const composto = prefix !== undefined || suffix !== undefined;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (mask) event.target.value = mask(event.target.value);
    onChange?.(event);
  };

  const isInvalid = Boolean(error) || invalid === true;
  const border = isInvalid ? "border-ferrugem" : "border-linha";
  const surface = disabled ? "bg-suave text-tinta2" : "bg-fundo text-tinta";
  const inputSize = composto
    ? "min-h-12 min-w-0 flex-1 bg-transparent px-2 text-[24px] font-extrabold"
    : "min-h-11 w-full bg-transparent px-3 text-[16px]";

  return (
    <div className={className}>
      <label htmlFor={inputId} className="t-mono-rotulo mb-2 block">
        {label}
      </label>
      <div className={`flex items-center rounded-nenhum border-2 ${border} ${surface} ${composto ? "px-3" : ""}`}>
        {prefix !== undefined ? <span className="text-[18px] font-semibold">{prefix}</span> : null}
        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={isInvalid ? true : undefined}
          aria-describedby={describedBy}
          onChange={handleChange}
          className={`${inputSize} rounded-nenhum placeholder:text-tinta2`}
          {...rest}
        />
        {suffix !== undefined ? <span className="text-[24px] font-semibold">{suffix}</span> : null}
      </div>
      {help ? (
        <p id={helpId} className="t-body-nota mt-2">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="t-body-nota mt-2 !text-ferrugem">
          {error}
        </p>
      ) : null}
    </div>
  );
}
