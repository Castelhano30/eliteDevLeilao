import { errorEnvelopeSchema, type ErrorEnvelope } from "@lanceauto/shared";
import { getToken } from "./token";

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

export interface ApiRequestOptions {
  /** Leituras esperam até 15 s; escritas, 20 s. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export type ApiGetOptions = ApiRequestOptions;

type UnauthenticatedHandler = () => void;
let onUnauthenticated: UnauthenticatedHandler | null = null;

/** O AuthProvider registra aqui o que fazer quando a API recusa um token que enviamos (expirado ou órfão). */
export function setUnauthenticatedHandler(handler: UnauthenticatedHandler | null): void {
  onUnauthenticated = handler;
}

async function apiRequest<T>(
  method: "GET" | "POST",
  path: string,
  body: unknown,
  { timeoutMs = method === "GET" ? 15_000 : 20_000, signal }: ApiRequestOptions,
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });
  const token = getToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const parsed: unknown = await res.json().catch(() => null);
    if (res.ok) return { ok: true, status: res.status, data: parsed as T };
    const envelope = errorEnvelopeSchema.safeParse(parsed);
    const error = envelope.success ? envelope.data.error : null;
    // Token enviado e recusado: a sessão acabou. Login e cadastro não enviam token, então não caem aqui.
    if (token && error?.code === "UNAUTHENTICATED") onUnauthenticated?.();
    return { ok: false, status: res.status, error, body: parsed };
  } catch {
    return { ok: false, status: null, error: null, body: null };
  } finally {
    clearTimeout(timer);
  }
}

/** GET que nunca lança: falhas de rede e de servidor voltam como objeto (R-0.8). */
export function apiGet<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  return apiRequest<T>("GET", path, undefined, options);
}

/** POST com corpo JSON; também nunca lança. Leva o token da sessão, se houver. */
export function apiPost<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  return apiRequest<T>("POST", path, body, options);
}
