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

/** Olho que mostra ou oculta o saldo (preferência guardada no navegador); no celular ele mora no menu. */
export function BalanceEyeButton({ className = "" }: { className?: string }) {
  const hidden = useSyncExternalStore(subscribeBalanceVisibility, readBalanceHidden, () => true);
  return (
    <button type="button" aria-label={hidden ? "Mostrar saldo" : "Ocultar saldo"} onClick={() => setBalanceHidden(!hidden)} className={`inline-flex h-11 min-w-[44px] shrink-0 items-center sm:h-12 sm:min-w-[48px] justify-center rounded-full border border-linha bg-papel text-tinta hover:bg-suave ${className}`}>
      <HeaderIcon name={hidden ? "eye-off" : "eye"} />
    </button>
  );
}

/**
 * Chip "DISPONÍVEL R$ X" do cabeçalho: link para a Carteira. Só para licitante.
 * `barra` é a versão da barra do celular: sem o olho (ele vai para o menu), mais baixa e com a área de toque estendida a 44px.
 */
export function BalanceChip({ barra = false }: { barra?: boolean }) {
  const { data } = useWalletSummary();
  // Servidor e primeiro render sempre mascarados: nenhum saldo vaza antes da leitura da preferência.
  const hidden = useSyncExternalStore(subscribeBalanceVisibility, readBalanceHidden, () => true);
  const value = hidden ? "••••••" : data ? formatBRL(data.availableCents) : "R$ …";
  const aria = hidden ? "Saldo oculto, ir para a carteira" : data ? `Saldo disponível ${value}, ir para a carteira` : "Saldo disponível, ir para a carteira";
  if (barra) {
    return (
      <Link
        href="/carteira"
        aria-label={aria}
        className="t-mono-dado relative flex min-h-9 min-w-0 items-center gap-1.5 rounded-xl border border-linha bg-papel px-2 !text-tinta no-underline before:absolute before:-inset-y-[5px] before:inset-x-0 before:content-[''] hover:border-[var(--h-azul)]"
      >
        {/* Em 320px o ícone não cabe ao lado do logo e do menu; o rótulo "Disponível" já diz o que é. */}
        <span className="shrink-0 text-[var(--h-azul)] max-[359px]:hidden"><HeaderIcon name="wallet" size={18} /></span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-[9px] uppercase tracking-[0.1em] text-tinta2">Disponível</span>
          <span className="min-w-0 break-all text-[14px] font-extrabold tabular-nums text-[var(--h-valor)]">{value}</span>
        </span>
      </Link>
    );
  }
  return (
    <div className="balance-control flex min-w-0 items-center gap-2">
    <Link
      href="/carteira"
      aria-label={aria}
      className="t-mono-dado flex min-h-[44px] min-w-0 items-center gap-2 rounded-[14px] border border-linha bg-papel px-2 !text-tinta sm:min-h-[48px] sm:gap-3 sm:px-3 no-underline hover:border-[var(--h-azul)]"
    >
      <span className="shrink-0 text-[var(--h-azul)]"><HeaderIcon name="wallet" size={24} /></span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-[11px] uppercase tracking-[0.1em] text-tinta2">Disponível</span>
        <span className="balance-value text-[16px] font-extrabold tabular-nums text-[var(--h-valor)]">{value}</span>
      </span>
    </Link>
    <BalanceEyeButton />
    </div>
  );
}
