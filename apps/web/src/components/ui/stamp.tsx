import type { ReactNode } from "react";

export type StampVariant = "ao-vivo" | "agendado" | "encerrando" | "arrematado" | "sem-lances" | "integro" | "adulterado" | "cancelado" | "perdido";

type IconName = "dot" | "clock" | "clock-alert" | "check" | "alert" | "ban" | "gavel" | "dash";

// Classes literais, para o Tailwind gerá-las. Selo = pílula de fio de 1px, fundo tintado, ícone e texto na cor forte (DESIGN 4.4).
const NEUTRO_TRACEJADO = "border-dashed border-linha bg-papel text-tinta2";
const VARIANTS: Record<StampVariant, { label: string; icon: IconName; tone: string; carimbo?: string }> = {
  // Vermelho no cartão e na Sala: não se confunde com o azul de link e de ação.
  "ao-vivo": { label: "Ao vivo", icon: "dot", tone: "border-transparent bg-aoVivo text-sobreAoVivo" },
  agendado: { label: "Agendado", icon: "clock", tone: "border-ocre/30 bg-selecionado text-ocreTexto" },
  // Mesmo texto do "Ao vivo": nos últimos 2 minutos só a cor e o ícone mudam, e sem pulso.
  encerrando: { label: "Ao vivo", icon: "clock-alert", tone: "border-alerta/40 bg-alertaSuave text-alerta" },
  arrematado: { label: "Arrematado", icon: "gavel", tone: "border-transparent bg-tinta text-fundo", carimbo: "border-tinta bg-suave text-tinta" },
  "sem-lances": { label: "Sem lances", icon: "dash", tone: NEUTRO_TRACEJADO },
  integro: { label: "Íntegro", icon: "check", tone: "border-verde/35 bg-verdeSuave text-verde", carimbo: "border-verde bg-verdeSuave text-verde" },
  adulterado: { label: "Adulterado", icon: "alert", tone: "border-ferrugem/35 bg-falha text-ferrugem", carimbo: "border-ferrugem bg-falha text-ferrugem" },
  cancelado: { label: "Cancelado", icon: "ban", tone: "border-ferrugem/35 bg-falha text-ferrugem", carimbo: "border-ferrugem bg-falha text-ferrugem" },
  perdido: { label: "Perdido", icon: "dash", tone: NEUTRO_TRACEJADO },
};

// pequeno = cartão de lote e padrao = Sala (28px); tabela = tabelas e listas (24px); carimbo = resultado em destaque (Sala e Auditoria).
const SIZES = {
  padrao: "t-selo h-7 gap-1.5 border px-[10px]",
  pequeno: "t-selo h-7 gap-1.5 border px-[10px]",
  tabela: "t-selo h-6 gap-1.5 border px-2",
  carimbo: "la-carimbo gap-3 border-2 px-5 py-3 text-[length:clamp(28px,8vw,40px)] font-extrabold uppercase leading-none",
} as const;

export interface StampProps {
  variant: StampVariant;
  /** Texto próprio, para o selo que muda de frase (ex.: "ABRE QUI 18:00" no agendado). Sem ele vale o da variante. */
  label?: string;
  /** "Bate" ao aparecer (keyframe `la-bate`). Em reduced-motion aparece direto no estado final. */
  animate?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Ícone de 14px (28px no carimbo): sempre decorativo, o texto é o status. */
function Icon({ name, size }: { name: IconName; size: number }) {
  if (name === "dot") {
    return (
      <span
        aria-hidden="true"
        className="inline-block shrink-0 rounded-circulo bg-current"
        style={{ width: Math.round(size * 0.6), height: Math.round(size * 0.6), animation: "la-pulsa 1.2s infinite" }}
      />
    );
  }
  const paths: Record<Exclude<IconName, "dot">, ReactNode> = {
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    "clock-alert": (
      <>
        <circle cx="11" cy="13" r="8" />
        <path d="M11 8.5V13l2.5 1.7" />
        <circle cx="19.5" cy="4.5" r="2.4" fill="currentColor" stroke="none" />
      </>
    ),
    check: <path d="m5 12.5 4.5 4.5L19 7" />,
    alert: (
      <>
        <path d="M12 3.5 2.5 20h19L12 3.5Z" />
        <path d="M12 10v4.5" />
        <circle cx="12" cy="17.3" r="0.6" fill="currentColor" />
      </>
    ),
    ban: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m5.6 5.6 12.8 12.8" />
      </>
    ),
    gavel: (
      <>
        <rect x="11" y="2.5" width="10" height="6" rx="1.2" transform="rotate(45 16 5.5)" />
        <path d="m11.5 10.5-8 8" />
        <path d="M3 21.5h9" />
      </>
    ),
    dash: <path d="M5 12h14" />,
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {paths[name]}
    </svg>
  );
}

/**
 * Selo de status: pílula com ícone e texto, sem inclinação. O texto é o status; a cor nunca vai sozinha.
 * `size="carimbo"` é o resultado em destaque (cartão de 12px, borda de 2px, fundo tintado, -3° e `la-bate`), sem inclinação em reduced-motion.
 */
export function Stamp({ variant, label, animate = false, size = "padrao", className = "" }: StampProps) {
  const spec = VARIANTS[variant];
  const carimbo = size === "carimbo";
  const tone = carimbo ? (spec.carimbo ?? spec.tone) : spec.tone;
  return (
    <span
      className={`inline-flex max-w-full items-center justify-center whitespace-nowrap ${carimbo ? "rounded-xl" : "rounded-full"} ${SIZES[size]} ${tone} ${className}`.trim()}
      style={{
        ["--rot" as string]: carimbo ? "-3deg" : "0deg",
        animation: animate ? "la-bate 0.6s cubic-bezier(0.2, 0.8, 0.3, 1) both" : undefined,
      }}
    >
      <Icon name={spec.icon} size={carimbo ? 28 : 14} />
      {label ?? spec.label}
    </span>
  );
}
