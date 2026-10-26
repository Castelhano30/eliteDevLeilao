import { barcodeBars } from "@/lib/barcode";

/** Código de barras decorativo do recibo (§10): derivado do hash final, sem informação, escondido de leitores de tela. */
export function CodigoDeBarras({ hash }: { hash: string }) {
  const { bars, width } = barcodeBars(hash);
  if (bars.length === 0) return null;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${width} 48`}
      preserveAspectRatio="none"
      className="block h-12 w-full max-w-[360px]"
      fill="var(--c-tinta)"
    >
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={48} />
      ))}
    </svg>
  );
}
