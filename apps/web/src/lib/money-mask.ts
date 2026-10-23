/** Mais de 9 dígitos já passa de R$ 10.000.000 e arriscaria `number` fora do intervalo seguro. */
export const MAX_DIGITS = 9;

export interface MaskedValue {
  value: string;
  /** Posição do cursor no texto formatado. */
  caret: number;
}

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Máscara de reais inteiros: mantém só dígitos, corta em 9, remove zeros à esquerda e reaplica o ponto de milhar.
 * O cursor acompanha o mesmo número de dígitos que havia antes dele.
 */
export function maskReais(raw: string, caret: number = raw.length): MaskedValue {
  const before = raw.slice(0, caret).replace(/\D/g, "");
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITS);
  const kept = Math.min(before.replace(/^0+/, "").length, digits.length);
  const value = group(digits);
  if (kept === 0) return { value, caret: 0 };
  // avança no texto formatado até ter passado `kept` dígitos
  let seen = 0;
  let position = 0;
  while (position < value.length && seen < kept) {
    if (/\d/.test(value[position] ?? "")) seen += 1;
    position += 1;
  }
  return { value, caret: position };
}
