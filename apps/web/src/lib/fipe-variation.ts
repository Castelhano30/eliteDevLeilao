/**
 * Variação do lance final sobre a referência FIPE, para a linha do cartão do Painel: "+8,2%" ou "−3,0%".
 * (final − ref) / ref em porcentagem, uma casa, vírgula decimal, meio para longe do zero, tudo em inteiros
 * (décimos de ponto percentual) para não depender de ponto flutuante. Sem lance final ou sem referência, `null`.
 */
export function fipeVariation(finalCents: number | null, referenceCents: number): string | null {
  if (finalCents === null || !Number.isFinite(finalCents) || !Number.isFinite(referenceCents) || referenceCents <= 0) return null;
  const diff = finalCents - referenceCents;
  // décimos de ponto percentual = |diff| * 1000 / ref, arredondado com inteiros (meio para cima no módulo).
  const tenths = Math.floor((Math.abs(diff) * 2_000 + referenceCents) / (2 * referenceCents));
  const text = `${Math.floor(tenths / 10)},${tenths % 10}%`;
  if (tenths === 0) return text;
  return `${diff > 0 ? "+" : "−"}${text}`;
}
