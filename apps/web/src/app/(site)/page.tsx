import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import type { LotListResponse } from "@lanceauto/shared";
import { Vitrine } from "@/components/vitrine";
import { DEFAULT_FILTERS, lotsKey } from "@/lib/vitrine-query";
import { serverGet } from "@/lib/server-api";

export const dynamic = "force-dynamic";

/**
 * Vitrine (§9.1). O servidor chama `GET /lots` sem token e hidrata o TanStack Query; se falhar, a página sai sem
 * dados e o cliente tenta de novo.
 */
export default async function VitrinePage() {
  const queryClient = new QueryClient();
  const result = await serverGet<LotListResponse | null>("/lots");
  // 200 com corpo que não é JSON vira null: a página sai sem dados e o cliente tenta de novo.
  const data = result?.status === 200 && result.data && Array.isArray(result.data.lots) ? result.data : null;
  if (data) queryClient.setQueryData(lotsKey(DEFAULT_FILTERS), data);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Vitrine initialServerTime={data?.serverTime} />
    </HydrationBoundary>
  );
}
