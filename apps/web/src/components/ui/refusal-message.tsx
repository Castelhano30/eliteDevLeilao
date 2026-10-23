import type { ReactNode } from "react";

export interface RefusalMessageProps {
  children: ReactNode;
  /** Link opcional, ex.: "Depositar na carteira →". */
  action?: { href: string; label: string };
  className?: string;
}

/** Mensagem de recusa: ícone + texto, borda tracejada ferrugem. Uma por vez, colada ao botão que a causou. */
export function RefusalMessage({ children, action, className = "" }: RefusalMessageProps) {
  return (
    <div
      role="alert"
      className={`t-body-nota flex items-start gap-2 rounded-nenhum border-2 border-dashed border-ferrugem px-[10px] py-2 !text-ferrugem ${className}`.trim()}
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="mt-px shrink-0"
      >
        <circle cx="9" cy="9" r="7" />
        <path d="M4 14L14 4" />
      </svg>
      <p>
        {children}
        {action ? (
          <>
            {" "}
            <a href={action.href} className="font-semibold !text-ferrugem">
              {action.label}
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}
