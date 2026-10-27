"use client";

import { useState } from "react";
import { abbreviateHash } from "@lanceauto/shared";
import { Button } from "@/components/ui/button";
import { hashToggle } from "@/lib/audit-view";

export interface HashCellProps {
  /** `id` do trecho que o botão expande (`hash-09`, `hash-final`); único na página. */
  id: string;
  hash: string;
  /** De quem é o hash, para o nome acessível: "da linha 09", "final", "do comprovante". */
  what: string;
  /** Hash em ferrugem (contadores do veredito que não fecham). */
  alert?: boolean;
}

/** Hash abreviado (`6…4`) com "ver inteiro" / "recolher". O estado de expansão é de cada célula (S08 §9). */
export function HashCell({ id, hash, what, alert = false }: HashCellProps) {
  const [expanded, setExpanded] = useState(false);
  const toggle = hashToggle(id, what, expanded);
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span id={id} className={`t-mono-dado min-w-0 ${expanded ? "basis-full [word-break:break-all]" : ""} ${alert ? "text-ferrugem" : ""}`.trim()}>
        {expanded ? hash : abbreviateHash(hash)}
      </span>
      <Button
        variant="secundario"
        aria-expanded={toggle.expanded}
        aria-controls={toggle.controls}
        aria-label={toggle.ariaLabel}
        className="!min-h-alvo !px-3 !py-1 !text-[12px] !font-medium !tracking-[0.06em]"
        onClick={() => setExpanded((value) => !value)}
      >
        {toggle.text}
      </Button>
    </span>
  );
}
