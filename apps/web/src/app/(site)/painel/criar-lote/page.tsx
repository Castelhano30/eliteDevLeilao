import { CriarLoteForm } from "@/components/criar-lote-form";
import { RequireAuth } from "@/components/require-auth";

export const metadata = { title: "Criar lote · LanceAuto" };

export default function CriarLotePage() {
  return (
    <RequireAuth role="AUCTIONEER">
      <CriarLoteForm />
    </RequireAuth>
  );
}
