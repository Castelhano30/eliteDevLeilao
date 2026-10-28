"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { Button, buttonClasses } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageShell } from "@/components/ui/page-shell";
import { RefusalMessage } from "@/components/ui/refusal-message";
import { apiGet, apiPost } from "@/lib/api-client";
import { lotNumberLabel } from "@/lib/format";
import { anchorId } from "@/lib/my-bids-events";
import { maskReais } from "@/lib/money-mask";
import { DepositConfirmDialog } from "./deposit-confirm-dialog";
import { ExtratoCarteira } from "./extrato-carteira";
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
  const card = "min-w-0 flex-1 rounded-2xl border border-borda bg-papel p-5 shadow-cartao";
  const glyph = "self-center text-center text-[32px] font-extrabold leading-none";
  return (
    <div className="flex flex-col gap-3 lg:flex-row" role="group" aria-label="Saldo">
      <div className={card}>
        <p className="t-mono-rotulo mb-2">Total</p>
        <p className="text-[22px] break-all font-extrabold tabular-nums" aria-label={total === undefined ? undefined : show(total)}>
          {show(total)}
        </p>
      </div>
      <span aria-hidden="true" className={glyph}>
        −
      </span>
      <div className={card}>
        <p className="t-mono-rotulo mb-2">Comprometido</p>
        <p className="text-[22px] break-all font-extrabold tabular-nums">{show(committed)}</p>
      </div>
      <span aria-hidden="true" className={glyph}>
        =
      </span>
      <div className={`${card} cartao-disponivel`}>
        <p className="t-mono-rotulo mb-2">Disponível</p>
        <p className="text-[32px] break-all font-extrabold leading-[1.1] tabular-nums">{show(available)}</p>
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

  // Os atalhos (R$ 10 mil…) preenchem o próprio campo: há um só valor, o que está no input.
  const [custom, setCustom] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const cents = custom === "" ? null : parseReais(custom);
  const validAmount = cents !== null && cents >= 100 && cents <= MAX_DEPOSIT_CENTS;

  // O botão da página só abre a confirmação; o depósito é gravado quando a pessoa confirma no diálogo.
  function askConfirmation() {
    if (!validAmount) {
      setError(DEPOSIT_AMOUNT_MESSAGE);
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function deposit() {
    if (sending || !validAmount || cents === null) return;
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
    setConfirming(false);
    setCustom("");
    setAnnouncement(
      `Depósito de ${formatBRL(result.data.entry.amountCents)} feito. Disponível agora: ${formatBRL(result.data.wallet.availableCents)}.`,
    );
  }

  // O extrato é filtrado e paginado na tela (ExtratoCarteira): a API entrega de 50 em 50, então as páginas seguintes vêm até acabar.
  // Falha numa delas (`isError`) para a busca; "Tentar novamente" refaz.
  const { hasNextPage, isFetchingNextPage, isError: ledgerFailed, fetchNextPage } = ledger;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !ledgerFailed) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, ledgerFailed, fetchNextPage]);
  const entries: LedgerEntryDto[] = ledger.data?.pages.flatMap((page) => page.entries) ?? [];
  const leadingLots = ledger.data?.pages[0]?.leadingLots ?? [];
  const wallet = summary.data;

  return (
    <PageShell>
      <h1 className="mb-6 font-extrabold uppercase [overflow-wrap:anywhere]" style={{ fontSize: "clamp(30px, 3.6vw, 48px)", lineHeight: 1 }}>
        Carteira
      </h1>

      <section aria-label="Saldo" className="mb-10 space-y-4">
        {summary.isPending ? (
          <FeedbackState variant="carregando">Carregando…</FeedbackState>
        ) : (
          <Equation total={wallet?.totalCents} committed={wallet?.committedCents} available={wallet?.availableCents} />
        )}
        <div className="rounded-2xl border border-borda bg-papel p-4">
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

      <section aria-labelledby="depositar" className="mb-10 max-w-[640px]">
        <h2 id="depositar" className="mb-4 font-extrabold uppercase leading-none" style={{ fontSize: "clamp(22px, 2.4vw, 30px)" }}>
          Depositar
        </h2>
        <div className="mb-4 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2" role="group" aria-label="Valores rápidos">
          {QUICK_AMOUNTS.map((option) => {
            const pressed = cents === option.cents;
            return (
              <button
                key={option.cents}
                type="button"
                aria-pressed={pressed}
                onClick={() => {
                  setCustom(maskReais(String(option.cents / 100)).value);
                  setError(null);
                }}
                className={`${buttonClasses("atalho")} w-full whitespace-nowrap !px-2 !text-[14px]`}
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
            setError(null);
          }}
          invalid={error !== null}
          disabled={sending}
        />
        <div className="mt-4 space-y-3">
          {error && !confirming ? <RefusalMessage>{error}</RefusalMessage> : null}
          <Button variant="primario" onClick={askConfirmation}>
            {validAmount && cents !== null ? `Depositar ${formatBRL(cents)}` : "Depositar"}
          </Button>
        </div>
        <DepositConfirmDialog
          open={confirming}
          cents={validAmount ? cents : null}
          availableCents={wallet?.availableCents}
          sending={sending}
          error={error}
          onConfirm={() => void deposit()}
          onClose={() => setConfirming(false)}
        />
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </section>

      <section aria-labelledby="extrato">
        <h2 id="extrato" className="mb-4 font-extrabold uppercase leading-none" style={{ fontSize: "clamp(22px, 2.4vw, 30px)" }}>
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
          <ExtratoCarteira entries={entries} />
        )}
      </section>
    </PageShell>
  );
}
