import type { ReactNode } from "react";

export type NoticeKind = "info" | "sucesso" | "alerta" | "erro";

// Classes literais, para o Tailwind gerá-las. Fundo tintado e borda de 1px na cor do tipo; o texto fica em `tinta` (a cor forte vai no ícone e na borda).
const KIND: Record<NoticeKind, { box: string; icon: string; role: "status" | "alert" }> = {
  info: { box: "border-ocre bg-selecionado", icon: "text-ocreTexto", role: "status" },
  sucesso: { box: "border-verde bg-verdeSuave", icon: "text-verde", role: "status" },
  alerta: { box: "border-alerta bg-alertaSuave", icon: "text-alerta", role: "status" },
  erro: { box: "border-ferrugem bg-falha", icon: "text-ferrugem", role: "alert" },
};

/** Ícone de 20px por tipo: o aviso nunca vai só por cor. Decorativo (o texto é a mensagem). */
function Glyph({ kind }: { kind: NoticeKind }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
      {kind === "info" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <circle cx="12" cy="7.8" r="0.6" fill="currentColor" />
        </>
      ) : kind === "sucesso" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12.5 3 3 5-6" />
        </>
      ) : kind === "alerta" ? (
        <>
          <path d="M12 3.5 2.5 20h19L12 3.5Z" />
          <path d="M12 10v4.5" />
          <circle cx="12" cy="17.3" r="0.6" fill="currentColor" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m5.6 5.6 12.8 12.8" />
        </>
      )}
    </svg>
  );
}

export interface NoticeProps {
  kind: NoticeKind;
  children: ReactNode;
  /** Ação ou botão sob o texto, dentro do mesmo bloco (ex.: "Tentar novamente", "Dispensar"). */
  footer?: ReactNode;
  /** Padrão: `alert` no erro e `status` nos demais. `none` quando uma região viva do pai já anuncia (ex.: o banner de conexão). */
  role?: "status" | "alert" | "none";
  className?: string;
}

/**
 * Aviso (DESIGN 4.9): `rounded-xl`, borda de 1px, padding 12px 16px, ícone de 20px à esquerda e texto em `tinta`.
 * Informativo (inclui confirmação genérica), sucesso (só "ganhando" e "íntegro"), alerta e erro.
 */
export function Notice({ kind, children, footer, role, className = "" }: NoticeProps) {
  const spec = KIND[kind];
  const aria = role ?? spec.role;
  return (
    <div role={aria === "none" ? undefined : aria} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-tinta ${spec.box} ${className}`.trim()}>
      <span className={`flex ${spec.icon}`}>
        <Glyph kind={kind} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="t-body">{children}</div>
        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
    </div>
  );
}
