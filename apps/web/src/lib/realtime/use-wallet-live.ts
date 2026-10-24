"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { EVENTS, type WalletDto, type WalletUpdatedPayload } from "@lanceauto/shared";
import { WALLET_LEDGER_KEY, WALLET_SUMMARY_KEY } from "@/components/auth-provider";
import { getSocket } from "../socket";

/** Linha nova do extrato e `leadingLots` chegam por consulta; rajadas de eventos viram uma só (S04 §9.4). */
const LEDGER_DEBOUNCE_MS = 300;

/**
 * `wallet:updated` (só da própria sala `user:{id}`) escreve o saldo na mesma chave que o chip e a Carteira leem
 * (T7) e invalida o extrato. Ao reconectar, invalida todo o prefixo `["wallet"]`: pode ter passado evento. Montado
 * uma vez, na raiz, porque o chip de saldo está em todas as páginas.
 */
export function useWalletLive(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let connectedBefore = socket.connected;

    const onWallet = (payload: WalletUpdatedPayload) => {
      const wallet: WalletDto = {
        totalCents: payload.totalCents,
        committedCents: payload.committedCents,
        availableCents: payload.availableCents,
      };
      queryClient.setQueryData(WALLET_SUMMARY_KEY, wallet);
      clearTimeout(debounce);
      debounce = setTimeout(() => void queryClient.invalidateQueries({ queryKey: WALLET_LEDGER_KEY }), LEDGER_DEBOUNCE_MS);
    };
    const onConnect = () => {
      // A primeira conexão não perdeu nada; as seguintes (queda, login, logout) podem ter perdido.
      if (connectedBefore) void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      connectedBefore = true;
    };

    socket.on(EVENTS.WALLET_UPDATED, onWallet);
    socket.on("connect", onConnect);
    return () => {
      clearTimeout(debounce);
      socket.off(EVENTS.WALLET_UPDATED, onWallet);
      socket.off("connect", onConnect);
    };
  }, [queryClient]);
}
