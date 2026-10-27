"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  AUTH_TEXT,
  DEPOSIT_AMOUNT_MESSAGE,
  formatBRL,
  MAX_DEPOSIT_CENTS,
  parseReais,
  type DepositResponse,
  type LedgerEntryDto,
  type WalletPageDto,
} from "@lanceauto/shared";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageShell } from "@/components/ui/page-shell";
import { RefusalMessage } from "@/components/ui/refusal-message";
import { apiGet, apiPost } from "@/lib/api-client";
import { describeMovement, formatWhen, lotNumberLabel } from "@/lib/format";
import { anchorId } from "@/lib/my-bids-events";
import { WALLET_LEDGER_KEY, WALLET_SUMMARY_KEY } from "./auth-provider";
import { useWalletSummary } from "./balance-chip";
import { MoneyField } from "./money-field";

const QUICK_AMOUNTS = [
  { cents: 1_000_000, label: "R$ 10 mil" },
  { cents: 5_000_000, label: "R$ 50 mil" },
  { cents: 10_000_000, label: "R$ 100 mil" },
];

async function fetchLedgerPage(cursor: string | null): Promise<WalletPageDto> {
  const path = cursor ? `/wallet?cursor=${encodeURIComponent(cursor)}` : "/wallet";
  const result = await apiGet<WalletPageDto>(path);
  if (!result.ok) throw new Error(result.error?.message ?? "Não deu para carregar o extrato.");
  return result.data;
}

function Equation({ total, committed, available }: { total?: number; committed?: number; available?: number }) {
  const show = (cents?: number) => (cents === undefined ? "R$ …" : formatBRL(cents));
  const card = "min-w-0 flex-1 rounded-nenhum border-2 border-linha bg-papel p-5";
  const glyph = "t-display-titulo self-center text-center";
  return (
    <div className="flex flex-col gap-3 lg:flex-row" role="group" aria-label="Saldo">
      <div className={card}>
        <p className="t-mono-rotulo mb-2">Total</p>
        <p className="text-[24px] break-all font-extrabold" aria-label={total === undefined ? undefined : show(total)}>
          {show(total)}
        </p>
      </div>
      <span aria-hidden="true" className={glyph}>
        −
      </span>
      <div className={card}>
        <p className="t-mono-rotulo mb-2">Comprometido</p>
        <p className="text-[24px] break-all font-extrabold">{show(committed)}</p>
      </div>
      <span aria-hidden="true" className={glyph}>
        =
      </span>
      <div className={`${card} !border-[3px]`}>
        <p className="t-mono-rotulo mb-2">Disponível</p>
        <p className="text-[24px] break-all font-extrabold">{show(available)}</p>
      </div>
    </div>
  );
}

