import { auditViewSchema, type AuditView } from "@lanceauto/shared";
import { apiGet } from "./api-client";
import { MIN_VERIFYING_MS } from "./audit-view";

export const auditKey = (id: string) => ["audit", id] as const;

/** 404: o lote não existe (ou o id é inválido). Nada interno vai à tela. */
export class AuditNotFoundError extends Error {}

/** Qualquer outra falha: rede, 5xx, 429 ou corpo fora do contrato. `rateLimited` leva a mensagem do servidor à tela. */
export class AuditRequestError extends Error {
  constructor(
    message: string,
    readonly rateLimited = false,
  ) {
    super(message);
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `GET /lots/:id/audit` (S08). A resposta só vale depois de `MIN_VERIFYING_MS`: o estado "Verificando" precisa
 * ser perceptível, mesmo com a API respondendo na hora. Os 400 ms correm junto com a chamada, não depois dela.
 */
export async function fetchAudit(id: string, signal?: AbortSignal): Promise<AuditView> {
  const [result] = await Promise.all([apiGet<unknown>(`/lots/${encodeURIComponent(id)}/audit`, { signal }), wait(MIN_VERIFYING_MS)]);
  if (result.ok) {
    const parsed = auditViewSchema.safeParse(result.data);
    if (parsed.success) return parsed.data;
    throw new AuditRequestError("Resposta fora do formato esperado.");
  }
  if (result.status === 404) throw new AuditNotFoundError();
  if (result.status === 429) throw new AuditRequestError(result.error?.message ?? "Muitas requisições.", true);
  throw new AuditRequestError(result.error?.message ?? "Falha de rede.");
}
