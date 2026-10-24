import { formatBRL } from "@lanceauto/shared";

export interface PlacaLanceProps {
  cents: number;
  label: "LANCE ATUAL" | "LANCE INICIAL";
}

/**
 * Lance atual/inicial em placas (§10.5): cada dígito numa placa de 40×60 px com linha central.
 * Dígito que muda remonta e vira com `la-vira` (parado em reduced-motion). As placas são decorativas;
 * o valor vai no `aria-label`.
 */
export function PlacaLance({ cents, label }: PlacaLanceProps) {
  const money = formatBRL(cents);
  const reais = money.replace(/^R\$\s/, "").replace(/,00$/, "");
  const spoken = `${label === "LANCE ATUAL" ? "Lance atual" : "Lance inicial"} ${money}`;
  return (
    <div>
      <p className="t-mono-rotulo mb-2">{label}</p>
      <div role="img" aria-label={spoken} className="flex flex-wrap items-end gap-y-2">
        <span aria-hidden="true" className="mr-2 font-mono text-[20px] font-semibold">
          R$
        </span>
        <span aria-hidden="true" className="flex flex-wrap items-end gap-1" style={{ perspective: 400 }}>
          {reais.split("").map((char, index) =>
            char === "." ? (
              <span key={`p${index}`} className="inline-block w-4 text-center font-mono text-[28px] font-semibold">
                .
              </span>
            ) : (
              <span
                key={`${index}-${char}`}
                className="relative inline-flex items-center justify-center rounded-placa bg-painel font-mono font-semibold"
                style={{
                  width: 40,
                  height: 60,
                  fontSize: 40,
                  color: "var(--f-digito-placa)",
                  animation: `la-vira 0.5s ${index * 0.06}s both`,
                }}
              >
                {char}
                <span className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2" style={{ background: "var(--f-linha-central-placa)" }} />
              </span>
            ),
          )}
        </span>
        <span aria-hidden="true" className="ml-1 font-mono text-[20px] font-semibold">
          ,00
        </span>
      </div>
    </div>
  );
}
