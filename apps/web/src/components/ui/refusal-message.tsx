import Link from "next/link";
import type { ReactNode } from "react";
import { Notice } from "./notice";

export interface RefusalMessageProps {
  children: ReactNode;
  /** Link opcional, ex.: "Depositar na carteira →". */
  action?: { href: string; label: string };
  className?: string;
}

/** Recusa (DESIGN 4.9): o aviso de erro, com o círculo cortado, colado ao botão que a causou. Uma por vez. */
export function RefusalMessage({ children, action, className = "" }: RefusalMessageProps) {
  return (
    <Notice kind="erro" className={className}>
      {children}
      {action ? (
        <>
          {" "}
          <Link href={action.href} className="font-semibold !text-ocreTexto underline underline-offset-[3px]">
            {action.label}
          </Link>
        </>
      ) : null}
    </Notice>
  );
}
