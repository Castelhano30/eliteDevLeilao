"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  EVENTS,
  type BidPlacedPayload,
  type LotCancelledPayload,
  type LotClosedPayload,
  type LotEvent,
  type LotJoinAck,
  type LotState,
} from "@lanceauto/shared";
import { lotKey } from "../lot-query";
import { clockMark, syncServerTime } from "../server-clock";
import { getSocket } from "../socket";
import { markSynced } from "./connection-status";
import { applyLotEvent } from "./lot-reducer";

const ACK_TIMEOUT_MS = 8_000;
const RETRY_MS = 3_000;

/**
 * Entra na sala `lot:{id}` e mantém o cache `["lot", id]` vivo com os eventos (S04 §7, §9.1).
 *
 * - `lot:join` no mount (se já conectado) e a cada `connect`: o `SocketProvider` é singleton, então a Sala monta
 *   depois de o socket conectar e o `connect` não dispara de novo.
 * - Depois do ack, `GET /lots/:id`. Só então a conexão vale como `live` (R-4.8): entrar na sala primeiro evita
 *   buraco entre o snapshot e os eventos. O snapshot não passa por cima de um cache mais novo (`mergeSnapshot`, no
 *   `queryFn` da Sala).
 * - Evento de outro lote é ignorado; salto de `version` refaz o `GET` e deixa o botão de lance inerte até aplicar.
 * - `lot:leave` ao sair. Falha de ack ou de `GET` tenta de novo em 3 s enquanto conectado.
 *
 * Devolve `syncing`: há um refetch por salto em andamento (a Sala trata como desatualizada).
 */
export function useLotRoom(lotId: string, { enabled = true }: { enabled?: boolean } = {}): { syncing: boolean } {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    const key = lotKey(lotId);
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    /** Refaz o `GET` e diz se deu certo (o `refetchQueries` engole o erro; o estado da consulta diz). */
    const refetchSnapshot = async (): Promise<boolean> => {
      await queryClient.refetchQueries({ queryKey: key, exact: true });
      return queryClient.getQueryState(key)?.status === "success";
    };

    const scheduleRetry = () => {
      clearTimeout(retry);
      retry = setTimeout(joinAndSync, RETRY_MS);
    };

    function joinAndSync() {
      if (disposed || !socket.connected) return;
      clearTimeout(retry);
      const sentAt = clockMark();
      socket.timeout(ACK_TIMEOUT_MS).emit(EVENTS.LOT_JOIN, { lotId }, (error: Error | null, ack?: LotJoinAck) => {
        if (disposed || !socket.connected) return;
        if (error || !ack) return scheduleRetry();
        // Lote que não existe: a Sala já mostra o 404 pelo HTTP; não há o que sincronizar.
        if (!ack.ok) return ack.error.code === "NOT_FOUND" ? undefined : scheduleRetry();
        // O ack é resposta da conexão: acerta o relógio como qualquer resposta HTTP (R-4.10).
        syncServerTime(ack.lot.serverTime, { sentAt, receivedAt: clockMark() });
        void refetchSnapshot().then((ok) => {
          if (disposed) return;
          if (ok) markSynced();
          else scheduleRetry();
        });
      });
    }

    const handle = (event: LotEvent) => {
      if (event.payload.lotId !== lotId) return;
      const cache = queryClient.getQueryData<LotState>(key);
      if (!cache) return;
      const result = applyLotEvent(cache, event);
      if (result.action === "applied") {
        queryClient.setQueryData(key, result.state);
      } else if (result.action === "refetch") {
        setPending((n) => n + 1);
        void refetchSnapshot().finally(() => {
          if (!disposed) setPending((n) => Math.max(0, n - 1));
        });
      }
    };
    const onBid = (payload: BidPlacedPayload) => handle({ type: EVENTS.BID_PLACED, payload });
    const onClosed = (payload: LotClosedPayload) => handle({ type: EVENTS.LOT_CLOSED, payload });
    const onCancelled = (payload: LotCancelledPayload) => handle({ type: EVENTS.LOT_CANCELLED, payload });

    socket.on(EVENTS.BID_PLACED, onBid);
    socket.on(EVENTS.LOT_CLOSED, onClosed);
    socket.on(EVENTS.LOT_CANCELLED, onCancelled);
    socket.on("connect", joinAndSync);
    joinAndSync();

    return () => {
      disposed = true;
      clearTimeout(retry);
      socket.off(EVENTS.BID_PLACED, onBid);
      socket.off(EVENTS.LOT_CLOSED, onClosed);
      socket.off(EVENTS.LOT_CANCELLED, onCancelled);
      socket.off("connect", joinAndSync);
      if (socket.connected) socket.emit(EVENTS.LOT_LEAVE, { lotId });
    };
  }, [lotId, enabled, queryClient]);

  return { syncing: pending > 0 };
}
