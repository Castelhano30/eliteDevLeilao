import Link from "next/link";
import type { ReactNode } from "react";
import { AUDIT_TEXT, RECEIPT_TEXT, formatBRL, formatBrasilia, formatLotNumber, formatReferenceMonth, type ReceiptDTO } from "@lanceauto/shared";
import { LotTag } from "@/components/ui/lot-tag";
import { Perforation } from "@/components/ui/perforation";
import { Stamp } from "@/components/ui/stamp";
import { CodigoDeBarras } from "./codigo-de-barras";

const BAND = "bg-papel px-4 py-[14px]";

/** Linha rótulo/valor do recibo: em tela estreita o valor desce para baixo do rótulo (reflow, sem rolagem lateral). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4">
      <dt className="t-mono-rotulo min-w-[170px] shrink-0 pt-[6px]">{label}</dt>
      <dd className="t-mono-recibo m-0 min-w-0 flex-1 tabular-nums [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/**
 * Recibo em cinco faixas (cabeçalho, picote, corpo, picote, rodapé) num cartão `papel`, `rounded-xl`, fio e nível 2 (§10, DESIGN 4.12): sem
 * rotação e sem sombra dura. O picote é o tracejado que sobra, com os recortes semicirculares recortados pelo cartão.
 * O hash é o HMAC-SHA256 completo, selecionável e que quebra em qualquer ponto; o código de barras é decorativo.
 */
export function Recibo({ receipt }: { receipt: ReceiptDTO }) {
  const { car } = receipt;
  return (
    <article
      aria-label={`Recibo ${receipt.receiptCode}`}
      className="mx-auto w-full max-w-[760px] overflow-hidden rounded-xl border border-borda bg-papel shadow-painel"
    >
      <div className={`${BAND} flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex min-w-0 items-center gap-5">
          <LotTag number={receipt.lotNumber} tone="papel" />
          <p className="min-w-0 text-[32px] font-bold uppercase leading-none [overflow-wrap:anywhere]">{car.title}</p>
        </div>
        <Stamp variant="arrematado" />
      </div>
      <Perforation />
      <dl className={`${BAND} m-0`}>
        <Row label="Lote">{formatLotNumber(receipt.lotNumber)}</Row>
        <Row label="Carro">{car.title}</Row>
        <Row label="Ano / combustível">
          {car.year} · {car.fuel || "—"}
        </Row>
        <Row label="Referência FIPE">
          {formatBRL(car.referencePriceCents)} · {formatReferenceMonth(car.referenceMonth)}
        </Row>
        <Row label="Lances">
          {receipt.bidCount}
          {receipt.extended ? " · PRORROGADO" : ""}
        </Row>
        <Row label="Martelo">{formatBrasilia(receipt.hammerAt, "seconds")}</Row>
        <Row label="Arrematante">{receipt.winnerPseudonym}</Row>
        <Row label="Valor">
          <strong className="font-extrabold">{formatBRL(receipt.amountCents)}</strong>
        </Row>
      </dl>
      <Perforation />
      <div className={`${BAND} space-y-4`}>
        <div>
          <p className="t-mono-rotulo">{RECEIPT_TEXT.hashLabel}</p>
          <p className="mt-1 select-all text-[14px] leading-[1.5] tabular-nums [overflow-wrap:anywhere]">{receipt.finalHash}</p>
          <Link href={receipt.auditUrl} className="t-body-nota mt-1 inline-flex min-h-alvo items-center underline underline-offset-4">
            {AUDIT_TEXT.verifyOnAudit}
          </Link>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="t-mono-rotulo">Nº do comprovante</p>
            <p className="text-[22px] font-semibold tabular-nums">{receipt.receiptCode}</p>
          </div>
          <div className="min-w-[160px] flex-1">
            <CodigoDeBarras hash={receipt.finalHash} />
          </div>
        </div>
      </div>
    </article>
  );
}
