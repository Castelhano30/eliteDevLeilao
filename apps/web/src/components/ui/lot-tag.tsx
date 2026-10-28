const CHAMFER = "polygon(18px 0, 100% 0, 100% 100%, 18px 100%, 0 calc(100% - 18px), 0 18px)";
const CHAMFER_INNER = "polygon(17px 0, 100% 0, 100% 100%, 17px 100%, 0 calc(100% - 17px), 0 17px)";

export interface LotTagProps {
  /** Número do lote (aparece com três dígitos, `018`) ou um texto curto, como "NOVO" antes de o lote existir. */
  number: number | string;
  /** Ocre para aberto, encerrando e agendado (contorno azul); papel para encerrado e cancelado (contorno neutro `linha`). */
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
  // Contorno de 2px: azul profundo no claro e `ocreTexto` no noite (o azul principal não aparece como borda sobre o escuro).
  const contour = tone === "ocre" ? "var(--c-etiqueta-contorno)" : "var(--c-linha)";
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
          strokeWidth="2"
          className="absolute z-[2]"
          style={{ left: 0, top: -18 }}
        >
          <path d="M16 19C9 13 6 4 10 -3C13 -9 22 -9 23 -3C24 3 19 10 16 19" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="inline-block" style={{ clipPath: CHAMFER, padding: 2, background: contour }}>
          <span
            className={`relative block ${compact ? "pb-1 pl-8 pr-[14px] pt-[6px]" : "pb-2 pl-9 pr-[18px] pt-[10px]"}`}
            style={{ clipPath: CHAMFER_INNER, background: fill, color: ink }}
          >
            <span
              className="absolute left-[10px] top-3 h-[10px] w-[10px] rounded-circulo border-2 bg-fundo"
              style={{ borderColor: contour }}
              aria-hidden="true"
            />
            <span className={`block tracking-[0.14em] ${compact ? "text-[10px]" : "text-[11px]"}`}>LOTE</span>
            <span className="t-numero-lote block" style={compact ? { fontSize: 28 } : undefined}>
              {typeof number === "number" ? String(number).padStart(3, "0") : number}
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}