export function WalletScreen() {
  const queryClient = useQueryClient();
  const summary = useWalletSummary();
  const ledger = useInfiniteQuery({
    queryKey: WALLET_LEDGER_KEY,
    queryFn: ({ pageParam }) => fetchLedgerPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    retry: false,
  });

  const [quick, setQuick] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const customCents = custom === "" ? null : parseReais(custom);
  const cents = quick ?? customCents;
  const validAmount = cents !== null && cents >= 100 && cents <= MAX_DEPOSIT_CENTS;

  async function deposit() {
    if (sending) return;
    if (!validAmount || cents === null) {
      setError(DEPOSIT_AMOUNT_MESSAGE);
      return;
    }
    setError(null);
    setSending(true);
    // Sem atualização otimista (INV-1): o saldo só muda depois da resposta.
    const result = await apiPost<DepositResponse>("/wallet/deposits", { amountCents: cents });
    setSending(false);
    if (!result.ok) {
      const fields = (result.error?.details as { fields?: Record<string, string> } | undefined)?.fields;
      setError(
        result.status === null || !result.error
          ? AUTH_TEXT.network
          : (fields?.amountCents ?? result.error.message),
      );
      return;
    }
    queryClient.setQueryData(WALLET_SUMMARY_KEY, result.data.wallet);
    void queryClient.invalidateQueries({ queryKey: WALLET_LEDGER_KEY });
    setQuick(null);
    setCustom("");
    setAnnouncement(
      `Depósito de ${formatBRL(result.data.entry.amountCents)} feito. Disponível agora: ${formatBRL(result.data.wallet.availableCents)}.`,
    );
  }

  const entries: LedgerEntryDto[] = ledger.data?.pages.flatMap((page) => page.entries) ?? [];
  const leadingLots = ledger.data?.pages[0]?.leadingLots ?? [];
  const wallet = summary.data;

  const columns: DataTableColumn<LedgerEntryDto>[] = [
    { key: "quando", header: "Quando", render: (row) => formatWhen(row.createdAt) },
    {
      key: "movimento",
      header: "Movimento",
      render: (row) => {
        const { label, note } = describeMovement(row);
        return (
          <>
            <span className="t-cartaz-subtitulo block">{label}</span>
            {note ? <span className="t-mono-rotulo-pequeno block">{note}</span> : null}
          </>
        );
      },
    },
    {
      key: "lote",
      header: "Lote",
      render: (row) =>
        row.lotId ? (
          <Link href={`/lotes/${row.lotId}`} className="inline-flex min-h-alvo min-w-alvo items-center">{row.lotNumber === null ? "Lote" : `Lote ${lotNumberLabel(row.lotNumber)}`}</Link>
        ) : (
          "—"
        ),
    },
    { key: "valor", header: "Valor", align: "right", render: (row) => describeMovement(row).value },
    {
      key: "disponivel",
      header: "Disponível após",
      align: "right",
      render: (row) => formatBRL(row.totalAfterCents - row.committedAfterCents),
    },
  ];

  return (
    <PageShell title="Carteira">
      <p className="t-body-lead mb-8">Dinheiro de mentira, emoção de verdade.</p>

      <section aria-label="Saldo" className="mb-8 space-y-4">
        {summary.isPending ? (
          <FeedbackState variant="carregando">Carregando…</FeedbackState>
        ) : (
          <Equation total={wallet?.totalCents} committed={wallet?.committedCents} available={wallet?.availableCents} />
        )}
        <div className="rounded-nenhum border-2 border-dashed border-tracejado bg-papel p-4">
          <p className="t-mono-rotulo mb-2">Comprometido</p>
          {leadingLots.length === 0 ? (
            <p className="t-body">Nada travado no momento.</p>
          ) : (
            <>
              <p className="t-body mb-2">Travado onde você lidera. Volta se alguém cobrir.</p>
              <ul className="space-y-1">
                {leadingLots.map((lot) => (
                  <li key={lot.lotId} className="t-mono-dado">
                    <Link
                      href={`/arremates#${anchorId(lot.number)}`}
                      aria-label={`Ver o lote ${lotNumberLabel(lot.number)}, ${lot.title}, no Meus arremates`}
                    >
                      Lote {lotNumberLabel(lot.number)} · {lot.title} · {formatBRL(lot.committedCents)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="depositar" className="mb-8 max-w-[640px]">
        <h2 id="depositar" className="t-display-secao mb-4">
          Depositar
        </h2>
        <div className="mb-4 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3" role="group" aria-label="Valores rápidos">
          {QUICK_AMOUNTS.map((option) => {
            const pressed = quick === option.cents;
            return (
              <button
                key={option.cents}
                type="button"
                aria-pressed={pressed}
                onClick={() => {
                  setQuick(option.cents);
                  setCustom("");
                  setError(null);
                }}
                className={`t-botao min-h-botao rounded-nenhum border-2 border-linha px-2 ${
                  pressed ? "bg-ocre text-sobreOcre shadow-botao" : "bg-papel text-tinta"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <MoneyField
          label="Outro valor"
          value={custom}
          onChange={(masked) => {
            setCustom(masked);
            setQuick(null);
            setError(null);
          }}
          invalid={error !== null}
          disabled={sending}
        />
        <div className="mt-4 space-y-3">
          {error ? <RefusalMessage>{error}</RefusalMessage> : null}
          <Button variant="primario" loading={sending} loadingText="Depositando…" onClick={() => void deposit()}>
            {validAmount && cents !== null ? `Depositar ${formatBRL(cents)}` : "Depositar"}
          </Button>
        </div>
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </section>

      <section aria-labelledby="extrato">
        <h2 id="extrato" className="t-display-secao mb-4">
          Extrato
        </h2>
        {ledger.isPending ? (
          <FeedbackState variant="carregando">Carregando…</FeedbackState>
        ) : ledger.isError ? (
          <FeedbackState variant="erro" onRetry={() => void ledger.refetch()}>
            Não deu para carregar o extrato.
          </FeedbackState>
        ) : entries.length === 0 ? (
          <FeedbackState variant="vazio">Nenhuma movimentação ainda.</FeedbackState>
        ) : (
          <>
            <DataTable
              caption="Extrato da carteira"
              captionHidden
              columns={columns}
              rows={entries}
              rowKey={(row) => row.id}
              minWidth={560}
            />
            {ledger.hasNextPage ? (
              <div className="mt-4">
                <Button loading={ledger.isFetchingNextPage} loadingText="Carregando…" onClick={() => void ledger.fetchNextPage()}>
                  Ver mais
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </PageShell>
  );
}
