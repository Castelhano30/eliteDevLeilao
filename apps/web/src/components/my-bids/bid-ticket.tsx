import Link from "next/link";
import { formatBRL, type MyBidItem } from "@lanceauto/shared";
import { BotaoCopiarLink } from "@/components/botao-copiar-link";
import { ChipLicitante } from "@/components/lots/chip-licitante";
import { buttonClasses } from "@/components/ui/button";
import { LotTag } from "@/components/ui/lot-tag";
import { myBidView, type MyBidAction } from "@/lib/my-bid-view";
import { anchorId } from "@/lib/my-bids-events";
import { StatusSeal } from "./status-seal";

export interface BidTicketProps {
  entry: MyBidItem;
  /** Relógio do servidor (ms). Só o rótulo "apurando" depende dele. */
  nowMs: number;
}

function Action({ action, lotNumber }: { action: MyBidAction; lotNumber: number }) {
  const classes = `${buttonClasses(action.kind === "cover" ? "primario" : "secundario")} !min-h-alvo`;
  if (action.kind === "copy") {
    return <BotaoCopiarLink token={action.token} lotNumber={lotNumber} ariaLabel={action.ariaLabel} />;
  }
  if (action.kind === "receipt") {
    // O comprovante abre em outra guia: a lista continua onde a pessoa estava (como na Sala).
    return (
      <Link href={action.href} target="_blank" rel="noopener noreferrer" aria-label={`${action.ariaLabel} (abre em outra guia)`} className={classes}>
        {action.label}
      </Link>
    );
  }
  return (
    <Link href={action.href} aria-label={action.ariaLabel} className={classes}>
      {action.label}
    </Link>
  );
}

/**
 * Ingresso de Meus arremates (S07 §9, `cartao-canhoto`): canhoto com o número, o carro e o selo, os valores à
 * direita e as ações no rodapé. Empilha pelo tamanho do próprio cartão, sem depender da janela. O `<li>` leva o
 * `id` da âncora (`#lote-NNN`) e `tabIndex=-1` para receber o foco vindo da Carteira.
 */
export function BidTicket({ entry, nowMs }: BidTicketProps) {
  const { lot } = entry;
  const view = myBidView(entry, nowMs);
  const titleId = `ingresso-${lot.id}`;

  return (
    <li id={anchorId(lot.number)} tabIndex={-1} className="scroll-mt-6 list-none">
      <article aria-labelledby={titleId} className="@container rounded-nenhum border-[3px] border-linha bg-papel p-6 shadow-cartao">
        <div className="grid gap-5 @[44rem]:grid-cols-[auto_minmax(0,1fr)_auto] @[44rem]:gap-6">
          <div className="min-w-[112px] pl-6 pt-7 @[44rem]:border-r-[3px] @[44rem]:border-dashed @[44rem]:border-tracejado @[44rem]:pr-6">
            <LotTag number={lot.number} tone="papel" />
          </div>

          <div className="flex min-w-0 flex-col items-start gap-3">
            <h3 id={titleId} className="m-0 text-[32px] font-extrabold uppercase leading-none [overflow-wrap:anywhere]">
              <Link href={`/lotes/${lot.id}`}>{lot.title}</Link>
            </h3>
            <p className="t-mono-dado text-tinta2">
              {lot.year} · {lot.fuel}
            </p>
            <div className="w-full max-w-[420px]">
              <StatusSeal seal={view.seal} />
            </div>
            <p className="t-body">{view.sentence}</p>
            <ChipLicitante name={view.ownPseudonym} />
          </div>

          <dl className="m-0 flex flex-col gap-4 border-t-2 border-dashed border-tracejado pt-4 @[44rem]:border-l-2 @[44rem]:border-t-0 @[44rem]:pl-6 @[44rem]:pt-0">
            {view.values.map((value) => (
              <div key={value.label}>
                <dt className="t-mono-rotulo">{value.label}</dt>
                <dd className="m-0 break-all text-[22px] font-semibold">{formatBRL(value.cents)}</dd>
              </div>
            ))}
          </dl>
        </div>

        {view.actions.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-start gap-3 border-t-2 border-dashed border-tracejado pt-4">
            {view.actions.map((action) => (
              <Action key={action.kind} action={action} lotNumber={lot.number} />
            ))}
          </div>
        ) : null}
      </article>
    </li>
  );
}
