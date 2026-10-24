"use client";

import { useLayoutEffect, useRef, type ChangeEvent } from "react";
import { Field } from "@/components/ui/field";
import { DEPOSIT_MAX_DIGITS, maskReais } from "@/lib/money-mask";

export interface MoneyFieldProps {
  label: string;
  /** Texto já mascarado, ex.: "10.000". */
  value: string;
  onChange: (masked: string) => void;
  /** Borda e `aria-invalid` sem texto: a mensagem fica numa RefusalMessage colada ao botão. */
  invalid?: boolean;
  /** Mensagem do erro junto ao campo (liga `aria-describedby`). */
  error?: string;
  required?: boolean;
  help?: string;
  disabled?: boolean;
  id?: string;
  /** Limite de dígitos da máscara: 9 no depósito (padrão), 13 no lance. */
  maxDigits?: number;
  /** Ids extras que descrevem o campo (ex.: a recusa que está fora dele). */
  describedBy?: string;
}

/** Campo de valor em reais inteiros: "R$" + dígitos com ponto de milhar + ",00". Reaplica a máscara a cada tecla ou colagem. */
export function MoneyField({
  label,
  value,
  onChange,
  invalid,
  error,
  required,
  help,
  disabled,
  id,
  maxDigits = DEPOSIT_MAX_DIGITS,
  describedBy,
}: MoneyFieldProps) {
  const pending = useRef<{ input: HTMLInputElement; caret: number } | null>(null);

  // O React recoloca o cursor no fim ao trocar o valor; devolvemos para onde o usuário estava.
  useLayoutEffect(() => {
    const target = pending.current;
    if (target && document.activeElement === target.input) target.input.setSelectionRange(target.caret, target.caret);
    pending.current = null;
  }, [value]);

  const handle = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const masked = maskReais(input.value, input.selectionStart ?? input.value.length, maxDigits);
    pending.current = { input, caret: masked.caret };
    onChange(masked.value);
  };

  return (
    <Field
      id={id}
      label={label}
      prefix="R$"
      suffix=",00"
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
      value={value}
      onChange={handle}
      invalid={invalid}
      error={error}
      required={required}
      help={help}
      disabled={disabled}
      describedBy={describedBy}
    />
  );
}
