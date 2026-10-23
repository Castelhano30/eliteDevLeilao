const CHAMFER = "polygon(18px 0, 100% 0, 100% 100%, 18px 100%, 0 calc(100% - 18px), 0 18px)";
const CHAMFER_INNER = "polygon(17px 0, 100% 0, 100% 100%, 17px 100%, 0 calc(100% - 17px), 0 17px)";

export interface LotTagProps {
  /** Número do lote; aparece com três dígitos (`018`). */
  number: number;
  /** Ocre para ao vivo ou agendado, papel para encerrado. */
  tone?: "ocre" | "papel";
  /** Inclinação de -4° a +3° (-2° nos encerrados). */
  rotate?: number;
}

/** Etiqueta de lote "amarrada no retrovisor". Decorativa: nunca é o único meio de saber o status. */
export function LotTag({ number, tone = "ocre", rotate = tone === "papel" ? -2 : -4 }: LotTagProps) {
  const fill = tone === "ocre" ? "var(--c-ocre)" : "var(--c-papel)";
  const ink = tone === "ocre" ? "var(--c-sobre-ocre)" : "var(--c-tinta)";
  return (
    <span className="relative inline-block" style={{ transform: `rotate(${rotate}deg)` }}>
      <svg
        aria-hidden="true"
        width="44"
        height="40"
        viewBox="0 0 44 40"
        fill="none"
        stroke="var(--c-tinta)"
        strokeWidth="2.5"
        className="absolute z-[2]"
        style={{ left: -22, top: -26 }}
      >
        <path d="M32 38C14 38 2 24 8 10C12 2 22 2 24 8" />
        <path d="M24 8C26 14 20 20 30 30" />
      </svg>
      <span className="inline-block bg-linha" style={{ clipPath: CHAMFER, padding: 3 }}>
        <span
          className="relative block pb-2 pl-9 pr-[18px] pt-[10px]"
          style={{ clipPath: CHAMFER_INNER, background: fill, color: ink }}
        >
          <span
            className="absolute left-[10px] top-3 h-[10px] w-[10px] rounded-circulo border-[3px] border-linha bg-fundo"
            aria-hidden="true"
          />
          <span className="block font-mono text-[11px] tracking-[0.14em]">LOTE</span>
          <span className="t-numero-lote block">{String(number).padStart(3, "0")}</span>
        </span>
      </span>
    </span>
  );
}
