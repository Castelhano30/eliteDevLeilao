import type { ReactNode } from "react";
import { AUDIT_TEXT } from "@lanceauto/shared";
import { PublicHeader } from "@/components/public-header";

/** Auditoria pública: cabeçalho mínimo (logo e a legenda), igual para quem está logado ou não (S08 §9). */
export default function AuditLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader legend={AUDIT_TEXT.legend} />
      <main id="conteudo">{children}</main>
    </>
  );
}
