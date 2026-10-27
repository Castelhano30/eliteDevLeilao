"use client";

import { GlobalError } from "@/components/global-states";
import { PublicHeader } from "@/components/public-header";

/** Fronteira de erro global. O cabeçalho é o mínimo: se o defeito estiver no cabeçalho completo, ele não repete. */
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PublicHeader legend="ERRO INESPERADO" />
      <main id="conteudo">
        <GlobalError onRetry={reset} />
      </main>
    </>
  );
}
