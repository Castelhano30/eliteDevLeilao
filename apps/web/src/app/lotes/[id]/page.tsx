import { cache } from "react";
import type { LotState } from "@lanceauto/shared";
import { Sala } from "@/components/sala";
import { serverGet } from "@/lib/server-api";

export const dynamic = "force-dynamic";

/** Um só GET /lots/:id por render, compartilhado por generateMetadata e pela página. */
const loadLot = cache(async (id: string) => {
  const result = await serverGet<LotState | null>(`/lots/${encodeURIComponent(id)}`);
  // 200 com corpo que não é JSON vira null: a página sai sem dados e o cliente tenta de novo.
  const lot = result?.status === 200 && result.data?.lot ? result.data : undefined;
  return { lot, notFound: result?.status === 404 };
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lot } = await loadLot(id);
  return { title: lot ? `${lot.lot.title} · LanceAuto` : "Lote · LanceAuto" };
}

/** Sala do lote (§9.2): SSR de `GET /lots/:id` sem token; o cliente hidrata e refaz o GET nos limites. */
export default async function SalaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lot, notFound } = await loadLot(id);
  return <Sala id={id} initial={lot} notFound={notFound} />;
}
