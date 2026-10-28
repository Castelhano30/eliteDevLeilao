"use client";

import { useState } from "react";
import { formatBRL } from "@lanceauto/shared";

export interface PlacaLanceProps {
  cents: number;
  label: "LANCE ATUAL" | "LANCE INICIAL" | "LANCE FINAL";
}

const SPOKEN = { "LANCE ATUAL": "Lance atual", "LANCE INICIAL": "Lance inicial", "LANCE FINAL": "Lance final" } as const;

/**
 * Lance atual/inicial em placas (§10.5): cada dígito numa placa de 40×60 px com linha central.
 * Só vira (`la-vira`, parado em reduced-motion) quando o valor muda: a primeira pintura fica parada. O dígito que muda
 * remonta, os demais mantêm o nó. As placas são decorativas; o valor vai no `aria-label`.
 */
export function PlacaLance({ cents, label }: PlacaLanceProps) {
  const [shown, setShown] = useState(cents);
  const [flip, setFlip] = useState(false);
  if (shown !== cents) {
    setShown(cents);
    setFlip(true);
  }
  const money = formatBRL(cents);
  const reais = money.replace(/^R\$\s/, "").replace(/,00$/, "");
  const spoken = `${SPOKEN[label]} ${money}`;
  return (
    <div>
      <p className="t-mono-rotulo mb-2">{label}</p>
      <div role="img" aria-label={spoken} className="flex flex-wrap items-end gap-y-2">
        <span aria-hidden="true" className="mr-2 text-[20px] font-extrabold">
          R$
        </span>
        <span aria-hidden="true" className="flex flex-wrap items-end gap-1" style={{ perspective: 400 }}>
          {reais.split("").map((char, index) =>
            char === "." ? (
              <span key={`p${index}`} className="inline-block w-4 text-center text-[28px] font-extrabold">
                .
              </span>
            ) : (
              <span
                key={`${index}-${char}`}
                className="relative inline-flex items-center justify-center rounded-md bg-painel font-extrabold"
                style={{
                  width: 32,
                  height: 48,
                  fontSize: 32,
                  color: "var(--f-digito-placa)",
                  animation: flip ? `la-vira 0.5s ${index * 0.06}s both` : undefined,
                }}
              >
                {char}
                <span className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2" style={{ background: "var(--f-linha-central-placa)" }} />
              </span>
            ),
          )}
        </span>
        <span aria-hidden="true" className="ml-1 text-[20px] font-extrabold">
          ,00
        </span>
      </div>
    </div>
  );
}
