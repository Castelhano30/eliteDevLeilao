import Link from "next/link";
import { receiptPath } from "@lanceauto/shared";
import { BotaoCopiarLink } from "@/components/botao-copiar-link";
import { buttonClasses } from "@/components/ui/button";
import { Stamp } from "@/components/ui/stamp";
import type { LotResultView } from "@/lib/lot-result";

export interface ResultadoDoLoteProps {
  view: Exclude<LotResultView, { kind: "apurando" }>;
  lotNumber: number;
  /** A transição foi vista nesta sessão: o carimbo "Arrematado" bate. Ao abrir um lote já encerrado, aparece assentado. */
  animate: boolean;
}

/**
 * Resultado do lote na Sala (§9.1): carimbo, frase e as ações. A faixa de situação fica fora, na região aria-live
 * do painel, que é a única que anuncia a mudança. O carimbo do texto é o status; não depende de cor nem de rotação.
 */
export function ResultadoDoLote({ view, lotNumber, animate }: ResultadoDoLoteProps) {
  const arrematado = view.stamp === "arrematado";
  return (
    <div className="space-y-4">
      <div className="flex min-h-[96px] items-center justify-center py-3">
        <Stamp
          variant={view.stamp}
          animate={arrematado && animate}
          rotate={arrematado ? -6 : undefined}
          // Fluido: a 320 px o "Arrematado" de 52 px media 413 px e estourava a página.
          className={arrematado ? "!text-[length:clamp(24px,8vw,52px)]" : "!text-[length:clamp(24px,8vw,40px)]"}
        />
      </div>
      {view.sentence ? <p className="t-body-lead">{view.sentence}</p> : null}
      {view.kind === "arrematou" ? (
        <div className="space-y-3">
          {/* O comprovante abre em outra guia: a Sala continua onde a pessoa estava. */}
          <Link href={receiptPath(view.receiptToken)} target="_blank" rel="noopener noreferrer" className={`${buttonClasses("primario")} w-full`}>
            Ver comprovante
            <span className="sr-only"> (abre em outra guia)</span>
          </Link>
          <BotaoCopiarLink token={view.receiptToken} lotNumber={lotNumber} />
        </div>
      ) : null}
      {view.backToShowcase ? (
        <Link href="/" className={buttonClasses("secundario")}>
          Voltar à vitrine
        </Link>
      ) : null}
    </div>
  );
}
