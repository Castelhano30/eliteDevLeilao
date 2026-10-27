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
  /** Campo composto: prefixo fixo (ex. "R$"), em tinta2. */
  prefix?: ReactNode;
  /** Campo composto: sufixo fixo (ex. ",00"). */
  suffix?: ReactNode;
  /** Ids de fora do campo que também o descrevem (ex.: a recusa colada ao botão). */
  describedBy?: string;
  /** Transforma o texto digitado antes de chegar ao `onChange`. */
  mask?: (raw: string) => string;
  /** `lance` é o campo da Sala: 56px e valor em 28px. O padrão tem 48px. */
  tamanho?: "padrao" | "lance";
}

/** Ícone de aviso do erro: o erro nunca vai só por cor (borda, ícone e texto juntos). */
function AlertIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-[2px] shrink-0">
      <path d="M8 1.5 15 14H1L8 1.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 6v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11.8" r="0.9" fill="currentColor" />
    </svg>
  );
}

/**
 * Campo com rótulo sempre visível. Com prefixo/sufixo vira o campo de valor (lance e depósito).
 * A caixa é o wrapper: o anel de foco e a borda azul vão nele (`has-[:focus-visible]`), porque o `input` interno não tem borda própria.
 */
export function Field({ label, help, error, invalid, prefix, suffix, mask, describedBy: extraDescribedBy, id, className = "", onChange, disabled, tamanho = "padrao", ...rest }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const helpId = help ? `${inputId}-ajuda` : undefined;
  const errorId = error ? `${inputId}-erro` : undefined;
  const describedBy = [helpId, errorId, extraDescribedBy].filter(Boolean).join(" ") || undefined;
  const composto = prefix !== undefined || suffix !== undefined;
  const lance = tamanho === "lance";

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (mask) event.target.value = mask(event.target.value);
    onChange?.(event);
  };

  const isInvalid = Boolean(error) || invalid === true;
  // Erro: borda ferrugem com 2px visuais (1px de borda + 1px de sombra). Desabilitado não reage a hover.
  const state = disabled
    ? "cursor-not-allowed border-borda bg-suave text-tinta2"
    : isInvalid
      ? "border-ferrugem bg-papel text-tinta shadow-[0_0_0_1px_var(--c-ferrugem)]"
      : "border-linha bg-papel text-tinta hover:border-tinta2";
  const box = `flex items-center rounded-xl border transition-[border-color,box-shadow] duration-150 ease-out ${lance ? "min-h-14" : "min-h-12"} ${composto ? "px-3" : ""} ${state} has-[:focus-visible]:border-foco has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foco`;
  const inputSize = composto
    ? `min-w-0 flex-1 self-stretch bg-transparent px-2 font-bold tabular-nums ${lance ? "text-[28px]" : "text-[24px]"}`
    : "w-full self-stretch bg-transparent px-3 text-[16px]";
  const affix = `font-semibold text-tinta2 ${lance ? "text-[20px]" : "text-[18px]"}`;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="t-rotulo-campo mb-[6px] block">
        {label}
      </label>
      <div className={box}>
        {prefix !== undefined ? <span className={affix}>{prefix}</span> : null}
        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={isInvalid ? true : undefined}
          aria-describedby={describedBy}
          onChange={handleChange}
          className={`${inputSize} rounded-xl !outline-none placeholder:text-tinta2 disabled:cursor-not-allowed`}
          {...rest}
        />
        {suffix !== undefined ? <span className={affix}>{suffix}</span> : null}
      </div>
      {help ? (
        <p id={helpId} className="t-body-nota mt-[6px]">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="t-body-nota mt-[6px] flex items-start gap-2 !text-ferrugem">
          <AlertIcon />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
