import { Suspense, type ReactNode } from "react";
import { AvisoPapel } from "@/components/aviso-papel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** Páginas do app: cabeçalho completo (navegação, saldo, perfil), o aviso de papel errado e o rodapé completo, inclusive na Sala de lances. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="flex-1">
        <Suspense fallback={null}>
          <AvisoPapel />
        </Suspense>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
