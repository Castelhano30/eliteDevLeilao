import { GlobalNotFound } from "@/components/global-states";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Página não encontrada · LanceAuto" };

/** 404 global: rota que não existe em nenhum grupo. Mantém o cabeçalho para a pessoa seguir navegando. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo">
        <GlobalNotFound />
      </main>
    </>
  );
}
