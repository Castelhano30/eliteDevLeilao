"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatBRL, type MeResponse, type WalletDto } from "@lanceauto/shared";
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
  const value = data ? formatBRL(data.availableCents) : "R$ …";
  return (
    <Link
      href="/carteira"
      aria-label={data ? `Saldo disponível ${value}, ir para a carteira` : "Saldo disponível, ir para a carteira"}
      className="t-mono-dado inline-flex min-h-alvo items-center gap-2 rounded-nenhum border-[3px] border-linha bg-papel px-3 py-2 text-tinta no-underline"
    >
      <span className="text-[11px] uppercase tracking-[0.12em] text-tinta2">Disponível</span>
      <span className="font-semibold">{value}</span>
    </Link>
  );
}
