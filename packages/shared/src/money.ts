/** Maior depósito aceito por operação, em centavos (R$ 10.000.000,00). */
export const MAX_DEPOSIT_CENTS = 1_000_000_000;

/** Quebra o inteiro em grupos de três dígitos separados por ponto. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Centavos inteiros para a moldura da UI: reais inteiros com ",00" fixo. */
export function formatBRL(cents: number): string {
  const negative = cents < 0;
  const reais = Math.trunc(Math.abs(cents) / 100);
  return `${negative ? "-" : ""}R$ ${groupThousands(String(reais))},00`;
}

/**
 * Lê o que o usuário digitou em reais inteiros ("31.000", "31000", "R$ 31.000,00")
 * e devolve centavos. Entrada vazia ou não numérica volta `null`.
 */
export function parseReais(input: string): number | null {
  const cleaned = input
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/,00$/, "");
  if (!/^\d{1,3}(\.\d{3})+$|^\d+$/.test(cleaned)) return null;
  const digits = cleaned.replace(/\./g, "");
  if (digits.length > 13) return null;
  return Number(digits) * 100;
}
