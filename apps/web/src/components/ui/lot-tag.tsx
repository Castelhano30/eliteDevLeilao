const CHAMFER = "polygon(18px 0, 100% 0, 100% 100%, 18px 100%, 0 calc(100% - 18px), 0 18px)";
const CHAMFER_INNER = "polygon(17px 0, 100% 0, 100% 100%, 17px 100%, 0 calc(100% - 17px), 0 17px)";

export interface LotTagProps {
  /** Número do lote (aparece com três dígitos, `018`) ou um texto curto, como "NOVO" antes de o lote existir. */
  number: number | string;
  /** Ocre para ao vivo ou agendado, papel para encerrado. */
  tone?: "ocre" | "papel";
  /** Inclinação de -4° a +3° (-2° nos encerrados). */
  rotate?: number;
  /** Compacto para a faixa do cartão da Vitrine; o padrão serve às telas com título grande. */
  size?: "padrao" | "compacto";
}

/**
 * Etiqueta de lote "amarrada no retrovisor". Decorativa: nunca é o único meio de saber o status.
 * O laço fica dentro da caixa do componente, que reserva o espaço do laço e da inclinação: a etiqueta não cobre
 * o que está ao redor, então quem a usa não precisa compensar com margem.
 */
export function LotTag({ number, tone = "ocre", rotate = tone === "papel" ? -2 : -4, size = "padrao" }: LotTagProps) {
  const fill = tone === "ocre" ? "var(--c-ocre)" : "var(--c-papel)";
  const ink = tone === "ocre" ? "var(--c-sobre-ocre)" : "var(--c-tinta)";
  const compact = size === "compacto";
  return (
    <span className="inline-block align-top" style={{ padding: "18px 4px 6px 2px" }}>
      <span className="relative inline-block" style={{ transform: `rotate(${rotate}deg)` }}>
        {/* Coordenadas do SVG = coordenadas da etiqueta; o laço sobe do furo e não passa da borda esquerda. */}
        <svg
          aria-hidden="true"
          width="40"
          height="40"
          viewBox="0 -18 40 40"
          fill="none"
          stroke="var(--c-tinta)"
          strokeWidth="2.5"
          className="absolute z-[2]"
          style={{ left: 0, top: -18 }}
        >
          <path d="M18 18C6 14 3 -2 11 -9C17 -14 25 -11 24 -5" />
          <path d="M24 -5C23 1 15 5 20 13" />
        </svg>
        <span className="inline-block bg-linha" style={{ clipPath: CHAMFER, padding: 3 }}>
          <span
            className={`relative block pl-9 pr-[18px] ${compact ? "pb-[6px] pt-2" : "pb-2 pt-[10px]"}`}
            style={{ clipPath: CHAMFER_INNER, background: fill, color: ink }}
          >
            <span
              className="absolute left-[10px] top-3 h-[10px] w-[10px] rounded-circulo border-[3px] border-linha bg-fundo"
              aria-hidden="true"
            />
            <span className="block text-[11px] tracking-[0.14em]">LOTE</span>
            <span className="t-numero-lote block" style={compact ? { fontSize: 36 } : undefined}>
              {typeof number === "number" ? String(number).padStart(3, "0") : number}
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}
