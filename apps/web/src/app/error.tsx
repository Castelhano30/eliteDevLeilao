"use client";

import { GlobalError } from "@/components/global-states";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";

/** Fronteira de erro global. Cabeçalho e rodapé são os mínimos: se o defeito estiver nos completos (que leem a sessão), eles não repetem. */
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PublicHeader legend="ERRO INESPERADO" />
      <main id="conteudo" className="flex-1">
        <GlobalError onRetry={reset} />
      </main>
      <SiteFooter variant="minimo" />
    </>
  );
}
