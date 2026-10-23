import { Suspense } from "react";
import { AccessScreen } from "@/components/access-screen";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageShell } from "@/components/ui/page-shell";

export const metadata = { title: "Entrar · LanceAuto" };

export default function EntrarPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <FeedbackState variant="carregando">Carregando…</FeedbackState>
        </PageShell>
      }
    >
      <AccessScreen />
    </Suspense>
  );
}
