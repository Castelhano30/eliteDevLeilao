export interface Rank {
  rank: number;
  myBestBidCents: number;
}

/**
 * Posição de `me` entre os licitantes distintos, pelo maior lance de cada um (S03 §4.7):
 * `1 + nº de licitantes com maior lance acima do meu`. Sem lance meu, `null`.
 * O total de licitantes é `bestByBidder.size`.
 */
export function rankFrom(bestByBidder: ReadonlyMap<string, number>, me: string): Rank | null {
  const mine = bestByBidder.get(me);
  if (mine === undefined) return null;
  let above = 0;
  for (const best of bestByBidder.values()) if (best > mine) above += 1;
  return { rank: 1 + above, myBestBidCents: mine };
}
