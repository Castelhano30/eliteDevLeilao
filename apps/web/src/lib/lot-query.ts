import { LOT_TEXT, type LotState } from "@lanceauto/shared";
import { apiGet } from "./api-client";

export const lotKey = (id: string) => ["lot", id] as const;

/** Lotes do leiloeiro (Painel); o tempo real atualiza as linhas pelo `showcase:lot`. */
export const MY_LOTS_KEY = ["my-lots"] as const;

export class LotNotFoundError extends Error {}

/** `GET /lots/:id`. Com token, o servidor devolve também o pseudônimo e a posição de quem olha. */
export async function fetchLot(id: string, signal?: AbortSignal): Promise<LotState> {
  const result = await apiGet<LotState>(`/lots/${encodeURIComponent(id)}`, { signal });
  if (result.ok) return result.data;
  if (result.status === 404) throw new LotNotFoundError(LOT_TEXT.notFoundTitle);
  throw new Error("Não consegui trazer o lote.");
}

/** Meus arremates (`GET /me/bids`); `showcase:lot`, `wallet:updated` e a reconexão refazem a consulta. */
export const MY_BIDS_KEY = ["me", "bids"] as const;
