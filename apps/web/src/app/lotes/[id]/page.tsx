import type { LotState } from "@lanceauto/shared";
import { Sala } from "@/components/sala";
import { serverGet } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await serverGet<LotState>(`/lots/${encodeURIComponent(id)}`);
  return { title: result?.status === 200 ? `${result.data.lot.title} · LanceAuto` : "Lote · LanceAuto" };
}

/** Sala do lote (§9.2): SSR de `GET /lots/:id` sem token; o cliente hidrata e refaz o GET nos limites. */
export default async function SalaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await serverGet<LotState>(`/lots/${encodeURIComponent(id)}`);
  return <Sala id={id} initial={result?.status === 200 ? result.data : undefined} notFound={result?.status === 404} />;
}
