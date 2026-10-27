"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { EVENTS, MY_BIDS_TEXT, type MyBidsResponse, type ShowcaseLotPayload } from "@lanceauto/shared";
import { apiGet } from "../api-client";
import { MY_BIDS_KEY } from "../lot-query";
import { MY_BIDS_DEBOUNCE_MS, createDebounced, decideEvent, mergeSeen, type SeenMap } from "../my-bids-events";
import { getSocket } from "../socket";
import { useShowcaseLive } from "./use-showcase-live";

async function fetchMyBids(signal?: AbortSignal): Promise<MyBidsResponse> {
  const result = await apiGet<MyBidsResponse>("/me/bids", { signal });
  if (!result.ok) throw new Error(MY_BIDS_TEXT.loadError);
  return result.data;
}

/**
 * Meus arremates (S07 §7). A lista só muda com a resposta do `GET` (INV-1): os eventos apenas mandam refazê-lo.
 * `useShowcaseLive` entra na sala `showcase` e refaz a consulta a cada `connect` (queda e volta do socket). Aqui se
 * somam dois ouvintes: `showcase:lot`, que só conta se o lote está na lista e a versão não é velha, e
 * `wallet:updated`, que cobre lance dado em outra aba, estorno e liquidação. Rajadas viram uma consulta (300 ms).
 */
export function useMyBids() {
  const queryClient = useQueryClient();
  // `gcTime: 0`: cada visita à tela é uma carga inicial; lista de cache velha não pode virar "transição" anunciada.
  const query = useQuery({ queryKey: MY_BIDS_KEY, queryFn: ({ signal }) => fetchMyBids(signal), retry: 1, gcTime: 0 });
  useShowcaseLive(MY_BIDS_KEY);

  const seen = useRef<SeenMap>(new Map());
  const data = query.data;
  useEffect(() => {
    if (data) seen.current = mergeSeen(seen.current, data.items);
  }, [data]);

  useEffect(() => {
    const socket = getSocket();
    const refetch = createDebounced(() => void queryClient.invalidateQueries({ queryKey: MY_BIDS_KEY }), MY_BIDS_DEBOUNCE_MS);

    const onLot = ({ serverTime: _serverTime, ...card }: ShowcaseLotPayload) => {
      const decision = decideEvent(seen.current, card);
      seen.current = decision.seen;
      if (decision.action === "refetch") refetch.call();
    };
    const onWallet = () => refetch.call();

    socket.on(EVENTS.SHOWCASE_LOT, onLot);
    socket.on(EVENTS.WALLET_UPDATED, onWallet);
    return () => {
      refetch.cancel();
      socket.off(EVENTS.SHOWCASE_LOT, onLot);
      socket.off(EVENTS.WALLET_UPDATED, onWallet);
    };
  }, [queryClient]);

  return query;
}
