import { RequireAuth } from "@/components/require-auth";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageShell } from "@/components/ui/page-shell";

export const metadata = { title: "Painel · LanceAuto" };

/** Stub protegido: a S02 troca pelo Painel real. */
export default function PainelPage() {
  return (
    <RequireAuth role="AUCTIONEER">
      <PageShell title="Painel">
        <FeedbackState variant="vazio">Painel chega na próxima fatia.</FeedbackState>
      </PageShell>
    </RequireAuth>
  );
}
