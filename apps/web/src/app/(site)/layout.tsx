import { Suspense, type ReactNode } from "react";
import { AvisoPapel } from "@/components/aviso-papel";
import { SiteHeader } from "@/components/site-header";

/** Páginas do app: cabeçalho completo (navegação, saldo, perfil) e o aviso de papel errado. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo">
        <Suspense fallback={null}>
          <AvisoPapel />
        </Suspense>
        {children}
      </main>
    </>
  );
}
