export interface Bar {
  x: number;
  w: number;
}

/**
 * Barras do código decorativo do recibo, derivadas dos bytes do hash final: cada byte vira uma barra de 1 a 4 px
 * (dois bits) seguida de um vão de 1 a 3 px (outros dois bits). Mesma entrada, mesmo desenho; não carrega informação.
 */
export function barcodeBars(hash: string): { bars: Bar[]; width: number } {
  const bars: Bar[] = [];
  let x = 0;
  for (let i = 0; i + 1 < hash.length; i += 2) {
    const byte = Number.parseInt(hash.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) continue;
    const w = (byte & 3) + 1;
    bars.push({ x, w });
    x += w + (((byte >> 2) & 3) % 3) + 1;
  }
  return { bars, width: x };
}
