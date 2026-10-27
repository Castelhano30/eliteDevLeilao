import Link from "next/link";
import type { ReactNode } from "react";
import { AUDIT_TEXT, RECEIPT_TEXT, formatBRL, formatBrasilia, formatLotNumber, formatReferenceMonth, type ReceiptDTO } from "@lanceauto/shared";
import { LotTag } from "@/components/ui/lot-tag";
import { Perforation } from "@/components/ui/perforation";
import { Stamp } from "@/components/ui/stamp";
import { CodigoDeBarras } from "./codigo-de-barras";

const BAND = "bg-papel px-4 py-[14px] border-dashed border-tracejado";

/** Linha rótulo/valor do recibo: em tela estreita o valor desce para baixo do rótulo (reflow, sem rolagem lateral). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4">
      <dt className="t-mono-rotulo min-w-[170px] shrink-0 pt-[6px]">{label}</dt>
      <dd className="t-mono-recibo m-0 min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/**
 * Recibo em cinco faixas sobrepostas (cabeçalho, picote, corpo, picote, rodapé), girado -1° com sombra dura (§10).
 * O hash é o HMAC-SHA256 completo, selecionável e que quebra em qualquer ponto; o código de barras é decorativo.
 */
export function Recibo({ receipt }: { receipt: ReceiptDTO }) {
  // 8 px a menos de largura: a sombra deslocada e a rotação de -1° cabem na coluna e a página não ganha rolagem lateral.
  const { car } = receipt;
  return (
    <article
      aria-label={`Recibo ${receipt.receiptCode}`}
      className="mx-auto w-[calc(100%-8px)] max-w-[760px]"
      style={{ transform: "rotate(-1deg)", filter: "drop-shadow(8px 8px 0 var(--c-sombra))" }}
    >
      <div className={`${BAND} flex flex-wrap items-center justify-between gap-4 border-2 !pt-6`}>
        <div className="flex min-w-0 items-center gap-5">
          <LotTag number={receipt.lotNumber} tone="papel" />
          <p className="min-w-0 text-[32px] font-bold uppercase leading-none [overflow-wrap:anywhere]">{car.title}</p>
        </div>
        <Stamp variant="arrematado" />
      </div>
      <Perforation />
      <dl className={`${BAND} m-0 border-x-2`}>
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
      <div className={`${BAND} space-y-4 border-2 border-t-0`}>
        <div>
          <p className="t-mono-rotulo">{RECEIPT_TEXT.hashLabel}</p>
          <p className="mt-1 select-all text-[15px] leading-[1.5] [overflow-wrap:anywhere]">{receipt.finalHash}</p>
          <Link href={receipt.auditUrl} className="t-body-nota mt-1 inline-flex min-h-alvo items-center underline underline-offset-4">
            {AUDIT_TEXT.verifyOnAudit}
          </Link>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="t-mono-rotulo">Nº do comprovante</p>
            <p className="text-[22px] font-semibold">{receipt.receiptCode}</p>
          </div>
          <div className="min-w-[160px] flex-1">
            <CodigoDeBarras hash={receipt.finalHash} />
          </div>
        </div>
      </div>
    </article>
  );
}
