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
  const classes = `${buttonClasses(action.kind === "cover" ? "primario" : "secundario", false, "compacto")} @[44rem]:w-full`;
  if (action.kind === "copy") {
    return <BotaoCopiarLink token={action.token} lotNumber={lotNumber} ariaLabel={action.ariaLabel} tamanho="compacto" className="@[44rem]:w-full @[44rem]:[&>button]:w-full" />;
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
 * Ingresso de Meus arremates (S07 §9, `cartao-canhoto`): canhoto com o número à esquerda, o carro e o selo no meio e,
 * à direita, os valores e as ações. Empilha pelo tamanho do próprio cartão, sem depender da janela. O `<li>` leva o
 * `id` da âncora (`#lote-NNN`) e `tabIndex=-1` para receber o foco vindo da Carteira.
 */
export function BidTicket({ entry, nowMs }: BidTicketProps) {
  const { lot } = entry;
  const view = myBidView(entry, nowMs);
  const titleId = `ingresso-${lot.id}`;

  return (
    <li id={anchorId(lot.number)} tabIndex={-1} className="scroll-mt-6 list-none">
      <article aria-labelledby={titleId} className="@container relative overflow-hidden rounded-xl border border-borda bg-papel p-4 shadow-cartao">
        {/* Picote (o único tracejado que sobra): separa o canhoto dos dados, com um recorte semicircular em cada ponta, na cor da página.
            Largo: linha vertical na altura do cartão (16px de padding + 132px do canhoto + metade do vão de 24px). Estreito: linha horizontal. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[160px] hidden border-l-2 border-dashed border-tracejado @[44rem]:block" />
        <span aria-hidden="true" className="pointer-events-none absolute -top-2 left-[153px] hidden h-4 w-4 rounded-full border border-borda bg-fundo @[44rem]:block" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-2 left-[153px] hidden h-4 w-4 rounded-full border border-borda bg-fundo @[44rem]:block" />
        <div className="grid gap-4 @[44rem]:grid-cols-[132px_minmax(0,1fr)_200px] @[44rem]:gap-6">
          <div>
            <LotTag number={lot.number} tone="papel" size="compacto" />
          </div>
          <div aria-hidden="true" className="relative -mx-4 border-t-2 border-dashed border-tracejado @[44rem]:hidden">
            <span className="absolute -left-2 -top-[9px] h-4 w-4 rounded-full border border-borda bg-fundo" />
            <span className="absolute -right-2 -top-[9px] h-4 w-4 rounded-full border border-borda bg-fundo" />
          </div>

          <div className="flex min-w-0 flex-col items-start gap-2">
            <h3 id={titleId} className="m-0 text-[20px] font-extrabold leading-tight [overflow-wrap:anywhere]">
              <Link href={`/lotes/${lot.id}`}>{lot.title}</Link>
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="t-mono-dado text-tinta2">
                {lot.year} · {lot.fuel}
              </p>
              <ChipLicitante name={view.ownPseudonym} />
            </div>
            <div className="w-full max-w-[380px]">
              <StatusSeal seal={view.seal} />
            </div>
            <p className="text-[14px] leading-snug">{view.sentence}</p>
          </div>

          <div className="flex flex-col gap-3 border-t border-borda pt-3 @[44rem]:border-t-0 @[44rem]:pt-0">
            <dl className="m-0 flex flex-col gap-3">
              {view.values.map((value) => (
                <div key={value.label}>
                  <dt className="t-mono-rotulo">{value.label}</dt>
                  <dd className="m-0 break-all text-[18px] font-semibold tabular-nums">{formatBRL(value.cents)}</dd>
                </div>
              ))}
            </dl>
            {/* As ações ficam na coluna da direita, depois do picote: a linha tracejada não passa por elas. */}
            {view.actions.length > 0 ? (
              <div className="flex flex-wrap items-start gap-2 @[44rem]:flex-col @[44rem]:items-stretch">
                {view.actions.map((action) => (
                  <Action key={action.kind} action={action} lotNumber={lot.number} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}
