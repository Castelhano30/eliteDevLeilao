"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { formatBRL, type MeResponse, type WalletDto } from "@lanceauto/shared";
import { readBalanceHidden, setBalanceHidden, subscribeBalanceVisibility } from "../lib/balance-visibility";
import { HeaderIcon } from "./ui/header-icon";
import { fetchMe, WALLET_SUMMARY_KEY } from "./auth-provider";

/** Saldo do licitante: lê ["wallet","summary"], semeado pelo GET /me e atualizado pelo depósito (T7). */
export function useWalletSummary() {
  return useQuery<WalletDto>({
    queryKey: WALLET_SUMMARY_KEY,
    queryFn: async () => ((await fetchMe()) satisfies MeResponse).wallet,
    staleTime: 5_000,
  });
}

/** Chip "DISPONÍVEL R$ X" do cabeçalho: link para a Carteira. Só para licitante. */
export function BalanceChip() {
  const { data } = useWalletSummary();
  // Servidor e primeiro render sempre mascarados: nenhum saldo vaza antes da leitura da preferência.
  const hidden = useSyncExternalStore(subscribeBalanceVisibility, readBalanceHidden, () => true);
  const value = hidden ? "••••••" : data ? formatBRL(data.availableCents) : "R$ …";
  return (
    <div className="balance-control flex min-w-0 items-center gap-2">
    <Link
      href="/carteira"
      aria-label={hidden ? "Saldo oculto, ir para a carteira" : data ? `Saldo disponível ${value}, ir para a carteira` : "Saldo disponível, ir para a carteira"}
      className="t-mono-dado flex min-h-[44px] min-w-0 items-center gap-2 rounded-[14px] border border-linha bg-papel px-2 !text-tinta sm:min-h-[48px] sm:gap-3 sm:px-3 no-underline hover:border-[var(--h-azul)]"
    >
      <span className="shrink-0 text-[var(--h-azul)]"><HeaderIcon name="wallet" size={24} /></span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-[11px] uppercase tracking-[0.1em] text-tinta2">Disponível</span>
        <span className="balance-value text-[16px] font-extrabold tabular-nums">{value}</span>
      </span>
    </Link>
    <button type="button" aria-label={hidden ? "Mostrar saldo" : "Ocultar saldo"} onClick={() => setBalanceHidden(!hidden)} className="inline-flex h-11 min-w-[44px] shrink-0 items-center sm:h-12 sm:min-w-[48px] justify-center rounded-full border border-linha bg-papel text-tinta hover:bg-suave">
      <HeaderIcon name={hidden ? "eye-off" : "eye"} />
    </button>
    </div>
  );
}
