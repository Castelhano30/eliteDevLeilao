import { Suspense } from "react";
import { PainelScreen } from "@/components/painel-screen";
import { RequireAuth } from "@/components/require-auth";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageShell } from "@/components/ui/page-shell";

export const metadata = { title: "Painel · LanceAuto" };

export default function PainelPage() {
  return (
    <RequireAuth role="AUCTIONEER">
      <Suspense
        fallback={
          <PageShell>
            <FeedbackState variant="carregando" />
          </PageShell>
        }
      >
        <PainelScreen />
      </Suspense>
    </RequireAuth>
  );
}
