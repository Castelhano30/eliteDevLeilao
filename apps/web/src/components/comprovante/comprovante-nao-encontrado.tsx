import Link from "next/link";
import { RECEIPT_TEXT } from "@lanceauto/shared";
import { buttonClasses } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageShell } from "@/components/ui/page-shell";

/** 404 do comprovante (§9.2). Não ecoa o token. */
export function ComprovanteNaoEncontrado() {
  return (
    <PageShell width="comprovante">
      <div className="max-w-[640px] space-y-4">
        <h1 className="t-display-titulo">{RECEIPT_TEXT.notFoundTitle}</h1>
        <FeedbackState variant="vazio">{RECEIPT_TEXT.notFoundBody}</FeedbackState>
        <Link href="/" className={buttonClasses("secundario")}>
          {RECEIPT_TEXT.backToShowcase}
        </Link>
      </div>
    </PageShell>
  );
}
