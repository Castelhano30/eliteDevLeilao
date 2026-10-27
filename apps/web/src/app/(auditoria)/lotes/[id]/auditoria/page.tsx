import { AuditScreen } from "@/components/audit/audit-screen";

export const metadata = { title: "Auditoria do lote · LanceAuto", robots: "noindex" };

/**
 * Auditoria pública do lote (S08 §9). Renderizada no cliente: a verificação é uma chamada de verdade e o estado
 * "Verificando" também. O título da aba ganha o número do lote quando a resposta chega.
 */
export default async function AuditoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuditScreen id={id} />;
}
