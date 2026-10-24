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
    <div className="balance-control flex min-w-0 items-center gap-1">
    <Link
      href="/carteira"
      aria-label={hidden ? "Saldo oculto, ir para a carteira" : data ? `Saldo disponível ${value}, ir para a carteira` : "Saldo disponível, ir para a carteira"}
      className="t-mono-dado flex min-h-alvo min-w-0 flex-col justify-center px-1 text-tinta no-underline"
    >
      <span className="text-[12px] uppercase tracking-[0.08em] text-tinta2">Disponível</span>
      <span className="balance-value font-semibold tabular-nums">{value}</span>
    </Link>
    <button type="button" aria-label={hidden ? "Mostrar saldo" : "Ocultar saldo"} onClick={() => setBalanceHidden(!hidden)} className="inline-flex min-h-alvo min-w-[44px] shrink-0 items-center justify-center rounded-full hover:bg-suave">
      <HeaderIcon name={hidden ? "eye-off" : "eye"} />
    </button>
    </div>
  );
}
