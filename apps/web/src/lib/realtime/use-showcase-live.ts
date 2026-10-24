"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";
import { EVENTS, type LotListResponse, type MyLotsResponse, type ShowcaseLotPayload } from "@lanceauto/shared";
import { MY_LOTS_KEY } from "../lot-query";
import { getSocket } from "../socket";
import type { VitrineFilters } from "../vitrine-query";
import { markSynced } from "./connection-status";
import { isFiltered, upsertMyLot, upsertShowcaseCard } from "./showcase-cache";

const RETRY_MS = 3_000;
/** Lote novo com filtro ativo: o servidor decide se casa; agrupa rajadas numa só consulta. */
const INVALIDATE_DEBOUNCE_MS = 500;

export const SHOWCASE_LISTS_KEY = ["lots"] as const;

/**
 * Entra na sala `showcase` e aplica `showcase:lot` nas listas em cache (S04 §9.2, §9.3).
 *
 * `refetchKey` é a consulta da página (`["lots"]` na Vitrine, `["my-lots"]` no Painel): a cada `connect` entra na
 * sala e refaz essa consulta, e só depois a conexão vale como `live`. Eventos aplicam em todas as listas da Vitrine
 * que estiverem em cache (cada combinação de busca/marca/aba é uma) e na do Painel; id desconhecido num filtro vira
 * invalidação com debounce.
 */
export function useShowcaseLive(refetchKey: QueryKey): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const refetchPage = async (): Promise<boolean> => {
      await queryClient.refetchQueries({ queryKey: refetchKey, type: "active" });
      return queryClient.getQueryCache().findAll({ queryKey: refetchKey, type: "active" }).every((query) => query.state.status !== "error");
    };

    const joinAndSync = () => {
      if (disposed || !socket.connected) return;
      clearTimeout(retry);
      socket.emit(EVENTS.SHOWCASE_JOIN);
      void refetchPage().then((ok) => {
        if (disposed) return;
        if (ok) markSynced();
        else retry = setTimeout(joinAndSync, RETRY_MS);
      });
    };

    const invalidateLists = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void queryClient.invalidateQueries({ queryKey: SHOWCASE_LISTS_KEY }), INVALIDATE_DEBOUNCE_MS);
    };

    const onShowcaseLot = ({ serverTime: _serverTime, ...card }: ShowcaseLotPayload) => {
      let invalidate = false;
      for (const [key, data] of queryClient.getQueriesData<LotListResponse>({ queryKey: SHOWCASE_LISTS_KEY })) {
        if (!data) continue;
        const filters = key[1] as VitrineFilters;
        const result = upsertShowcaseCard(data, card, isFiltered(filters));
        if (result.data !== data) queryClient.setQueryData(key, result.data);
        invalidate ||= result.invalidate;
      }
      if (invalidate) invalidateLists();

      const mine = queryClient.getQueryData<MyLotsResponse>(MY_LOTS_KEY);
      if (mine) {
        const result = upsertMyLot(mine, card);
        if (result.data !== mine) queryClient.setQueryData(MY_LOTS_KEY, result.data);
        if (result.refetch) void queryClient.invalidateQueries({ queryKey: MY_LOTS_KEY });
      }
    };

    socket.on(EVENTS.SHOWCASE_LOT, onShowcaseLot);
    socket.on("connect", joinAndSync);
    joinAndSync();

    return () => {
      disposed = true;
      clearTimeout(retry);
      clearTimeout(debounce);
      socket.off(EVENTS.SHOWCASE_LOT, onShowcaseLot);
      socket.off("connect", joinAndSync);
    };
    // `refetchKey` é uma constante de módulo em cada tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);
}
