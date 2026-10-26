import { EVENTS, computeMyStanding, type LotEvent, type LotState, type PlaceBidResponse } from "@lanceauto/shared";

/** O que o evento fez ao estado: aplicou, descartou, ou o estado não basta e é preciso refazer o `GET`. */
export type LotAction = "applied" | "ignored" | "refetch";

export interface LotReduction {
  state: LotState;
  action: LotAction;
}

const TERMINAL = new Set<LotState["lot"]["status"]>(["SOLD", "UNSOLD", "CANCELLED"]);

const laterOf = (a: string, b: string) => (Date.parse(b) > Date.parse(a) ? b : a);

/**
 * Reducer único do estado da Sala (R-4.14), puro. Lê só `version` (T4):
 * - `bid:placed`: aplica se `version == atual + 1`; descarta se `<= atual` (a resposta do próprio lance chega por
 *   REST e por evento, sem duplicar linha); com salto (`> atual + 1`) não aplica e pede o `GET` (R-4.6).
 * - `lot:closed`: terminal e idempotente. O fechamento não incrementa `entryCount`, então vale `>=` (R-4.7, C10);
 *   `version` à frente do estado é salto e pede o `GET`.
 * - `lot:cancelled`: o payload não traz `cancelledAt`, então até o `version` seguinte pede o `GET` em vez de
 *   presumir o estado (R-4.6).
 * Evento de outro lote é ignorado. O `serverTime` do estado só avança (evento atrasado não o faz voltar).
 */
export function applyLotEvent(state: LotState, event: LotEvent): LotReduction {
  const { lot } = state;
  const ignored: LotReduction = { state, action: "ignored" };
  const refetch: LotReduction = { state, action: "refetch" };
  if (event.payload.lotId !== lot.id) return ignored;
  const { version } = event.payload;

  switch (event.type) {
    case EVENTS.BID_PLACED: {
      if (version <= lot.version) return ignored;
      if (version > lot.version + 1) return refetch;
      const { payload } = event;
      const bids = [payload.bid, ...state.bids.filter((bid) => bid.seq !== payload.bid.seq)].sort((a, b) => b.seq - a.seq);
      const standing = computeMyStanding(bids, lot.myPseudonym);
      return {
        action: "applied",
        state: {
          ...state,
          serverTime: laterOf(state.serverTime, payload.serverTime),
          lot: {
            ...lot,
            // Um lance aceito prova que o lote está ao vivo agora (agendado que abriu, apurando que foi prorrogado).
            status: TERMINAL.has(lot.status) ? lot.status : "LIVE",
            currentBidCents: payload.currentBidCents,
            minimumBidCents: payload.minimumBidCents,
            bidCount: payload.bidCount,
            bidderCount: payload.bidderCount,
            version,
            entryCount: version,
            endsAt: payload.endsAt,
            myRank: standing?.myRank ?? null,
            myBestBidCents: standing?.myBestBidCents ?? null,
          },
          bids,
        },
      };
    }
    case EVENTS.LOT_CLOSED: {
      if (version < lot.version) return ignored;
      if (version > lot.version) return refetch;
      const { payload } = event;
      return {
        action: "applied",
        state: {
          ...state,
          serverTime: laterOf(state.serverTime, payload.serverTime),
          lot: { ...lot, status: payload.outcome, currentBidCents: payload.finalBidCents ?? lot.currentBidCents },
        },
      };
    }
    case EVENTS.LOT_CANCELLED:
      return version <= lot.version ? ignored : refetch;
  }
}

/**
 * O `lot:closed` não leva `result` nem token: depois de aplicado, o cliente refaz o `GET /lots/:id` para obtê-los
 * (S05 §7). Evento descartado ou que já pediu o `GET` por salto de versão não repete o pedido.
 */
export function needsResultSnapshot(event: LotEvent, action: LotAction): boolean {
  return event.type === EVENTS.LOT_CLOSED && action === "applied";
}

/**
 * Resposta do próprio `POST` de lance, pelo mesmo reducer. Aplicada, fica com a posição que o servidor calculou
 * (a de `computeMyStanding` é só aproximação). `ignored` quando um evento ou um `GET` já trouxe essa versão.
 */
export function applyBidResponse(state: LotState, response: PlaceBidResponse): LotReduction {
  const { lot, bid } = response;
  const result = applyLotEvent(state, {
    type: EVENTS.BID_PLACED,
    payload: {
      lotId: lot.id,
      version: lot.version,
      bid,
      currentBidCents: lot.currentBidCents ?? bid.amountCents,
      minimumBidCents: lot.minimumBidCents,
      bidCount: lot.bidCount,
      bidderCount: lot.bidderCount,
      endsAt: lot.endsAt,
      // O reducer não lê `extended`: a Sala deriva "prorrogado" de `endsAt > originalEndsAt`.
      extended: lot.extended,
      serverTime: response.serverTime,
    },
  });
  if (result.action !== "applied") return result;
  return {
    action: "applied",
    state: {
      ...result.state,
      lot: {
        ...result.state.lot,
        myRank: lot.myRank,
        myBestBidCents: lot.myBestBidCents,
        myPseudonym: lot.myPseudonym ?? result.state.lot.myPseudonym,
      },
    },
  };
}

/**
 * O `GET` só substitui o cache se `snapshot.version >= cache.version` (R-4.8): um evento que chegou entre o
 * `lot:join` e a resposta já levou o cache além do snapshot. Na mesma versão o snapshot vale (traz o status e o
 * `serverTime` mais novos), salvo se o cache já fechou o lote (`lot:closed`) e o snapshot é de antes do fechamento.
 */
export function mergeSnapshot(cache: LotState | undefined, snapshot: LotState): LotState {
  if (!cache) return snapshot;
  if (snapshot.lot.version < cache.lot.version) return cache;
  const closed = cache.lot.status === "SOLD" || cache.lot.status === "UNSOLD";
  if (snapshot.lot.version === cache.lot.version && closed && !TERMINAL.has(snapshot.lot.status)) return cache;
  return snapshot;
}
