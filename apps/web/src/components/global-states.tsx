import Link from "next/link";
import { GLOBAL_TEXT } from "@lanceauto/shared";
import { buttonClasses } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageShell } from "@/components/ui/page-shell";

/** Rota inexistente (`app/not-found.tsx`). */
export function GlobalNotFound() {
  return (
    <PageShell>
      <div className="max-w-[640px] space-y-4">
        <h1 className="t-display-titulo">{GLOBAL_TEXT.notFoundTitle}</h1>
        <FeedbackState variant="vazio">{GLOBAL_TEXT.notFoundBody}</FeedbackState>
        <Link href="/" className={buttonClasses("secundario")}>
          {GLOBAL_TEXT.backToShowcase}
        </Link>
      </div>
    </PageShell>
  );
}

/** Erro inesperado de renderização (`app/error.tsx`): o botão tenta renderizar de novo. */
export function GlobalError({ onRetry }: { onRetry: () => void }) {
  return (
    <PageShell>
      <div className="max-w-[640px] space-y-4">
        <h1 className="t-display-titulo">{GLOBAL_TEXT.errorTitle}</h1>
        <FeedbackState variant="erro" onRetry={onRetry}>
          {GLOBAL_TEXT.errorBody}
        </FeedbackState>
        <Link href="/" className={buttonClasses("secundario")}>
          {GLOBAL_TEXT.backToShowcase}
        </Link>
      </div>
    </PageShell>
  );
}
