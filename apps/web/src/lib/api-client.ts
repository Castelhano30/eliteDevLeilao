import { errorEnvelopeSchema, type ErrorEnvelope } from "@lanceauto/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | {
      ok: false;
      /** `null` quando nem chegou resposta (rede caiu ou estourou o tempo). */
      status: number | null;
      /** O erro do envelope, quando a API respondeu com ele. */
      error: ErrorEnvelope["error"] | null;
      /** Corpo bruto da resposta, para quem precisa de rotas fora do envelope (ex.: /health). */
      body: unknown;
    };

export interface ApiGetOptions {
  /** Leituras esperam até 15 s: o Render gratuito pode estar acordando. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** GET que nunca lança: falhas de rede e de servidor voltam como objeto (R-0.8). */
export async function apiGet<T>(path: string, { timeoutMs = 15_000, signal }: ApiGetOptions = {}): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const res = await fetch(`${API_URL}${path}`, { signal: controller.signal, headers: { Accept: "application/json" } });
    const body: unknown = await res.json().catch(() => null);
    if (res.ok) return { ok: true, status: res.status, data: body as T };
    const envelope = errorEnvelopeSchema.safeParse(body);
    return { ok: false, status: res.status, error: envelope.success ? envelope.data.error : null, body };
  } catch {
    return { ok: false, status: null, error: null, body: null };
  } finally {
    clearTimeout(timer);
  }
}
