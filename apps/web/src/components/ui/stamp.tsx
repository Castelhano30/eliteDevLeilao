export type StampVariant = "ao-vivo" | "arrematado" | "sem-lances" | "integro" | "adulterado" | "cancelado";

const VARIANTS: Record<StampVariant, { label: string; color: string; rotate: number; dashed?: boolean }> = {
  "ao-vivo": { label: "Ao vivo", color: "var(--c-ferrugem)", rotate: -5 },
  arrematado: { label: "Arrematado", color: "var(--c-tinta)", rotate: 3 },
  "sem-lances": { label: "Sem lances", color: "var(--c-tinta2)", rotate: -2, dashed: true },
  integro: { label: "Íntegro", color: "var(--c-verde)", rotate: -7 },
  adulterado: { label: "Adulterado", color: "var(--c-ferrugem)", rotate: 4 },
  cancelado: { label: "Cancelado", color: "var(--c-tinta2)", rotate: -4 },
};

export interface StampProps {
  variant: StampVariant;
  /** "Bate" ao encerrar e assenta em -6°. Em reduced-motion aparece direto no estado final. */
  animate?: boolean;
  /** Inclinação de repouso; sem ela vale a da variante (ou -6° quando bate). */
  rotate?: number;
  className?: string;
}

/** Carimbo de status. O texto é o status: não depende da rotação nem da cor. */
export function Stamp({ variant, animate = false, rotate: resting, className = "" }: StampProps) {
  const spec = VARIANTS[variant];
  const rotate = resting ?? (animate ? -6 : spec.rotate);
  return (
    <span
      className={`t-carimbo inline-flex items-center gap-2 rounded-nenhum px-3 pb-[2px] pt-1 ${className}`.trim()}
      style={{
        color: spec.color,
        border: `4px ${spec.dashed ? "dashed" : "solid"} ${spec.color}`,
        outline: spec.dashed ? undefined : `2px solid ${spec.color}`,
        outlineOffset: spec.dashed ? undefined : "3px",
        transform: `rotate(${rotate}deg)`,
        // O carimbo "bate" até a inclinação de repouso (keyframe `la-bate`).
        ["--rot" as string]: `${rotate}deg`,
        animation: animate ? "la-bate 0.6s cubic-bezier(0.2, 0.8, 0.3, 1) both" : undefined,
      }}
    >
      {variant === "ao-vivo" ? (
        <span
          aria-hidden="true"
          className="inline-block h-[10px] w-[10px] rounded-circulo"
          style={{ background: spec.color, animation: "la-pulsa 1.2s infinite" }}
        />
      ) : null}
      {spec.label}
    </span>
  );
}
