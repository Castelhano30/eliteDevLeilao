import { notFound } from "next/navigation";
import type { ReceiptDTO } from "@lanceauto/shared";
import { Comprovante } from "@/components/comprovante/comprovante";
import { serverGet } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata = { title: "Comprovante de arremate · LanceAuto", robots: "noindex" };

/**
 * Comprovante público (§9.2). O servidor chama `GET /receipts/:token` sem token de usuário (timeout de 8 s no
 * `serverGet`). 404 só quando a API respondeu 404; rede caída, timeout ou resposta estranha saem sem dados e o
 * cliente refaz o pedido, com "Tentar novamente".
 */
export default async function ComprovantePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await serverGet<ReceiptDTO | null>(`/receipts/${encodeURIComponent(token)}`);
  if (result?.status === 404) notFound();
  const receipt = result?.status === 200 && result.data?.receiptCode ? result.data : undefined;
  return <Comprovante token={token} initial={receipt} />;
}
