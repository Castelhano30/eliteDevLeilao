import { API_URL } from "./api-client";

/**
 * GET feito pelo servidor do Next no SSR, sem token e sem cache. `INTERNAL_API_URL` (opcional) serve quando o
 * servidor do web enxerga a API por outro endereço (ex.: Compose). Qualquer falha vira `null`: a página renderiza
 * o esqueleto e o cliente tenta de novo.
 */
export async function serverGet<T>(path: string): Promise<{ status: number; data: T } | null> {
  const base = process.env.INTERNAL_API_URL ?? API_URL;
  try {
    const res = await fetch(`${base}${path}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await res.json().catch(() => null)) as T;
    return { status: res.status, data };
  } catch {
    return null;
  }
}
