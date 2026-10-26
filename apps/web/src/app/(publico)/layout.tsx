import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";
import { RECEIPT_TEXT } from "@lanceauto/shared";

/** Páginas públicas por link (Comprovante): cabeçalho mínimo, igual para quem está logado ou não. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader legend={RECEIPT_TEXT.publicPage} />
      <main id="conteudo">{children}</main>
    </>
  );
}
