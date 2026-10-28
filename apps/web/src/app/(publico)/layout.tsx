import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";
import { RECEIPT_TEXT } from "@lanceauto/shared";

/** Páginas públicas por link (Comprovante): cabeçalho mínimo, igual para quem está logado ou não, e o rodapé mínimo (fora da impressão). */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader legend={RECEIPT_TEXT.publicPage} />
      <main id="conteudo" className="flex-1">{children}</main>
      <SiteFooter variant="minimo" hideOnPrint />
    </>
  );
}
