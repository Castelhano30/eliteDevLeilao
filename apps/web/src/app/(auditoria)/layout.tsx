import type { ReactNode } from "react";
import { AUDIT_TEXT } from "@lanceauto/shared";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";

/** Auditoria pública: cabeçalho mínimo (logo e a legenda), igual para quem está logado ou não (S08 §9), e o rodapé mínimo. */
export default function AuditLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader legend={AUDIT_TEXT.legend} />
      <main id="conteudo" className="flex-1">{children}</main>
      <SiteFooter variant="minimo" />
    </>
  );
}
