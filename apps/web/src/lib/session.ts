export type SessionStatus = "loading" | "anon" | "auth" | "error";

export interface SessionInputs {
  /** Já hidratou? O token vive no `localStorage`, que o servidor não vê. */
  hydrated: boolean;
  hasToken: boolean;
  /** O `GET /me` já trouxe o usuário. */
  hasUser: boolean;
  /** O `GET /me` esgotou as tentativas sem trazer o usuário (API fora do ar, por exemplo). */
  failed: boolean;
}

/**
 * Estado da sessão. Com token e sem usuário, "loading" só vale enquanto o `/me` ainda tenta: esgotadas as
 * tentativas vira "error", para a tela oferecer "Tentar novamente" em vez de ficar em "Carregando…" para sempre.
 */
export function deriveSessionStatus({ hydrated, hasToken, hasUser, failed }: SessionInputs): SessionStatus {
  if (!hydrated) return "loading";
  if (!hasToken) return "anon";
  if (hasUser) return "auth";
  return failed ? "error" : "loading";
}
